import 'server-only'
import type { Contexto } from '@/lib/context'
import { CONFIG_RESERVAS_DEFECTO, type ConfigReservas, type TipoReservaCfg } from '@/lib/reservas-config'

/** Parámetros generales de reservas del negocio (con los valores de siempre si todavía no configuró nada). */
export async function cargarConfigReservas(ctx: Contexto): Promise<ConfigReservas> {
  const { data } = await ctx.supabase.from('reservas_config').select('alerta_aforo_pct, turnos, estados_bloquean').eq('negocio_id', ctx.negocio.id).maybeSingle()
  const turnos = Array.isArray(data?.turnos) ? (data!.turnos as { nombre: string; hora: string }[]).filter((t) => t && typeof t.nombre === 'string' && /^\d{2}:\d{2}$/.test(String(t.hora))) : CONFIG_RESERVAS_DEFECTO.turnos
  return {
    alerta_aforo_pct: data?.alerta_aforo_pct ?? CONFIG_RESERVAS_DEFECTO.alerta_aforo_pct,
    turnos: turnos.map((t) => ({ nombre: t.nombre, hora: String(t.hora).slice(0, 5) })),
    estados_bloquean: (data?.estados_bloquean as string[] | null) ?? CONFIG_RESERVAS_DEFECTO.estados_bloquean,
  }
}

/** Catálogo de tipos de reserva del negocio, en el orden elegido. */
export async function cargarTiposReserva(ctx: Contexto): Promise<TipoReservaCfg[]> {
  const { data } = await ctx.supabase.from('reserva_tipos').select('clave, etiqueta, activo, orden').eq('negocio_id', ctx.negocio.id).order('orden').order('clave')
  return (data ?? []) as TipoReservaCfg[]
}
