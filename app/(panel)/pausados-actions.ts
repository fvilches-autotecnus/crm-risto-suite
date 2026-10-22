'use server'

import { revalidatePath } from 'next/cache'
import { getContexto } from '@/lib/context'
import { createAdminClient } from '@/lib/supabase/server'
import { enAlcance, reactivar } from '@/lib/pausados'
import type { ActionResult } from './actions'

const fail = (error: string): ActionResult => ({ ok: false, error })
const UUID = /^[0-9a-f-]{36}$/i

/** Mismo permiso que el botón de apagar el bot: el negocio tiene la función y el rol alcanza (encargado o superior). */
async function permiso() {
  const ctx = await getContexto()
  return { ctx, error: ctx.puedeApagarBot ? null : 'No tenés permiso para reactivar chats del bot' }
}

export async function reactivarChat(id: string): Promise<ActionResult> {
  const { ctx, error } = await permiso()
  if (error) return fail(error)
  if (!UUID.test(id)) return fail('Chat no válido')
  try {
    const n = await reactivar(ctx, { id })
    if (n === 0) return fail('Ese chat ya no estaba pausado')
  } catch { return fail('No se pudo reactivar el chat') }
  revalidatePath('/', 'layout')
  return { ok: true }
}

/** Reactiva todos los pausados (o solo los de un motivo) dentro del alcance de sedes del usuario. */
export async function reactivarTodos(motivo?: string): Promise<ActionResult> {
  const { ctx, error } = await permiso()
  if (error) return fail(error)
  try {
    const cantidad = await reactivar(ctx, { motivo: motivo && ['consulta', 'reserva', 'otro'].includes(motivo) ? motivo : undefined })
    revalidatePath('/', 'layout')
    return { ok: true, cantidad }
  } catch { return fail('No se pudieron reactivar los chats') }
}

/** Deshacer de "Reactivar": vuelve a dejar el chat pausado con su motivo y su fecha originales. */
export async function volverAPausar(id: string, motivo: string | null, pausadoEn: string | null): Promise<ActionResult> {
  const { ctx, error } = await permiso()
  if (error) return fail(error)
  if (!UUID.test(id)) return fail('Chat no válido')
  const motivoOk = motivo && /^[a-z_]{1,40}$/.test(motivo) ? motivo : null
  const admin = createAdminClient()
  const { data: fila } = await admin.from('sesiones_bot').select('sucursal_id').eq('id', id).eq('negocio_id', ctx.negocio.id).maybeSingle()
  if (!fila || !enAlcance(ctx, fila.sucursal_id)) return fail('Chat no válido')
  const { error: e } = await admin.from('sesiones_bot').update({ estado_bot: 'pausado', motivo_pausa: motivoOk, pausado_en: pausadoEn ?? new Date().toISOString() }).eq('id', id).eq('negocio_id', ctx.negocio.id)
  if (e) return fail('No se pudo volver a pausar el chat')
  revalidatePath('/', 'layout')
  return { ok: true }
}
