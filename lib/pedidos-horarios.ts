import type { ConfigPedidos, HorariosSemana, MedioPago, TipoPedido, Turno } from '@/lib/pedidos'

/**
 * Horarios de pedidos: cuándo se reciben pedidos y por qué, si no, la carta o el bot no los toman.
 * Funciona igual en el navegador (carta pública, panel) y en el servidor. La regla de verdad la vuelve a aplicar la base al crear el pedido.
 */
const TZ = 'America/Argentina/Buenos_Aires'

/** De lunes a domingo (como se ve en pantalla); `n` es el número de día de la semana que se guarda (0 = domingo). */
export const DIAS_SEMANA: { n: '0' | '1' | '2' | '3' | '4' | '5' | '6'; corto: string; largo: string }[] = [
  { n: '1', corto: 'Lun', largo: 'lunes' }, { n: '2', corto: 'Mar', largo: 'martes' }, { n: '3', corto: 'Mié', largo: 'miércoles' }, { n: '4', corto: 'Jue', largo: 'jueves' },
  { n: '5', corto: 'Vie', largo: 'viernes' }, { n: '6', corto: 'Sáb', largo: 'sábado' }, { n: '0', corto: 'Dom', largo: 'domingo' },
]
const RE_HORA = /^([01]\d|2[0-3]):[0-5]\d$/
const aMin = (h: string) => { const [a, b] = h.split(':').map(Number); return a * 60 + b }

/** Fecha, día de la semana y minuto del día en Argentina. */
export function ahoraAR(d: Date = new Date()) {
  const p = Object.fromEntries(new Intl.DateTimeFormat('en-US', { timeZone: TZ, year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hour12: false }).formatToParts(d).map((x) => [x.type, x.value]))
  const fecha = `${p.year}-${p.month}-${p.day}`
  return { fecha, dow: new Date(fecha + 'T12:00:00Z').getUTCDay(), min: (Number(p.hour) % 24) * 60 + Number(p.minute) }
}
const sumarDias = (fecha: string, n: number) => { const x = new Date(fecha + 'T12:00:00Z'); x.setUTCDate(x.getUTCDate() + n); return x.toISOString().slice(0, 10) }

/** Las franjas que valen para esa forma de entrega (el delivery puede tener las suyas). */
export const horariosDe = (cfg: Pick<ConfigPedidos, 'horarios' | 'horarios_delivery'>, tipo: TipoPedido): HorariosSemana => (tipo === 'delivery' && cfg.horarios_delivery ? cfg.horarios_delivery : cfg.horarios)

export type MotivoCierre = 'pausa' | 'tipo' | 'fecha' | 'horario'
export interface EstadoPedidos { abierto: boolean; motivo: MotivoCierre | null; /** "hoy a las 19:00", "mañana a las 12:00", "el jueves a las 19:00" */ proxima: string | null }

/** ¿Se reciben pedidos de ese tipo en este momento? Si no, por qué y cuándo vuelven. */
export function estadoPedidos(cfg: ConfigPedidos, tipo: TipoPedido, ahora: Date = new Date()): EstadoPedidos {
  const a = ahoraAR(ahora)
  if (!cfg.recibe) return { abierto: false, motivo: 'pausa', proxima: null }
  if (!cfg[tipo]) return { abierto: false, motivo: 'tipo', proxima: null }
  const cerradaHoy = cfg.fechas_cerradas.includes(a.fecha)
  if (!cerradaHoy && (!cfg.usar_horarios || (horariosDe(cfg, tipo)[String(a.dow) as '0'] ?? []).some(([d, h]) => a.min >= aMin(d) && a.min < aMin(h)))) return { abierto: true, motivo: null, proxima: null }
  return { abierto: false, motivo: cerradaHoy ? 'fecha' : 'horario', proxima: proximaApertura(cfg, tipo, a) }
}

