import 'server-only'
import type { Contexto } from '@/lib/context'

/** ¿El programa de fidelización está activo y cuenta como visita lo que el equipo marca con “Llegó”? (para mostrar ese botón en Reservas) */
export async function usaAsistencia(ctx: Contexto): Promise<boolean> {
  if (!ctx.modulosActivos.fidelizacion) return false
  const { data } = await ctx.supabase.from('fidelidad_config').select('activo, criterio').eq('negocio_id', ctx.negocio.id).maybeSingle()
  return data?.activo === true && data.criterio === 'asistencia'
}
