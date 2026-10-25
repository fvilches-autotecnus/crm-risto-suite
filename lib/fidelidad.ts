/** Fidelización por visitas: tipos y cálculos simples (se usan en el panel y en la ficha del cliente). */

export type CriterioVisita = 'confirmadas' | 'asistencia'

export interface ConfigFidelidad { activo: boolean; criterio: CriterioVisita; contar_desde: string }
export interface ReglaFidelidad { id: string; nombre: string; visitas: number; repetir: boolean; beneficio: string; vence_dias: number | null; activa: boolean }
export interface ClienteFidelidad { cliente_id: string; nombre: string; telefono: string | null; visitas: number; total: number; ultima: string | null; premios: number }

export const CRITERIOS: { value: CriterioVisita; titulo: string; texto: string }[] = [
  { value: 'confirmadas', titulo: 'Reservas confirmadas', texto: 'Cuenta una visita por cada día con una reserva confirmada que ya pasó. No hay que hacer nada extra, pero no sabe si el cliente fue (se asume que sí).' },
  { value: 'asistencia', titulo: 'Marcadas como “Llegó”', texto: 'Cuenta solo las reservas que el equipo marca con “Llegó”. Es más exacto, pero hay que marcarlas en Reservas.' },
]

export const textoRegla = (r: Pick<ReglaFidelidad, 'visitas' | 'repetir'>) => (r.repetir ? `Cada ${r.visitas} visitas` : `A la visita ${r.visitas}`)

/** Cuántas visitas le faltan para su próximo premio y de qué regla (solo reglas activas). null = no hay más premios por alcanzar. */
export function proximoPremio(visitas: number, reglas: ReglaFidelidad[]): { faltan: number; regla: ReglaFidelidad } | null {
  let mejor: { faltan: number; regla: ReglaFidelidad } | null = null
  for (const r of reglas) {
    if (!r.activa) continue
    const faltan = r.repetir ? r.visitas - (visitas % r.visitas) : r.visitas - visitas
    if (faltan <= 0) continue
    if (!mejor || faltan < mejor.faltan) mejor = { faltan, regla: r }
  }
  return mejor
}

export const textoVisitas = (n: number) => `${n} visita${n === 1 ? '' : 's'}`
