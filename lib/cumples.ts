import { inicioSemana, sumarDias } from '@/lib/fechas'

export const PERIODOS_CUMPLE = [
  { value: 'hoy', label: 'Hoy' },
  { value: 'semana', label: 'Esta semana' },
  { value: 'semana_prox', label: 'Semana próxima' },
  { value: 'mes', label: 'Este mes' },
  { value: 'mes_prox', label: 'Mes siguiente' },
  { value: 'todos', label: 'Todos' },
] as const
export type PeriodoCumple = (typeof PERIODOS_CUMPLE)[number]['value']

const pad = (n: number) => String(n).padStart(2, '0')
const esBisiesto = (y: number) => (y % 4 === 0 && y % 100 !== 0) || y % 400 === 0

/** Fecha 'YYYY-MM-DD' del cumpleaños en un año dado (el 29/02 pasa al 28/02 en años no bisiestos). */
function enAnio(dia: number, mes: number, anio: number): string {
  const d = mes === 2 && dia === 29 && !esBisiesto(anio) ? 28 : dia
  return `${anio}-${pad(mes)}-${pad(d)}`
}

/** Próxima ocurrencia (hoy incluido) y días que faltan. */
export function proximoCumple(dia: number, mes: number, hoy: string): { fecha: string; dias: number } {
  const anio = Number(hoy.slice(0, 4))
  let fecha = enAnio(dia, mes, anio)
  if (fecha < hoy) fecha = enAnio(dia, mes, anio + 1)
  const dias = Math.round((Date.UTC(+fecha.slice(0, 4), +fecha.slice(5, 7) - 1, +fecha.slice(8, 10)) - Date.UTC(+hoy.slice(0, 4), +hoy.slice(5, 7) - 1, +hoy.slice(8, 10))) / 86400000)
  return { fecha, dias }
}

/** Rango [desde, hasta] (inclusive) de un período, o null para "todos". */
export function rangoPeriodo(p: PeriodoCumple, hoy: string): { desde: string; hasta: string } | null {
  if (p === 'hoy') return { desde: hoy, hasta: hoy }
  if (p === 'semana') { const l = inicioSemana(hoy); return { desde: l, hasta: sumarDias(l, 6) } }
  if (p === 'semana_prox') { const l = sumarDias(inicioSemana(hoy), 7); return { desde: l, hasta: sumarDias(l, 6) } }
  if (p === 'mes' || p === 'mes_prox') {
    let y = Number(hoy.slice(0, 4)), m = Number(hoy.slice(5, 7)) + (p === 'mes_prox' ? 1 : 0)
    if (m > 12) { m = 1; y++ }
    const ultimo = new Date(Date.UTC(y, m, 0)).getUTCDate()
    return { desde: `${y}-${pad(m)}-01`, hasta: `${y}-${pad(m)}-${pad(ultimo)}` }
  }
  return null
}

const MESES = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic']
export const textoCumple = (dia: number, mes: number) => `${dia} ${MESES[mes - 1]}`
export const textoFaltan = (dias: number) => (dias === 0 ? 'hoy' : dias === 1 ? 'mañana' : `en ${dias} días`)
