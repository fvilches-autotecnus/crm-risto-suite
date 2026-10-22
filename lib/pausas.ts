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
