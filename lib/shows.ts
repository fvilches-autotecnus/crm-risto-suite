/**
 * Shows y eventos (módulo "Shows"): cartelera con imagen, fecha, ubicación (o todo el local) y una de tres modalidades:
 *  · reserva  → se reserva mesa en el sitio de reservas del local (el enlace ya lleva la fecha, la ubicación y un código de campaña para medir cuántas reservas trajo)
 *  · derivada → las reservas las toma otra producción (enlace a su WhatsApp o su sitio)
 *  · entradas → solo entradas, a la venta en un sitio externo
 */
import { sinTildes } from '@/lib/validar'

export type ModalidadShow = 'reserva' | 'derivada' | 'entradas'

export const MODALIDADES: { clave: ModalidadShow; label: string; ayuda: string; boton: string }[] = [
  { clave: 'reserva', label: 'Reserva de mesa en el local', ayuda: 'El cliente reserva por el sitio de reservas, con la fecha del show ya elegida.', boton: 'Reservar mesa' },
  { clave: 'derivada', label: 'Reservas con otra producción', ayuda: 'Las toma otra producción: el botón lleva a su WhatsApp o a su sitio.', boton: 'Reservar con la producción' },
  { clave: 'entradas', label: 'Solo entradas', ayuda: 'Las entradas se venden en un sitio externo: el botón lleva a ese enlace.', boton: 'Comprar entradas' },
]
export const modalidadDe = (c: string) => MODALIDADES.find((m) => m.clave === c) ?? MODALIDADES[0]

export interface Show {
  id: string; titulo: string; descripcion: string | null; imagen_path: string | null
  fecha: string; hora: string | null; ubicacion_id: string | null; modalidad: ModalidadShow; enlace: string | null; visible: boolean
}

/** Un show tal como lo ve el sitio de reservas: con la dirección de su imagen y el nombre de su ubicación (null = todo el local). */
export interface ShowWeb { id: string; titulo: string; descripcion: string | null; img: string | null; fecha: string; hora: string | null; ubicacion: string | null; modalidad: ModalidadShow; enlace: string | null }

/** Lo que escribe la persona en "enlace" → URL lista para usar. '' → null (sin enlace); algo que no es un enlace ni un teléfono → undefined. */
export function normalizarEnlace(texto: string): string | null | undefined {
  const s = texto.trim()
  if (!s) return null
  const digitos = s.replace(/[\s()+-]/g, '')
  if (/^\d{8,15}$/.test(digitos)) return `https://wa.me/${digitos}`   // un número de WhatsApp
  const url = /^https?:\/\//i.test(s) ? s : /^[\w-]+(\.[\w-]+)+([/?#]|$)/.test(s) ? 'https://' + s : null
  if (!url) return undefined
  try { const u = new URL(url); return u.protocol === 'https:' || u.protocol === 'http:' ? u.toString() : undefined } catch { return undefined }
}

/** Código de campaña de las reservas que vienen de un show: "show-tributo-a-queen-1114" (título + día y mes). Se ve en Campañas. */
export const codigoCampanaShow = (titulo: string, fecha: string) =>
  `show-${sinTildes(titulo).slice(0, 22).replace(/-+$/, '')}-${fecha.slice(5, 7)}${fecha.slice(8, 10)}`.replace(/-+/g, '-')

/** Enlace (relativo) al sitio de reservas con la fecha, la ubicación y la campaña del show. Pasa la ubicación solo si el show es de una. */
export function enlaceReservaShow(slug: string, s: Pick<Show, 'titulo' | 'fecha'>, ubicacion: string | null): string {
  const q = new URLSearchParams({ fecha: s.fecha, ...(ubicacion ? { ubicacion } : {}), c: codigoCampanaShow(s.titulo, s.fecha) })
  return `/reservar/${slug}?${q.toString()}`
}
