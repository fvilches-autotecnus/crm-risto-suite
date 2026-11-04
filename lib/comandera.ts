import { categoriaDeItem } from '@/lib/pedidos'

/** Columnas de un pedido para armar su ticket (80 mm). Las usan la página del ticket y la comandera. */
export const COLS_TICKET = 'id, numero, nombre, telefono, tipo, entrega_nombre, medio_pago_nombre, mesa, direccion, observaciones, medio_pago, estado, subtotal, envio, total, descuento, descuento_nombre, creado_en, items:pedido_items(id, nombre, variante, cantidad, observaciones, subtotal, producto:carta_productos(categoria:carta_categorias(nombre)))'

export interface DatosTicket {
  id: string; numero: number; creado_en: string; nombre: string; telefono: string | null
  tipo: string; entrega_nombre: string | null; mesa: string | null; direccion: string | null
  medio_pago: string; medio_pago_nombre: string | null; observaciones: string | null
  subtotal: number; envio: number; descuento: number; descuento_nombre: string | null; total: number
  items: { id: string; nombre: string; variante: string | null; cantidad: number; observaciones: string | null; subtotal: number; categoria: string | null }[]
}

type Fila = Record<string, unknown>

/** Fila de `pedidos` (leída con COLS_TICKET) → datos listos para imprimir. */
export function aDatosTicket(p: Fila): DatosTicket {
  const items = Array.isArray(p.items) ? (p.items as Fila[]) : []
  return {
    id: String(p.id), numero: Number(p.numero), creado_en: String(p.creado_en), nombre: String(p.nombre ?? ''), telefono: (p.telefono as string | null) ?? null,
    tipo: String(p.tipo), entrega_nombre: (p.entrega_nombre as string | null) ?? null, mesa: (p.mesa as string | null) ?? null, direccion: (p.direccion as string | null) ?? null,
    medio_pago: String(p.medio_pago ?? ''), medio_pago_nombre: (p.medio_pago_nombre as string | null) ?? null, observaciones: (p.observaciones as string | null) ?? null,
    subtotal: Number(p.subtotal ?? 0), envio: Number(p.envio ?? 0), descuento: Number(p.descuento ?? 0), descuento_nombre: (p.descuento_nombre as string | null) ?? null, total: Number(p.total ?? 0),
    items: items.map((i) => ({
      id: String(i.id), nombre: String(i.nombre), variante: (i.variante as string | null) ?? null, cantidad: Number(i.cantidad), observaciones: (i.observaciones as string | null) ?? null,
      subtotal: Number(i.subtotal ?? 0), categoria: categoriaDeItem(i),
    })),
  }
}
