'use server'

import { revalidatePath } from 'next/cache'
import { getContexto } from '@/lib/context'
import { ESTADOS_PEDIDO, MEDIOS_PAGO, mensajeError, type HorariosSemana } from '@/lib/pedidos'
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
const guardar = async (ctx: Awaited<ReturnType<typeof permiso>>['ctx'], cambios: Record<string, unknown>): Promise<ActionResult> => {
  const { error: e } = await ctx.supabase.from('pedidos_config').upsert({ negocio_id: ctx.negocio.id, ...cambios })
  if (e) return fail('No se pudieron guardar los ajustes')
  refrescar(ctx.negocio.slug)
  return { ok: true }
}
const limpio = (v: unknown, n: number) => String(v ?? '').trim().slice(0, n)
const RE_FECHA = /^\d{4}-\d{2}-\d{2}$/

export interface AjustesGenerales { recibe: boolean; retiro: boolean; delivery: boolean; mesa: boolean; costo_envio: string; envio_gratis_desde: string; pedido_minimo: string; tiempo_estimado: string; tiempo_delivery: string; mensaje: string; aceptar_auto: boolean }
/** Recepción de pedidos: interruptor general, formas de entrega, costos, tiempos y mensaje para el cliente. */
export async function guardarPedidosGeneral(d: AjustesGenerales): Promise<ActionResult> {
  const { ctx, error } = await permisoAjustes(); if (error) return fail(error)
  const costo = leerMonto(limpio(d.costo_envio, 20)), minimo = leerMonto(limpio(d.pedido_minimo, 20)), gratis = leerMonto(limpio(d.envio_gratis_desde, 20))
  if (Number.isNaN(costo)) return fail('El costo de envío no es válido (ej. 1500)')
  if (Number.isNaN(minimo)) return fail('El pedido mínimo no es válido (ej. 5000)')
  if (Number.isNaN(gratis)) return fail('El monto para envío gratis no es válido (ej. 20000)')
  if (gratis > 0 && costo === 0) return fail('El envío ya es gratis: borrá el monto para envío gratis o poné un costo de envío')
  if (d.recibe && !(d.retiro || d.delivery || d.mesa)) return fail('Para recibir pedidos elegí al menos una forma de entrega')
  const tiempo = limpio(d.tiempo_estimado, 61), tdel = limpio(d.tiempo_delivery, 61), mensaje = limpio(d.mensaje, 301)
  if (tiempo.length > 60 || tdel.length > 60) return fail('Los tiempos pueden tener hasta 60 letras')
  if (mensaje.length > 300) return fail('El mensaje puede tener hasta 300 letras')
  return guardar(ctx, { recibe: !!d.recibe, retiro: !!d.retiro, delivery: !!d.delivery, mesa: !!d.mesa, costo_envio: costo, pedido_minimo: minimo, envio_gratis_desde: gratis > 0 ? gratis : null,
    tiempo_estimado: tiempo || null, tiempo_delivery: tdel || null, mensaje: mensaje || null, aceptar_auto: !!d.aceptar_auto })
}

