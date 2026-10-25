/** Pedidos: tipos, estados y textos (se usan en el panel, en la carta pública y en el ticket). */

export type TipoPedido = 'retiro' | 'delivery' | 'mesa'
export type EstadoPedido = 'nuevo' | 'aceptado' | 'preparando' | 'listo' | 'en_camino' | 'entregado' | 'cancelado'
export type MedioPago = 'efectivo' | 'transferencia' | 'tarjeta'

export interface ConfigPedidos {
  recibe: boolean; retiro: boolean; delivery: boolean; mesa: boolean
  costo_envio: number; pedido_minimo: number; tiempo_estimado: string | null
  medios_pago: MedioPago[]; datos_pago: string | null; mensaje: string | null
}
export const CONFIG_PEDIDOS_POR_DEFECTO: ConfigPedidos = { recibe: false, retiro: true, delivery: false, mesa: false, costo_envio: 0, pedido_minimo: 0, tiempo_estimado: null, medios_pago: ['efectivo'], datos_pago: null, mensaje: null }

export interface ItemPedido { id: string; nombre: string; variante: string | null; precio_unit: number; cantidad: number; observaciones: string | null; subtotal: number }
export interface Pedido {
  id: string; numero: number; nombre: string; telefono: string | null; tipo: TipoPedido; mesa: string | null; direccion: string | null; observaciones: string | null
  medio_pago: MedioPago; estado: EstadoPedido; subtotal: number; envio: number; total: number; motivo_cancelacion: string | null; origen: 'web' | 'bot' | 'manual'
  creado_en: string; aceptado_en: string | null; listo_en: string | null; entregado_en: string | null; cancelado_en: string | null
  items: ItemPedido[]
}

export const TIPOS: { value: TipoPedido; label: string; corto: string }[] = [
  { value: 'retiro', label: 'Retiro en el local', corto: 'Retiro' },
  { value: 'delivery', label: 'Delivery (envío a domicilio)', corto: 'Delivery' },
  { value: 'mesa', label: 'En mesa', corto: 'Mesa' },
]
export const MEDIOS_PAGO: { value: MedioPago; label: string }[] = [
  { value: 'efectivo', label: 'Efectivo' }, { value: 'transferencia', label: 'Transferencia' }, { value: 'tarjeta', label: 'Tarjeta (al retirar o recibir)' },
]
export const labelTipo = (t: string) => TIPOS.find((x) => x.value === t)?.corto ?? t
export const labelPago = (m: string) => MEDIOS_PAGO.find((x) => x.value === m)?.label.split(' (')[0] ?? m

export const ESTADOS_PEDIDO: { value: EstadoPedido; label: string; color: string; punto: string }[] = [
  { value: 'nuevo', label: 'Nuevo', color: 'bg-rs-lav/15 text-rs-lav', punto: 'bg-rs-lav' },
  { value: 'aceptado', label: 'Aceptado', color: 'bg-rs-lime/15 text-rs-lime', punto: 'bg-rs-lime' },
  { value: 'preparando', label: 'Preparando', color: 'bg-rs-warn/15 text-rs-warn', punto: 'bg-rs-warn' },
  { value: 'listo', label: 'Listo', color: 'bg-rs-ok/15 text-rs-ok', punto: 'bg-rs-ok' },
  { value: 'en_camino', label: 'En camino', color: 'bg-rs-ok/15 text-rs-ok', punto: 'bg-rs-ok' },
  { value: 'entregado', label: 'Entregado', color: 'bg-rs-raised text-rs-muted', punto: 'bg-rs-muted' },
  { value: 'cancelado', label: 'Cancelado', color: 'bg-rs-danger/15 text-rs-danger', punto: 'bg-rs-danger' },
]
export const labelEstadoPedido = (e: string) => ESTADOS_PEDIDO.find((x) => x.value === e)?.label ?? e
export const ESTADOS_ACTIVOS: EstadoPedido[] = ['nuevo', 'aceptado', 'preparando', 'listo', 'en_camino']

