// Días de la semana como los guarda la base (0 = domingo … 6 = sábado), mostrados de lunes a domingo.
export const DIAS_SEMANA = [{ n: 1, c: 'Lun', l: 'Lunes' }, { n: 2, c: 'Mar', l: 'Martes' }, { n: 3, c: 'Mié', l: 'Miércoles' }, { n: 4, c: 'Jue', l: 'Jueves' }, { n: 5, c: 'Vie', l: 'Viernes' }, { n: 6, c: 'Sáb', l: 'Sábado' }, { n: 0, c: 'Dom', l: 'Domingo' }]

/** "Vie y Sáb", "Lun a Jue", "Lun, Mié y Vie"… (vacío o los 7 días = null: todos los días). */
export function textoDias(dias: number[] | null | undefined): string | null {
  if (!dias || dias.length === 0 || dias.length >= 7) return null
  const orden = DIAS_SEMANA.filter((d) => dias.includes(d.n))
  const pos = orden.map((d) => DIAS_SEMANA.indexOf(d))
  const seguidos = pos.every((p, i) => i === 0 || p === pos[i - 1] + 1)
  if (orden.length >= 3 && seguidos) return `${orden[0].c} a ${orden[orden.length - 1].c}`
  if (orden.length === 1) return orden[0].c
  return orden.slice(0, -1).map((d) => d.c).join(', ') + ' y ' + orden[orden.length - 1].c
}
