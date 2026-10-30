/** Pedidos: tipos, estados y textos (se usan en el panel, en la carta pública y en el ticket). */

export type TipoPedido = 'retiro' | 'delivery' | 'mesa'
export type EstadoPedido = 'nuevo' | 'aceptado' | 'preparando' | 'listo' | 'en_camino' | 'entregado' | 'cancelado'
export type MedioPago = 'efectivo' | 'transferencia' | 'tarjeta'

/** Franja horaria "desde-hasta" ("12:00", "15:00"); "24:00" vale para el cierre a medianoche. */
export type Turno = [string, string]
/** Por día de la semana (0 = domingo … 6 = sábado): las franjas en que se reciben pedidos. Un día sin franjas está cerrado. */
export type HorariosSemana = Partial<Record<'0' | '1' | '2' | '3' | '4' | '5' | '6', Turno[]>>

/**
 * Forma de entrega del negocio (catálogo propio, como los tipos de reserva). `base` define qué datos se piden y cómo se cobra:
 * retiro (teléfono) · delivery (teléfono, dirección y costo de envío) · mesa (número de mesa).
 */
export interface EntregaPedido {
  clave: string; etiqueta: string; base: TipoPedido; activo: boolean; orden: number
  costo_envio: number; envio_gratis_desde: number | null
  /** null = usa el tiempo general. */
  tiempo: string | null
  /** null = usa los horarios generales. */
  horarios: HorariosSemana | null
  /** Claves de los medios de pago que acepta (null = todos los activos). */
  medios: string[] | null
}
/** Medio de pago del negocio. `aviso` se ve al elegirlo y al confirmar; `datos` (alias, CBU, link) solo al confirmar el pedido. */
export interface MedioPedido { clave: string; etiqueta: string; aviso: string | null; datos: string | null; activo: boolean; orden: number }

export interface ConfigPedidos {
  recibe: boolean; pedido_minimo: number; tiempo_estimado: string | null
  mensaje: string | null; mensaje_cerrado: string | null
  aceptar_auto: boolean
  usar_horarios: boolean; horarios: HorariosSemana; fechas_cerradas: string[]
  entregas: EntregaPedido[]; medios: MedioPedido[]
}
/** Formas de entrega y medios de pago con los que arranca un negocio (iguales a lo que se siembra en la base). */
export const ENTREGAS_POR_DEFECTO: EntregaPedido[] = [
  { clave: 'retiro', etiqueta: 'Retiro en el local', base: 'retiro', activo: true, orden: 1, costo_envio: 0, envio_gratis_desde: null, tiempo: null, horarios: null, medios: null },
  { clave: 'delivery', etiqueta: 'Delivery', base: 'delivery', activo: false, orden: 2, costo_envio: 0, envio_gratis_desde: null, tiempo: null, horarios: null, medios: null },
  { clave: 'mesa', etiqueta: 'En mesa', base: 'mesa', activo: false, orden: 3, costo_envio: 0, envio_gratis_desde: null, tiempo: null, horarios: null, medios: null },
]
export const MEDIOS_POR_DEFECTO: MedioPedido[] = [
  { clave: 'efectivo', etiqueta: 'Efectivo', aviso: null, datos: null, activo: true, orden: 1 },
  { clave: 'transferencia', etiqueta: 'Transferencia', aviso: null, datos: null, activo: false, orden: 2 },
  { clave: 'tarjeta', etiqueta: 'Tarjeta', aviso: null, datos: null, activo: false, orden: 3 },
]
export const CONFIG_PEDIDOS_POR_DEFECTO: ConfigPedidos = {
  recibe: false, pedido_minimo: 0, tiempo_estimado: null, mensaje: null, mensaje_cerrado: null, aceptar_auto: false,
  usar_horarios: false, horarios: {}, fechas_cerradas: [], entregas: ENTREGAS_POR_DEFECTO, medios: MEDIOS_POR_DEFECTO,
}
/** Columnas de cada tabla que se leen en el panel y en la carta pública. */
export const COLS_CONFIG_PEDIDOS = 'recibe, pedido_minimo, tiempo_estimado, mensaje, mensaje_cerrado, aceptar_auto, usar_horarios, horarios, fechas_cerradas'
export const COLS_ENTREGAS = 'clave, etiqueta, base, activo, orden, costo_envio, envio_gratis_desde, tiempo, horarios, medios'
export const COLS_MEDIOS = 'clave, etiqueta, aviso, datos, activo, orden'

