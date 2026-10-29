import 'server-only'
import type { getContexto } from '@/lib/context'
import { sumarDias } from '@/lib/fechas'
import { calcularMetricas, type FilaReserva, type Metricas } from '@/lib/metricas'
import { calcularMetricasPedidos, clavePedido, topProductos, type FilaItemPedido, type FilaPedido, type MetricasPedidos } from '@/lib/metricas-pedidos'

type Ctx = Awaited<ReturnType<typeof getContexto>>

/** Días del período [desde, hasta], ambos incluidos. */
export const diasEntre = (desde: string, hasta: string) => Math.round((Date.parse(hasta + 'T12:00:00Z') - Date.parse(desde + 'T12:00:00Z')) / 86400000) + 1

/** Métricas de reservas del período [desde, hasta] (RLS + sede elegida). */
export async function cargarReservas(ctx: Ctx, desde: string, hasta: string): Promise<Metricas> {
  const { supabase, negocio, sede } = ctx
  let q = supabase.from('reservas').select('cliente_id, fecha, hora, cantidad_personas, estado, sucursal_id').eq('negocio_id', negocio.id).is('eliminado_en', null).gte('fecha', desde).lte('fecha', hasta)
  if (sede) q = q.eq('sucursal_id', sede.id)
  const { data } = await q.limit(20000)
  const periodo = (data ?? []) as FilaReserva[]
  // Clientes del período que ya habían reservado antes (para distinguir recurrentes de nuevos)
  const ids = [...new Set(periodo.filter((r) => r.cliente_id && r.estado !== 'cancelada').map((r) => r.cliente_id!))]
  const previos = new Set<string>()
  for (let i = 0; i < ids.length; i += 100) {
    let p = supabase.from('reservas').select('cliente_id').eq('negocio_id', negocio.id).is('eliminado_en', null).neq('estado', 'cancelada').lt('fecha', desde).in('cliente_id', ids.slice(i, i + 100))
    if (sede) p = p.eq('sucursal_id', sede.id)
    const { data: prev } = await p.limit(5000)
    for (const r of prev ?? []) if (r.cliente_id) previos.add(r.cliente_id)
  }
  return calcularMetricas(periodo, previos, diasEntre(desde, hasta), hasta)
}

/** Métricas de pedidos del período [desde, hasta] (los pedidos no tienen sede: son los de todo el negocio). */
export async function cargarPedidos(ctx: Ctx, desde: string, hasta: string): Promise<{ m: MetricasPedidos; productos: { etiqueta: string; valor: number; ventas: number }[] }> {
  const { supabase, negocio } = ctx
  // un día de margen: el corte por día se hace en la zona horaria del negocio
  const { data } = await supabase.from('pedidos').select('id, cliente_id, nombre, telefono, tipo, medio_pago, estado, total, creado_en').eq('negocio_id', negocio.id).gte('creado_en', `${sumarDias(desde, -1)}T00:00:00Z`).lte('creado_en', `${sumarDias(hasta, 1)}T23:59:59Z`).limit(20000)
  const crudos = ((data ?? []) as (FilaPedido & { id: string })[]).map((r) => ({ ...r, total: Number(r.total) }))
  const fechaLocal = new Intl.DateTimeFormat('en-CA', { timeZone: negocio.zona_horaria, year: 'numeric', month: '2-digit', day: '2-digit' })
  const filas = crudos.filter((r) => { const f = fechaLocal.format(new Date(r.creado_en)); return f >= desde && f <= hasta })

  // Clientes del período que ya habían pedido antes (para distinguir recurrentes de nuevos)
  const claves = [...new Set(filas.filter((r) => r.estado !== 'cancelado').map((r) => clavePedido(r)).filter((k): k is string => !!k))]
  const previos = new Set<string>()
  const ids = claves.filter((k) => !k.startsWith('tel:')), tels = claves.filter((k) => k.startsWith('tel:')).map((k) => k.slice(4))
  for (let i = 0; i < ids.length; i += 100) {
    const { data: prev } = await supabase.from('pedidos').select('cliente_id').eq('negocio_id', negocio.id).neq('estado', 'cancelado').lt('creado_en', `${desde}T00:00:00-03:00`).in('cliente_id', ids.slice(i, i + 100)).limit(5000)
    for (const r of prev ?? []) if (r.cliente_id) previos.add(r.cliente_id as string)
  }
  for (let i = 0; i < tels.length; i += 100) {
    const { data: prev } = await supabase.from('pedidos').select('telefono').eq('negocio_id', negocio.id).neq('estado', 'cancelado').is('cliente_id', null).lt('creado_en', `${desde}T00:00:00-03:00`).in('telefono', tels.slice(i, i + 100)).limit(5000)
    for (const r of prev ?? []) if (r.telefono) previos.add(`tel:${r.telefono}`)
  }
  const m = calcularMetricasPedidos(filas, previos, diasEntre(desde, hasta), hasta, negocio.zona_horaria)

  // Productos más pedidos del período (sin los cancelados)
  const idsValidos = filas.filter((r) => r.estado !== 'cancelado').map((r) => r.id)
  const items: FilaItemPedido[] = []
  for (let i = 0; i < idsValidos.length; i += 150) {
    const { data: it } = await supabase.from('pedido_items').select('nombre, variante, cantidad, subtotal').eq('negocio_id', negocio.id).in('pedido_id', idsValidos.slice(i, i + 150)).limit(10000)
    items.push(...((it ?? []) as FilaItemPedido[]))
  }
  return { m, productos: topProductos(items) }
}
