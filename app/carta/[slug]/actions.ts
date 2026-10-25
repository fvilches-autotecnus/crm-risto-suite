'use server'

import { mensajeError } from '@/lib/pedidos'
import { createAdminClient } from '@/lib/supabase/server'

export interface DatosPedidoPublico {
  tipo: string; nombre: string; telefono: string; direccion: string; mesa: string; medio_pago: string; observaciones: string
  items: { producto_id: string; variante: string | null; cantidad: number }[]
  web?: string   // campo trampa: las personas lo dejan vacío
}
export type ResultadoPedidoPublico =
  | { ok: true; numero: number; total: number; tipo: string; medio_pago: string; tiempo_estimado: string | null; datos_pago: string | null; mensaje: string | null; whatsapp: string | null; unidades: number }
  | { ok: false; error: string }

const corto = (v: unknown, n: number) => String(v ?? '').trim().slice(0, n)

/** Pedido hecho por un cliente desde la carta pública (sin sesión). Los precios los pone el servidor desde la carta: aquí solo se pasan ids y cantidades. */
export async function crearPedidoPublico(slug: string, d: DatosPedidoPublico): Promise<ResultadoPedidoPublico> {
  if (!/^[a-z0-9-]{2,49}$/.test(slug)) return { ok: false, error: 'No encontramos este negocio.' }
  if (d?.web) return { ok: false, error: 'No pudimos registrar tu pedido. Probá de nuevo.' }   // robot: se rechaza sin pistas
  const items = Array.isArray(d?.items) ? d.items.slice(0, 60).map((i) => ({ producto_id: corto(i.producto_id, 40), variante: i.variante ? corto(i.variante, 40) : null, cantidad: Math.trunc(Number(i.cantidad)) })) : []
  const admin = createAdminClient()
  const { data, error } = await admin.rpc('crear_pedido', { p: {
    negocio: slug, origen: 'web', tipo: corto(d.tipo, 10), nombre: corto(d.nombre, 80), telefono: corto(d.telefono, 30), direccion: corto(d.direccion, 200),
    mesa: corto(d.mesa, 20), medio_pago: corto(d.medio_pago, 20), observaciones: corto(d.observaciones, 500), items,
  } })
  if (error) return { ok: false, error: 'No pudimos registrar tu pedido. Probá de nuevo.' }
  const r = data as { ok: boolean; error?: string; minimo?: number; numero?: number; total?: number; tipo?: string; medio_pago?: string; tiempo_estimado?: string | null; datos_pago?: string | null; mensaje?: string | null; unidades?: number }
  if (!r.ok) return { ok: false, error: r.error === 'pedidos_cerrados' && r.mensaje ? `${mensajeError(r.error)} ${r.mensaje}` : mensajeError(r.error, r) }
  const { data: neg } = await admin.from('negocios').select('whatsapp_nro').eq('slug', slug).maybeSingle()
  return { ok: true, numero: r.numero!, total: Number(r.total), tipo: r.tipo!, medio_pago: r.medio_pago!, tiempo_estimado: r.tiempo_estimado ?? null, datos_pago: r.datos_pago ?? null, mensaje: r.mensaje ?? null, whatsapp: neg?.whatsapp_nro ?? null, unidades: r.unidades ?? 0 }
}
