/**
 * Turnos del sitio de reservas: grupos de horarios con nombre (Desayuno, Almuerzo, Cena…) que el sitio muestra con separadores,
 * con un corte propio opcional (el turno entero se cierra junto) y el mensaje que se ve cuando ya cerró.
 * Se guardan en reservas_web_config.turnos (negocio) y reservas_web_sedes.turnos (sede).
 */
export type CorteTurno = { tipo: 'horas'; horas: number } | { tipo: 'hora'; hora: string }
export interface TurnoWeb { nombre: string; horas: string[]; /** Días de la semana (0 = domingo … 6 = sábado); null = todos. */ dias: number[] | null; corte: CorteTurno | null; mensaje: string | null }
/** Lo que devuelve el sitio para cada turno del día. */
export interface TurnoPublico { nombre: string; horas: string[]; cerrado: boolean; mensaje: string }

export const MENSAJE_CORTE_DEFECTO = 'Sujeto a disponibilidad, por orden de llegada'
export const MAX_TURNOS = 8
const HORA = /^([01]\d|2[0-3]):[0-5]\d$/
const normalizarHora = (h: string) => (/^\d{1,2}:\d{2}$/.test(h) ? h.padStart(5, '0') : h)

/** Lo que llega de la pantalla (JSON con los turnos tal como se escribieron) → turnos validados, o el motivo por el que no sirven. */
export function leerTurnos(raw: unknown): { ok: true; turnos: TurnoWeb[] } | { ok: false; error: string } {
  let v: unknown = raw
  if (typeof raw === 'string') { if (!raw.trim()) return { ok: true, turnos: [] }; try { v = JSON.parse(raw) } catch { return { ok: false, error: 'Los turnos no se pudieron leer' } } }
  if (!Array.isArray(v)) return { ok: false, error: 'Los turnos no son válidos' }
  if (v.length > MAX_TURNOS) return { ok: false, error: `Hasta ${MAX_TURNOS} turnos` }
  const turnos: TurnoWeb[] = []
  const nombres = new Set<string>(), usadas = new Map<string, string>()
  for (const [i, t] of v.entries()) {
    const o = (t ?? {}) as Record<string, unknown>
    const nombre = String(o.nombre ?? '').trim().replace(/\s+/g, ' ')
    if (!nombre) return { ok: false, error: `Al turno ${i + 1} le falta el nombre` }
    if (nombre.length > 30) return { ok: false, error: `El nombre del turno “${nombre.slice(0, 20)}…” es muy largo (máximo 30 letras)` }
    if (nombres.has(nombre.toLowerCase())) return { ok: false, error: `Hay dos turnos que se llaman “${nombre}”` }
    nombres.add(nombre.toLowerCase())
    const horasCrudas = Array.isArray(o.horas) ? o.horas.map(String) : String(o.horas ?? '').split(/[\s,;]+/)
    const horas = [...new Set(horasCrudas.map((h) => h.trim()).filter(Boolean).map(normalizarHora))].sort()
    if (horas.length === 0) return { ok: false, error: `El turno “${nombre}” necesita al menos un horario` }
    if (horas.some((h) => !HORA.test(h))) return { ok: false, error: `Los horarios de “${nombre}” van como 13:00, 21:30 (separados por coma)` }
    if (horas.length > 24) return { ok: false, error: `“${nombre}”: hasta 24 horarios` }
    const dias = Array.isArray(o.dias) ? [...new Set(o.dias.map(Number).filter((d) => Number.isInteger(d) && d >= 0 && d <= 6))].sort() : []
    for (const h of horas) { const otro = usadas.get(h); if (otro && !(dias.length > 0 && cruzaPocoDias(o, turnos, otro))) return { ok: false, error: `El horario ${h} está en dos turnos (“${otro}” y “${nombre}”)` }; usadas.set(h, nombre) }
    let corte: CorteTurno | null = null
    const c = o.corte as Record<string, unknown> | null | undefined
    if (c && typeof c === 'object' && c.tipo) {
      if (c.tipo === 'horas') {
        const horasCorte = typeof c.horas === 'string' && c.horas.trim() === '' ? NaN : Number(typeof c.horas === 'string' ? c.horas.replace(',', '.') : c.horas)
        if (!Number.isFinite(horasCorte) || horasCorte < 0 || horasCorte > 72 || Math.round(horasCorte * 2) !== horasCorte * 2) return { ok: false, error: `El corte de “${nombre}” va de 0 a 72 horas (puede ser 0,5, 1, 1,5…)` }
        corte = { tipo: 'horas', horas: horasCorte }
      } else if (c.tipo === 'hora') {
        const hora = normalizarHora(String(c.hora ?? '').trim())
        if (!HORA.test(hora)) return { ok: false, error: `La hora de corte de “${nombre}” va como 18:00` }
        corte = { tipo: 'hora', hora }
      } else return { ok: false, error: `El corte de “${nombre}” no es válido` }
    }
    const mensaje = String(o.mensaje ?? '').trim()
    if (mensaje.length > 120) return { ok: false, error: `El mensaje de “${nombre}” puede tener hasta 120 letras` }
    turnos.push({ nombre, horas, dias: dias.length > 0 && dias.length < 7 ? dias : null, corte, mensaje: mensaje || null })
  }
  return { ok: true, turnos }
}

/** Un mismo horario puede estar en dos turnos solo si esos turnos rigen en días distintos (por ejemplo, desayuno de fin de semana y de semana). */
function cruzaPocoDias(actual: Record<string, unknown>, previos: TurnoWeb[], nombreOtro: string): boolean {
  const otro = previos.find((p) => p.nombre === nombreOtro)
  const dias = Array.isArray(actual.dias) ? actual.dias.map(Number) : []
  return !!otro?.dias && !otro.dias.some((d) => dias.includes(d))
}

/** Los turnos guardados, leídos con tolerancia (lo que salga mal formado se ignora): para mostrarlos al editar. */
export function turnosGuardados(raw: unknown): TurnoWeb[] {
  if (!Array.isArray(raw)) return []
  return raw.flatMap((t) => {
    const r = leerTurnos([t])
    return r.ok ? r.turnos : []
  })
}
