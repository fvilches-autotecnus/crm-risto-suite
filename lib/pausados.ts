import 'server-only'
import { createAdminClient } from '@/lib/supabase/server'
import type { Contexto } from '@/lib/context'

/**
 * Chats pausados del bot de WhatsApp: filas de sesiones_bot con estado_bot = 'pausado'.
 * El bot (WAHA) pausa un chat cuando deriva a una persona (consulta / solicitud de reserva) y no tiene temporizador
 * para volver solo: se reactiva acá. Se lee y se escribe con service_role porque RLS de sesiones_bot es de solo lectura
 * y el permiso (poder apagar el bot) y el alcance de sedes se validan en el servidor.
 */
export interface ChatPausado {
  id: string
  telefono: string
  nombre_whatsapp: string | null
  motivo_pausa: string | null
  pausado_en: string | null
  sucursal_id: string | null
  /** Cuándo se reactiva solo (null = indefinida: se reactiva a mano). */
  reactivar_en: string | null
}

const COLS = 'id, telefono, nombre_whatsapp, motivo_pausa, pausado_en, sucursal_id, reactivar_en'

/** Una pausa vencida ya no cuenta: el chat vuelve al bot apenas el cliente escribe (la fila se actualiza en ese momento). */
const NO_VENCIDA = () => `reactivar_en.is.null,reactivar_en.gt.${new Date().toISOString()}`

/** Sedes a las que el usuario tiene alcance (null = todas, incluidos los chats sin sede). */
function alcanceSedes(ctx: Contexto): string[] | null {
  if (ctx.sede) return [ctx.sede.id]
  return ctx.sinRestriccionSede ? null : ctx.sedesGestion.map((s) => s.id)
}

/** ¿Un chat de esa sede cae dentro del alcance del usuario? (sin sede = solo para quien no tiene restricción) */
export function enAlcance(ctx: Contexto, sucursalId: string | null): boolean {
  const sedes = alcanceSedes(ctx)
  return !sedes || (!!sucursalId && sedes.includes(sucursalId))
}

export async function listarPausados(ctx: Contexto): Promise<ChatPausado[]> {
  let q = createAdminClient().from('sesiones_bot').select(COLS).eq('negocio_id', ctx.negocio.id).eq('estado_bot', 'pausado').or(NO_VENCIDA())
  const sedes = alcanceSedes(ctx)
  if (sedes) q = q.in('sucursal_id', sedes.length ? sedes : ['00000000-0000-0000-0000-000000000000'])
  const { data } = await q.order('pausado_en', { ascending: false, nullsFirst: false }).limit(20000)
  return (data ?? []) as ChatPausado[]
}

export async function contarPausados(ctx: Contexto): Promise<number> {
  let q = createAdminClient().from('sesiones_bot').select('id', { count: 'exact', head: true }).eq('negocio_id', ctx.negocio.id).eq('estado_bot', 'pausado').or(NO_VENCIDA())
  const sedes = alcanceSedes(ctx)
  if (sedes) q = q.in('sucursal_id', sedes.length ? sedes : ['00000000-0000-0000-0000-000000000000'])
  const { count } = await q
  return count ?? 0
}

/** Reactiva chats pausados del negocio dentro del alcance del usuario (ids opcionales). Devuelve cuántos reactivó. */
export async function reactivar(ctx: Contexto, opciones: { id?: string; motivo?: string } = {}): Promise<number> {
  let q = createAdminClient()
    .from('sesiones_bot')
    .update({ estado_bot: 'activo', motivo_pausa: null, pausado_en: null })
    .eq('negocio_id', ctx.negocio.id)
    .eq('estado_bot', 'pausado')
    .or(NO_VENCIDA())
  if (opciones.id) q = q.eq('id', opciones.id)
  if (opciones.motivo) q = opciones.motivo === 'otro' ? q.or('motivo_pausa.is.null,motivo_pausa.not.in.(consulta,reserva)') : q.eq('motivo_pausa', opciones.motivo)
  const sedes = alcanceSedes(ctx)
  if (sedes) q = q.in('sucursal_id', sedes.length ? sedes : ['00000000-0000-0000-0000-000000000000'])
  const { data, error } = await q.select('id')
  if (error) throw new Error(error.message)
  return data?.length ?? 0
}
