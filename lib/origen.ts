/** Origen del cliente: cómo llegó la primera vez. Se guarda una sola vez (al crear el cliente) y no se modifica más. */
export const ORIGENES = [
  { value: 'whatsapp', label: 'WhatsApp' },
  { value: 'qr_carta', label: 'QR Carta' },
  { value: 'qr_wifi', label: 'QR Wifi' },
  { value: 'manual', label: 'Manual' },
] as const

export const labelOrigen = (v: string | null | undefined) => ORIGENES.find((o) => o.value === v)?.label ?? (v ? v.charAt(0).toUpperCase() + v.slice(1).replace(/_/g, ' ') : 'Manual')
