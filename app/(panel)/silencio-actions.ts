'use server'

import { revalidatePath } from 'next/cache'
import { getContexto } from '@/lib/context'
import { buscarSuscriptor, enviarFlujoBC, etiquetasBC, flujosBC, textoErrorBC } from '@/lib/botconversa'
import { cuentaBCUsable } from '@/lib/etiquetas'
import { CLAVES_FLUJO, OPCIONES_SILENCIO, TITULO_FLUJO, leerFlujos, type ClaveFlujo } from '@/lib/silencio'
import { createAdminClient } from '@/lib/supabase/server'
import type { ActionResult } from './actions'

const fail = (error: string): ActionResult => ({ ok: false, error })
const UUID = /^[0-9a-f-]{36}$/i
const text = (fd: FormData, k: string) => String(fd.get(k) ?? '').trim()

type Admin = ReturnType<typeof createAdminClient>
/** El código de suscriptor y el estado de silencio de un cliente en una cuenta de BotConversa (sucursalId null = la del negocio). */
const filaCuenta = (admin: Admin, clienteId: string, sucursalId: string | null) => {
  const q = admin.from('cliente_botconversa').select('id, suscriptor_id').eq('cliente_id', clienteId)
  return (sucursalId ? q.eq('sucursal_id', sucursalId) : q.is('sucursal_id', null)).maybeSingle()
}

/**
 * Silenciar o reactivar al bot de BotConversa para un cliente, en la cuenta de una sede (o en la del negocio si sucursalId es null):
 * se le manda al suscriptor el flujo elegido. El código del suscriptor (que es de cada cuenta) se guarda la primera vez que se lo busca
 * por teléfono. Solo si BotConversa acepta el flujo se anota el estado en el CRM (el tiempo lo cuenta el propio flujo).
 */
export async function cambiarSilencioBot(clienteId: string, clave: ClaveFlujo, sucursalId: string | null): Promise<ActionResult> {
  const ctx = await getContexto()
  if (!ctx.puedeSilenciarBot) return fail('Solo un encargado, administrador o dueño puede silenciar al bot')
  const opcion = OPCIONES_SILENCIO.find((o) => o.clave === clave)
  if (!opcion || !UUID.test(clienteId) || (sucursalId !== null && !UUID.test(sucursalId))) return fail('Dato no válido')
  if (sucursalId && !ctx.sedesGestion.some((s) => s.id === sucursalId)) return fail('No tenés acceso a esa sede')
  const { negocio, supabase } = ctx
  const { data: cliente } = await supabase.from('clientes').select('id, telefono').eq('id', clienteId).eq('negocio_id', negocio.id).maybeSingle()
  if (!cliente) return fail('El cliente no existe')
  if (!cliente.telefono) return fail('El cliente no tiene teléfono: no se lo puede buscar en BotConversa')
  const cuenta = await cuentaBCUsable(negocio.id, sucursalId)
  if (!cuenta) return fail('La integración con BotConversa no está activa para esa sede')
  const flujoId = cuenta.flujos[clave]
  if (!flujoId) return fail(`Todavía no se configuró el flujo “${TITULO_FLUJO[clave]}” (Configuración → Funciones y módulos)`)

  const admin = createAdminClient()
  const previa = (await filaCuenta(admin, cliente.id, sucursalId)).data
  let suscriptor: number | null = previa?.suscriptor_id == null ? null : Number(previa.suscriptor_id)
  const buscar = async (): Promise<ActionResult | null> => {
    const s = await buscarSuscriptor(cuenta.clave, cliente.telefono!)
    if (!s.ok || s.datos === undefined) return fail(textoErrorBC(s))
    suscriptor = s.datos
    return null
  }
  if (suscriptor === null) { const e = await buscar(); if (e) return e }
  let r = await enviarFlujoBC(cuenta.clave, suscriptor!, flujoId)
  // el código guardado puede haber quedado viejo (el suscriptor se recreó): se busca de nuevo por teléfono y se reintenta una vez
  if (!r.ok && r.error === 'no_encontrado' && previa?.suscriptor_id != null) {
    const e = await buscar(); if (e) return e
    r = await enviarFlujoBC(cuenta.clave, suscriptor!, flujoId)
  }
  if (!r.ok) return fail(r.error === 'no_encontrado' ? 'BotConversa no encontró a este cliente' : textoErrorBC(r))

  const ahora = new Date()
  const silencia = clave !== 'reactivar'
  const datos = {
    suscriptor_id: suscriptor,
    bot_silenciado_en: silencia ? ahora.toISOString() : null,
    bot_silenciado_hasta: silencia && opcion.horas ? new Date(ahora.getTime() + opcion.horas * 3600_000).toISOString() : null,
    actualizado_en: ahora.toISOString(),
  }
  const { error } = previa
    ? await admin.from('cliente_botconversa').update(datos).eq('id', previa.id)
    : await admin.from('cliente_botconversa').insert({ ...datos, negocio_id: negocio.id, cliente_id: cliente.id, sucursal_id: sucursalId })
  if (error) return fail('BotConversa aceptó el flujo, pero no se pudo anotar el estado en el CRM')
  revalidatePath(`/clientes/${cliente.id}`)
  return { ok: true }
}

