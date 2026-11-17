/**
 * Ticket promedio de las reservas. El sistema no tiene POS, así que en reservas no hay un monto real por mesa: el dueño carga un valor ESTIMADO
 * (por persona o por reserva) y las cifras que lo usan se rotulan "estimado". Se guarda en negocios.modulos.ticket_reservas = { valor, modo }.
 */
export type ModoTicket = 'persona' | 'reserva'
export interface TicketReservas { valor: number; modo: ModoTicket }

export const MAX_TICKET = 10_000_000

export function leerTicketReservas(modulos: unknown): TicketReservas | null {
  const t = (modulos as { ticket_reservas?: { valor?: unknown; modo?: unknown } } | null | undefined)?.ticket_reservas
  const valor = Number(t?.valor)
  if (!t || !Number.isFinite(valor) || valor <= 0 || valor > MAX_TICKET) return null
  return { valor, modo: t.modo === 'reserva' ? 'reserva' : 'persona' }
}

/** Lo que se estima facturar con esas reservas: comensales × ticket por persona, o reservas × ticket por reserva. */
export const estimarConTicket = (t: TicketReservas, reservas: number, comensales: number) => Math.round(t.modo === 'persona' ? comensales * t.valor : reservas * t.valor)

/** "$ 25.000 por persona" */
export const ticketTexto = (t: TicketReservas) => `$ ${t.valor.toLocaleString('es-AR')} por ${t.modo === 'persona' ? 'persona' : 'reserva'}`