export interface AjustesHorarios { usar_horarios: boolean; horarios: unknown; delivery_propio: boolean; horarios_delivery: unknown; fechas_cerradas: string[]; mensaje_cerrado: string }
/** Cuándo se reciben pedidos: franjas por día de la semana (y las del delivery si son distintas) y los días en que no se toman. */
export async function guardarPedidosHorarios(d: AjustesHorarios): Promise<ActionResult> {
  const { ctx, error } = await permisoAjustes(); if (error) return fail(error)
  const gen = validarHorarios(d.horarios); if (!gen.ok) return fail(gen.error)
  let delHorarios: HorariosSemana | null = null
  if (d.delivery_propio) { const r = validarHorarios(d.horarios_delivery); if (!r.ok) return fail('Horarios del delivery: ' + r.error); delHorarios = r.horarios }
  if (d.usar_horarios && Object.keys(gen.horarios).length === 0) return fail('Cargá al menos una franja horaria, o apagá “Recibir pedidos solo en ciertos horarios”')
  if (d.usar_horarios && delHorarios && Object.keys(delHorarios).length === 0) return fail('Cargá al menos una franja para el delivery, o desactivá sus horarios propios')
  const fechas = [...new Set((Array.isArray(d.fechas_cerradas) ? d.fechas_cerradas : []).map((f) => String(f)))]
  if (fechas.length > 120 || fechas.some((f) => !RE_FECHA.test(f) || Number.isNaN(Date.parse(f + 'T12:00:00Z')))) return fail('Alguna de las fechas sin pedidos no es válida')
  const cerrado = limpio(d.mensaje_cerrado, 301); if (cerrado.length > 300) return fail('El mensaje de “fuera de horario” puede tener hasta 300 letras')
  return guardar(ctx, { usar_horarios: !!d.usar_horarios, horarios: gen.horarios, horarios_delivery: delHorarios, fechas_cerradas: fechas.sort(), mensaje_cerrado: cerrado || null })
}

export interface AjustesPagos { medios: string[]; datos_pago: string; instrucciones: { efectivo: string; tarjeta: string }; por_tipo: Record<string, string[]> }
/** Medios de pago: cuáles se ofrecen, cuáles en cada forma de entrega y qué se le dice al cliente según el medio que elige. */
export async function guardarPedidosPagos(d: AjustesPagos): Promise<ActionResult> {
  const { ctx, error } = await permisoAjustes(); if (error) return fail(error)
  const validos = MEDIOS_PAGO.map((m) => m.value)
  const medios = validos.filter((v) => (Array.isArray(d.medios) ? d.medios : []).includes(v))
  const { data: actual } = await ctx.supabase.from('pedidos_config').select('recibe, retiro, delivery, mesa').eq('negocio_id', ctx.negocio.id).maybeSingle()
  if (medios.length === 0 && actual?.recibe) return fail('Mientras recibís pedidos tiene que haber al menos un medio de pago')
  const datos = limpio(d.datos_pago, 301); if (datos.length > 300) return fail('Los datos para transferir pueden tener hasta 300 letras')
  const ef = limpio(d.instrucciones?.efectivo, 201), ta = limpio(d.instrucciones?.tarjeta, 201)
  if (ef.length > 200 || ta.length > 200) return fail('Los avisos de cada medio pueden tener hasta 200 letras')
  const porTipo: Record<string, string[]> = {}
  for (const t of ['retiro', 'delivery', 'mesa'] as const) {
    const sel = validos.filter((v) => (d.por_tipo?.[t] ?? medios).includes(v) && medios.includes(v))
    if (actual?.[t] && sel.length === 0 && medios.length > 0) return fail(`Elegí al menos un medio de pago para ${t === 'retiro' ? 'retiro' : t === 'delivery' ? 'delivery' : 'pedidos en mesa'}`)
    if (sel.length !== medios.length) porTipo[t] = sel   // solo se guarda lo que se aparta de “todos los medios”
  }
  return guardar(ctx, { medios_pago: medios.length ? medios : ['efectivo'], datos_pago: datos || null, instrucciones_pago: { ...(ef ? { efectivo: ef } : {}), ...(ta ? { tarjeta: ta } : {}) }, medios_por_tipo: porTipo })
}

/** Interruptor rápido "Recibiendo pedidos" (pausa o reanuda los pedidos de la carta pública y del bot). */
export async function alternarRecibePedidos(): Promise<ActionResult> {
  const { ctx, error } = await permiso(true); if (error) return fail(error)
  const { data } = await ctx.supabase.from('pedidos_config').select('recibe, retiro, delivery, mesa, medios_pago').eq('negocio_id', ctx.negocio.id).maybeSingle()
  if (!data) return fail('Primero configurá los ajustes de pedidos (formas de entrega y medios de pago)')
  if (!data.recibe && !(data.retiro || data.delivery || data.mesa)) return fail('Elegí al menos una forma de entrega en Ajustes')
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
