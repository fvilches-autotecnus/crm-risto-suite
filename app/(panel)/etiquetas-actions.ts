'use server'

import { revalidatePath } from 'next/cache'
import { getContexto, type Contexto } from '@/lib/context'
import { agregarEtiquetaBC, buscarSuscriptor, etiquetasBC, quitarEtiquetaBC, textoErrorBC } from '@/lib/botconversa'
import { claveBC } from '@/lib/etiquetas'
import { createAdminClient } from '@/lib/supabase/server'
import type { ActionResult } from './actions'

const fail = (error: string): ActionResult => ({ ok: false, error })
const text = (fd: FormData, k: string) => String(fd.get(k) ?? '').trim()
const refrescar = () => revalidatePath('/', 'layout')
const UUID = /^[0-9a-f-]{36}$/i
const norm = (s: string) => s.trim().toLowerCase()

interface Entrada { clienteId?: string; telefono?: string; nombre?: string; etiquetaId?: string; etiquetaNueva?: string }

/**
 * Le pone una etiqueta a un cliente (por id) o a un número (crea el cliente si no existe).
 * Negocio con BotConversa: primero se aplica en BotConversa (si no se puede, no se guarda nada) y después se espeja acá.
 * Negocio sin BotConversa: la etiqueta vive solo en el CRM (y se crea al vuelo si es nueva).
 */
async function aplicar(ctx: Contexto, e: Entrada): Promise<ActionResult> {
  if (!ctx.puedeEscribir) return fail('Tu usuario es de solo lectura')
  const { supabase, negocio } = ctx
  const clave = await claveBC(negocio.id)

  // 1) cliente (el existente, o el número a crear más abajo)
  let cliente: { id: string; telefono: string | null } | null = null
  let telefono: string | null = null
  if (e.clienteId) {
    if (!UUID.test(e.clienteId)) return fail('Cliente no válido')
    const { data } = await supabase.from('clientes').select('id, telefono').eq('id', e.clienteId).eq('negocio_id', negocio.id).maybeSingle()
    if (!data) return fail('El cliente no existe')
    cliente = data; telefono = data.telefono
  } else {
    telefono = (e.telefono ?? '').replace(/\D/g, '')
    if (telefono.length < 6 || telefono.length > 20) return fail('Ingresá un teléfono válido (con código de país)')
    const { data } = await supabase.from('clientes').select('id, telefono').eq('negocio_id', negocio.id).eq('telefono', telefono).maybeSingle()
    cliente = data
  }

  // 2) etiqueta (existente, o nueva en negocios sin BotConversa)
  const { data: catalogo } = await supabase.from('etiquetas').select('id, nombre, bc_tag_id').eq('negocio_id', negocio.id)
  let etiqueta = e.etiquetaId ? (catalogo ?? []).find((x) => x.id === e.etiquetaId) : undefined
  if (!etiqueta && !e.etiquetaId) {
    const nombre = (e.etiquetaNueva ?? '').trim().replace(/\s+/g, ' ')
    if (!nombre) return fail('Elegí una etiqueta')
    if (nombre.length > 60) return fail('El nombre de la etiqueta es demasiado largo (máximo 60 caracteres)')
    etiqueta = (catalogo ?? []).find((x) => norm(x.nombre) === norm(nombre))
    if (!etiqueta) {
      if (clave) return fail('En este negocio las etiquetas vienen de BotConversa: importalas desde Configuración')
      const { data: nueva, error } = await supabase.from('etiquetas').insert({ negocio_id: negocio.id, nombre }).select('id, nombre, bc_tag_id').single()
      if (error || !nueva) return fail('No se pudo crear la etiqueta')
      etiqueta = nueva
    }
  }
  if (!etiqueta) return fail('La etiqueta no existe')

  // 3) BotConversa
  if (clave) {
    if (!telefono) return fail('El cliente no tiene teléfono: no se puede etiquetar en BotConversa')
    if (!etiqueta.bc_tag_id) return fail('Esa etiqueta no está vinculada a BotConversa: importá las etiquetas desde Configuración')
    const s = await buscarSuscriptor(clave, telefono)
    if (!s.ok || s.datos === undefined) return fail(textoErrorBC(s))
    const r = await agregarEtiquetaBC(clave, s.datos, etiqueta.bc_tag_id)
    if (!r.ok) return fail(textoErrorBC(r))
  }

  // 4) el CRM (crea el cliente si hacía falta)
  if (!cliente) {
    const { data: nuevo, error } = await supabase.from('clientes').insert({ negocio_id: negocio.id, nombre: (e.nombre ?? '').trim() || 'Sin nombre', telefono, canal_origen: 'manual' }).select('id, telefono').single()
    if (error || !nuevo) return fail('No se pudo crear el cliente')
    cliente = nuevo
  }
  const { error } = await supabase.from('cliente_etiquetas').insert({ cliente_id: cliente.id, etiqueta_id: etiqueta.id, negocio_id: negocio.id, origen: clave ? 'botconversa' : 'crm' })
  if (error && error.code !== '23505') return fail('No se pudo guardar la etiqueta')
  refrescar()
  return { ok: true }
}

