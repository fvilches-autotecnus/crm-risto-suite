'use server'

import { revalidatePath } from 'next/cache'
import { getContexto } from '@/lib/context'
import { ESTADOS_PEDIDO, mensajeError } from '@/lib/pedidos'
import { validarHorarios } from '@/lib/pedidos-horarios'
import { createAdminClient } from '@/lib/supabase/server'
import type { ActionResult } from './actions'

const fail = (error: string): ActionResult => ({ ok: false, error })
const text = (fd: FormData, k: string) => String(fd.get(k) ?? '').trim()
const UUID = /^[0-9a-f-]{36}$/i
const refrescar = (slug: string) => { revalidatePath('/pedidos'); revalidatePath(`/carta/${slug}`) }

async function permiso(ajustes = false) {
  const ctx = await getContexto()
  if (!ctx.modulosActivos.pedidos) return { ctx, error: 'Este negocio no tiene el módulo de Pedidos' }
  if (!ctx.puedeEscribir) return { ctx, error: 'Tu usuario es de solo lectura' }
  if (ajustes && !(ctx.puedeAdministrar || ctx.rol === 'encargado')) return { ctx, error: 'Solo dueños, administradores y encargados pueden cambiar los ajustes de pedidos' }
  return { ctx, error: null as string | null }
}

/** "1.500,50" / "1500.5" / "$ 1500" → número ≥ 0; vacío → 0; inválido → NaN. */
function leerMonto(t: string): number {
  const s = t.replace(/[$\s]/g, '')
  if (!s) return 0
  const miles = /^\d{1,3}(\.\d{3})+(,\d+)?$/.test(s)   // "1.500" = mil quinientos (formato argentino)
  const n = Number(miles || s.includes(',') ? s.replace(/\./g, '').replace(',', '.') : s)
  return Number.isFinite(n) && n >= 0 && n <= 10_000_000 ? Math.round(n * 100) / 100 : NaN
}

export async function cambiarEstadoPedido(id: string, estado: string, motivo?: string): Promise<ActionResult> {
  const { ctx, error } = await permiso(); if (error) return fail(error)
  if (!UUID.test(id) || !ESTADOS_PEDIDO.some((e) => e.value === estado)) return fail('Pedido o estado no válido')
  const m = (motivo ?? '').trim().slice(0, 200)
  const { data, error: e } = await ctx.supabase.from('pedidos').update({ estado, motivo_cancelacion: estado === 'cancelado' ? m || null : null }).eq('id', id).eq('negocio_id', ctx.negocio.id).select('id').maybeSingle()
  if (e || !data) return fail('No se pudo cambiar el estado del pedido')
  refrescar(ctx.negocio.slug)
  return { ok: true }
}

/** Los ajustes de pedidos son del negocio entero (no de una sede): solo los cambia quien tiene todas las sedes. */
async function permisoAjustes() {
  const r = await permiso(true)
  if (!r.error && !r.ctx.sinRestriccionSede) return { ...r, error: 'Los ajustes de pedidos son de todo el negocio: tu usuario tiene acceso a algunas sedes solamente' }
  return r
}
type Ctx = Awaited<ReturnType<typeof permiso>>['ctx']
const guardar = async (ctx: Ctx, cambios: Record<string, unknown>): Promise<ActionResult> => {
  const { error: e } = await ctx.supabase.from('pedidos_config').upsert({ negocio_id: ctx.negocio.id, ...cambios })
  if (e) return fail('No se pudieron guardar los ajustes')
  refrescar(ctx.negocio.slug)
  return { ok: true }
}
const limpio = (v: unknown, n: number) => String(v ?? '').trim().slice(0, n)
const RE_FECHA = /^\d{4}-\d{2}-\d{2}$/
const RE_CLAVE = /^[a-z0-9_]{1,40}$/

