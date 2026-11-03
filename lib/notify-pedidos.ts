import 'server-only'
import { createAdminClient } from '@/lib/supabase/server'
import { ESTADOS_AVISO_PEDIDO, ESTADOS_AVISO_PEDIDO_POR_DEFECTO, dinero, labelEntrega, mensajeWhatsApp, type EstadoPedido, type Pedido } from '@/lib/pedidos'
import { soloDigitos, type DestinoWebhook } from '@/lib/notify'

/**
 * Webhook de pedidos: avisa al cliente (y al equipo) cuando entra un pedido de la carta digital y cada vez que un pedido cambia de estado.
 * Igual que el de reservas: la URL vive en una columna oculta de negocios y el destino (n8n / BotConversa) y los estados que avisan en negocios.modulos.
 * A diferencia de reservas, es AUTOMÁTICO: sale solo para los estados que el negocio habilitó (como el aviso de estado de Toque).
 * Es best-effort: si el webhook está caído el cambio de estado igual queda guardado; los errores solo se loguean.
 */
const esDestino = (v: unknown): v is DestinoWebhook => v === 'n8n' || v === 'botconversa'
const filtrarEstados = (v: unknown) => ESTADOS_AVISO_PEDIDO.filter((e) => Array.isArray(v) && v.includes(e))
// El secreto general del servidor solo vale para n8n (BotConversa no valida headers: su URL ya lleva el token)
const secretoPara = (destino: DestinoWebhook, propio: string | null | undefined) => propio || (destino === 'n8n' ? process.env.TOQUE_STATUS_WEBHOOK_SECRET : undefined) || undefined

export interface ConfigWebhookPedidos { destino: DestinoWebhook; url: string; tieneSecreto: boolean; estados: EstadoPedido[]; disponible: boolean }
interface Crudo { url: string | null; secreto: string | undefined; destino: DestinoWebhook; estados: EstadoPedido[]; negocio: string }
const listo = (c: Crudo) => !!c.url && (c.destino !== 'n8n' || !!c.secreto)

async function leer(negocioId: string): Promise<Crudo | null> {
  const { data, error } = await createAdminClient().from('negocios').select('nombre, webhook_aviso_pedido_url, webhook_pedido_secret, modulos').eq('id', negocioId).maybeSingle()
  if (error || !data) return null   // (si la columna todavía no existe, simplemente no hay webhook de pedidos)
  const m = (data.modulos ?? {}) as { avisos_pedidos?: unknown; webhook_pedido_destino?: unknown }
  const destino = esDestino(m.webhook_pedido_destino) ? m.webhook_pedido_destino : 'n8n'
  const estados = Array.isArray(m.avisos_pedidos) ? filtrarEstados(m.avisos_pedidos) : ESTADOS_AVISO_PEDIDO_POR_DEFECTO
  return { url: (data.webhook_aviso_pedido_url as string | null) || null, secreto: secretoPara(destino, data.webhook_pedido_secret as string | null), destino, estados, negocio: data.nombre as string }
}

/** Configuración completa para el formulario de Configuración (solo superadmin; no devuelve el secreto). */
export async function configuracionWebhookPedidos(negocioId: string): Promise<ConfigWebhookPedidos> {
  const c = await leer(negocioId)
  if (!c) return { destino: 'n8n', url: '', tieneSecreto: false, estados: ESTADOS_AVISO_PEDIDO_POR_DEFECTO, disponible: false }
  return { destino: c.destino, url: c.url ?? '', tieneSecreto: !!c.secreto, estados: c.estados, disponible: listo(c) }
}

// ---------------------------------------------------------------------------
// Qué se manda
// ---------------------------------------------------------------------------
export interface DatosAvisoPedido {
  numero: number; nombre: string; telefono: string | null; estado: EstadoPedido; tipo: Pedido['tipo']; entrega_nombre?: string | null
  subtotal: number; envio: number; total: number; descuento?: number; descuento_nombre?: string | null; medio_pago: string; medio_pago_nombre?: string | null; direccion: string | null; mesa: string | null; observaciones: string | null
  motivo_cancelacion: string | null; origen: 'web' | 'bot' | 'manual'; items: { nombre: string; variante: string | null; cantidad: number; precio_unit: number }[]
  tiempo_estimado?: string | null; negocio: string; prueba?: boolean
}