type Fila = Record<string, unknown>
const obj = (v: unknown) => (v && typeof v === 'object' && !Array.isArray(v) ? (v as Record<string, unknown>) : null)
const numONull = (v: unknown) => (v === null || v === undefined || v === '' ? null : Number(v))
export const leerEntregas = (filas: Fila[] | null | undefined): EntregaPedido[] => (filas ?? []).map((f) => ({
  clave: String(f.clave), etiqueta: String(f.etiqueta), base: (['retiro', 'delivery', 'mesa'].includes(String(f.base)) ? f.base : 'retiro') as TipoPedido, activo: f.activo !== false, orden: Number(f.orden ?? 0),
  costo_envio: Number(f.costo_envio ?? 0), envio_gratis_desde: numONull(f.envio_gratis_desde), tiempo: (f.tiempo as string | null) || null,
  horarios: obj(f.horarios) as HorariosSemana | null, medios: Array.isArray(f.medios) ? (f.medios as string[]) : null,
})).sort((a, b) => a.orden - b.orden || a.clave.localeCompare(b.clave))
export const leerMedios = (filas: Fila[] | null | undefined): MedioPedido[] => (filas ?? []).map((f) => ({
  clave: String(f.clave), etiqueta: String(f.etiqueta), aviso: (f.aviso as string | null) || null, datos: (f.datos as string | null) || null, activo: f.activo !== false, orden: Number(f.orden ?? 0),
})).sort((a, b) => a.orden - b.orden || a.clave.localeCompare(b.clave))
/** Junta lo que devuelve la base (la fila de configuración y los dos catálogos) en una configuración lista para usar. */
export function leerConfigPedidos(cfg: Fila | null | undefined, entregas?: Fila[] | null, medios?: Fila[] | null): ConfigPedidos {
  const r = cfg ?? {}
  const e = leerEntregas(entregas), m = leerMedios(medios)
  return {
    recibe: r.recibe === true, pedido_minimo: Number(r.pedido_minimo ?? 0), tiempo_estimado: (r.tiempo_estimado as string | null) || null,
    mensaje: (r.mensaje as string | null) || null, mensaje_cerrado: (r.mensaje_cerrado as string | null) || null, aceptar_auto: r.aceptar_auto === true,
    usar_horarios: r.usar_horarios === true, horarios: (obj(r.horarios) ?? {}) as HorariosSemana, fechas_cerradas: Array.isArray(r.fechas_cerradas) ? (r.fechas_cerradas as string[]) : [],
    entregas: e.length ? e : ENTREGAS_POR_DEFECTO, medios: m.length ? m : MEDIOS_POR_DEFECTO,
  }
}
/** "retiro" → "retiro_en_el_local": identificador estable a partir de un nombre. */
export const claveDeNombre = (nombre: string) => nombre.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '').slice(0, 40) || 'otro'

export interface ItemPedido { id: string; nombre: string; variante: string | null; precio_unit: number; cantidad: number; observaciones: string | null; subtotal: number }
export interface Pedido {
  id: string; numero: number; nombre: string; telefono: string | null; tipo: TipoPedido; mesa: string | null; direccion: string | null; observaciones: string | null
  medio_pago: string; entrega?: string | null; entrega_nombre?: string | null; medio_pago_nombre?: string | null; estado: EstadoPedido; subtotal: number; envio: number; total: number; motivo_cancelacion: string | null; origen: 'web' | 'bot' | 'manual'
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
/** Nombre de un medio de pago: el que se guardó con el pedido, el del catálogo o, si no hay ninguno, la clave bien escrita. */
export const labelPago = (m: string, nombre?: string | null, catalogo?: Record<string, string>) => nombre || catalogo?.[m] || MEDIOS_PAGO.find((x) => x.value === m)?.label.split(' (')[0] || m.charAt(0).toUpperCase() + m.slice(1).replace(/_/g, ' ')
/** Nombre de la forma de entrega de un pedido (la propia del negocio, o la base de siempre). */
export const labelEntrega = (p: { tipo: string; entrega_nombre?: string | null }) => p.entrega_nombre || labelTipo(p.tipo)

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
  fuera_de_horario: 'En este momento estamos fuera del horario de pedidos.',
  dia_cerrado: 'Hoy no estamos tomando pedidos.',
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
