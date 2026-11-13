/**
 * Predicción de demanda por franja horaria (sin dependencias de servidor: función pura, se prueba contra el historial real).
 *
 * Método (el más simple que mostró funcionar en la prueba con datos reales):
 *  · Esperado = promedio recortado (sin el mayor y el menor) de las últimas 8 semanas del MISMO día de la semana, dejando afuera los días atípicos
 *    (eventos, cierres, feriados, bloqueos y días de los que todavía no entraron las reservas).
 *  · Rango = percentil 10 a 90 de las últimas 12 semanas, un poco ensanchado.
 *  · Para hoy y los 3 días siguientes se usa lo ya reservado + lo que suele sumarse hasta ese día (las reservas se hacen con 2–6 días de antelación),
 *    solo si la fecha de alta de las reservas es confiable.
 * La demanda que mide es la de las reservas (no incluye a quien llega sin reservar).
 */
import type { ReglaAforo } from '@/lib/aforo'
import { feriado } from '@/lib/feriados'

export type Banda = 'tranquilo' | 'normal' | 'alto' | 'completo'
export const BANDAS: { value: Banda; label: string; desde: number }[] = [
  { value: 'tranquilo', label: 'Tranquilo', desde: 0 }, { value: 'normal', label: 'Normal', desde: 0.4 },
  { value: 'alto', label: 'Muy lleno', desde: 0.7 }, { value: 'completo', label: 'Completo', desde: 0.9 },
]
export const bandaDe = (pct: number): Banda => (pct >= 0.9 ? 'completo' : pct >= 0.7 ? 'alto' : pct >= 0.4 ? 'normal' : 'tranquilo')

export type NivelDatos = 'completo' | 'sin_aforo' | 'poco_historial' | 'desactualizado'
export type OrigenCelda = 'historial' | 'reservas' | 'evento' | 'cerrado' | 'habitualmente_cerrado'

export interface ReservaMin { fecha: string; hora: string | null; ubicacion: string | null; sucursal_id: string | null; personas: number; creado: string }
export interface Especial { id: string | null; fecha: string; tipo: 'evento' | 'cerrado'; motivo: string | null; origen: 'manual' | 'bloqueo' | 'show' }

export interface EntradaPrediccion {
  hoy: string
  dias: number
  reservas: ReservaMin[]
  reglas: ReglaAforo[]
  especiales: Especial[]
  /** Fecha (AR) de la última reserva que entró al sistema. */
  ultimaCreada: string | null
}

export interface Celda {
  esperado: number | null
  min: number
  max: number
  reservado: number
  capacidad: number | null
  pct: number | null
  banda: Banda | null
  origen: OrigenCelda
  ubicaciones: { nombre: string; esperado: number; min: number; max: number; reservado: number; capacidad: number; pct: number; banda: Banda }[]
}
export interface FranjaPred { clave: string; etiqueta: string }
export interface DiaPred { fecha: string; dow: number; feriado: string | null; especial: Especial | null; celdas: Record<string, Celda | null> }
export interface Prediccion {
  nivel: NivelDatos
  aviso: string | null
  ultimaCreada: string | null
  semanasHistorial: number
  franjas: FranjaPred[]
  dias: DiaPred[]
}

const HORIZONTE_PICKUP = 3
const SEMANAS_BASE = 8
const SEMANAS_RANGO = 12
const ENSANCHE = 0.15
export const DIAS_SIN_DATOS = 4

const d2n = (s: string) => Math.round(Date.UTC(+s.slice(0, 4), +s.slice(5, 7) - 1, +s.slice(8, 10)) / 86400000)
const n2d = (n: number) => new Date(n * 86400000).toISOString().slice(0, 10)
const dowDe = (s: string) => new Date(d2n(s) * 86400000).getUTCDay()
const hms = (h: string) => (h.length === 5 ? h + ':00' : h)
const hhmm = (h: string) => h.slice(0, 5)
const media = (a: number[]) => (a.length ? a.reduce((x, y) => x + y, 0) / a.length : 0)
function percentil(a: number[], q: number) {
  if (!a.length) return 0
  const s = [...a].sort((x, y) => x - y); const i = (s.length - 1) * q; const lo = Math.floor(i), hi = Math.ceil(i)
  return s[lo] + (s[hi] - s[lo]) * (i - lo)
}
/** Promedio sin el mayor ni el menor (si hay al menos 6 datos): no se deja engañar por un día raro. */
function mediaRecortada(a: number[]) {
  if (a.length < 6) return media(a)
  const s = [...a].sort((x, y) => x - y)
  return media(s.slice(1, -1))
}

