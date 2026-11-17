import { fechaCorta, sumarDias } from '@/lib/fechas'

/**
 * Período personalizado ("Rango de fechas…") de las pantallas con filtro de días anteriores: viaja en la dirección como ?desde=AAAA-MM-DD&hasta=AAAA-MM-DD.
 * Es válido si las dos fechas existen, el inicio no es posterior al final, el final no es futuro y no pasa de un año.
 */
export interface Rango { desde: string; hasta: string }

const FECHA_RE = /^\d{4}-\d{2}-\d{2}$/
export const esFecha = (s: string | undefined | null): s is string => !!s && FECHA_RE.test(s) && !Number.isNaN(Date.parse(s + 'T12:00:00Z'))

export const diasEnRango = (r: Rango) => Math.round((Date.parse(r.hasta + 'T12:00:00Z') - Date.parse(r.desde + 'T12:00:00Z')) / 86400000) + 1

export function leerRango(sp: { desde?: string; hasta?: string }, hoy: string, maxDias = 366): Rango | null {
  if (!esFecha(sp.desde) || !esFecha(sp.hasta) || sp.desde > sp.hasta || sp.hasta > hoy) return null
  const r = { desde: sp.desde, hasta: sp.hasta }
  return diasEnRango(r) <= maxDias ? r : null
}

/** "del 01/11 al 15/11" */
export const rotuloRango = (r: Rango) => `del ${fechaCorta(r.desde)} al ${fechaCorta(r.hasta)}`

/** Límites (hora de Argentina) para filtrar timestamps: desde el primer instante del primer día hasta el último del último día, inclusive. */
export const inicioDia = (f: string) => `${f}T00:00:00-03:00`
export const finDia = (f: string) => `${f}T23:59:59.999-03:00`
export const despuesDeDia = (f: string) => `${sumarDias(f, 1)}T00:00:00-03:00`   // para filtros con "menor que"
