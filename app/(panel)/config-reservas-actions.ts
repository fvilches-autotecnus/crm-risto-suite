'use server'

import { revalidatePath } from 'next/cache'
import { getContexto } from '@/lib/context'
import { MENSAJES_BOT } from '@/lib/reservas-config'
import type { ActionResult } from './actions'

const fail = (error: string): ActionResult => ({ ok: false, error })
const refrescar = (slug: string) => { revalidatePath('/configuracion'); revalidatePath('/reservas'); revalidatePath('/'); revalidatePath('/mesas'); revalidatePath(`/reservar/${slug}`) }

/** Guarda el catálogo de tipos de reserva. `tipos` viene en el orden elegido. Un tipo que ya tiene reservas no se borra: se desactiva. */
export async function guardarTiposReserva(tipos: { clave: string; etiqueta: string; activo: boolean }[]): Promise<ActionResult> {
  const ctx = await getContexto()
  if (!ctx.puedeAdministrar) return fail('Solo dueños y administradores pueden cambiar los tipos de reserva')
  if (!Array.isArray(tipos) || tipos.length === 0 || tipos.length > 40) return fail('Tiene que haber entre 1 y 40 tipos de reserva')
  const claves = new Set<string>()
  for (const t of tipos) {
    if (!/^[a-z0-9_]{1,40}$/.test(String(t.clave))) return fail('Hay un tipo con un nombre no válido')
    if (claves.has(t.clave)) return fail(`El tipo “${t.etiqueta}” está repetido`)
    claves.add(t.clave)
    const e = String(t.etiqueta ?? '').trim()
    if (e.length < 1 || e.length > 40) return fail('El nombre de cada tipo va de 1 a 40 letras')
  }
  if (!tipos.some((t) => t.activo)) return fail('Dejá al menos un tipo activo')
  const filas = tipos.map((t, i) => ({ negocio_id: ctx.negocio.id, clave: t.clave, etiqueta: t.etiqueta.trim(), activo: !!t.activo, orden: i }))
  const { error } = await ctx.supabase.from('reserva_tipos').upsert(filas, { onConflict: 'negocio_id,clave' })
  if (error) return fail('No se pudieron guardar los tipos')
  // los que ya no están en la lista: se borran si nadie los usa; si tienen reservas, quedan desactivados
  const { data: actuales } = await ctx.supabase.from('reserva_tipos').select('clave').eq('negocio_id', ctx.negocio.id)
  for (const a of (actuales ?? []).filter((x) => !claves.has(x.clave as string))) {
    const { count } = await ctx.supabase.from('reservas').select('id', { count: 'exact', head: true }).eq('negocio_id', ctx.negocio.id).eq('tipo_reserva', a.clave as string)
    if ((count ?? 0) > 0) await ctx.supabase.from('reserva_tipos').update({ activo: false }).eq('negocio_id', ctx.negocio.id).eq('clave', a.clave as string)
    else await ctx.supabase.from('reserva_tipos').delete().eq('negocio_id', ctx.negocio.id).eq('clave', a.clave as string)
  }
  refrescar(ctx.negocio.slug)
  return { ok: true }
}

/** Alerta de aforo, turnos del plano y estados que bloquean una mesa. */
export async function guardarParametrosReservas(_prev: ActionResult | null, fd: FormData): Promise<ActionResult> {
  const ctx = await getContexto()
  if (!ctx.modulosActivos.reservas) return fail('Este negocio no tiene el módulo Reservas')
  if (!ctx.puedeAdministrar) return fail('Solo dueños y administradores pueden cambiar estos parámetros')
  const alerta = Number(String(fd.get('alerta_aforo_pct') ?? '').trim())
  if (!Number.isInteger(alerta) || alerta < 50 || alerta > 100) return fail('La alerta de aforo va de 50 a 100 %')
  const nombres = fd.getAll('turno_nombre').map((v) => String(v).trim()), horas = fd.getAll('turno_hora').map((v) => String(v).trim())
  const turnos: { nombre: string; hora: string }[] = []
  for (let i = 0; i < nombres.length; i++) {
    if (!nombres[i] && !horas[i]) continue
    if (!nombres[i] || nombres[i].length > 20) return fail('Cada turno necesita un nombre de hasta 20 letras')
    if (!/^([01]\d|2[0-3]):[0-5]\d$/.test(horas[i])) return fail(`La hora del turno “${nombres[i]}” no es válida (por ejemplo 21:00)`)
    turnos.push({ nombre: nombres[i], hora: horas[i] })
  }
  if (turnos.length > 6) return fail('Hasta 6 turnos')
  const estados = fd.getAll('estados_bloquean').map(String).filter((e) => ['nueva', 'confirmada', 'pendiente_pago', 'revisar_pago'].includes(e))
  if (estados.length === 0) return fail('Elegí al menos un estado que bloquee la mesa')
  const { error } = await ctx.supabase.from('reservas_config').upsert({ negocio_id: ctx.negocio.id, alerta_aforo_pct: alerta, turnos, estados_bloquean: estados })
  if (error) return fail('No se pudieron guardar los parámetros')
  refrescar(ctx.negocio.slug)
  return { ok: true }
}

/** Guarda el texto de un mensaje del bot (el cliente lo recibe por WhatsApp). */
export async function guardarMensajeBot(clave: string, texto: string): Promise<ActionResult> {
  const ctx = await getContexto()
  if (!ctx.puedeAdministrar) return fail('Solo dueños y administradores pueden cambiar los mensajes del bot')
  const def = MENSAJES_BOT.find((m) => m.clave === clave)
  if (!def) return fail('Mensaje no válido')
  const t = String(texto ?? '').trim()
  if (t.length < 1 || t.length > 600) return fail('El mensaje va de 1 a 600 letras')
  const permitidas = new Set(def.variables)
  const raras = [...t.matchAll(/\{([a-z_]+)\}/g)].map((m) => m[1]).filter((v) => !permitidas.has(v))
  if (raras.length) return fail(`No existe la variable {${raras[0]}} en este mensaje${def.variables.length ? `. Podés usar: ${def.variables.map((v) => `{${v}}`).join(', ')}` : ''}`)
  const { error } = await ctx.supabase.from('bot_mensajes').upsert({ negocio_id: ctx.negocio.id, clave, texto: t, actualizado_en: new Date().toISOString() })
  if (error) return fail('No se pudo guardar el mensaje')
  revalidatePath('/configuracion')
  return { ok: true }
}

/** Vuelve al texto original de un mensaje del bot. */
export async function restaurarMensajeBot(clave: string): Promise<ActionResult> {
  const ctx = await getContexto()
  if (!ctx.puedeAdministrar) return fail('Solo dueños y administradores pueden cambiar los mensajes del bot')
  if (!MENSAJES_BOT.some((m) => m.clave === clave)) return fail('Mensaje no válido')
  const { error } = await ctx.supabase.from('bot_mensajes').delete().eq('negocio_id', ctx.negocio.id).eq('clave', clave)
  if (error) return fail('No se pudo restaurar el mensaje')
  revalidatePath('/configuracion')
  return { ok: true }
}
