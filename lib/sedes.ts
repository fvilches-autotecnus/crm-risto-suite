import 'server-only'
import type { Contexto } from '@/lib/context'
import type { OpcionesSede } from '@/components/reservas-ui'

/** Opciones de sede/ubicación para los formularios y tablas de reservas. */
export async function cargarOpciones(ctx: Contexto): Promise<OpcionesSede> {
  const { data } = await ctx.supabase.from('ubicaciones').select('nombre, sucursal_id').eq('negocio_id', ctx.negocio.id).eq('activo', true).order('orden').order('nombre')
  const ubicaciones = [...new Set((data ?? []).filter((u) => !u.sucursal_id || !ctx.sede || u.sucursal_id === ctx.sede.id).map((u) => u.nombre))]
  return {
    sedes: ctx.sedes.map((x) => ({ id: x.id, nombre: x.nombre })),
    nombresSede: Object.fromEntries(ctx.sedesTodas.map((x) => [x.id, x.nombre])),
    sedeDefault: ctx.sede?.id ?? null,
    ubicaciones,
  }
}