const TITULOS: Record<EstadoPedido, [string, string]> = {
  nuevo: ['🛍️', 'NUEVO PEDIDO'], aceptado: ['✅', 'PEDIDO ACEPTADO'], preparando: ['👨‍🍳', 'PEDIDO EN PREPARACIÓN'], listo: ['📦', 'PEDIDO LISTO'],
  en_camino: ['🛵', 'PEDIDO EN CAMINO'], entregado: ['🏁', 'PEDIDO ENTREGADO'], cancelado: ['🔴', 'PEDIDO CANCELADO'],
}
const ORIGENES = { web: 'Carta digital', bot: 'Chat de WhatsApp', manual: 'Cargado en el local' }
const lineaItem = (i: { nombre: string; variante: string | null; cantidad: number }) => `${i.cantidad} x ${i.nombre}${i.variante ? ` (${i.variante})` : ''}`

/** Monto para mostrar en la tarjeta de BotConversa: punto de mil y coma decimal, sin símbolo (26500 → "26.500", 26500.5 → "26.500,50"). El campo `total` sigue siendo el número. */
export const montoConPuntos = (n: number) => {
  const x = Number(n)
  const [i, dec] = x.toFixed(Number.isInteger(x) ? 0 : 2).split('.')
  return i.replace(/\B(?=(\d{3})+(?!\d))/g, '.') + (dec ? `,${dec}` : '')
}

/** Dónde se entrega, en una sola línea para la tarjeta de BotConversa: la dirección (delivery), "Mesa 5" o el nombre del retiro ("Retiro en el local"). */
export const direccionPedido = (d: Pick<DatosAvisoPedido, 'tipo' | 'entrega_nombre' | 'direccion' | 'mesa'>) =>
  d.tipo === 'delivery' ? (d.direccion?.trim() || labelEntrega(d)) : d.tipo === 'mesa' ? (d.mesa ? `Mesa ${d.mesa}` : labelEntrega(d)) : labelEntrega(d)

/** Mensaje para el EQUIPO del local ("qué pasó con este pedido"), listo para reenviar por WhatsApp (usa *negrita* de WhatsApp). */
export function textoEquipoPedido(d: DatosAvisoPedido): string {
  const [icono, titulo] = TITULOS[d.estado]
  const tel = soloDigitos(d.telefono)
  return [
    `${d.prueba ? '🧪 *AVISO DE PRUEBA*\n' : ''}${icono} *${titulo} #${d.numero}* · ${d.negocio}`,
    `👤 *${d.nombre}*${tel ? ` · 📞 +${tel}` : ''}`,
    ...d.items.map((i) => `• ${lineaItem(i)}`),
    ...((d.descuento ?? 0) > 0 ? [`🏷️ Descuento${d.descuento_nombre ? ` “${d.descuento_nombre}”` : ''}: -${dinero(d.descuento!)}`] : []),
    `💵 Total ${dinero(d.total)}${d.envio > 0 ? ` (envío ${dinero(d.envio)})` : ''} · ${d.medio_pago_nombre || d.medio_pago}`,
    `🚚 ${labelEntrega(d)}${d.tipo === 'delivery' && d.direccion ? ` · 📍 ${d.direccion}` : ''}${d.tipo === 'mesa' && d.mesa ? ` · Mesa ${d.mesa}` : ''}`,
    ...(d.observaciones ? [`📝 ${d.observaciones}`] : []),
    ...(d.estado === 'cancelado' && d.motivo_cancelacion ? [`Motivo: ${d.motivo_cancelacion}`] : []),
    `Origen: ${ORIGENES[d.origen]}`,
  ].join('\n')
}