/** ¿La regla rige ese día? (copia de lib/aforo.vigente, que es solo de servidor) */
function vigente(r: ReglaAforo, fecha: string): boolean {
  if (r.fecha_desde && r.fecha_hasta && (fecha < r.fecha_desde || fecha > r.fecha_hasta)) return false
  if (r.dias_semana && r.dias_semana.length > 0 && !r.dias_semana.map(Number).includes(dowDe(fecha))) return false
  return true
}
const enVentana = (hora: string, desde: string, hasta: string, incluye = false) => { const h = hms(hora); return h >= hms(desde) && (h < hms(hasta) || (incluye && h === hms(hasta))) }

interface Serie { y: Map<string, number>; creado: Map<string, { personas: number; creado: string }[]> }
const nuevaSerie = (): Serie => ({ y: new Map(), creado: new Map() })
function sumar(s: Serie, r: ReservaMin) {
  s.y.set(r.fecha, (s.y.get(r.fecha) ?? 0) + r.personas)
  const l = s.creado.get(r.fecha) ?? []; l.push({ personas: r.personas, creado: r.creado }); s.creado.set(r.fecha, l)
}
/** Personas de ese día que ya estaban reservadas `k` días antes (por fecha de alta). */
const reservadoA = (s: Serie, fecha: string, k: number) => { const lim = n2d(d2n(fecha) - k); return (s.creado.get(fecha) ?? []).filter((x) => x.creado <= lim).reduce((a, x) => a + x.personas, 0) }

interface Pred { esperado: number; min: number; max: number; reservado: number; origen: OrigenCelda }

/** Predice una serie para un día: historial del mismo día de la semana (sin días atípicos) y, cerca de la fecha, lo ya reservado. */
function predecirSerie(s: Serie, fecha: string, hoy: string, excluidos: Set<string>, pickupOk: boolean): Pred {
  const base: number[] = [], rango: number[] = [], fechasBase: string[] = []
  for (let k = 1; k <= 18 && base.length < SEMANAS_RANGO; k++) {
    const f = n2d(d2n(fecha) - 7 * k)
    if (f >= hoy || excluidos.has(f)) continue
    const v = s.y.get(f) ?? 0
    rango.push(v)
    if (base.length < SEMANAS_BASE) { base.push(v); fechasBase.push(f) }
    else base.push(v)
  }
  const ult8 = base.slice(0, SEMANAS_BASE)
  const reservado = s.y.get(fecha) ?? 0
  const ceros = ult8.filter((x) => x === 0).length
  if (ult8.length >= 4 && ceros / ult8.length >= 0.75 && reservado === 0) return { esperado: 0, min: 0, max: 0, reservado: 0, origen: 'habitualmente_cerrado' }
  const esperadoBase = mediaRecortada(ult8)
  const lo = percentil(rango, 0.1) * (1 - ENSANCHE), hi = percentil(rango, 0.9) * (1 + ENSANCHE)
  const d = d2n(fecha) - d2n(hoy)
  if (pickupOk && d >= 0 && d <= HORIZONTE_PICKUP && fechasBase.length >= 4) {
    const k = Math.max(1, d)
    const faltan = fechasBase.map((f) => Math.max(0, (s.y.get(f) ?? 0) - reservadoA(s, f, k)))
    const esperado = reservado + media(faltan)
    return { esperado, min: reservado + percentil(faltan, 0.1) * (1 - ENSANCHE), max: reservado + percentil(faltan, 0.9) * (1 + ENSANCHE), reservado, origen: 'reservas' }
  }
  return { esperado: Math.max(esperadoBase, reservado), min: Math.max(lo, reservado), max: Math.max(hi, reservado), reservado, origen: 'historial' }
}

interface UbicFranja { nombre: string; sucursal: string | null; serie: Serie }
interface Franja { clave: string; etiqueta: string; desde: string; hasta: string; reglas: ReglaAforo[]; serie: Serie; ubic: Map<string, UbicFranja> }
const claveUbic = (sucursal: string | null | undefined, ubicacion: string | null | undefined) => `${sucursal ?? ''}|${ubicacion ?? ''}`

