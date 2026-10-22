/** Textos y formato de la pantalla "Chats pausados" (sin dependencias de servidor: lo usan páginas y componentes). */
export const MOTIVOS_PAUSA = [
  { value: 'consulta', label: 'Consulta' },
  { value: 'reserva', label: 'Solicitud de reserva' },
  { value: 'otro', label: 'Otro motivo' },
]
export const motivoValido = (m: string | null | undefined) => (m === 'consulta' || m === 'reserva' ? m : 'otro')
export const labelMotivoPausa = (m: string | null | undefined) => MOTIVOS_PAUSA.find((x) => x.value === motivoValido(m))!.label

/** "hace 5 min", "hace 3 h", "hace 2 días" a partir de una fecha ISO. */
export function hace(iso: string | null, ahora: number = Date.now()): string {
  if (!iso) return 'sin dato'
  const s = Math.max(0, Math.round((ahora - new Date(iso).getTime()) / 1000))
  if (s < 60) return 'hace instantes'
  const m = Math.floor(s / 60)
  if (m < 60) return `hace ${m} min`
  const h = Math.floor(m / 60)
  if (h < 24) return `hace ${h} h`
  const d = Math.floor(h / 24)
  return d === 1 ? 'hace 1 día' : `hace ${d} días`
}

/** "en 25 min", "en 3 h", "en 2 días" a partir de una fecha ISO futura. */
export function dentroDe(iso: string | null, ahora: number = Date.now()): string {
  if (!iso) return ''
  const s = Math.round((new Date(iso).getTime() - ahora) / 1000)
  if (s <= 60) return 'en instantes'
  const m = Math.ceil(s / 60)
  if (m < 60) return `en ${m} min`
  const h = Math.round(m / 60)
  if (h < 24) return `en ${h} h`
  const d = Math.round(h / 24)
  return d === 1 ? 'en 1 día' : `en ${d} días`
}

// ---------------------------------------------------------------------------
// Pausa automática (negocios.modulos.pausa_auto = { consulta, reserva, otro } en minutos; null = indefinida)
// ---------------------------------------------------------------------------
export const MAX_PAUSA_MIN = 43200   // 30 días
export const UNIDADES_PAUSA = [
  { v: 'min', l: 'minutos', m: 1 },
  { v: 'h', l: 'horas', m: 60 },
  { v: 'd', l: 'días', m: 1440 },
] as const
export type UnidadPausa = (typeof UNIDADES_PAUSA)[number]['v']
export interface PausaAuto { consulta: number | null; reserva: number | null; otro: number | null }

export function leerPausaAuto(modulos: unknown): PausaAuto {
  const p = ((modulos as { pausa_auto?: Record<string, unknown> } | null)?.pausa_auto ?? {}) as Record<string, unknown>
  const v = (x: unknown) => (typeof x === 'number' && Number.isInteger(x) && x > 0 && x <= MAX_PAUSA_MIN ? x : null)
  return { consulta: v(p.consulta), reserva: v(p.reserva), otro: v(p.otro) }
}

/** 90 -> { valor: "90", unidad: "min" }, 120 -> { "2", "h" }, 2880 -> { "2", "d" }: la unidad más grande que lo divide exacto. */
export function partirMinutos(min: number | null): { valor: string; unidad: UnidadPausa } {
  if (!min) return { valor: '', unidad: 'h' }
  if (min % 1440 === 0) return { valor: String(min / 1440), unidad: 'd' }
  if (min % 60 === 0) return { valor: String(min / 60), unidad: 'h' }
  return { valor: String(min), unidad: 'min' }
}

export function textoPausa(min: number | null): string {
  if (!min) return 'Indefinida'
  const { valor, unidad } = partirMinutos(min)
  return unidad === 'd' ? `${valor} ${valor === '1' ? 'día' : 'días'}` : unidad === 'h' ? `${valor} h` : `${valor} min`
}