/**
 * Arma el JSON según el destino.
 *  · BotConversa: nombres en minúsculas con guion bajo, listos para mapear a variables (id_pedido → ID_PEDIDO, estado_pedido → ESTADO_PEDIDO…).
 *  · n8n: mismo formato que el aviso de estado de Toque (telefono, numero, estado, tipoEntrega, total) y los datos extra en camelCase.
 * En los dos viajan `mensaje_cliente` (el texto ya armado para el cliente) y `notificacion_equipo` (el texto para el equipo).
 */
export function armarPayloadPedido(destino: DestinoWebhook, d: DatosAvisoPedido): Record<string, unknown> {
  const telefono = soloDigitos(d.telefono)
  const mensaje_cliente = mensajeWhatsApp({ numero: d.numero, nombre: d.nombre, estado: d.estado, tipo: d.tipo, total: d.total, motivo_cancelacion: d.motivo_cancelacion }, d.negocio, d.tiempo_estimado)
  const notificacion_equipo = textoEquipoPedido(d)
  const extra = d.prueba ? { prueba: true } : {}
  const unidades = d.items.reduce((s, i) => s + i.cantidad, 0)
  if (destino === 'botconversa') {
    return {
      evento: 'pedido_estado',
      id_pedido: d.numero,
      nombre: d.nombre,
      nombre_titular: d.nombre,                               // mismos nombres que en la respuesta del flujo "Confirmar pedido web", para usar las mismas variables
      telefono,
      estado_pedido: d.estado,
      tipo_entrega: d.tipo,                                   // retiro · delivery · mesa
      tipo_pedido: labelEntrega(d),                           // nombre de la forma de entrega ("Retiro en el local")
      direccion_pedido: direccionPedido(d),                   // delivery: la dirección · mesa: "Mesa 5" · retiro: "Retiro en el local"
      monto_total: montoConPuntos(d.total),
      total: d.total, subtotal: d.subtotal, envio: d.envio, descuento: d.descuento ?? 0, descuento_nombre: d.descuento_nombre ?? '',
      metodo_pago: d.medio_pago_nombre || d.medio_pago,
      medio_pago: d.medio_pago_nombre || d.medio_pago,
      direccion: d.direccion ?? '', mesa: d.mesa ?? '',
      observaciones: d.observaciones ?? '',
      motivo_cancelacion: d.motivo_cancelacion ?? '',
      tiempo_estimado: d.tiempo_estimado ?? '',
      items: d.items.map(lineaItem).join('\n'),               // un renglón por producto
      cantidad_items: unidades,
      origen: d.origen,
      mensaje_cliente,
      notificacion_equipo,
      ...extra,
    }
  }
  return {
    evento: 'pedido_estado',
    telefono,
    numero: d.numero,
    estado: d.estado,
    tipoEntrega: d.tipo === 'delivery' ? 'delivery' : 'takeaway',   // igual que Toque
    total: d.total,
    nombre: d.nombre,
    tipo: d.tipo,
    entrega: labelEntrega(d),
    subtotal: d.subtotal, envio: d.envio, descuento: d.descuento ?? 0, descuentoNombre: d.descuento_nombre ?? null,
    medioPago: d.medio_pago_nombre || d.medio_pago,
    direccion: d.direccion, mesa: d.mesa, observaciones: d.observaciones,
    motivoCancelacion: d.motivo_cancelacion,
    tiempoEstimado: d.tiempo_estimado ?? null,
    items: d.items.map((i) => ({ nombre: i.nombre, variante: i.variante, cantidad: i.cantidad, precio: i.precio_unit })),
    origen: d.origen,
    mensaje_cliente,
    notificacion_equipo,
    ...extra,
  }
}

async function llamar(c: Crudo, payload: Record<string, unknown>): Promise<{ ok: boolean; status?: number }> {
  try {
    const res = await fetch(c.url!, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...(c.secreto ? { 'X-Toque-Secret': c.secreto } : {}) },
      body: JSON.stringify(payload),
      signal: AbortSignal.timeout(8000),
    })
    if (!res.ok) console.error('[webhook pedidos] respondió', res.status)
    return { ok: res.ok, status: res.status }
  } catch (e) {
    console.error('[webhook pedidos] error llamando al webhook:', e)
    return { ok: false }
  }
}

