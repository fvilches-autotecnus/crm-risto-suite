'use server'

import { revalidatePath } from 'next/cache'
import { getContexto } from '@/lib/context'
import { hoyEn, sumarDias } from '@/lib/fechas'
import { createAdminClient } from '@/lib/supabase/server'
import { UUID } from '@/lib/validar'
import type { ActionResult } from './actions'

const fail = (error: string): ActionResult => ({ ok: false, error })
const FECHA_RE = /^\d{4}-\d{2}-\d{2}$/
const ROLES_MARCAR = ['superadmin', 'owner', 'admin', 'encargado']

async function permiso() {
  const ctx = await getContexto()
  if (!ctx.modulosActivos.metricas) return { ctx, error: 'Este negocio no tiene el módulo de métricas' }
  if (!ROLES_MARCAR.includes(ctx.rol)) return { ctx, error: 'Solo un encargado, administrador o dueño puede marcar días' }
  return { ctx, error: null }
}

/**
 * Marca un día como evento o cerrado (solo informativo: no bloquea reservas). La predicción lo deja afuera del promedio.
 * Una marca por fecha (y sede, si se está viendo una): volver a marcarla la cambia.
 */
export async function marcarDiaEspecial(_prev: ActionResult | null, fd: FormData): Promise<ActionResult> {
  const { ctx, error } = await permiso()
  if (error) return fail(error)
  const fecha = String(fd.get('fecha') ?? '')
  const tipo = String(fd.get('tipo') ?? '')
  const motivo = String(fd.get('motivo') ?? '').replace(/\s+/g, ' ').trim()
  const hoy = hoyEn(ctx.negocio.zona_horaria)
  if (!FECHA_RE.test(fecha) || fecha < sumarDias(hoy, -120) || fecha > sumarDias(hoy, 365)) return fail('La fecha no es válida')
  if (tipo !== 'evento' && tipo !== 'cerrado') return fail('Elegí si fue un evento o si estuvo cerrado')
  if (motivo.length > 120) return fail('El motivo puede tener hasta 120 caracteres')
  const sucursal = ctx.sede?.id ?? null
  const admin = createAdminClient()
  let q = admin.from('dias_especiales').select('id').eq('negocio_id', ctx.negocio.id).eq('fecha', fecha)
  q = sucursal ? q.eq('sucursal_id', sucursal) : q.is('sucursal_id', null)
  const { data: previa, error: e1 } = await q.maybeSingle()
  if (e1) return fail('No se pudo guardar la marca')
  const fila = { tipo, motivo: motivo || null }
  const { error: e2 } = previa
    ? await admin.from('dias_especiales').update(fila).eq('id', previa.id).eq('negocio_id', ctx.negocio.id)
    : await admin.from('dias_especiales').insert({ ...fila, negocio_id: ctx.negocio.id, sucursal_id: sucursal, fecha, creado_por: ctx.userId })
  if (e2) return fail('No se pudo guardar la marca')
  revalidatePath('/', 'layout')
  return { ok: true }
}

export async function quitarDiaEspecial(id: string): Promise<ActionResult> {
  const { ctx, error } = await permiso()
  if (error) return fail(error)
  if (!UUID.test(id)) return fail('Marca no válida')
  const { error: e } = await createAdminClient().from('dias_especiales').delete().eq('id', id).eq('negocio_id', ctx.negocio.id)
  if (e) return fail('No se pudo quitar la marca')
  revalidatePath('/', 'layout')
  return { ok: true }
}
