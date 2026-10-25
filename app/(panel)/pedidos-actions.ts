'use server'

import { revalidatePath } from 'next/cache'
import { getContexto } from '@/lib/context'
import { ESTADOS_PEDIDO, MEDIOS_PAGO, mensajeError } from '@/lib/pedidos'
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

export async function guardarConfigPedidos(_prev: ActionResult | null, fd: FormData): Promise<ActionResult> {
  const { ctx, error } = await permiso(true); if (error) return fail(error)
  const costo = leerMonto(text(fd, 'costo_envio')), minimo = leerMonto(text(fd, 'pedido_minimo'))
  if (Number.isNaN(costo)) return fail('El costo de envío no es válido (ej. 1500)')
  if (Number.isNaN(minimo)) return fail('El pedido mínimo no es válido (ej. 5000)')
  const tiempo = text(fd, 'tiempo_estimado'), datos = text(fd, 'datos_pago'), mensaje = text(fd, 'mensaje')
  if (tiempo.length > 60) return fail('El tiempo estimado puede tener hasta 60 letras')
  if (datos.length > 300 || mensaje.length > 300) return fail('Los textos pueden tener hasta 300 letras')
  const medios = MEDIOS_PAGO.map((m) => m.value).filter((v) => fd.get('medio_' + v) === 'on')
  const retiro = fd.get('retiro') === 'on', delivery = fd.get('delivery') === 'on', mesa = fd.get('mesa') === 'on'
  const recibe = fd.get('recibe') === 'on'
  if (recibe && !(retiro || delivery || mesa)) return fail('Para recibir pedidos elegí al menos una forma de entrega')
  if (recibe && medios.length === 0) return fail('Para recibir pedidos elegí al menos un medio de pago')
  const { error: e } = await ctx.supabase.from('pedidos_config').upsert({
    negocio_id: ctx.negocio.id, recibe, retiro, delivery, mesa, costo_envio: costo, pedido_minimo: minimo, tiempo_estimado: tiempo || null,
    medios_pago: medios.length ? medios : ['efectivo'], datos_pago: datos || null, mensaje: mensaje || null,
  })
  if (e) return fail('No se pudieron guardar los ajustes')
  refrescar(ctx.negocio.slug)
  return { ok: true }
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
