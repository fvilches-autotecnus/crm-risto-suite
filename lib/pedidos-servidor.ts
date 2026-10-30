import 'server-only'
import type { SupabaseClient } from '@supabase/supabase-js'
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
