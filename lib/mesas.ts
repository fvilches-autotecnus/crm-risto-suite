/** Salón y mesas: tipos y cálculos del plano (estado de cada mesa en un momento, sugerencia de mesas, superposición). Sin dependencias de servidor. */

export interface Salon { id: string; nombre: string; orden: number; ancho: number; alto: number; sucursal_id: string | null; ubicacion: string | null; activo: boolean; tema_sillas: string; color_sillas: string | null }
export interface Mesa {
  id: string; salon_id: string; tipo: 'mesa' | 'deco'; numero: string; capacidad: number | null; capacidad_min: number; movil: boolean
  x: number; y: number; w: number; h: number; forma: 'cuadrada' | 'redonda'; activa: boolean; ocupada_desde: string | null; ocupada_pax: number | null
  rotacion: number; sillas: boolean; sillas_lados: string[] | null
}
export interface ReservaSalon {
  id: string; numero: number; numero_sede?: number | null; cliente_nombre: string | null; cliente_telefono: string | null; hora: string | null; cantidad_personas: number | null; estado: string
  ubicacion: string | null; observaciones: string | null; asistio_en: string | null; sentada_en: string | null; liberada_en: string | null; mesas: string[]
}
export type EstadoMesa = 'libre' | 'reservada' | 'llego' | 'ocupada' | 'inactiva'

export const ESTADOS_MESA: Record<EstadoMesa, { label: string; clases: string; punto: string }> = {
  libre: { label: 'Libre', clases: 'border-rs-ok/60 bg-rs-ok/10 text-rs-text', punto: 'bg-rs-ok' },
  reservada: { label: 'Reservada', clases: 'border-rs-lav/70 bg-rs-lav/15 text-rs-text', punto: 'bg-rs-lav' },
  llego: { label: 'Llegó', clases: 'border-rs-warn/80 bg-rs-warn/20 text-rs-text', punto: 'bg-rs-warn' },
  ocupada: { label: 'Ocupada', clases: 'border-rs-danger/80 bg-rs-danger/20 text-rs-text', punto: 'bg-rs-danger' },
  inactiva: { label: 'Fuera de servicio', clases: 'border-rs-border bg-rs-raised/40 text-rs-muted', punto: 'bg-rs-muted' },
}

/** "21:30" o "21:30:00" → minutos desde la medianoche (null si no hay hora). */
export const aMinutos = (h: string | null | undefined): number | null => { const m = /^(\d{1,2}):(\d{2})/.exec(h ?? ''); return m ? Number(m[1]) * 60 + Number(m[2]) : null }
export const deMinutos = (min: number) => `${String(Math.floor(min / 60) % 24).padStart(2, '0')}:${String(min % 60).padStart(2, '0')}`

/** ¿Se superponen dos rectángulos del plano? */
export const seSuperponen = (a: { x: number; y: number; w: number; h: number }, b: { x: number; y: number; w: number; h: number }) =>
  a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h

const ACTIVAS = ['nueva', 'confirmada', 'pendiente_pago', 'revisar_pago']

/** "2–4" (o solo "4" cuando no hay mínimo). */
export const rangoCapacidad = (m: Pick<Mesa, 'capacidad' | 'capacidad_min'>) => ((m.capacidad_min ?? 1) > 1 ? `${m.capacidad_min}–${m.capacidad}` : `${m.capacidad}`)
/** Un conjunto de mesas se puede juntar solo si son todas móviles (una mesa sola siempre se puede). */
export const sePuedenJuntar = (ms: Pick<Mesa, 'movil'>[]) => ms.length <= 1 || ms.every((m) => m.movil)

/** Reservas que, en el minuto `t`, tienen tomada esa mesa (ventana desde 30 min antes de la hora hasta que termina la duración típica). */
export function reservasDeMesa(mesaId: string, reservas: ReservaSalon[], t: number, duracion: number, esHoy: boolean): ReservaSalon[] {
  return reservas.filter((r) => {
    if (!r.mesas.includes(mesaId) || !ACTIVAS.includes(r.estado) || r.liberada_en) return false
    if (r.sentada_en && esHoy) return true   // ya está sentada: ocupa hasta que la liberen
    const h = aMinutos(r.hora)
    return h !== null && t >= h - 30 && t < h + duracion
  })
}

