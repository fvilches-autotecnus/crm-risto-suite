'use server'

import { revalidatePath } from 'next/cache'
import { getContexto } from '@/lib/context'
import type { ActionResult } from './actions'

const fail = (error: string): ActionResult => ({ ok: false, error })
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
const refrescar = (slug: string) => { revalidatePath('/configuracion'); revalidatePath('/'); revalidatePath('/reservas'); revalidatePath(`/reservar/${slug}`) }

/** Días de la semana (0 = domingo … 6 = sábado) en que abre el negocio o una sede. `dias` null = abre todos los días (se borra la regla); en una sede, null = usar los del negocio. */
export async function guardarDiasApertura(sucursalId: string | null, dias: number[] | null): Promise<ActionResult> {
  const ctx = await getContexto()
  if (!ctx.modulosActivos.reservas) return fail('Este negocio no tiene el módulo Reservas')
  if (!ctx.puedeAdministrar) return fail('Solo dueños y administradores pueden cambiar los días de apertura')
  if (sucursalId && (!UUID.test(sucursalId) || !ctx.sedesTodas.some((s) => s.id === sucursalId))) return fail('La sede no es válida')
  const sede = sucursalId || null
  const base = ctx.supabase.from('reservas_dias_apertura').select('id').eq('negocio_id', ctx.negocio.id)
  const { data: actual } = await (sede ? base.eq('sucursal_id', sede) : base.is('sucursal_id', null)).maybeSingle()
  if (dias === null || (Array.isArray(dias) && dias.length === 7)) {   // todos los días = sin regla
    if (actual) { const { error } = await ctx.supabase.from('reservas_dias_apertura').delete().eq('id', actual.id as string); if (error) return fail('No se pudo guardar') }
  } else {
    const limpios = [...new Set((Array.isArray(dias) ? dias : []).map(Number).filter((d) => Number.isInteger(d) && d >= 0 && d <= 6))].sort()
    if (limpios.length === 0) return fail('Elegí al menos un día de la semana (o “todos los días”)')
    const { error } = actual
      ? await ctx.supabase.from('reservas_dias_apertura').update({ dias_semana: limpios }).eq('id', actual.id as string)
      : await ctx.supabase.from('reservas_dias_apertura').insert({ negocio_id: ctx.negocio.id, sucursal_id: sede, dias_semana: limpios })
    if (error) return fail('No se pudo guardar')
  }
  refrescar(ctx.negocio.slug)
  return { ok: true }
}

/** Un día puntual que abre aunque no sea uno de sus días habituales (una semana especial). Para cerrar un día puntual se usan las Fechas bloqueadas. */
export async function agregarDiaExtra(sucursalId: string | null, fecha: string, motivo: string): Promise<ActionResult> {
  const ctx = await getContexto()
  if (!ctx.modulosActivos.reservas) return fail('Este negocio no tiene el módulo Reservas')
  if (!(ctx.puedeAdministrar || ctx.rol === 'encargado')) return fail('No tenés permiso para agregar días')
  if (!/^\d{4}-\d{2}-\d{2}$/.test(fecha)) return fail('Elegí la fecha')
  if (sucursalId && (!UUID.test(sucursalId) || !ctx.sedesTodas.some((s) => s.id === sucursalId))) return fail('La sede no es válida')
  const { error } = await ctx.supabase.from('reservas_dias_extra').insert({ negocio_id: ctx.negocio.id, sucursal_id: sucursalId || null, fecha, motivo: motivo.trim().slice(0, 120) || null })
  if (error) return fail(error.code === '23505' ? 'Ese día ya está agregado' : 'No se pudo agregar el día')
  refrescar(ctx.negocio.slug)
  return { ok: true }
}

export async function quitarDiaExtra(id: string): Promise<ActionResult> {
  const ctx = await getContexto()
  if (!(ctx.puedeAdministrar || ctx.rol === 'encargado')) return fail('No tenés permiso para quitar días')
  if (!UUID.test(id)) return fail('Día no válido')
  const { error } = await ctx.supabase.from('reservas_dias_extra').delete().eq('id', id).eq('negocio_id', ctx.negocio.id)
  if (error) return fail('No se pudo quitar el día')
  refrescar(ctx.negocio.slug)
  return { ok: true }
}
