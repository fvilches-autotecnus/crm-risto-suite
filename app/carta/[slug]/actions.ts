'use server'

import { after } from 'next/server'
import { mensajeError } from '@/lib/pedidos'
import { avisarPedido } from '@/lib/notify-pedidos'
import { guardarCumplePedido, leerCumple } from '@/lib/cumple-pedido'
import { limpiarCampana } from '@/lib/promos'
import { createAdminClient } from '@/lib/supabase/server'

export interface DatosPedidoPublico {
  tipo: string; nombre: string; telefono: string; direccion: string; mesa: string; medio_pago: string; observaciones: string
  codigo?: string   // cupón de descuento (opcional)
  items: { producto_id: string; variante: string | null; cantidad: number }[]
  web?: string   // campo trampa: las personas lo dejan vacío
  campana?: string   // código del enlace de campaña (?c=…)
  cumple_dia?: string; cumple_mes?: string; cumple_anio?: string   // cumpleaños opcional (si el negocio lo pide)
}
export type ResultadoPedidoPublico =
  | { ok: true; numero: number; total: number; tipo: string; entrega_nombre: string | null; medio_pago: string; medio_pago_nombre: string | null; tiempo_estimado: string | null; datos_pago: string | null; instrucciones: string | null; mensaje: string | null; whatsapp: string | null; unidades: number; subtotal: number; descuento: number; descuento_nombre: string | null }
  | { ok: false; error: string }

const corto = (v: unknown, n: number) => String(v ?? '').trim().slice(0, n)

/** Pedido hecho por un cliente desde la carta pública (sin sesión). Los precios los pone el servidor desde la carta: aquí solo se pasan ids y cantidades. */
export async function crearPedidoPublico(slug: string, d: DatosPedidoPublico): Promise<ResultadoPedidoPublico> {
  if (!/^[a-z0-9-]{2,49}$/.test(slug)) return { ok: false, error: 'No encontramos este negocio.' }
  if (d?.web) return { ok: false, error: 'No pudimos registrar tu pedido. Probá de nuevo.' }   // robot: se rechaza sin pistas
  const items = Array.isArray(d?.items) ? d.items.slice(0, 60).map((i) => ({ producto_id: corto(i.producto_id, 40), variante: i.variante ? corto(i.variante, 40) : null, cantidad: Math.trunc(Number(i.cantidad)) })) : []
  const admin = createAdminClient()
  // si el negocio confirma por WhatsApp, el pedido no se crea directo: pasa por la solicitud (crearSolicitudPedidoPublico)
  const { data: cfgConf } = await admin.from('pedidos_config').select('confirmar_whatsapp, negocios!inner(slug)').eq('negocios.slug', slug).maybeSingle()
  if (cfgConf?.confirmar_whatsapp === true) return { ok: false, error: 'Este negocio confirma los pedidos por WhatsApp. Recargá la página y volvé a hacer el pedido.' }
  const { data, error } = await admin.rpc('crear_pedido', { p: {
    negocio: slug, origen: 'web', tipo: corto(d.tipo, 40), nombre: corto(d.nombre, 80), telefono: corto(d.telefono, 30), direccion: corto(d.direccion, 200),
    mesa: corto(d.mesa, 20), medio_pago: corto(d.medio_pago, 40), observaciones: corto(d.observaciones, 500), items, campana: limpiarCampana(d.campana), codigo: corto(d.codigo, 30),
  } })
  if (error) return { ok: false, error: 'No pudimos registrar tu pedido. Probá de nuevo.' }
  const r = data as { ok: boolean; error?: string; minimo?: number; id?: string; numero?: number; total?: number; tipo?: string; entrega_nombre?: string | null; medio_pago?: string; medio_pago_nombre?: string | null; tiempo_estimado?: string | null; datos_pago?: string | null; instrucciones?: string | null; mensaje?: string | null; unidades?: number; subtotal?: number; descuento?: number; descuento_nombre?: string | null; detalle?: string }
  if (!r.ok) return { ok: false, error: (r.error === 'pedidos_cerrados' || r.error === 'fuera_de_horario' || r.error === 'dia_cerrado') && r.mensaje ? `${mensajeError(r.error)} ${r.mensaje}` : mensajeError(r.error, r) }
  const { data: neg } = await admin.from('negocios').select('id, whatsapp_nro').eq('slug', slug).maybeSingle()
  // webhook de pedidos: avisa que entró un pedido nuevo (si el negocio lo habilitó), después de responderle al cliente
  if (neg?.id && r.id) {
    const negocioId = neg.id as string, pedidoId = r.id, cumple = leerCumple({ dia: d.cumple_dia, mes: d.cumple_mes, anio: d.cumple_anio })
    after(async () => { if (cumple) await guardarCumplePedido(negocioId, pedidoId, cumple); await avisarPedido(negocioId, pedidoId) })
  }
  return { ok: true, numero: r.numero!, total: Number(r.total), tipo: r.tipo!, entrega_nombre: r.entrega_nombre ?? null, medio_pago: r.medio_pago!, medio_pago_nombre: r.medio_pago_nombre ?? null, tiempo_estimado: r.tiempo_estimado ?? null, datos_pago: r.datos_pago ?? null, instrucciones: r.instrucciones ?? null, mensaje: r.mensaje ?? null, whatsapp: neg?.whatsapp_nro ?? null, unidades: r.unidades ?? 0, subtotal: Number(r.subtotal ?? r.total), descuento: Number(r.descuento ?? 0), descuento_nombre: r.descuento_nombre ?? null }
}

