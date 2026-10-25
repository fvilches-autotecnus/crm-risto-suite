import 'server-only'
import type { Contexto } from '@/lib/context'

/** Mesas asignadas a cada reserva ("4" o "4 + 5"), para mostrarlas en la lista de Reservas. Vacío si el negocio no tiene el módulo Salón y mesas. */
export async function mesasPorReserva(ctx: Contexto, reservaIds: string[]): Promise<Record<string, string>> {
  if (!ctx.modulosActivos.mesas || reservaIds.length === 0) return {}
  const { data } = await ctx.supabase.from('reserva_mesas').select('reserva_id, mesa:mesas(numero)').eq('negocio_id', ctx.negocio.id).in('reserva_id', reservaIds.slice(0, 500))
  const salida: Record<string, string[]> = {}
  for (const r of (data ?? []) as unknown as { reserva_id: string; mesa: { numero: string } | null }[]) if (r.mesa) (salida[r.reserva_id] ??= []).push(r.mesa.numero)
  return Object.fromEntries(Object.entries(salida).map(([k, v]) => [k, v.sort((a, b) => a.localeCompare(b, 'es', { numeric: true })).join(' + ')]))
}
