'use server'

import { revalidatePath } from 'next/cache'
import { getContexto } from '@/lib/context'
import { VARIABLES_WA } from '@/lib/reservas-config'
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
  const titulo = text(fd, 'titulo'), subtitulo = text(fd, 'subtitulo')
  if (titulo.length > 80) return fail('El título puede tener hasta 80 letras')
  if (subtitulo.length > 160) return fail('El subtítulo puede tener hasta 160 letras')
  const validez = entero(text(fd, 'validez_horas'), 1, 168), maxMesas = entero(text(fd, 'max_mesas'), 1, 12)
  if (!validez) return fail('La solicitud puede esperar de 1 a 168 horas')
  if (!maxMesas) return fail('El máximo de mesas por reserva va de 1 a 12')
  const plantilla = String(fd.get('texto_whatsapp') ?? '').replace(/\r\n/g, '\n').trim()
  if (plantilla) {
    if (plantilla.length > 1200) return fail('El mensaje de WhatsApp puede tener hasta 1200 letras')
    if (!plantilla.includes('{codigo}')) return fail('El mensaje de WhatsApp tiene que llevar {codigo}: sin eso no se puede registrar la reserva cuando el cliente escribe')
    const permitidas = new Set<string>(VARIABLES_WA.map((v) => v[0]))
    const rara = [...plantilla.matchAll(/\{([a-z_]+)\}/g)].map((m) => m[1]).find((v) => !permitidas.has(v))
    if (rara) return fail(`En el mensaje de WhatsApp no existe la variable {${rara}}`)
  }
  const { error } = await ctx.supabase.from('reservas_web_config').upsert({
    negocio_id: ctx.negocio.id, activo: fd.get('activo') === 'on', elegir_mesa: fd.get('elegir_mesa') === 'on', tipos, horarios: horarios.sort(),
    dias_adelante: dias, horas_anticipacion: horas, personas_min: pmin, personas_max: pmax, mensaje: mensaje || null,
    modo_prueba: fd.get('modo_prueba') === 'on', titulo: titulo || null, subtitulo: subtitulo || null, texto_whatsapp: plantilla || null, validez_horas: validez, max_mesas: maxMesas,
  })
  if (error) return fail('No se pudo guardar la configuración')
  revalidatePath(`/reservar/${ctx.negocio.slug}`)
  revalidatePath('/configuracion')
  return { ok: true }
}

const AVISOS: Record<string, string> = {
  mesa_ocupada: 'La mesa que había elegido ya no estaba libre: la reserva quedó sin mesa.', mesa_no_disponible: 'La mesa que había elegido ya no existe: la reserva quedó sin mesa.',
  horario_completo: 'Ojo: ese horario ya está completo según el aforo.',
}

/** Registra una solicitud del sitio como reserva real con el teléfono de quien escribió por WhatsApp (cuando el bot no la tomó solo). */
export interface ResultadoSolicitud { ok: boolean; error?: string; numero?: number; nota?: string }
export async function registrarSolicitudWeb(id: string, telefono: string): Promise<ResultadoSolicitud> {
  const ctx = await getContexto()
  if (!ctx.puedeEscribir) return fail('Tu usuario es de solo lectura')
  if (!UUID.test(id)) return fail('Solicitud no válida')
  const { data, error } = await ctx.supabase.rpc('registrar_solicitud_web', { p_id: id, p_telefono: String(telefono ?? '').slice(0, 30) })
  const r = data as { ok?: boolean; error?: string; avisos?: string[]; reserva?: { numero: number } } | null
  if (error || !r) return fail('No se pudo registrar la reserva')
  if (!r.ok) return fail(r.error === 'telefono_invalido' ? 'Revisá el teléfono' : r.error === 'solicitud_vencida' ? 'La solicitud venció (pasaron más de 48 horas o ya pasó la fecha)' : r.error === 'sin_permiso' ? 'No tenés permiso para registrar reservas' : 'No se pudo registrar la reserva')
  revalidatePath('/reservas')
  return { ok: true, numero: r.reserva?.numero, nota: (r.avisos ?? []).map((a) => AVISOS[a]).filter(Boolean).join(' ') || undefined }
}

/** Descarta una solicitud en espera (el cliente no escribió o se arrepintió). */
export async function descartarSolicitudWeb(id: string): Promise<ActionResult> {
  const ctx = await getContexto()
  if (!ctx.puedeEscribir) return fail('Tu usuario es de solo lectura')
  if (!UUID.test(id)) return fail('Solicitud no válida')
  const { error } = await ctx.supabase.from('reservas_web_solicitudes').delete().eq('id', id).eq('negocio_id', ctx.negocio.id).is('reserva_id', null)
  if (error) return fail('No se pudo descartar la solicitud')
  revalidatePath('/reservas')
  return { ok: true }
}