export type VistaPreviaPedido = { ok: true; descuento: number; nombre: string | null; cupon: string | null; cuponUsado: boolean } | { ok: false }

/** Cuánto se descontaría con lo que hay en el carrito (mismo cálculo que al hacer el pedido, sin guardar nada). Se usa para mostrar el total antes de confirmar. */
export async function simularPedidoPublico(slug: string, d: { tipo: string; medio_pago: string; codigo?: string; items: { producto_id: string; variante: string | null; cantidad: number }[] }): Promise<VistaPreviaPedido> {
  if (!/^[a-z0-9-]{2,49}$/.test(slug)) return { ok: false }
  const items = Array.isArray(d?.items) ? d.items.slice(0, 60).map((i) => ({ producto_id: corto(i.producto_id, 40), variante: i.variante ? corto(i.variante, 40) : null, cantidad: Math.trunc(Number(i.cantidad)) })) : []
  const { data, error } = await createAdminClient().rpc('simular_pedido', { p: { negocio: slug, tipo: corto(d?.tipo, 40), medio_pago: corto(d?.medio_pago, 40), codigo: corto(d?.codigo, 30), items } })
  const r = data as { ok?: boolean; descuento?: number; descuento_nombre?: string | null; cupon?: string | null; cupon_usado?: boolean } | null
  if (error || !r?.ok) return { ok: false }
  return { ok: true, descuento: Number(r.descuento ?? 0), nombre: r.descuento_nombre ?? null, cupon: r.cupon ?? null, cuponUsado: r.cupon_usado === true }
}

export type ResultadoSolicitudPedido =
  | { ok: true; codigo: string; whatsapp: string; validez_horas: number; subtotal: number; descuento: number; descuento_nombre: string | null; envio: number; total: number; tipo: string; entrega_nombre: string | null; medio_pago: string; medio_pago_nombre: string | null; unidades: number }
  | { ok: false; error: string }

/**
 * Pedido de un negocio que confirma por WhatsApp: valida todo (precios de la carta, horarios, mínimo, cupón…) y deja una solicitud EN ESPERA con un código.
 * No existe ningún pedido hasta que el cliente manda el mensaje con ese código por WhatsApp y el bot lo registra.
 */