/** Estado de una mesa a la hora elegida. En el día de hoy cuentan también la ocupación manual y las reservas que ya llegaron / se sentaron. */
export function estadoMesa(m: Mesa, reservas: ReservaSalon[], t: number, duracion: number, esHoy: boolean): { estado: EstadoMesa; reservas: ReservaSalon[] } {
  if (!m.activa) return { estado: 'inactiva', reservas: [] }
  const rs = reservasDeMesa(m.id, reservas, t, duracion, esHoy)
  if (esHoy && (m.ocupada_desde || rs.some((r) => r.sentada_en && !r.liberada_en))) return { estado: 'ocupada', reservas: rs }
  if (esHoy && rs.some((r) => r.asistio_en && !r.sentada_en)) return { estado: 'llego', reservas: rs }
  return { estado: rs.length ? 'reservada' : 'libre', reservas: rs }
}

/** ¿La mesa está tomada por OTRA reserva cerca de la hora de `reserva`? (misma regla que usa la base: menos de `duracion` minutos de diferencia) */
export function conflictoCon(mesaId: string, reserva: ReservaSalon, todas: ReservaSalon[], duracion: number): ReservaSalon | null {
  const h = aMinutos(reserva.hora)
  if (h === null) return null
  return todas.find((o) => o.id !== reserva.id && o.mesas.includes(mesaId) && ACTIVAS.includes(o.estado) && !o.liberada_en && aMinutos(o.hora) !== null && Math.abs(aMinutos(o.hora)! - h) < duracion) ?? null
}

const centro = (m: Mesa) => ({ cx: m.x + m.w / 2, cy: m.y + m.h / 2 })

/** Sugiere mesas para una reserva: una sola mesa libre lo más justa posible, o si no alcanza, las 2-3 mesas libres más cercanas entre sí que sumen lugar. */
export function sugerirMesas(reserva: ReservaSalon, mesas: Mesa[], todas: ReservaSalon[], duracion: number): string[] {
  const pax = reserva.cantidad_personas ?? 2
  const libres = mesas.filter((m) => m.tipo === 'mesa' && m.activa && m.capacidad && !conflictoCon(m.id, reserva, todas, duracion))
  // una sola mesa: el grupo tiene que estar entre su capacidad mínima y máxima
  const unica = libres.filter((m) => m.capacidad! >= pax && pax >= (m.capacidad_min ?? 1)).sort((a, b) => a.capacidad! - pax - (b.capacidad! - pax) || a.numero.localeCompare(b.numero, 'es', { numeric: true }))[0]
  if (unica) return [unica.id]
  let mejor: { ids: string[]; costo: number } | null = null
  const dist = (a: Mesa, b: Mesa) => Math.hypot(centro(a).cx - centro(b).cx, centro(a).cy - centro(b).cy)
  const juntables = libres.filter((m) => m.movil)   // solo las móviles se pueden juntar
  for (let i = 0; i < juntables.length; i++) for (let j = i + 1; j < juntables.length; j++) {
    if (juntables[i].salon_id !== juntables[j].salon_id) continue
    const cap2 = juntables[i].capacidad! + juntables[j].capacidad!, min2 = juntables[i].capacidad_min + juntables[j].capacidad_min
    if (cap2 >= pax && pax >= min2) { const costo = (cap2 - pax) * 2 + dist(juntables[i], juntables[j]); if (!mejor || costo < mejor.costo) mejor = { ids: [juntables[i].id, juntables[j].id], costo } }
    else for (let k = j + 1; k < juntables.length; k++) {
      if (juntables[k].salon_id !== juntables[i].salon_id) continue
      const cap3 = cap2 + juntables[k].capacidad!, min3 = min2 + juntables[k].capacidad_min
      if (cap3 >= pax && pax >= min3) { const costo = (cap3 - pax) * 2 + dist(juntables[i], juntables[j]) + dist(juntables[j], juntables[k]) + 4; if (!mejor || costo < mejor.costo) mejor = { ids: [juntables[i].id, juntables[j].id, juntables[k].id], costo } }
    }
  }
  return mejor?.ids ?? []
}
