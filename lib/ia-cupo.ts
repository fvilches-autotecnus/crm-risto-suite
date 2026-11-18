import 'server-only'
import { createAdminClient } from '@/lib/supabase/server'
import { TZ_AR, hoyEn } from '@/lib/fechas'

/** Tope diario de usos de la IA por negocio. Cada pedido que cuesta (OpenAI) se anota en `ia_usos`. */
export const CUPOS = { pregunta: 10, ficha_cliente: 30 } as const
export type TipoUsoIA = keyof typeof CUPOS

/** Inicio del día de hoy en Argentina (el tope se reinicia a las 00:00 hora argentina). */
const inicioDelDia = () => `${hoyEn(TZ_AR)}T00:00:00-03:00`

export async function usosHoy(negocioId: string, tipo: TipoUsoIA): Promise<number> {
  const { count } = await createAdminClient().from('ia_usos').select('id', { count: 'exact', head: true })
    .eq('negocio_id', negocioId).eq('tipo', tipo).gte('creado_en', inicioDelDia())
  return count ?? 0
}

export const restantesHoy = async (negocioId: string, tipo: TipoUsoIA) => Math.max(0, CUPOS[tipo] - (await usosHoy(negocioId, tipo)))

/**
 * Reserva un lugar del tope: anota el uso y recién después cuenta; si se pasó del tope, lo borra y lo rechaza.
 * Así dos pedidos al mismo tiempo no se cuelan por encima del tope.
 */
export async function reservarCupo(negocioId: string, tipo: TipoUsoIA, usuarioId: string, detalle: Record<string, unknown>): Promise<{ ok: true; id: string; restantes: number } | { ok: false; restantes: 0 }> {
  const admin = createAdminClient()
  const { data, error } = await admin.from('ia_usos').insert({ negocio_id: negocioId, usuario_id: usuarioId, tipo, detalle }).select('id').single()
  if (error || !data) throw new Error('No se pudo registrar el uso de la IA')
  const usados = await usosHoy(negocioId, tipo)
  if (usados > CUPOS[tipo]) { await admin.from('ia_usos').delete().eq('id', data.id); return { ok: false, restantes: 0 } }
  return { ok: true, id: data.id as string, restantes: CUPOS[tipo] - usados }
}

/** Si la IA falló, el uso no cuenta. */
export async function devolverCupo(id: string) { await createAdminClient().from('ia_usos').delete().eq('id', id) }

/** Completa lo que se hizo con la pregunta (qué consultas usó) sin tocar el cupo. */
export async function anotarDetalle(id: string, detalle: Record<string, unknown>) { await createAdminClient().from('ia_usos').update({ detalle }).eq('id', id) }