// ---------------------------------------------------------------------------
// Configuración (solo superadmin, como el resto de la integración): los cuatro flujos
// ---------------------------------------------------------------------------
async function claveGuardada(negocioId: string, sucursalId: string | null): Promise<string | null> {
  const admin = createAdminClient()
  const { data } = sucursalId
    ? await admin.from('sedes_integraciones').select('botconversa_api_key').eq('negocio_id', negocioId).eq('sucursal_id', sucursalId).maybeSingle()
    : await admin.from('negocios_integraciones').select('botconversa_api_key').eq('negocio_id', negocioId).maybeSingle()
  return data?.botconversa_api_key ?? null
}

/** Los flujos que hay en BotConversa (de la cuenta de la sede, o de la del negocio), para elegir cuál es cada uno. */
export async function listarFlujosBotconversa(sucursalId: string | null = null): Promise<{ ok: true; flujos: { id: number; name: string }[] } | { ok: false; error: string }> {
  const ctx = await getContexto()
  if (!ctx.esSuperadmin) return { ok: false, error: 'Solo un superadmin puede configurar los flujos de BotConversa' }
  if (sucursalId !== null && !UUID.test(sucursalId)) return { ok: false, error: 'Sede no válida' }
  const apiKey = await claveGuardada(ctx.negocio.id, sucursalId)
  if (!apiKey) return { ok: false, error: 'Primero guardá la clave de la API de BotConversa' }
  const r = await flujosBC(apiKey)
  if (!r.ok || !r.datos) return { ok: false, error: textoErrorBC(r) }
  return { ok: true, flujos: r.datos.sort((a, b) => a.name.localeCompare(b.name, 'es')) }
}

/** Lee del formulario los ids de los cuatro flujos (uno vacío = sin configurar). */
function leerFlujosForm(fd: FormData): { flujos: Record<string, number> } | { error: string } {
  const flujos: Record<string, number> = {}
  for (const c of CLAVES_FLUJO) {
    const t = text(fd, `flujo_${c}`)
    if (!t) continue
    if (!/^\d{1,12}$/.test(t) || Number(t) <= 0) return { error: `El id del flujo “${TITULO_FLUJO[c]}” no es válido (es un número)` }
    flujos[c] = Number(t)
  }
  const usados = Object.values(flujos)
  if (new Set(usados).size !== usados.length) return { error: 'Cada acción tiene que usar un flujo distinto' }
  return { flujos: leerFlujos(flujos) }
}

/** Guarda los ids de los flujos de la cuenta del negocio. */
export async function guardarFlujosSilencio(_prev: ActionResult | null, fd: FormData): Promise<ActionResult> {
  const ctx = await getContexto()
  if (!ctx.esSuperadmin) return fail('Solo un superadmin puede configurar los flujos de BotConversa')
  const f = leerFlujosForm(fd)
  if ('error' in f) return fail(f.error)
  const { error } = await createAdminClient().from('negocios_integraciones').upsert({ negocio_id: ctx.negocio.id, botconversa_flujos: f.flujos, actualizado_en: new Date().toISOString() }, { onConflict: 'negocio_id' })
  if (error) return fail('No se pudo guardar')
  revalidatePath('/', 'layout')
  return { ok: true }
}

/** Guarda la cuenta de BotConversa de una sede: si está activa, su clave de API y sus cuatro flujos. */
export async function guardarBotconversaSede(_prev: ActionResult | null, fd: FormData): Promise<ActionResult> {
  const ctx = await getContexto()
  if (!ctx.esSuperadmin) return fail('Solo un superadmin puede configurar BotConversa')
  const sucursalId = text(fd, 'sucursal_id')
  if (!UUID.test(sucursalId) || !ctx.sedesTodas.some((s) => s.id === sucursalId)) return fail('Sede no válida')
  const f = leerFlujosForm(fd)
  if ('error' in f) return fail(f.error)
  const admin = createAdminClient()
  const activo = fd.get('activo') === 'on'
  const clave = text(fd, 'clave')
  if (clave && (clave.length < 8 || clave.length > 200 || /\s/.test(clave))) return fail('La clave de la API no parece válida')
  const quitar = fd.get('quitar_clave') === 'on'
  const actual = await claveGuardada(ctx.negocio.id, sucursalId)
  if (activo && !(quitar ? '' : clave || actual)) return fail('Cargá la clave de la API de BotConversa de esta sede para activarla')
  const fila: Record<string, unknown> = { sucursal_id: sucursalId, negocio_id: ctx.negocio.id, botconversa_activo: activo, botconversa_flujos: f.flujos, actualizado_en: new Date().toISOString() }
  if (quitar) fila.botconversa_api_key = null
  else if (clave) fila.botconversa_api_key = clave
  const { error } = await admin.from('sedes_integraciones').upsert(fila, { onConflict: 'sucursal_id' })
  if (error) return fail('No se pudo guardar')
  revalidatePath('/', 'layout')
  return { ok: true }
}

/** Prueba la clave guardada de la sede pidiéndole a BotConversa su lista de etiquetas. cantidad = etiquetas que hay. */
export async function probarBotconversaSede(sucursalId: string): Promise<ActionResult> {
  const ctx = await getContexto()
  if (!ctx.esSuperadmin) return fail('Solo un superadmin puede probar la conexión')
  if (!UUID.test(sucursalId)) return fail('Sede no válida')
  const clave = await claveGuardada(ctx.negocio.id, sucursalId)
  if (!clave) return fail('Todavía no cargaste la clave de la API de esta sede')
  const r = await etiquetasBC(clave)
  return r.ok ? { ok: true, cantidad: r.datos?.length ?? 0 } : fail(textoErrorBC(r))
}