export interface AjustesGenerales { recibe: boolean; pedido_minimo: string; tiempo_estimado: string; mensaje: string; aceptar_auto: boolean }
/** Recepción de pedidos: interruptor general, pedido mínimo, tiempo estimado, mensaje para el cliente y aceptación automática. */
export async function guardarPedidosGeneral(d: AjustesGenerales): Promise<ActionResult> {
  const { ctx, error } = await permisoAjustes(); if (error) return fail(error)
  const minimo = leerMonto(limpio(d.pedido_minimo, 20))
  if (Number.isNaN(minimo)) return fail('El pedido mínimo no es válido (ej. 5000)')
  if (d.recibe) {
    const { count } = await ctx.supabase.from('pedido_entregas').select('clave', { count: 'exact', head: true }).eq('negocio_id', ctx.negocio.id).eq('activo', true)
    if ((count ?? 0) === 0) return fail('Para recibir pedidos activá al menos una forma de entrega (en “Formas de entrega”)')
  }
  const tiempo = limpio(d.tiempo_estimado, 61), mensaje = limpio(d.mensaje, 301)
  if (tiempo.length > 60) return fail('El tiempo estimado puede tener hasta 60 letras')
  if (mensaje.length > 300) return fail('El mensaje puede tener hasta 300 letras')
  return guardar(ctx, { recibe: !!d.recibe, pedido_minimo: minimo, tiempo_estimado: tiempo || null, mensaje: mensaje || null, aceptar_auto: !!d.aceptar_auto })
}

export interface AjustesHorarios { usar_horarios: boolean; horarios: unknown; fechas_cerradas: string[]; mensaje_cerrado: string }
/** Cuándo se reciben pedidos: franjas por día de la semana y los días en que no se toman. (Cada forma de entrega puede tener las suyas.) */
export async function guardarPedidosHorarios(d: AjustesHorarios): Promise<ActionResult> {
  const { ctx, error } = await permisoAjustes(); if (error) return fail(error)
  const gen = validarHorarios(d.horarios); if (!gen.ok) return fail(gen.error)
  if (d.usar_horarios && Object.keys(gen.horarios).length === 0) return fail('Cargá al menos una franja horaria, o apagá “Recibir pedidos solo en ciertos horarios”')
  const fechas = [...new Set((Array.isArray(d.fechas_cerradas) ? d.fechas_cerradas : []).map((f) => String(f)))]
  if (fechas.length > 120 || fechas.some((f) => !RE_FECHA.test(f) || Number.isNaN(Date.parse(f + 'T12:00:00Z')))) return fail('Alguna de las fechas sin pedidos no es válida')
  const cerrado = limpio(d.mensaje_cerrado, 301); if (cerrado.length > 300) return fail('El mensaje de “fuera de horario” puede tener hasta 300 letras')
  return guardar(ctx, { usar_horarios: !!d.usar_horarios, horarios: gen.horarios, fechas_cerradas: fechas.sort(), mensaje_cerrado: cerrado || null })
}

export interface FilaEntrega { clave: string; etiqueta: string; base: string; activo: boolean; costo_envio: string; envio_gratis_desde: string; tiempo: string; horarios: unknown; medios: string[] | null }
/**
 * Guarda el catálogo de formas de entrega (en el orden elegido). Cada una se comporta como retiro, delivery o mesa ("base").
 * Una forma que ya tiene pedidos no se borra: se desactiva (los pedidos viejos conservan su nombre).
 */
