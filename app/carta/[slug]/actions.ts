'use server'

import { mensajeError } from '@/lib/pedidos'
import { createAdminClient } from '@/lib/supabase/server'

export interface DatosPedidoPublico {
  tipo: string; nombre: string; telefono: string; direccion: string; mesa: string; medio_pago: string; observaciones: string
  items: { producto_id: string; variante: string | null; cantidad: number }[]
  web?: string   // campo trampa: las personas lo dejan vacío
}
export type ResultadoPedidoPublico =
  | { ok: true; numero: number; total: number; tipo: string; entrega_nombre: string | null; medio_pago: string; medio_pago_nombre: string | null; tiempo_estimado: string | null; datos_pago: string | null; instrucciones: string | null; mensaje: string | null; whatsapp: string | null; unidades: number }
  | { ok: false; error: string }

const corto = (v: unknown, n: number) => String(v ?? '').trim().slice(0, n)

/** Pedido hecho por un cliente desde la carta pública (sin sesión). Los precios los pone el servidor desde la carta: aquí solo se pasan ids y cantidades. */
export async function crearPedidoPublico(slug: string, d: DatosPedidoPublico): Promise<ResultadoPedidoPublico> {
  if (!/^[a-z0-9-]{2,49}$/.test(slug)) return { ok: false, error: 'No encontramos este negocio.' }
  if (d?.web) return { ok: false, error: 'No pudimos registrar tu pedido. Probá de nuevo.' }   // robot: se rechaza sin pistas
  const items = Array.isArray(d?.items) ? d.items.slice(0, 60).map((i) => ({ producto_id: corto(i.producto_id, 40), variante: i.variante ? corto(i.variante, 40) : null, cantidad: Math.trunc(Number(i.cantidad)) })) : []
  const admin = createAdminClient()
  const { data, error } = await admin.rpc('crear_pedido', { p: {
    negocio: slug, origen: 'web', tipo: corto(d.tipo, 40), nombre: corto(d.nombre, 80), telefono: corto(d.telefono, 30), direccion: corto(d.direccion, 200),
    mesa: corto(d.mesa, 20), medio_pago: corto(d.medio_pago, 40), observaciones: corto(d.observaciones, 500), items,
  } })
  if (error) return { ok: false, error: 'No pudimos registrar tu pedido. Probá de nuevo.' }
  const r = data as { ok: boolean; error?: string; minimo?: number; numero?: number; total?: number; tipo?: string; entrega_nombre?: string | null; medio_pago?: string; medio_pago_nombre?: string | null; tiempo_estimado?: string | null; datos_pago?: string | null; instrucciones?: string | null; mensaje?: string | null; unidades?: number }
  if (!r.ok) return { ok: false, error: (r.error === 'pedidos_cerrados' || r.error === 'fuera_de_horario' || r.error === 'dia_cerrado') && r.mensaje ? `${mensajeError(r.error)} ${r.mensaje}` : mensajeError(r.error, r) }
  const { data: neg } = await admin.from('negocios').select('whatsapp_nro').eq('slug', slug).maybeSingle()
  return { ok: true, numero: r.numero!, total: Number(r.total), tipo: r.tipo!, entrega_nombre: r.entrega_nombre ?? null, medio_pago: r.medio_pago!, medio_pago_nombre: r.medio_pago_nombre ?? null, tiempo_estimado: r.tiempo_estimado ?? null, datos_pago: r.datos_pago ?? null, instrucciones: r.instrucciones ?? null, mensaje: r.mensaje ?? null, whatsapp: neg?.whatsapp_nro ?? null, unidades: r.unidades ?? 0 }
}
