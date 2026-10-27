import 'server-only'
import type { Contexto } from '@/lib/context'
import { CONFIG_RESERVAS_DEFECTO, type ConfigReservas, type TipoReservaCfg } from '@/lib/reservas-config'

/** La sede cuya configuración vale: la que se pide, y si no se pide ninguna, la elegida en el selector (null = el negocio). */
const sedeDe = (ctx: Contexto, sedeId?: string | null) => (sedeId === undefined ? ctx.sede?.id ?? null : sedeId)

/** Parámetros generales de reservas (con los valores de siempre si todavía no configuró nada). Con una sede, lo propio de la sede pisa lo del negocio. */
export async function cargarConfigReservas(ctx: Contexto, sedeId?: string | null): Promise<ConfigReservas> {
  const { data } = await ctx.supabase.from('reservas_config').select('alerta_aforo_pct, turnos, estados_bloquean').eq('negocio_id', ctx.negocio.id).maybeSingle()
  const ov = (sedeDe(ctx, sedeId) && ctx.configSedes[sedeDe(ctx, sedeId)!]?.params) || {}
  const turnosCrudos = 'turnos' in ov ? ov.turnos : data?.turnos
  const turnos = Array.isArray(turnosCrudos) ? (turnosCrudos as { nombre: string; hora: string }[]).filter((t) => t && typeof t.nombre === 'string' && /^\d{2}:\d{2}/.test(String(t.hora))) : CONFIG_RESERVAS_DEFECTO.turnos
  return {
    alerta_aforo_pct: (ov.alerta_aforo_pct as number | undefined) ?? data?.alerta_aforo_pct ?? CONFIG_RESERVAS_DEFECTO.alerta_aforo_pct,
    turnos: turnos.map((t) => ({ nombre: t.nombre, hora: String(t.hora).slice(0, 5) })),
    estados_bloquean: (ov.estados_bloquean as string[] | undefined) ?? (data?.estados_bloquean as string[] | null) ?? CONFIG_RESERVAS_DEFECTO.estados_bloquean,
  }
}

/** Minutos que una reserva ocupa su mesa (el de la sede si lo cambió, y si no el del negocio). */
export async function cargarDuracionMesas(ctx: Contexto, sedeId?: string | null): Promise<number> {
  const propia = sedeDe(ctx, sedeId) ? (ctx.configSedes[sedeDe(ctx, sedeId)!]?.params.duracion_min as number | undefined) : undefined
  if (propia) return propia
  const { data } = await ctx.supabase.from('mesas_config').select('duracion_min').eq('negocio_id', ctx.negocio.id).maybeSingle()
  return data?.duracion_min ?? 120
}

/** Catálogo de tipos de reserva del negocio, en el orden elegido. Con una sede, aplica lo que esa sede cambió (si lo ofrece y en qué días). */
export async function cargarTiposReserva(ctx: Contexto, sedeId?: string | null): Promise<TipoReservaCfg[]> {
  const { data } = await ctx.supabase.from('reserva_tipos').select('clave, etiqueta, activo, orden, modo, dias_semana, fechas').eq('negocio_id', ctx.negocio.id).order('orden').order('clave')
  const base = (data ?? []) as TipoReservaCfg[]
  const sid = sedeDe(ctx, sedeId)
  const tipos = sid ? ctx.configSedes[sid]?.tipos ?? {} : {}
  return base.map((t) => {
    const o = tipos[t.clave]
    return o ? { ...t, activo: o.activo === false ? false : t.activo, modo: o.modo ?? t.modo, dias_semana: o.dias_semana ?? t.dias_semana, fechas: o.fechas ?? t.fechas } : t
  })
}