export async function etiquetarCliente(clienteId: string, etiquetaId: string | null, etiquetaNueva?: string): Promise<ActionResult> {
  return aplicar(await getContexto(), { clienteId, etiquetaId: etiquetaId ?? undefined, etiquetaNueva })
}

/** Formulario "Etiquetar un número": teléfono, nombre (si es nuevo) y etiqueta existente o nueva. */
export async function etiquetarNumero(_prev: ActionResult | null, fd: FormData): Promise<ActionResult> {
  const sel = text(fd, 'etiqueta_id')
  return aplicar(await getContexto(), { telefono: text(fd, 'telefono'), nombre: text(fd, 'nombre'), etiquetaId: sel && sel !== '__nueva' ? sel : undefined, etiquetaNueva: sel === '__nueva' ? text(fd, 'etiqueta_nueva') : undefined })
}

export async function quitarEtiquetaCliente(clienteId: string, etiquetaId: string): Promise<ActionResult> {
  const ctx = await getContexto()
  if (!ctx.puedeEscribir) return fail('Tu usuario es de solo lectura')
  if (!UUID.test(clienteId) || !UUID.test(etiquetaId)) return fail('Dato no válido')
  const { supabase, negocio } = ctx
  const [{ data: cliente }, { data: etiqueta }] = await Promise.all([
    supabase.from('clientes').select('id, telefono').eq('id', clienteId).eq('negocio_id', negocio.id).maybeSingle(),
    supabase.from('etiquetas').select('id, bc_tag_id').eq('id', etiquetaId).eq('negocio_id', negocio.id).maybeSingle(),
  ])
  if (!cliente || !etiqueta) return fail('La etiqueta o el cliente no existen')
  const clave = await claveBC(negocio.id)
  if (clave && cliente.telefono && etiqueta.bc_tag_id) {
    const s = await buscarSuscriptor(clave, cliente.telefono)
    if (s.ok && s.datos !== undefined) {
      const r = await quitarEtiquetaBC(clave, s.datos, etiqueta.bc_tag_id)
      if (!r.ok) return fail(textoErrorBC(r))
    } else if (s.error !== 'no_encontrado') return fail(textoErrorBC(s))   // si el número ya no está en BotConversa, igual se quita acá
  }
  const { error } = await supabase.from('cliente_etiquetas').delete().eq('cliente_id', clienteId).eq('etiqueta_id', etiquetaId)
  if (error) return fail('No se pudo quitar la etiqueta')
  refrescar()
  return { ok: true }
}

export async function eliminarEtiqueta(id: string): Promise<ActionResult> {
  const ctx = await getContexto()
  if (!ctx.puedeAdministrar) return fail('Solo un dueño o administrador puede eliminar etiquetas')
  if (!ctx.sinRestriccionSede) return fail('Las etiquetas son de todo el negocio y tu usuario no tiene acceso a ellas')
  if (!UUID.test(id)) return fail('Etiqueta no válida')
  const { error } = await ctx.supabase.from('etiquetas').delete().eq('id', id).eq('negocio_id', ctx.negocio.id)
  if (error) return fail('No se pudo eliminar la etiqueta')
  refrescar()
  return { ok: true }
}

