'use server'

import { revalidatePath } from 'next/cache'
import { getContexto } from '@/lib/context'
import { createAdminClient } from '@/lib/supabase/server'
import { configurarVapid, enviarAviso } from '@/lib/push'
import { UUID } from '@/lib/validar'

export interface ResultadoPush { ok: boolean; error?: string; enviados?: number }
const fail = (error: string): ResultadoPush => ({ ok: false, error })

/** Por ahora las notificaciones push son solo para superadmin (se vuelve a comprobar acá, en el servidor). */
async function superadmin() {
  const ctx = await getContexto()
  return ctx.esSuperadmin ? ctx : null
}

/** Guarda (o actualiza) este dispositivo. Un mismo navegador puede pasar de un usuario a otro: el endpoint es único y queda con el último. */
export async function guardarSuscripcion(s: { endpoint: string; p256dh: string; auth: string; dispositivo?: string }): Promise<ResultadoPush> {
  const ctx = await superadmin()
  if (!ctx) return fail('Solo un superadmin puede activar los avisos')
  const endpoint = String(s?.endpoint ?? ''), p256dh = String(s?.p256dh ?? ''), auth = String(s?.auth ?? '')
  if (!/^https:\/\//.test(endpoint) || endpoint.length < 20 || endpoint.length > 1000 || p256dh.length < 10 || p256dh.length > 200 || auth.length < 10 || auth.length > 100) return fail('Los datos del dispositivo no son válidos')
  const dispositivo = String(s?.dispositivo ?? '').replace(/\s+/g, ' ').trim().slice(0, 120) || null
  const { error } = await createAdminClient().from('push_suscripciones').upsert({ usuario_id: ctx.userId, endpoint, p256dh, auth, dispositivo, fallos: 0 }, { onConflict: 'endpoint' })
  if (error) return fail('No se pudo guardar el dispositivo')
  return { ok: true }
}

/** Da de baja este dispositivo (solo si es del usuario con sesión). */
export async function quitarSuscripcion(endpoint: string): Promise<ResultadoPush> {
  const ctx = await superadmin()
  if (!ctx) return fail('Solo un superadmin puede cambiar los avisos')
  const { error } = await ctx.supabase.from('push_suscripciones').delete().eq('endpoint', String(endpoint ?? '')).eq('usuario_id', ctx.userId)
  return error ? fail('No se pudo quitar el dispositivo') : { ok: true }
}

/** Enciende o apaga los avisos de un negocio para este superadmin (en todos sus dispositivos). Sin fila = encendido. */
export async function cambiarAvisosNegocio(negocioId: string, encendido: boolean): Promise<ResultadoPush> {
  const ctx = await superadmin()
  if (!ctx) return fail('Solo un superadmin puede cambiar los avisos')
  if (!UUID.test(negocioId) || !ctx.negocios.some((n) => n.id === negocioId)) return fail('Negocio no válido')
  const { error } = encendido
    ? await ctx.supabase.from('push_negocios_apagados').delete().eq('usuario_id', ctx.userId).eq('negocio_id', negocioId)
    : await ctx.supabase.from('push_negocios_apagados').upsert({ usuario_id: ctx.userId, negocio_id: negocioId }, { onConflict: 'usuario_id,negocio_id', ignoreDuplicates: true })
  if (error) return fail('No se pudo guardar el cambio')
  revalidatePath('/', 'layout')
  return { ok: true }
}

/** Manda una notificación de prueba a los dispositivos de este usuario (siempre se muestra, aunque el CRM esté abierto). */
export async function enviarPrueba(): Promise<ResultadoPush> {
  const ctx = await superadmin()
  if (!ctx) return fail('Solo un superadmin puede probar los avisos')
  if (!configurarVapid()) return fail('Faltan las claves de notificaciones en el servidor')
  const { data } = await ctx.supabase.from('push_suscripciones').select('id, usuario_id, endpoint, p256dh, auth').eq('usuario_id', ctx.userId)
  const subs = (data ?? []) as { id: string; usuario_id: string; endpoint: string; p256dh: string; auth: string }[]
  if (!subs.length) return fail('Este usuario todavía no tiene dispositivos con avisos activados')
  const enviados = await enviarAviso(subs, { titulo: 'RistoSuite · prueba', cuerpo: 'Si ves esto, los avisos de este dispositivo funcionan.', url: '/', tag: 'prueba', prueba: true })
  return enviados ? { ok: true, enviados } : fail('No se pudo enviar la prueba (el dispositivo no respondió)')
}
