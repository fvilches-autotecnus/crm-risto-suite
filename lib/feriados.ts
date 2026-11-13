/**
 * Feriados nacionales de Argentina (incluye los "puentes turísticos" decretados) para marcar los días en la predicción de demanda.
 * Es una lista fija: hay que revisarla y completarla cada año (los feriados trasladables y los puentes se confirman por decreto).
 * 2027: solo están los feriados de fecha fija; faltan los trasladables y puentes, que se cargan cuando se decreten.
 */
export const FERIADOS: Record<string, string> = {
  '2025-03-03': 'Carnaval', '2025-03-04': 'Carnaval', '2025-03-24': 'Día de la Memoria', '2025-04-02': 'Día de Malvinas', '2025-04-17': 'Jueves Santo', '2025-04-18': 'Viernes Santo',
  '2025-05-01': 'Día del Trabajador', '2025-05-02': 'Feriado puente', '2025-06-16': 'Paso a la inmortalidad de Güemes', '2025-06-20': 'Día de la Bandera', '2025-07-09': 'Día de la Independencia',
  '2025-08-15': 'Feriado puente', '2025-10-10': 'Diversidad Cultural (trasladado)', '2025-11-21': 'Feriado puente', '2025-11-24': 'Soberanía Nacional (trasladado)', '2025-12-08': 'Inmaculada Concepción', '2025-12-25': 'Navidad',
  '2026-01-01': 'Año Nuevo', '2026-02-16': 'Carnaval', '2026-02-17': 'Carnaval', '2026-03-23': 'Feriado puente', '2026-03-24': 'Día de la Memoria', '2026-04-02': 'Día de Malvinas', '2026-04-03': 'Viernes Santo',
  '2026-05-01': 'Día del Trabajador', '2026-05-25': 'Revolución de Mayo', '2026-06-15': 'Paso a la inmortalidad de Güemes (trasladado)', '2026-06-20': 'Día de la Bandera', '2026-07-09': 'Día de la Independencia',
  '2026-07-10': 'Feriado puente', '2026-08-17': 'Paso a la inmortalidad de San Martín', '2026-10-12': 'Diversidad Cultural', '2026-11-23': 'Soberanía Nacional (trasladado)', '2026-12-07': 'Feriado puente',
  '2026-12-08': 'Inmaculada Concepción', '2026-12-25': 'Navidad',
  '2027-01-01': 'Año Nuevo', '2027-03-24': 'Día de la Memoria', '2027-04-02': 'Día de Malvinas', '2027-05-01': 'Día del Trabajador', '2027-05-25': 'Revolución de Mayo', '2027-06-20': 'Día de la Bandera',
  '2027-07-09': 'Día de la Independencia', '2027-12-08': 'Inmaculada Concepción', '2027-12-25': 'Navidad',
}
export const feriado = (fecha: string): string | null => FERIADOS[fecha] ?? null
