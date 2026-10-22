'use server'

import { revalidatePath } from 'next/cache'
import { getContexto } from '@/lib/context'
import { createAdminClient } from '@/lib/supabase/server'
import { enAlcance, reactivar } from '@/lib/pausados'
import { MAX_PAUSA_MIN, UNIDADES_PAUSA } from '@/lib/pausas'
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

/**
 * Tiempo de pausa automática por motivo (consulta o reclamo / solicitud de reserva / otro): "Indefinida" o un plazo.
 * Lo usa el trigger de sesiones_bot: al pausar calcula cuándo vence y, cuando el cliente escribe pasado ese momento, el chat vuelve al bot.
 * Después recalcula las pausas que ya estaban vigentes. Solo dueño/administrador de un negocio con el botón de apagado.
 */
export async function guardarPausaAuto(_prev: ActionResult | null, fd: FormData): Promise<ActionResult> {
  const ctx = await getContexto()
  if (!ctx.tieneApagadoBot) return fail('Este negocio no tiene habilitado el control del bot')
  if (!ctx.puedeAdministrar) return fail('Solo un dueño o administrador puede cambiar la pausa automática')
  const pausa: Record<string, number | null> = {}
  for (const [clave, titulo] of [['consulta', 'consulta o reclamo'], ['reserva', 'solicitud de reserva'], ['otro', 'otro motivo']] as const) {
    if (String(fd.get(clave + '_modo') ?? 'indefinida') !== 'tiempo') { pausa[clave] = null; continue }
    const valor = Number(String(fd.get(clave + '_valor') ?? '').replace(',', '.'))
    const unidad = UNIDADES_PAUSA.find((u) => u.v === fd.get(clave + '_unidad'))
    if (!unidad || !Number.isFinite(valor) || valor <= 0) return fail(`Escribí cuánto dura la pausa de ${titulo}`)
    const min = Math.round(valor * unidad.m)
    if (min < 1 || min > MAX_PAUSA_MIN) return fail(`La pausa de ${titulo} tiene que estar entre 1 minuto y 30 días`)
    pausa[clave] = min
  }
  const admin = createAdminClient()
  const { data: actual } = await admin.from('negocios').select('modulos').eq('id', ctx.negocio.id).single()
  if (!actual) return fail('No se pudo leer el negocio')
  const { error } = await admin.from('negocios').update({ modulos: { ...(actual.modulos as Record<string, unknown>), pausa_auto: pausa } }).eq('id', ctx.negocio.id)
  if (error) return fail('No se pudo guardar')
  const { data: n } = await admin.rpc('recalcular_pausas', { p_negocio: ctx.negocio.id })
  revalidatePath('/', 'layout')
  return { ok: true, cantidad: typeof n === 'number' ? n : 0 }
}
