import { textoDias } from '@/lib/dias'
import { fechaCorta } from '@/lib/fechas'

// Confirmación automática de reservas: el estado con el que entra una reserva que llega por el sitio o por el bot.
// Cada negocio tiene un resultado por defecto y una lista ordenada de excepciones; manda la primera que coincide.
// La misma lógica vive en la base (app.estado_inicial_reserva); esta copia sirve para probarla en pantalla.

export type ResultadoConfirmacion = 'confirmada' | 'nueva'
export interface ReglaConfirmacion {
  uid: string                        // clave de React (en la base es el id)
  activo: boolean
  sucursal_id: string | null
  tipo_reserva: string | null
  fecha_desde: string | null
  fecha_hasta: string | null
  dias_semana: number[]              // vacío = todos los días
  personas_min: number | null
  personas_max: number | null
  resultado: ResultadoConfirmacion
  nota: string
}
export interface DatosPrueba { sede: string | null; tipo: string; fecha: string; personas: number }

export const RESULTADOS: { value: ResultadoConfirmacion; label: string; corto: string }[] = [
  { value: 'confirmada', label: 'Se confirma sola', corto: 'se confirma sola' },
  { value: 'nueva', label: 'Queda en “Nuevas” para que un asesor la confirme', corto: 'queda en Nuevas (la confirma un asesor)' },
]

function diaDeSemana(fecha: string) { const [y, m, d] = fecha.split('-').map(Number); return new Date(Date.UTC(y, m - 1, d)).getUTCDay() }

export function coincide(r: ReglaConfirmacion, d: DatosPrueba): boolean {
  if (!r.activo) return false
  if (r.sucursal_id && r.sucursal_id !== d.sede) return false
  if (r.tipo_reserva && r.tipo_reserva !== d.tipo) return false
  if (r.fecha_desde && r.fecha_hasta && !(d.fecha >= r.fecha_desde && d.fecha <= r.fecha_hasta)) return false
  if (r.dias_semana.length > 0 && r.dias_semana.length < 7 && !r.dias_semana.includes(diaDeSemana(d.fecha))) return false
  if (r.personas_min !== null && d.personas < r.personas_min) return false
  if (r.personas_max !== null && d.personas > r.personas_max) return false
  return true
}

/** Resultado para una reserva de ejemplo y la regla (posición en la lista) que decidió; null = el valor por defecto. */
export function estadoSegunReglas(defecto: ResultadoConfirmacion, reglas: ReglaConfirmacion[], d: DatosPrueba): { estado: ResultadoConfirmacion; regla: number | null } {
  const i = reglas.findIndex((r) => coincide(r, d))
  return i >= 0 ? { estado: reglas[i].resultado, regla: i } : { estado: defecto, regla: null }
}

/** "Más de 6 personas", "Cumpleaños · vie y sáb · del 20-12-2026 al 31-12-2026"… las condiciones de la excepción en una frase. */
export function textoCondicion(r: ReglaConfirmacion, nombreSede: (id: string) => string, etiquetaTipo: (clave: string) => string): string {
  const p: string[] = []
  if (r.sucursal_id) p.push(nombreSede(r.sucursal_id))
  if (r.tipo_reserva) p.push(etiquetaTipo(r.tipo_reserva))
  if (r.personas_min !== null && r.personas_max !== null) p.push(r.personas_min === r.personas_max ? `${r.personas_min} personas` : `de ${r.personas_min} a ${r.personas_max} personas`)
  else if (r.personas_min !== null) p.push(`${r.personas_min} personas o más`)
  else if (r.personas_max !== null) p.push(`hasta ${r.personas_max} personas`)
  const dias = textoDias(r.dias_semana); if (dias) p.push(dias)
  if (r.fecha_desde && r.fecha_hasta) p.push(r.fecha_desde === r.fecha_hasta ? fechaCorta(r.fecha_desde) : `del ${fechaCorta(r.fecha_desde)} al ${fechaCorta(r.fecha_hasta)}`)
  return p.length ? p.join(' · ') : 'Cualquier reserva'
}
