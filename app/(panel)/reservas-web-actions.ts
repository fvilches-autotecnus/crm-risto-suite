'use server'

import { revalidatePath } from 'next/cache'
import { getContexto } from '@/lib/context'
import { colorValido, urlValida } from '@/lib/marca'
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
  // horarios propios de ciertos días de la semana (0 = domingo … 6 = sábado); el día vacío usa los generales
  const horariosDias: Record<string, string[]> = {}
  for (let d = 0; d <= 6; d++) {
    const hs = [...new Set(text(fd, `horarios_dia_${d}`).split(/[\s,;]+/).filter(Boolean).map((h) => (/^\d{1,2}:\d{2}$/.test(h) ? h.padStart(5, '0') : h)))]
    if (hs.length === 0) continue
    if (hs.some((h) => !/^([01]\d|2[0-3]):[0-5]\d$/.test(h))) return fail('Los horarios de cada día van como 13:00, 21:30 (separados por coma)')
    if (hs.length > 24) return fail('Hasta 24 horarios por día')
    horariosDias[String(d)] = hs.sort()
  }
  const tipos = fd.getAll('tipos').map(String).filter((t) => /^[a-z0-9_]{1,40}$/.test(t))
  const mensaje = text(fd, 'mensaje')
  if (mensaje.length > 400) return fail('El mensaje puede tener hasta 400 letras')
  const titulo = text(fd, 'titulo'), subtitulo = text(fd, 'subtitulo')
  if (titulo.length > 80) return fail('El título puede tener hasta 80 letras')
  if (subtitulo.length > 160) return fail('El subtítulo puede tener hasta 160 letras')
  const marca = { logo_url: text(fd, 'marca_logo_url'), ornamento_url: text(fd, 'marca_ornamento_url'), color_fondo: text(fd, 'marca_color_fondo'), color_acento: text(fd, 'marca_color_acento'), lema: text(fd, 'marca_lema') }
  for (const [k, n] of [['logo_url', 'El logo'], ['ornamento_url', 'El adorno']] as const) if (marca[k] && !urlValida(marca[k])) return fail(`${n} tiene que ser una dirección https://… o una ruta que empiece con / (sin espacios ni comillas)`)
  for (const [k, n] of [['color_fondo', 'El color de fondo'], ['color_acento', 'El color de acento']] as const) if (marca[k] && !colorValido(marca[k])) return fail(`${n} va como #RRGGBB (por ejemplo #3a442c)`)
  if (marca.lema.length > 120) return fail('La frase del local puede tener hasta 120 letras')
  const textoCualquiera = text(fd, 'texto_cualquier_ubicacion')
  if (textoCualquiera.length > 60) return fail('El texto de “cualquier ubicación” puede tener hasta 60 letras')
  const escModo = ['off', 'pocos', 'cantidad'].includes(text(fd, 'escasez_modo')) ? text(fd, 'escasez_modo') : 'off'
  const escUmbral = entero(text(fd, 'escasez_umbral') || '10', 1, 500)
  if (!escUmbral) return fail('El aviso de pocos lugares va de 1 a 500 lugares')
  const escTexto = text(fd, 'escasez_texto')
  if (escTexto.length > 40) return fail('El texto de “pocos lugares” puede tener hasta 40 letras')
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
  // ajustes por sede (cada sede puede tener sus horarios, su mensaje y si deja elegir mesa; vacío = hereda lo del sitio)
  const idsSede = fd.getAll('sede_id').map(String).filter((i) => UUID.test(i))
  const filasSede: { sucursal_id: string; negocio_id: string; activo: boolean; horarios: string[] | null; horarios_dias: Record<string, string[]>; elegir_mesa: boolean | null; mensaje: string | null }[] = []
  if (idsSede.length) {
    const { data: validas } = await ctx.supabase.from('sucursales').select('id, nombre').eq('negocio_id', ctx.negocio.id).in('id', idsSede)
    for (const v of validas ?? []) {
      const id = v.id as string
      const hs = [...new Set(text(fd, `sede_horarios_${id}`).split(/[\s,;]+/).filter(Boolean).map((h) => (/^\d{1,2}:\d{2}$/.test(h) ? h.padStart(5, '0') : h)))]
      if (hs.some((h) => !/^([01]\d|2[0-3]):[0-5]\d$/.test(h))) return fail(`Los horarios de ${v.nombre} van como 13:00, 21:30 (separados por coma)`)
      if (hs.length > 24) return fail(`${v.nombre}: hasta 24 horarios`)
      const hd: Record<string, string[]> = {}
      for (let d = 0; d <= 6; d++) {
        const h = [...new Set(text(fd, `sede_horarios_dia_${id}_${d}`).split(/[\s,;]+/).filter(Boolean).map((x) => (/^\d{1,2}:\d{2}$/.test(x) ? x.padStart(5, '0') : x)))]
        if (h.length === 0) continue
        if (h.some((x) => !/^([01]\d|2[0-3]):[0-5]\d$/.test(x))) return fail(`Los horarios de ${v.nombre} por día van como 13:00, 21:30 (separados por coma)`)
        if (h.length > 24) return fail(`${v.nombre}: hasta 24 horarios por día`)
        hd[String(d)] = h.sort()
      }
      const msg = text(fd, `sede_mensaje_${id}`)
      if (msg.length > 400) return fail(`El mensaje de ${v.nombre} puede tener hasta 400 letras`)
      const mesa = text(fd, `sede_mesa_${id}`)
      filasSede.push({ sucursal_id: id, negocio_id: ctx.negocio.id, activo: fd.get(`sede_activo_${id}`) === 'on', horarios: hs.length ? hs.sort() : null, horarios_dias: hd, elegir_mesa: mesa === 'si' ? true : mesa === 'no' ? false : null, mensaje: msg || null })
    }
  }
  const { error } = await ctx.supabase.from('reservas_web_config').upsert({
    negocio_id: ctx.negocio.id, activo: fd.get('activo') === 'on', elegir_mesa: fd.get('elegir_mesa') === 'on', tipos, horarios: horarios.sort(), horarios_dias: horariosDias,
    dias_adelante: dias, horas_anticipacion: horas, personas_min: pmin, personas_max: pmax, mensaje: mensaje || null,
    modo_prueba: fd.get('modo_prueba') === 'on', titulo: titulo || null, subtitulo: subtitulo || null, texto_whatsapp: plantilla || null, validez_horas: validez, max_mesas: maxMesas, cualquier_ubicacion: fd.get('cualquier_ubicacion') === 'on', pedir_cumple: fd.get('pedir_cumple') === 'on', texto_cualquier_ubicacion: textoCualquiera || null,
    escasez_modo: escModo, escasez_umbral: escUmbral, escasez_texto: escTexto || null, marca: Object.fromEntries(Object.entries(marca).filter(([, v]) => v)),
  })
  if (error) return fail('No se pudo guardar la configuración')
  if (filasSede.length) {
    const { error: e2 } = await ctx.supabase.from('reservas_web_sedes').upsert(filasSede, { onConflict: 'sucursal_id' })
    if (e2) return fail('Se guardó el sitio, pero no los ajustes de las sedes')
  }
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