export async function guardarPedidosEntregas(filas: FilaEntrega[]): Promise<ActionResult> {
  const { ctx, error } = await permisoAjustes(); if (error) return fail(error)
  if (!Array.isArray(filas) || filas.length === 0 || filas.length > 20) return fail('Tiene que haber entre 1 y 20 formas de entrega')
  const claves = new Set<string>(), salida: Record<string, unknown>[] = []
  for (const [i, f] of filas.entries()) {
    if (!RE_CLAVE.test(String(f.clave))) return fail('Hay una forma de entrega con un nombre no válido')
    if (claves.has(f.clave)) return fail(`La forma de entrega “${f.etiqueta}” está repetida`)
    claves.add(f.clave)
    const etiqueta = limpio(f.etiqueta, 41); if (etiqueta.length < 1 || etiqueta.length > 40) return fail('El nombre de cada forma de entrega va de 1 a 40 letras')
    if (!['retiro', 'delivery', 'mesa'].includes(f.base)) return fail(`“${etiqueta}”: elegí cómo se comporta (retiro, delivery o en mesa)`)
    const costo = leerMonto(limpio(f.costo_envio, 20)), gratis = leerMonto(limpio(f.envio_gratis_desde, 20))
    if (Number.isNaN(costo)) return fail(`“${etiqueta}”: el costo de envío no es válido (ej. 1500)`)
    if (Number.isNaN(gratis)) return fail(`“${etiqueta}”: el monto para envío gratis no es válido (ej. 20000)`)
    if (f.base === 'delivery' && gratis > 0 && costo === 0) return fail(`“${etiqueta}”: el envío ya es gratis; borrá el monto para envío gratis o poné un costo`)
    const tiempo = limpio(f.tiempo, 61); if (tiempo.length > 60) return fail(`“${etiqueta}”: el tiempo estimado puede tener hasta 60 letras`)
    let horarios: unknown = null
    if (f.horarios !== null && f.horarios !== undefined) {
      const v = validarHorarios(f.horarios); if (!v.ok) return fail(`“${etiqueta}”: ${v.error}`)
      if (Object.keys(v.horarios).length === 0) return fail(`“${etiqueta}”: cargá al menos una franja en sus horarios propios, o desactivalos`)
      horarios = v.horarios
    }
    const medios = f.medios === null || f.medios === undefined ? null : [...new Set((Array.isArray(f.medios) ? f.medios : []).map(String).filter((m) => RE_CLAVE.test(m)))]
    salida.push({ negocio_id: ctx.negocio.id, clave: f.clave, etiqueta, base: f.base, activo: !!f.activo, orden: i + 1, costo_envio: f.base === 'delivery' ? costo : 0, envio_gratis_desde: f.base === 'delivery' && gratis > 0 ? gratis : null, tiempo: tiempo || null, horarios, medios })
  }
  if (!filas.some((f) => f.activo)) return fail('Dejá al menos una forma de entrega activa')
  const { error: e } = await ctx.supabase.from('pedido_entregas').upsert(salida, { onConflict: 'negocio_id,clave' })
  if (e) return fail('No se pudieron guardar las formas de entrega')
  const { data: actuales } = await ctx.supabase.from('pedido_entregas').select('clave').eq('negocio_id', ctx.negocio.id)
  for (const a of (actuales ?? []).filter((x) => !claves.has(x.clave as string))) {
    const { count } = await ctx.supabase.from('pedidos').select('id', { count: 'exact', head: true }).eq('negocio_id', ctx.negocio.id).or(`entrega.eq.${a.clave},and(entrega.is.null,tipo.eq.${a.clave})`)
    if ((count ?? 0) > 0) await ctx.supabase.from('pedido_entregas').update({ activo: false }).eq('negocio_id', ctx.negocio.id).eq('clave', a.clave as string)
    else await ctx.supabase.from('pedido_entregas').delete().eq('negocio_id', ctx.negocio.id).eq('clave', a.clave as string)
  }
  refrescar(ctx.negocio.slug)
  return { ok: true }
}