export function calcularPrediccion(e: EntradaPrediccion): Prediccion {
  const { hoy, dias } = e
  const desdeHist = n2d(d2n(hoy) - 7 * SEMANAS_RANGO - 7)
  const hist = e.reservas.filter((r) => r.fecha >= desdeHist && r.fecha < hoy)
  const primera = hist.length ? hist.reduce((m, r) => (r.fecha < m ? r.fecha : m), hist[0].fecha) : null
  const semanasHistorial = primera ? Math.floor((d2n(hoy) - d2n(primera)) / 7) : 0
  const vacio = (nivel: NivelDatos, aviso: string): Prediccion => ({ nivel, aviso, ultimaCreada: e.ultimaCreada, semanasHistorial, franjas: [], dias: [] })

  // Sin historial suficiente o sin reservas nuevas: no se predice (sería inventar)
  const totalVentana = hist.length
  if (semanasHistorial < 4 || totalVentana < 20) return vacio('poco_historial', 'Todavía no hay historial suficiente: se necesitan al menos 4 semanas de reservas. Va a aparecer solo cuando se junten.')
  if (e.ultimaCreada && d2n(hoy) - d2n(e.ultimaCreada) > DIAS_SIN_DATOS) return vacio('desactualizado', `No entraron reservas nuevas desde el ${e.ultimaCreada.slice(8, 10)}/${e.ultimaCreada.slice(5, 7)}: sin datos al día no se puede predecir.`)

  // Turnos: los horarios de las reglas de aforo. Los que se pisan (por ejemplo 20:00–21:00 y 20:30–21:00) se unen en un solo turno que va del
  // primer comienzo al último final; sin aforo, mediodía y noche.
  const conAforo = e.reglas.length > 0
  const franjas = new Map<string, Franja>()
  if (conAforo) {
    const grupos = new Map<string, { desde: string; hasta: string; reglas: ReglaAforo[] }>()
    for (const r of e.reglas) {
      const desde = hms(r.hora_desde ?? '00:00:00'), hasta = hms(r.hora_hasta ?? '24:00:00')
      const g = grupos.get(`${desde}|${hasta}`) ?? { desde, hasta, reglas: [] }
      g.reglas.push(r); grupos.set(`${desde}|${hasta}`, g)
    }
    const unidos: { desde: string; hasta: string; reglas: ReglaAforo[] }[] = []
    for (const g of [...grupos.values()].sort((x, y) => x.desde.localeCompare(y.desde) || x.hasta.localeCompare(y.hasta))) {
      const u = unidos[unidos.length - 1]
      if (u && g.desde < u.hasta) { if (g.hasta > u.hasta) u.hasta = g.hasta; u.reglas.push(...g.reglas) } else unidos.push({ desde: g.desde, hasta: g.hasta, reglas: [...g.reglas] })
    }
    for (const g of unidos) {
      const clave = `${hhmm(g.desde)}-${hhmm(g.hasta)}`
      franjas.set(clave, { clave, etiqueta: '', desde: g.desde, hasta: g.hasta, reglas: g.reglas, serie: nuevaSerie(), ubic: new Map() })
    }
  } else {
    for (const [clave, desde, hasta, nombre] of [['00:00-16:00', '00:00:00', '16:00:00', 'Mediodía'], ['16:00-24:00', '16:00:00', '24:00:00', 'Noche']] as const) franjas.set(clave, { clave, etiqueta: nombre, desde, hasta, reglas: [], serie: nuevaSerie(), ubic: new Map() })
  }
  for (const f of franjas.values()) {
    f.etiqueta = f.etiqueta || `${hhmm(f.desde) < '16:00' ? 'Mediodía' : 'Noche'} ${hhmm(f.desde)}–${hhmm(f.hasta)}`
    for (const r of f.reglas) if (r.ubicacion) { const k = claveUbic(r.sucursal_id, r.ubicacion); if (!f.ubic.has(k)) f.ubic.set(k, { nombre: r.ubicacion, sucursal: r.sucursal_id, serie: nuevaSerie() }) }
  }
  // Una reserva cuenta en un turno si cae en un lugar que ese turno cubre con su aforo (una regla de solo el salón no cuenta lo de los toldos);
  // las que no tienen un lugar con regla (sin ubicación o "cualquiera") cuentan siempre: se van a sentar en algún lado.
  const ubicacionesConRegla = new Set(e.reglas.map((x) => x.ubicacion).filter(Boolean) as string[])
  const cubre = (f: Franja, r: ReservaMin) => !r.ubicacion || !ubicacionesConRegla.has(r.ubicacion) || f.reglas.length === 0 || f.reglas.some((x) => (!x.sucursal_id || x.sucursal_id === r.sucursal_id) && (!x.ubicacion || x.ubicacion === r.ubicacion))
  for (const r of e.reservas) {
    if (!r.hora) continue
    for (const f of franjas.values()) {
      if (!enVentana(r.hora, f.desde, f.hasta, f.reglas.some((x) => x.incluye_hasta === true)) || !cubre(f, r)) continue
      sumar(f.serie, r)
      for (const u of f.ubic.values()) if (u.nombre === r.ubicacion && (!u.sucursal || u.sucursal === r.sucursal_id)) sumar(u.serie, r)
    }
  }
  // franjas sin movimiento en las últimas semanas (solo en el modo sin aforo) no se muestran
  const lista = [...franjas.values()].filter((f) => conAforo || [...f.serie.y.keys()].some((x) => x >= desdeHist && x < hoy)).sort((a, b) => a.desde.localeCompare(b.desde) || a.hasta.localeCompare(b.hasta))

  // ¿la fecha de alta sirve? (las reservas importadas tienen el alta posterior a la fecha de la reserva)
  const recientes = hist.filter((r) => r.fecha >= n2d(d2n(hoy) - 56))
  const pickupOk = recientes.length >= 10 && recientes.filter((r) => r.creado <= r.fecha).length / recientes.length >= 0.85

  // Días atípicos: no cuentan para el promedio
  const espPorFecha = new Map(e.especiales.map((x) => [x.fecha, x]))
  const excluidos = new Set<string>([...espPorFecha.keys()])
  for (let n = d2n(desdeHist); n < d2n(hoy); n++) { const f = n2d(n); if (feriado(f)) excluidos.add(f) }
  // los días posteriores a la última reserva que entró están incompletos
  if (e.ultimaCreada) for (let n = d2n(e.ultimaCreada) + 1; n < d2n(hoy); n++) excluidos.add(n2d(n))

  const salida: DiaPred[] = []
  for (let i = 0; i < dias; i++) {
    const fecha = n2d(d2n(hoy) + i)
    const esp = espPorFecha.get(fecha) ?? null
    const fer = feriado(fecha)
    const celdas: Record<string, Celda | null> = {}
    for (const f of lista) {
      const vig = f.reglas.filter((r) => vigente(r, fecha))
      if (conAforo && vig.length === 0) { celdas[f.clave] = null; continue }
      // aforo del turno ese día: por ubicación rige el tope más estricto de las reglas que se pisan (p. ej. 30 para 20:00–21:00 y 40 para 20:30–21:00 → 30)
      const capPorUbic = new Map<string, number>()
      for (const r of vig) { const k = claveUbic(r.sucursal_id, r.ubicacion); capPorUbic.set(k, Math.min(capPorUbic.get(k) ?? Infinity, r.maximo)) }
      const capacidad = conAforo ? [...capPorUbic.values()].reduce((a, c) => a + c, 0) : null
      const reservado = f.serie.y.get(fecha) ?? 0
      let p: Pred
      if (esp?.tipo === 'cerrado') p = { esperado: 0, min: 0, max: 0, reservado, origen: 'cerrado' }
      else if (esp?.tipo === 'evento') p = { esperado: NaN, min: reservado, max: reservado, reservado, origen: 'evento' }
      else {
        p = predecirSerie(f.serie, fecha, hoy, excluidos, pickupOk)
        if (fer) p = { ...p, max: Math.max(p.max, p.esperado * 1.4) }   // feriado: el día puede salir distinto, el rango se abre hacia arriba
      }
      const sinPred = Number.isNaN(p.esperado)
      const ubic = conAforo && !sinPred && p.origen !== 'cerrado' && p.origen !== 'habitualmente_cerrado'
        ? [...f.ubic.entries()].filter(([k]) => capPorUbic.has(k)).map(([k, u]) => {
          const cap = capPorUbic.get(k)!
          const q = predecirSerie(u.serie, fecha, hoy, excluidos, pickupOk)
          const pct = cap ? q.esperado / cap : 0
          return { nombre: u.nombre, esperado: Math.round(q.esperado), min: Math.round(q.min), max: Math.round(q.max), reservado: q.reservado, capacidad: cap, pct, banda: bandaDe(pct) }
        }) : []
      const pct = capacidad && !sinPred ? p.esperado / capacidad : null
      celdas[f.clave] = { esperado: sinPred ? null : Math.round(p.esperado), min: Math.round(p.min), max: Math.round(p.max), reservado: p.reservado, capacidad, pct, banda: pct === null ? null : bandaDe(pct), origen: p.origen, ubicaciones: ubic }
    }
    salida.push({ fecha, dow: dowDe(fecha), feriado: fer, especial: esp, celdas })
  }
  return { nivel: conAforo ? 'completo' : 'sin_aforo', aviso: conAforo ? null : 'Este negocio no tiene el aforo cargado: se muestran las personas esperadas, sin porcentaje de ocupación.', ultimaCreada: e.ultimaCreada, semanasHistorial, franjas: lista.map((f) => ({ clave: f.clave, etiqueta: f.etiqueta })), dias: salida }
}
