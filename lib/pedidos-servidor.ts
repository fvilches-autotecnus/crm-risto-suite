import 'server-only'
import type { SupabaseClient } from '@supabase/supabase-js'
import { COLS_DESCUENTOS, leerDescuentos, type DescuentoPedido } from '@/lib/descuentos'
import { COLS_CONFIG_PEDIDOS, COLS_ENTREGAS, COLS_MEDIOS, leerConfigPedidos, type ConfigPedidos } from '@/lib/pedidos'

/** Configuración de pedidos de un negocio: los ajustes generales y sus dos catálogos (formas de entrega y medios de pago). */
export async function cargarConfigPedidos(sb: SupabaseClient, negocioId: string): Promise<{ config: ConfigPedidos; hayConfig: boolean }> {
  const [{ data: cfg }, { data: entregas }, { data: medios }] = await Promise.all([
    sb.from('pedidos_config').select(COLS_CONFIG_PEDIDOS).eq('negocio_id', negocioId).maybeSingle(),
    sb.from('pedido_entregas').select(COLS_ENTREGAS).eq('negocio_id', negocioId).order('orden').order('clave'),
    sb.from('pedido_medios').select(COLS_MEDIOS).eq('negocio_id', negocioId).order('orden').order('clave'),
  ])
  return { config: leerConfigPedidos(cfg as Record<string, unknown> | null, entregas as Record<string, unknown>[] | null, medios as Record<string, unknown>[] | null), hayConfig: !!cfg }
}

/** Reglas de descuento del negocio (con cuántos pedidos usó cada una). */
export async function cargarDescuentos(sb: SupabaseClient, negocioId: string): Promise<DescuentoPedido[]> {
  const [{ data: filas }, { data: usados }] = await Promise.all([
    sb.from('pedido_descuentos').select(COLS_DESCUENTOS).eq('negocio_id', negocioId).order('orden').order('creado_en'),
    sb.from('pedidos').select('descuento_id').eq('negocio_id', negocioId).not('descuento_id', 'is', null).neq('estado', 'cancelado').limit(20000),
  ])
  const usos: Record<string, number> = {}
  for (const u of usados ?? []) usos[u.descuento_id as string] = (usos[u.descuento_id as string] ?? 0) + 1
  return leerDescuentos(filas as Record<string, unknown>[] | null, usos)
}
