'use server'

import { revalidatePath } from 'next/cache'
import { getContexto } from '@/lib/context'
import { buscarSuscriptor, enviarFlujoBC, flujosBC, textoErrorBC } from '@/lib/botconversa'
import { claveBC, flujosSilencio } from '@/lib/etiquetas'
import { CLAVES_FLUJO, OPCIONES_SILENCIO, TITULO_FLUJO, leerFlujos, type ClaveFlujo } from '@/lib/silencio'
import { createAdminClient } from '@/lib/supabase/server'
import type { ActionResult } from './actions'

const fail = (error: string): ActionResult => ({ ok: false, error })
const UUID = /^[0-9a-f-]{36}$/i

/**
 * Silenciar o reactivar al bot de BotConversa para un cliente: se le manda al suscriptor el flujo elegido.
 * El código del suscriptor se guarda en el cliente la primera vez que se lo busca por teléfono. Solo si BotConversa acepta el flujo
 * se anota el estado en el CRM (el tiempo lo cuenta el propio flujo).
 */
export async function cambiarSilencioBot(clienteId: string, clave: ClaveFlujo): Promise<ActionResult> {
  const ctx = await getContexto()
  if (!ctx.puedeSilenciarBot) return fail('Solo un encargado, administrador o dueño puede silenciar al bot')
  const opcion = OPCIONES_SILENCIO.find((o) => o.clave === clave)
  if (!opcion || !UUID.test(clienteId)) return fail('Dato no válido')
  const { negocio, supabase } = ctx
  const { data: cliente } = await supabase.from('clientes').select('id, telefono, botconversa_suscriptor_id').eq('id', clienteId).eq('negocio_id', negocio.id).maybeSingle()
  if (!cliente) return fail('El cliente no existe')
  if (!cliente.telefono) return fail('El cliente no tiene teléfono: no se lo puede buscar en BotConversa')
  const apiKey = await claveBC(negocio.id)
  if (!apiKey) return fail('La integración con BotConversa no está activa en este negocio')
  const flujoId = (await flujosSilencio(negocio.id))[clave]
  if (!flujoId) return fail(`Todavía no se configuró el flujo “${TITULO_FLUJO[clave]}” (Configuración → Funciones y módulos)`)

  const admin = createAdminClient()
  let suscriptor: number | null = cliente.botconversa_suscriptor_id === null ? null : Number(cliente.botconversa_suscriptor_id)
  const buscar = async (): Promise<ActionResult | null> => {
    const s = await buscarSuscriptor(apiKey, cliente.telefono!)
    if (!s.ok || s.datos === undefined) return fail(textoErrorBC(s))
    suscriptor = s.datos
    await admin.from('clientes').update({ botconversa_suscriptor_id: s.datos }).eq('id', cliente.id).eq('negocio_id', negocio.id)
    return null
  }
  if (suscriptor === null) { const e = await buscar(); if (e) return e }
  let r = await enviarFlujoBC(apiKey, suscriptor!, flujoId)
  // el código guardado puede haber quedado viejo (el suscriptor se recreó): se busca de nuevo por teléfono y se reintenta una vez
  if (!r.ok && r.error === 'no_encontrado' && cliente.botconversa_suscriptor_id !== null) {
    const e = await buscar(); if (e) return e
    r = await enviarFlujoBC(apiKey, suscriptor!, flujoId)
  }
  if (!r.ok) return fail(r.error === 'no_encontrado' ? 'BotConversa no encontró a este cliente' : textoErrorBC(r))

  const ahora = new Date()
  const silencia = clave !== 'reactivar'
  const { error } = await admin.from('clientes').update({
    bot_silenciado_en: silencia ? ahora.toISOString() : null,
    bot_silenciado_hasta: silencia && opcion.horas ? new Date(ahora.getTime() + opcion.horas * 3600_000).toISOString() : null,
  }).eq('id', cliente.id).eq('negocio_id', negocio.id)
  if (error) return fail('BotConversa aceptó el flujo, pero no se pudo anotar el estado en el CRM')
  revalidatePath(`/clientes/${cliente.id}`)
  return { ok: true }
}

// ---------------------------------------------------------------------------
// Configuración (solo superadmin, como el resto de la integración): los cuatro flujos
// ---------------------------------------------------------------------------
async function claveGuardada(negocioId: string): Promise<string | null> {
  const { data } = await createAdminClient().from('negocios_integraciones').select('botconversa_api_key').eq('negocio_id', negocioId).maybeSingle()
  return data?.botconversa_api_key ?? null
}

/** Los flujos que hay en BotConversa, para elegir cuál es cada uno. */
export async function listarFlujosBotconversa(): Promise<{ ok: true; flujos: { id: number; name: string }[] } | { ok: false; error: string }> {
  const ctx = await getContexto()
  if (!ctx.esSuperadmin) return { ok: false, error: 'Solo un superadmin puede configurar los flujos de BotConversa' }
  const apiKey = await claveGuardada(ctx.negocio.id)
  if (!apiKey) return { ok: false, error: 'Primero cargá la clave de la API de BotConversa' }
  const r = await flujosBC(apiKey)
  if (!r.ok || !r.datos) return { ok: false, error: textoErrorBC(r) }
  return { ok: true, flujos: r.datos.sort((a, b) => a.name.localeCompare(b.name, 'es')) }
}

/** Guarda los ids de los flujos (uno vacío = sin configurar). */
export async function guardarFlujosSilencio(_prev: ActionResult | null, fd: FormData): Promise<ActionResult> {
  const ctx = await getContexto()
  if (!ctx.esSuperadmin) return fail('Solo un superadmin puede configurar los flujos de BotConversa')
  const flujos: Record<string, number> = {}
  for (const c of CLAVES_FLUJO) {
    const t = String(fd.get(`flujo_${c}`) ?? '').trim()
    if (!t) continue
    if (!/^\d{1,12}$/.test(t) || Number(t) <= 0) return fail(`El id del flujo “${TITULO_FLUJO[c]}” no es válido (es un número)`)
    flujos[c] = Number(t)
  }
  const usados = Object.values(flujos)
  if (new Set(usados).size !== usados.length) return fail('Cada acción tiene que usar un flujo distinto')
  const { error } = await createAdminClient().from('negocios_integraciones').upsert({ negocio_id: ctx.negocio.id, botconversa_flujos: leerFlujos(flujos), actualizado_en: new Date().toISOString() }, { onConflict: 'negocio_id' })
  if (error) return fail('No se pudo guardar')
  revalidatePath('/', 'layout')
  return { ok: true }
}