function proximaApertura(cfg: ConfigPedidos, tipo: TipoPedido, a: ReturnType<typeof ahoraAR>): string | null {
  if (!cfg.usar_horarios) {
    // sin horarios, solo una fecha cerrada lo impide: se abre el primer día que no lo está
    for (let d = 1; d <= 14; d++) if (!cfg.fechas_cerradas.includes(sumarDias(a.fecha, d))) return d === 1 ? 'mañana' : `el ${DIAS_SEMANA.find((x) => x.n === String(new Date(sumarDias(a.fecha, d) + 'T12:00:00Z').getUTCDay()))?.largo}`
    return null
  }
  const h = horariosDe(cfg, tipo)
  for (let d = 0; d <= 14; d++) {
    const fecha = sumarDias(a.fecha, d); if (cfg.fechas_cerradas.includes(fecha)) continue
    const dow = new Date(fecha + 'T12:00:00Z').getUTCDay()
    const t = (h[String(dow) as '0'] ?? []).find(([desde]) => d > 0 || aMin(desde) > a.min)
    if (t) return `${d === 0 ? 'hoy' : d === 1 ? 'mañana' : `el ${DIAS_SEMANA.find((x) => x.n === String(dow))?.largo}`} a las ${t[0]}`
  }
  return null
}

/** Medios de pago que se ofrecen para una forma de entrega: lo habilitado, recortado por lo que se haya elegido para esa entrega. */
export function mediosDisponibles(cfg: Pick<ConfigPedidos, 'medios_pago' | 'medios_por_tipo'>, tipo: TipoPedido): MedioPago[] {
  const propios = cfg.medios_por_tipo?.[tipo]
  return Array.isArray(propios) ? cfg.medios_pago.filter((m) => propios.includes(m)) : cfg.medios_pago
}

/** Costo de envío de un pedido de delivery según el subtotal (gratis desde cierto monto). */
export const costoEnvioFinal = (cfg: Pick<ConfigPedidos, 'costo_envio' | 'envio_gratis_desde'>, subtotal: number) =>
  cfg.envio_gratis_desde !== null && cfg.envio_gratis_desde > 0 && subtotal >= cfg.envio_gratis_desde ? 0 : cfg.costo_envio

/** "12:00 a 15:00 y 20:00 a 23:30" */
export const resumenDia = (turnos: Turno[] | undefined) => (turnos?.length ? turnos.map(([d, h]) => `${d} a ${h}`).join(' y ') : 'Cerrado')

/** Revisa lo que llega de la pantalla: franjas bien escritas, de menor a mayor y sin pisarse (máximo 3 por día). Devuelve las franjas ya ordenadas y sin días vacíos. */
export function validarHorarios(raw: unknown): { ok: true; horarios: HorariosSemana } | { ok: false; error: string } {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return { ok: false, error: 'Los horarios no son válidos' }
  const salida: HorariosSemana = {}
  for (const dia of DIAS_SEMANA) {
    const v = (raw as Record<string, unknown>)[dia.n]
    if (v === undefined || v === null) continue
    if (!Array.isArray(v) || v.length > 3) return { ok: false, error: `El ${dia.largo} puede tener hasta 3 franjas horarias` }
    const turnos: Turno[] = []
    for (const t of v) {
      if (!Array.isArray(t) || t.length !== 2) return { ok: false, error: `Revisá los horarios del ${dia.largo}` }
      const [d, h] = [String(t[0] ?? ''), String(t[1] ?? '')]
      if (!RE_HORA.test(d) || !(RE_HORA.test(h) || h === '24:00')) return { ok: false, error: `El ${dia.largo} tiene un horario mal escrito (usá el formato 19:30)` }
      if (aMin(d) >= aMin(h)) return { ok: false, error: `El ${dia.largo}: la hora de cierre (${h}) tiene que ser posterior a la de apertura (${d})` }
      turnos.push([d, h])
    }
    turnos.sort((x, y) => aMin(x[0]) - aMin(y[0]))
    for (let i = 1; i < turnos.length; i++) if (aMin(turnos[i][0]) < aMin(turnos[i - 1][1])) return { ok: false, error: `El ${dia.largo} tiene franjas que se pisan` }
    if (turnos.length) salida[dia.n] = turnos
  }
  return { ok: true, horarios: salida }
}