/** Siguiente paso "normal" de un pedido (el botón principal de la tarjeta). */
export function siguientePaso(p: Pick<Pedido, 'estado' | 'tipo'>): { estado: EstadoPedido; label: string } | null {
  switch (p.estado) {
    case 'nuevo': return { estado: 'aceptado', label: 'Aceptar' }
    case 'aceptado': return { estado: 'preparando', label: 'Preparando' }
    case 'preparando': return { estado: 'listo', label: 'Listo' }
    case 'listo': return p.tipo === 'delivery' ? { estado: 'en_camino', label: 'Salió a entregar' } : { estado: 'entregado', label: 'Entregado' }
    case 'en_camino': return { estado: 'entregado', label: 'Entregado' }
    default: return null
  }
}

export const dinero = (n: number, moneda = '$') => `${moneda} ${Number(n).toLocaleString('es-AR', { minimumFractionDigits: Number.isInteger(Number(n)) ? 0 : 2, maximumFractionDigits: 2 })}`

/** Mensaje para avisar al cliente por WhatsApp según el estado del pedido. */
export function mensajeWhatsApp(p: Pick<Pedido, 'numero' | 'nombre' | 'estado' | 'tipo' | 'total' | 'motivo_cancelacion'>, negocio: string, tiempo?: string | null): string {
  const hola = `Hola ${p.nombre.split(' ')[0]}, te escribimos de ${negocio} por tu pedido #${p.numero}.`
  switch (p.estado) {
    case 'nuevo': return `${hola} Lo recibimos y lo estamos revisando.`
    case 'aceptado': return `${hola} ¡Lo confirmamos!${tiempo ? ` Demora estimada: ${tiempo}.` : ''}`
    case 'preparando': return `${hola} Ya lo estamos preparando.`
    case 'listo': return p.tipo === 'delivery' ? `${hola} Tu pedido está listo y sale en breve.` : `${hola} ¡Tu pedido está listo para retirar!`
    case 'en_camino': return `${hola} Tu pedido va en camino.`
    case 'entregado': return `${hola} ¡Gracias por tu pedido! Esperamos que lo disfrutes.`
    case 'cancelado': return `${hola} Lamentablemente tuvimos que cancelarlo${p.motivo_cancelacion ? ` (${p.motivo_cancelacion})` : ''}. Disculpá las molestias.`
  }
}
export const linkWhatsApp = (telefono: string, texto: string) => `https://wa.me/${telefono.replace(/\D/g, '')}?text=${encodeURIComponent(texto)}`

/** Mensajes claros para los errores de crear_pedido (los muestra la carta pública y el CRM). */
export const ERRORES_PEDIDO: Record<string, string> = {
  negocio_no_encontrado: 'No encontramos este negocio.',
  modulo_apagado: 'Este negocio no está tomando pedidos por este medio.',
  pedidos_cerrados: 'Por el momento no estamos tomando pedidos. Probá de nuevo más tarde.',
  tipo_invalido: 'Elegí cómo querés recibir el pedido.',
  tipo_no_disponible: 'Esa forma de entrega no está disponible.',
  falta_nombre: 'Escribí tu nombre.',
  telefono_invalido: 'Revisá el teléfono: lo necesitamos para avisarte de tu pedido.',
  falta_direccion: 'Escribí la dirección de entrega.',
  falta_mesa: 'Indicá el número de mesa.',
  medio_pago_no_disponible: 'Ese medio de pago no está disponible.',
  sin_items: 'Agregá al menos un producto.',
  demasiados_items: 'El pedido tiene demasiados productos.',
  cantidad_invalida: 'Revisá las cantidades.',
  producto_no_disponible: 'Algún producto ya no está disponible. Revisá tu pedido.',
  falta_variante: 'Elegí el tamaño u opción de cada producto.',
  producto_sin_precio: 'Algún producto no tiene precio cargado. Consultanos por ese producto.',
  demasiados_pedidos: 'Hiciste varios pedidos seguidos. Esperá unos minutos o escribinos.',
  total_excedido: 'El total supera el máximo permitido.',
  error_interno: 'No pudimos registrar tu pedido. Probá de nuevo.',
}
export const mensajeError = (codigo: string | undefined, extra?: { minimo?: number }) =>
  codigo === 'pedido_minimo' ? `El pedido mínimo es ${dinero(extra?.minimo ?? 0)}.` : ERRORES_PEDIDO[codigo ?? ''] ?? 'No pudimos registrar tu pedido. Probá de nuevo.'
