'use server'

import { revalidatePath } from 'next/cache'
import { getContexto } from '@/lib/context'
import type { ActionResult } from './actions'

const fail = (error: string): ActionResult => ({ ok: false, error })
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
const text = (fd: FormData, k: string) => String(fd.get(k) ?? '').trim()
const entero = (v: string, min: number, max: number) => { const n = Number(v); return Number.isInteger(n) && n >= min && n <= max ? n : null }

/** Configura el sitio público de reservas del negocio (solo dueños y administradores). */
export async function guardarReservasWeb(_prev: ActionResult | null, fd: FormData): Promise<ActionResult> {
  const ctx = await getContexto()
  if (!ctx.modulosActivos.reservas) return fail('Este negocio no tiene el módulo Reservas')
  if (!ctx.puedeAdministrar) return fail('Solo dueños y administradores pueden configurar el sitio de reservas')
  const dias = entero(text(fd, 'dias_adelante'), 1, 365), horas = entero(text(fd, 'horas_anticipacion'), 0, 72), pmin = entero(text(fd, 'personas_min'), 1, 100), pmax = entero(text(fd, 'personas_max'), 1, 200)
  if (!dias) return fail('Los días hacia adelante van de 1 a 365')
  if (horas === null) return fail('La anticipación va de 0 a 72 horas')
  if (!pmin || !pmax || pmin > pmax) return fail('Revisá la cantidad de personas: el mínimo no puede superar al máximo')
  const horarios = [...new Set(text(fd, 'horarios').split(/[\s,;]+/).filter(Boolean).map((h) => (/^\d{1,2}:\d{2}$/.test(h) ? h.padStart(5, '0') : h)))]
  if (horarios.some((h) => !/^([01]\d|2[0-3]):[0-5]\d$/.test(h))) return fail('Los horarios van como 13:00, 21:30 (separados por coma)')
  if (horarios.length > 24) return fail('Hasta 24 horarios')
  const tipos = fd.getAll('tipos').map(String).filter((t) => /^[a-z0-9_]{1,40}$/.test(t))
  const mensaje = text(fd, 'mensaje')
  if (mensaje.length > 400) return fail('El mensaje puede tener hasta 400 letras')
  const { error } = await ctx.supabase.from('reservas_web_config').upsert({
    negocio_id: ctx.negocio.id, activo: fd.get('activo') === 'on', elegir_mesa: fd.get('elegir_mesa') === 'on', tipos, horarios: horarios.sort(),
    dias_adelante: dias, horas_anticipacion: horas, personas_min: pmin, personas_max: pmax, mensaje: mensaje || null,
  })
  if (error) return fail('No se pudo guardar la configuración')
  revalidatePath(`/reservar/${ctx.negocio.slug}`)
  revalidatePath('/configuracion')
  return { ok: true }
}

/** El cliente de una reserva del sitio ya escribió por WhatsApp (el botón "Ya escribió"). El bot lo hace solo con bot_reserva_web_recibida. */
export async function marcarWhatsappRecibido(reservaId: string): Promise<ActionResult> {
  const ctx = await getContexto()
  if (!ctx.puedeEscribir) return fail('Tu usuario es de solo lectura')
  if (!UUID.test(reservaId)) return fail('Reserva no válida')
  const { data, error } = await ctx.supabase.from('reservas').update({ espera_whatsapp: false }).eq('id', reservaId).eq('negocio_id', ctx.negocio.id).select('id').maybeSingle()
  if (error || !data) return fail('No se pudo marcar la reserva')
  revalidatePath('/reservas')
  return { ok: true }
}
