import 'server-only'
import type { Contexto } from '@/lib/context'
import type { OpcionesSede } from '@/components/reservas-ui'

/** Opciones de sede/ubicación para los formularios y tablas de reservas. */
export async function cargarOpciones(ctx: Contexto): Promise<OpcionesSede> {
  const { data } = await ctx.supabase.from('ubicaciones').select('nombre, sucursal_id').eq('negocio_id', ctx.negocio.id).eq('activo', true).order('orden').order('nombre')
  const ubicaciones = (data ?? []).map((u) => ({ nombre: u.nombre, sucursal_id: u.sucursal_id as string | null }))
  // tipos de reserva que ya existen en los datos (se ofrecen en el formulario y en los filtros)
  const { data: ts } = await ctx.supabase.from('reservas').select('tipo_reserva').eq('negocio_id', ctx.negocio.id).limit(10000)
  const tipos = [...new Set((ts ?? []).map((t) => t.tipo_reserva).filter(Boolean))].sort()
  return {
    tipos,
    sedes: ctx.sedes.map((x) => ({ id: x.id, nombre: x.nombre })),
    nombresSede: Object.fromEntries(ctx.sedesTodas.map((x) => [x.id, x.nombre])),
    sedeDefault: ctx.sede?.id ?? null,
    ubicaciones,
  }
}