export interface FilaMedio { clave: string; etiqueta: string; aviso: string; datos: string; activo: boolean }
/** Guarda el catálogo de medios de pago (en el orden elegido). Uno que ya se usó en pedidos no se borra: se desactiva. */
export async function guardarPedidosMedios(filas: FilaMedio[]): Promise<ActionResult> {
  const { ctx, error } = await permisoAjustes(); if (error) return fail(error)
  if (!Array.isArray(filas) || filas.length === 0 || filas.length > 20) return fail('Tiene que haber entre 1 y 20 medios de pago')
  const claves = new Set<string>(), salida: Record<string, unknown>[] = []
  for (const [i, f] of filas.entries()) {
    if (!RE_CLAVE.test(String(f.clave))) return fail('Hay un medio de pago con un nombre no válido')
    if (claves.has(f.clave)) return fail(`El medio “${f.etiqueta}” está repetido`)
    claves.add(f.clave)
    const etiqueta = limpio(f.etiqueta, 41); if (etiqueta.length < 1 || etiqueta.length > 40) return fail('El nombre de cada medio de pago va de 1 a 40 letras')
    const aviso = limpio(f.aviso, 201), datos = limpio(f.datos, 301)
    if (aviso.length > 200) return fail(`“${etiqueta}”: el aviso puede tener hasta 200 letras`)
    if (datos.length > 300) return fail(`“${etiqueta}”: los datos para pagar pueden tener hasta 300 letras`)
    salida.push({ negocio_id: ctx.negocio.id, clave: f.clave, etiqueta, aviso: aviso || null, datos: datos || null, activo: !!f.activo, orden: i + 1 })
  }
  if (!filas.some((f) => f.activo)) return fail('Dejá al menos un medio de pago activo')
  const { error: e } = await ctx.supabase.from('pedido_medios').upsert(salida, { onConflict: 'negocio_id,clave' })
  if (e) return fail('No se pudieron guardar los medios de pago')
  const { data: actuales } = await ctx.supabase.from('pedido_medios').select('clave').eq('negocio_id', ctx.negocio.id)
  for (const a of (actuales ?? []).filter((x) => !claves.has(x.clave as string))) {
    const { count } = await ctx.supabase.from('pedidos').select('id', { count: 'exact', head: true }).eq('negocio_id', ctx.negocio.id).eq('medio_pago', a.clave as string)
    if ((count ?? 0) > 0) await ctx.supabase.from('pedido_medios').update({ activo: false }).eq('negocio_id', ctx.negocio.id).eq('clave', a.clave as string)
    else await ctx.supabase.from('pedido_medios').delete().eq('negocio_id', ctx.negocio.id).eq('clave', a.clave as string)
  }
  refrescar(ctx.negocio.slug)
  return { ok: true }
}

/** Interruptor rápido "Recibiendo pedidos" (pausa o reanuda los pedidos de la carta pública y del bot). */
export async function alternarRecibePedidos(): Promise<ActionResult> {
  const { ctx, error } = await permiso(true); if (error) return fail(error)
  const { data } = await ctx.supabase.from('pedidos_config').select('recibe').eq('negocio_id', ctx.negocio.id).maybeSingle()
  const { count } = await ctx.supabase.from('pedido_entregas').select('clave', { count: 'exact', head: true }).eq('negocio_id', ctx.negocio.id).eq('activo', true)
  if (!data) return fail('Primero configurá los ajustes de pedidos (formas de entrega y medios de pago)')
  if (!data.recibe && (count ?? 0) === 0) return fail('Activá al menos una forma de entrega en Ajustes')
  const { error: e } = await ctx.supabase.from('pedidos_config').update({ recibe: !data.recibe }).eq('negocio_id', ctx.negocio.id)
  if (e) return fail('No se pudo cambiar')
  refrescar(ctx.negocio.slug)
  return { ok: true }
}

/** Carga un pedido a mano (por teléfono o mostrador). Mismas reglas de precios que la carta: salen de la carta, no de lo que se escriba. */
export async function crearPedidoManual(_prev: ActionResult | null, fd: FormData): Promise<ActionResult> {
  const { ctx, error } = await permiso(); if (error) return fail(error)
  let items: unknown
  try { items = JSON.parse(text(fd, 'items') || '[]') } catch { return fail('El detalle del pedido no es válido') }
  const { data, error: e } = await createAdminClient().rpc('crear_pedido', { p: {
    negocio: ctx.negocio.slug, origen: 'manual', tipo: text(fd, 'tipo'), nombre: text(fd, 'nombre'), telefono: text(fd, 'telefono'), mesa: text(fd, 'mesa'),
    direccion: text(fd, 'direccion'), observaciones: text(fd, 'observaciones'), medio_pago: text(fd, 'medio_pago') || 'efectivo', items,
  } })
  if (e) return fail('No se pudo crear el pedido')
  const r = data as { ok: boolean; error?: string; minimo?: number; detalle?: string }
  if (!r.ok) return fail(mensajeError(r.error, r) + (r.error === 'producto_no_disponible' || r.error === 'falta_variante' || r.error === 'producto_sin_precio' ? (r.detalle ? ` (${r.detalle})` : '') : ''))
  refrescar(ctx.negocio.slug)
  return { ok: true }
}