/**
 * Avisa por el webhook el estado actual de un pedido. No hace nada (y no es un error) si el negocio no tiene el webhook armado, si ese estado no está
 * habilitado o si el pedido no tiene teléfono al que avisar. Se llama después de responder (after) para no demorar la pantalla.
 */
export async function avisarPedido(negocioId: string, pedidoId: string): Promise<'enviado' | 'no_disponible' | 'fallo'> {
  try {
    const c = await leer(negocioId)
    if (!c || !listo(c)) return 'no_disponible'
    const admin = createAdminClient()
    const { data: p } = await admin.from('pedidos').select('numero, nombre, telefono, estado, tipo, entrega_nombre, subtotal, envio, total, descuento, descuento_nombre, medio_pago, medio_pago_nombre, direccion, mesa, observaciones, motivo_cancelacion, origen, pedido_items(nombre, variante, cantidad, precio_unit)').eq('id', pedidoId).eq('negocio_id', negocioId).maybeSingle()
    if (!p || !soloDigitos(p.telefono as string | null) || !c.estados.includes(p.estado as EstadoPedido)) return 'no_disponible'
    const { data: cfg } = await admin.from('pedidos_config').select('tiempo_estimado').eq('negocio_id', negocioId).maybeSingle()
    const items = ((p.pedido_items ?? []) as { nombre: string; variante: string | null; cantidad: number; precio_unit: number }[]).map((i) => ({ ...i, precio_unit: Number(i.precio_unit) }))
    const datos: DatosAvisoPedido = {
      numero: p.numero as number, nombre: p.nombre as string, telefono: p.telefono as string | null, estado: p.estado as EstadoPedido, tipo: p.tipo as Pedido['tipo'], entrega_nombre: p.entrega_nombre as string | null,
      subtotal: Number(p.subtotal), envio: Number(p.envio), total: Number(p.total), descuento: Number(p.descuento ?? 0), descuento_nombre: p.descuento_nombre as string | null, medio_pago: p.medio_pago as string, medio_pago_nombre: p.medio_pago_nombre as string | null,
      direccion: p.direccion as string | null, mesa: p.mesa as string | null, observaciones: p.observaciones as string | null, motivo_cancelacion: p.motivo_cancelacion as string | null,
      origen: p.origen as 'web' | 'bot' | 'manual', items, tiempo_estimado: (cfg?.tiempo_estimado as string | null) ?? null, negocio: c.negocio,
    }
    return (await llamar(c, armarPayloadPedido(c.destino, datos))).ok ? 'enviado' : 'fallo'
  } catch (e) {
    console.error('[webhook pedidos] no se pudo armar el aviso:', e)
    return 'fallo'
  }
}

/** Envía un aviso de ejemplo (marcado con prueba: true) al teléfono indicado, para armar y probar el flujo del otro lado. */
export async function enviarPruebaPedido(negocioId: string, telefono: string, estado: EstadoPedido = 'aceptado'): Promise<{ ok: boolean; status?: number; error?: string }> {
  const c = await leer(negocioId)
  if (!c || !c.url) return { ok: false, error: 'Todavía no cargaste la URL del webhook de pedidos' }
  if (!listo(c)) return { ok: false, error: 'Falta el secreto: n8n lo necesita para validar el aviso' }
  const r = await llamar(c, armarPayloadPedido(c.destino, {
    numero: 0, nombre: 'PRUEBA Risto Suite', telefono, estado, tipo: 'retiro', entrega_nombre: 'Retiro en el local', subtotal: 5000, envio: 0, total: 5000, medio_pago: 'efectivo', medio_pago_nombre: 'Efectivo',
    direccion: null, mesa: null, observaciones: 'Aviso de prueba enviado desde Risto Suite', motivo_cancelacion: null, origen: 'web',
    items: [{ nombre: 'Producto de prueba', variante: null, cantidad: 2, precio_unit: 2500 }], tiempo_estimado: '30 a 40 minutos', negocio: c.negocio, prueba: true,
  }))
  return r.ok ? { ok: true, status: r.status } : { ok: false, status: r.status, error: r.status ? `El webhook respondió ${r.status}` : 'No se pudo conectar con el webhook' }
}