// ---------------------------------------------------------------------------
// Integración con BotConversa (solo superadmin; la clave no vuelve nunca al navegador)
// ---------------------------------------------------------------------------
export async function guardarBotconversa(_prev: ActionResult | null, fd: FormData): Promise<ActionResult> {
  const ctx = await getContexto()
  if (!ctx.esSuperadmin) return fail('Solo un superadmin puede configurar la integración con BotConversa')
  const admin = createAdminClient()
  const activo = fd.get('activo') === 'on'
  const clave = text(fd, 'clave')
  const { data: actual } = await admin.from('negocios_integraciones').select('botconversa_api_key').eq('negocio_id', ctx.negocio.id).maybeSingle()
  const quitar = fd.get('quitar_clave') === 'on'
  if (clave && (clave.length < 8 || clave.length > 200 || /\s/.test(clave))) return fail('La clave de la API no parece válida')
  const tendra = quitar ? '' : clave || actual?.botconversa_api_key || ''
  if (activo && !tendra) return fail('Cargá la clave de la API de BotConversa para activar la integración')
  const fila: Record<string, unknown> = { negocio_id: ctx.negocio.id, botconversa_activo: activo, actualizado_en: new Date().toISOString() }
  if (quitar) fila.botconversa_api_key = null
  else if (clave) fila.botconversa_api_key = clave
  const { error } = await admin.from('negocios_integraciones').upsert(fila, { onConflict: 'negocio_id' })
  if (error) return fail('No se pudo guardar')
  refrescar()
  return { ok: true }
}

async function claveGuardada(negocioId: string): Promise<string | null> {
  const { data } = await createAdminClient().from('negocios_integraciones').select('botconversa_api_key').eq('negocio_id', negocioId).maybeSingle()
  return data?.botconversa_api_key ?? null
}

/** Prueba la clave guardada pidiéndole a BotConversa su lista de etiquetas. cantidad = etiquetas que hay en BotConversa. */
export async function probarBotconversa(): Promise<ActionResult> {
  const ctx = await getContexto()
  if (!ctx.esSuperadmin) return fail('Solo un superadmin puede probar la conexión')
  const clave = await claveGuardada(ctx.negocio.id)
  if (!clave) return fail('Todavía no cargaste la clave de la API')
  const r = await etiquetasBC(clave)
  return r.ok ? { ok: true, cantidad: r.datos?.length ?? 0 } : fail(textoErrorBC(r))
}

/** Trae las etiquetas de BotConversa al catálogo del negocio (las nuevas se crean; las que ya existían con ese nombre se vinculan). */
export async function importarEtiquetasBotconversa(): Promise<ActionResult> {
  const ctx = await getContexto()
  if (!ctx.puedeAdministrar) return fail('Solo un dueño o administrador puede importar etiquetas')
  const clave = await claveBC(ctx.negocio.id)
  if (!clave) return fail('La integración con BotConversa no está activa en este negocio')
  const r = await etiquetasBC(clave)
  if (!r.ok || !r.datos) return fail(textoErrorBC(r))
  const admin = createAdminClient()
  const { data: existentes } = await admin.from('etiquetas').select('id, nombre, bc_tag_id').eq('negocio_id', ctx.negocio.id)
  const porNombre = new Map((existentes ?? []).map((x) => [norm(x.nombre), x]))
  let cantidad = 0
  const nuevas: { negocio_id: string; nombre: string; bc_tag_id: number }[] = []
  for (const t of r.datos) {
    const nombre = t.name.trim().replace(/\s+/g, ' ').slice(0, 60)
    if (!nombre) continue
    const ya = porNombre.get(norm(nombre))
    if (!ya) { nuevas.push({ negocio_id: ctx.negocio.id, nombre, bc_tag_id: t.id }); porNombre.set(norm(nombre), { id: '', nombre, bc_tag_id: t.id }); cantidad++ }
    else if (ya.bc_tag_id !== t.id && ya.id) { await admin.from('etiquetas').update({ bc_tag_id: t.id }).eq('id', ya.id); cantidad++ }
  }
  if (nuevas.length) {
    const { error } = await admin.from('etiquetas').insert(nuevas)
    if (error) return fail('No se pudieron importar las etiquetas')
  }
  refrescar()
  return { ok: true, cantidad }
}
