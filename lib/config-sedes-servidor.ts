import 'server-only'
import type { Contexto } from '@/lib/context'
import type { ConfigSede } from '@/lib/config-sedes'

/** Guarda lo propio de una sede (reemplaza cada campo que se pasa; los demás quedan como estaban). Devuelve un mensaje de error o null. */
export async function guardarConfigSede(ctx: Contexto, sedeId: string, cambios: Partial<Omit<ConfigSede, 'sucursal_id'>>): Promise<string | null> {
  if (!ctx.sedesTodas.some((s) => s.id === sedeId)) return 'La sede no es válida'
  const actual = ctx.configSedes[sedeId]
  const fila = { sucursal_id: sedeId, negocio_id: ctx.negocio.id, modulos: actual?.modulos ?? {}, web: actual?.web ?? {}, params: actual?.params ?? {}, tipos: actual?.tipos ?? {}, mensajes: actual?.mensajes ?? {}, estado_inicial: actual?.estado_inicial ?? null, ...cambios, actualizado_en: new Date().toISOString() }
  const { error } = await ctx.supabase.from('config_sedes').upsert(fila, { onConflict: 'sucursal_id' })
  return error ? 'No se pudo guardar la configuración de la sede' : null
}
