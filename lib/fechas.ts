// El panel trabaja SIEMPRE en horario de Argentina, sin importar dónde corra el servidor (Vercel está en UTC).
export const TZ_AR = 'America/Argentina/Buenos_Aires'

// Fechas como strings 'YYYY-MM-DD' en la zona horaria dada (la columna es DATE, sin hora).

/** Formato de fecha del sistema: día-mes-año (LATAM), con este separador. Se cambia acá y vale para todo el panel. */
export const SEP_FECHA = '-'
/** "21-10" a partir de AAAA-MM-DD. */
export const diaMes = (f: string | null) => (f && /^\d{4}-\d{2}-\d{2}/.test(f) ? `${f.slice(8, 10)}${SEP_FECHA}${f.slice(5, 7)}` : '')

export function hoyEn(tz: string = TZ_AR, ahora = new Date()): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: tz, year: 'numeric', month: '2-digit', day: '2-digit' }).format(ahora)
}

export function sumarDias(fecha: string, dias: number): string {
  const [y, m, d] = fecha.split('-').map(Number)
  const dt = new Date(Date.UTC(y, m - 1, d + dias))
  return dt.toISOString().slice(0, 10)
}

/** Lunes de la semana de `fecha`. */
export function inicioSemana(fecha: string): string {
  const [y, m, d] = fecha.split('-').map(Number)
  const dow = new Date(Date.UTC(y, m - 1, d)).getUTCDay() // 0=dom
  return sumarDias(fecha, -((dow + 6) % 7))
}

const DIAS = ['dom', 'lun', 'mar', 'mié', 'jue', 'vie', 'sáb']
const MESES = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic']

/** "mié, 21 oct 2026" */
export function fechaLarga(fecha: string): string {
  const [y, m, d] = fecha.split('-').map(Number)
  const dow = new Date(Date.UTC(y, m - 1, d)).getUTCDay()
  return `${DIAS[dow]}, ${d} ${MESES[m - 1]} ${y}`
}

/** "21-10-2026" */
export function fechaCorta(fecha: string | null): string {
  if (!fecha) return 'A coordinar'
  const [y, m, d] = fecha.split('-')
  return `${d}${SEP_FECHA}${m}${SEP_FECHA}${y}`
}

export function horaCorta(hora: string | null): string {
  return hora ? hora.slice(0, 5) : '—'
}

/** 21-10-2026 19:45 (para columnas "Alta") */
export function fechaHoraLarga(iso: string, tz: string = TZ_AR): string {
  const p = Object.fromEntries(new Intl.DateTimeFormat('es-AR', { timeZone: tz, day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit', hour12: false }).formatToParts(new Date(iso)).map((x) => [x.type, x.value]))
  return `${p.day}${SEP_FECHA}${p.month}${SEP_FECHA}${p.year} ${p.hour === '24' ? '00' : p.hour}:${p.minute}`
}

/** 21-10 19:45 */
export function fechaHoraCorta(iso: string, tz: string = TZ_AR): string {
  const p = Object.fromEntries(new Intl.DateTimeFormat('es-AR', { timeZone: tz, day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit', hour12: false }).formatToParts(new Date(iso)).map((x) => [x.type, x.value]))
  return `${p.day}${SEP_FECHA}${p.month} ${p.hour === '24' ? '00' : p.hour}:${p.minute}`
}

/** "21-10" (día y mes) de un instante, en hora de Argentina. */
export function diaMesDe(iso: string, tz: string = TZ_AR): string {
  const p = Object.fromEntries(new Intl.DateTimeFormat('es-AR', { timeZone: tz, day: '2-digit', month: '2-digit' }).formatToParts(new Date(iso)).map((x) => [x.type, x.value]))
  return `${p.day}${SEP_FECHA}${p.month}`
}