export async function crearSolicitudPedidoPublico(slug: string, d: DatosPedidoPublico): Promise<ResultadoSolicitudPedido> {
  if (!/^[a-z0-9-]{2,49}$/.test(slug)) return { ok: false, error: 'No encontramos este negocio.' }
  if (d?.web) return { ok: false, error: 'No pudimos registrar tu pedido. Probá de nuevo.' }   // robot: se rechaza sin pistas
  const items = Array.isArray(d?.items) ? d.items.slice(0, 60).map((i) => ({ producto_id: corto(i.producto_id, 40), variante: i.variante ? corto(i.variante, 40) : null, cantidad: Math.trunc(Number(i.cantidad)) })) : []
  const cumple = leerCumple({ dia: d.cumple_dia, mes: d.cumple_mes, anio: d.cumple_anio })
  const { data, error } = await createAdminClient().rpc('crear_solicitud_pedido', { p: {
    negocio: slug, tipo: corto(d.tipo, 40), nombre: corto(d.nombre, 80), direccion: corto(d.direccion, 200), mesa: corto(d.mesa, 20), medio_pago: corto(d.medio_pago, 40), observaciones: corto(d.observaciones, 500),
    items, campana: limpiarCampana(d.campana), codigo: corto(d.codigo, 30), cumple_dia: cumple?.dia ?? null, cumple_mes: cumple?.mes ?? null, cumple_anio: cumple?.anio ?? null,
  } })
  if (error) return { ok: false, error: 'No pudimos registrar tu pedido. Probá de nuevo.' }
  const r = data as { ok: boolean; error?: string; minimo?: number; detalle?: string; mensaje?: string | null; codigo?: string; whatsapp?: string; validez_horas?: number; subtotal?: number; descuento?: number; descuento_nombre?: string | null; envio?: number; total?: number; tipo?: string; entrega_nombre?: string | null; medio_pago?: string; medio_pago_nombre?: string | null; unidades?: number }
  if (!r.ok) return { ok: false, error: (r.error === 'pedidos_cerrados' || r.error === 'fuera_de_horario' || r.error === 'dia_cerrado') && r.mensaje ? `${mensajeError(r.error)} ${r.mensaje}` : mensajeError(r.error, r) }
  return { ok: true, codigo: r.codigo!, whatsapp: r.whatsapp!, validez_horas: r.validez_horas ?? 6, subtotal: Number(r.subtotal), descuento: Number(r.descuento ?? 0), descuento_nombre: r.descuento_nombre ?? null, envio: Number(r.envio ?? 0), total: Number(r.total), tipo: r.tipo!, entrega_nombre: r.entrega_nombre ?? null, medio_pago: r.medio_pago!, medio_pago_nombre: r.medio_pago_nombre ?? null, unidades: r.unidades ?? 0 }
}

export type SeguimientoPedido =
  | { ok: true; numero: number; estado: string; tipo: string; entrega_nombre: string | null; creado_en: string; aceptado_en: string | null; listo_en: string | null; entregado_en: string | null; cancelado_en: string | null }
  | { ok: false; error: string }

/**
 * Estado de un pedido por su número, para la página pública de seguimiento (sin sesión). A propósito solo devuelve el estado y las horas:
 * ni nombre, ni teléfono, ni dirección, ni productos, ni montos (igual que el seguimiento de Toque).
 */
export async function estadoPedidoPublico(slug: string, numero: number): Promise<SeguimientoPedido> {
  const n = Math.trunc(Number(numero))
  if (!/^[a-z0-9-]{2,49}$/.test(slug) || !Number.isInteger(n) || n < 1 || n > 9_999_999) return { ok: false, error: 'Poné el número de tu pedido (por ejemplo 125).' }
  const admin = createAdminClient()
  const { data: negocio } = await admin.from('negocios').select('id').eq('slug', slug).eq('activo', true).maybeSingle()
  if (!negocio) return { ok: false, error: 'No encontramos este negocio.' }
  const { data: p } = await admin.from('pedidos').select('numero, estado, tipo, entrega_nombre, creado_en, aceptado_en, listo_en, entregado_en, cancelado_en').eq('negocio_id', negocio.id).eq('numero', n).maybeSingle()
  if (!p) return { ok: false, error: `No encontramos el pedido #${n}. Revisá el número que te llegó por WhatsApp.` }
  return { ok: true, numero: p.numero as number, estado: p.estado as string, tipo: p.tipo as string, entrega_nombre: (p.entrega_nombre as string | null) ?? null, creado_en: p.creado_en as string,
    aceptado_en: (p.aceptado_en as string | null) ?? null, listo_en: (p.listo_en as string | null) ?? null, entregado_en: (p.entregado_en as string | null) ?? null, cancelado_en: (p.cancelado_en as string | null) ?? null }
}
