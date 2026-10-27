'use server'

import { revalidatePath } from 'next/cache'
import { getContexto } from '@/lib/context'
import { guardarConfigSede } from '@/lib/config-sedes-servidor'
import { CLAVES_PARAMS, GRUPOS_WEB, type TipoSedeOv } from '@/lib/config-sedes'
import { MODULOS_POR_SEDE } from '@/lib/modulos'
import { ESTADOS_BLOQUEO, MENSAJES_BOT, VARIABLES_WA } from '@/lib/reservas-config'
import type { ActionResult } from './actions'

const fail = (error: string): ActionResult => ({ ok: false, error })
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
const text = (fd: FormData, k: string) => String(fd.get(k) ?? '').trim()
const entero = (v: string, min: number, max: number) => { const n = Number(v); return Number.isInteger(n) && n >= min && n <= max ? n : null }
const refrescar = (slug: string) => { revalidatePath('/', 'layout'); revalidatePath(`/reservar/${slug}`) }
const HORA = /^([01]\d|2[0-3]):[0-5]\d$/
const horas = (v: string) => [...new Set(v.split(/[\s,;]+/).filter(Boolean).map((h) => (/^\d{1,2}:\d{2}$/.test(h) ? h.padStart(5, '0') : h)))]

/** Una sede sobre la que el usuario puede decidir (dueños y administradores, dentro de su alcance). */
async function sedePermitida(sedeId: string, soloSuperadmin = false) {
  const ctx = await getContexto()
  if (!UUID.test(sedeId) || !ctx.sedesGestion.some((s) => s.id === sedeId)) return { ctx, error: 'La sede no es válida' }
  if (soloSuperadmin ? !ctx.esSuperadmin : !ctx.puedeAdministrar) return { ctx, error: soloSuperadmin ? 'Solo el superadmin puede elegir los módulos de cada sede' : 'Solo dueños y administradores pueden cambiar la configuración de una sede' }
  return { ctx, error: null as string | null }
}

// ───────── módulos: cada sede apaga los que no usa (solo entre los que el negocio tiene)
export async function guardarModulosSedes(_prev: ActionResult | null, fd: FormData): Promise<ActionResult> {
  const ctx = await getContexto()
  if (!ctx.esSuperadmin) return fail('Solo el superadmin puede elegir los módulos de cada sede')
  const ids = fd.getAll('sede_id').map(String).filter((i) => UUID.test(i) && ctx.sedesTodas.some((s) => s.id === i))
  for (const id of ids) {
    const modulos: Record<string, boolean> = {}
    for (const c of MODULOS_POR_SEDE) if (ctx.modulosNegocio[c] && fd.get(`m_${id}_${c}`) !== 'on') modulos[c] = false   // el negocio lo tiene y la sede no lo usa
    const err = await guardarConfigSede(ctx, id, { modulos }); if (err) return fail(err)
  }
  refrescar(ctx.negocio.slug)
  return { ok: true }
}

// ───────── tipos de reserva: si la sede los ofrece y en qué días
export async function guardarTiposSede(sedeId: string, tipos: Record<string, TipoSedeOv>): Promise<ActionResult> {
  const { ctx, error } = await sedePermitida(sedeId); if (error) return fail(error)
  const { data: cat } = await ctx.supabase.from('reserva_tipos').select('clave').eq('negocio_id', ctx.negocio.id)
  const validas = new Set((cat ?? []).map((t) => t.clave as string))
  const limpio: Record<string, TipoSedeOv> = {}
  for (const [clave, o] of Object.entries(tipos ?? {})) {
    if (!validas.has(clave) || !o) continue
    const r: TipoSedeOv = {}
    if (o.activo === false) r.activo = false
    if (o.modo) {
      if (!['siempre', 'semana', 'fechas'].includes(o.modo)) return fail(`El tipo “${clave}” tiene una disponibilidad no válida`)
      r.modo = o.modo
      if (o.modo === 'semana') {
        r.dias_semana = [...new Set((o.dias_semana ?? []).filter((d) => Number.isInteger(d) && d >= 0 && d <= 6))].sort()
        if (r.dias_semana.length === 0) return fail(`Elegí los días de la semana del tipo “${clave}”`)
      }
      if (o.modo === 'fechas') {
        r.fechas = [...new Set((o.fechas ?? []).filter((f) => /^\d{4}-\d{2}-\d{2}$/.test(f)))].sort().slice(0, 120)
        if (r.fechas.length === 0) return fail(`Agregá al menos una fecha al tipo “${clave}”`)
      }
    }
    if (Object.keys(r).length > 0) limpio[clave] = r
  }
  const err = await guardarConfigSede(ctx, sedeId, { tipos: limpio }); if (err) return fail(err)
  refrescar(ctx.negocio.slug)
  return { ok: true }
}

// ───────── parámetros de reservas (alerta de aforo, turnos, estados que bloquean)
export async function guardarParametrosSede(_prev: ActionResult | null, fd: FormData): Promise<ActionResult> {
  const { ctx, error } = await sedePermitida(text(fd, 'sede_id')); if (error) return fail(error)
  const sedeId = text(fd, 'sede_id')
  const params = { ...(ctx.configSedes[sedeId]?.params ?? {}) } as Record<string, unknown>
  for (const k of CLAVES_PARAMS) delete params[k]
  if (fd.get('ov_parametros') === 'on') {
    const alerta = entero(text(fd, 'alerta_aforo_pct'), 50, 100)
    if (!alerta) return fail('La alerta de aforo va de 50 a 100 %')
    const nombres = fd.getAll('turno_nombre').map((v) => String(v).trim()), hs = fd.getAll('turno_hora').map((v) => String(v).trim())
    const turnos: { nombre: string; hora: string }[] = []
    for (let i = 0; i < nombres.length; i++) {
      if (!nombres[i] && !hs[i]) continue
      if (!nombres[i] || nombres[i].length > 20) return fail('Cada turno necesita un nombre de hasta 20 letras')
      if (!HORA.test(hs[i])) return fail(`La hora del turno “${nombres[i]}” no es válida (por ejemplo 21:00)`)
      turnos.push({ nombre: nombres[i], hora: hs[i] })
    }
    if (turnos.length > 6) return fail('Hasta 6 turnos')
    const estados = fd.getAll('estados_bloquean').map(String).filter((e) => ESTADOS_BLOQUEO.some((x) => x.value === e))
    if (estados.length === 0) return fail('Elegí al menos un estado que bloquee la mesa')
    Object.assign(params, { alerta_aforo_pct: alerta, turnos, estados_bloquean: estados })
  }
  const err = await guardarConfigSede(ctx, sedeId, { params }); if (err) return fail(err)
  refrescar(ctx.negocio.slug)
  return { ok: true }
}

// ───────── cómo entran las reservas de la sede
export async function guardarEstadoSede(sedeId: string, estado: string | null): Promise<ActionResult> {
  const { ctx, error } = await sedePermitida(sedeId); if (error) return fail(error)
  if (estado !== null && !['nueva', 'confirmada'].includes(estado)) return fail('El estado no es válido')
  const err = await guardarConfigSede(ctx, sedeId, { estado_inicial: estado as 'nueva' | 'confirmada' | null }); if (err) return fail(err)
  refrescar(ctx.negocio.slug)
  return { ok: true }
}

// ───────── mensajes del bot propios de la sede
export async function guardarMensajeBotSede(sedeId: string, clave: string, texto: string): Promise<ActionResult> {
  const { ctx, error } = await sedePermitida(sedeId); if (error) return fail(error)
  const def = MENSAJES_BOT.find((m) => m.clave === clave)
  if (!def) return fail('Mensaje no válido')
  const t = String(texto ?? '').trim()
  if (t.length < 1 || t.length > 600) return fail('El mensaje va de 1 a 600 letras')
  const raras = [...t.matchAll(/\{([a-z_]+)\}/g)].map((m) => m[1]).filter((v) => !def.variables.includes(v))
  if (raras.length) return fail(`No existe la variable {${raras[0]}} en este mensaje${def.variables.length ? `. Podés usar: ${def.variables.map((v) => `{${v}}`).join(', ')}` : ''}`)
  const err = await guardarConfigSede(ctx, sedeId, { mensajes: { ...(ctx.configSedes[sedeId]?.mensajes ?? {}), [clave]: t } }); if (err) return fail(err)
  revalidatePath('/configuracion')
  return { ok: true }
}

export async function restaurarMensajeBotSede(sedeId: string, clave: string): Promise<ActionResult> {
  const { ctx, error } = await sedePermitida(sedeId); if (error) return fail(error)
  if (!MENSAJES_BOT.some((m) => m.clave === clave)) return fail('Mensaje no válido')
  const mensajes = { ...(ctx.configSedes[sedeId]?.mensajes ?? {}) }; delete mensajes[clave]
  const err = await guardarConfigSede(ctx, sedeId, { mensajes }); if (err) return fail(err)
  revalidatePath('/configuracion')
  return { ok: true }
}

// ───────── sitio de reservas: lo propio de la sede (activa, horarios, mesa, mensaje) y los grupos de ajustes que pisa
export async function guardarReservasWebSede(_prev: ActionResult | null, fd: FormData): Promise<ActionResult> {
  const sedeId = text(fd, 'sede_id')
  const { ctx, error } = await sedePermitida(sedeId); if (error) return fail(error)
  if (!ctx.modulosNegocio.reservas) return fail('Este negocio no tiene el módulo Reservas')
  const nombre = ctx.sedesTodas.find((s) => s.id === sedeId)!.nombre

  // 1) lo que ya tenía el sitio por sede
  const hs = horas(text(fd, 'sede_horarios'))
  if (hs.some((h) => !HORA.test(h))) return fail(`Los horarios de ${nombre} van como 13:00, 21:30 (separados por coma)`)
  if (hs.length > 24) return fail('Hasta 24 horarios')
  const hd: Record<string, string[]> = {}
  for (let d = 0; d <= 6; d++) {
    const h = horas(text(fd, `sede_horarios_dia_${d}`)); if (h.length === 0) continue
    if (h.some((x) => !HORA.test(x))) return fail('Los horarios de cada día van como 13:00, 21:30 (separados por coma)')
    if (h.length > 24) return fail('Hasta 24 horarios por día')
    hd[String(d)] = h.sort()
  }
  const msg = text(fd, 'sede_mensaje'); if (msg.length > 400) return fail('El mensaje puede tener hasta 400 letras')
  const mesa = text(fd, 'sede_mesa')
  const { error: e1 } = await ctx.supabase.from('reservas_web_sedes').upsert({ sucursal_id: sedeId, negocio_id: ctx.negocio.id, activo: fd.get('sede_activo') === 'on', horarios: hs.length ? hs.sort() : null, horarios_dias: hd, elegir_mesa: mesa === 'si' ? true : mesa === 'no' ? false : null, mensaje: msg || null }, { onConflict: 'sucursal_id' })
  if (e1) return fail('No se pudo guardar el sitio de la sede')

  // 2) los grupos de ajustes: el que se personaliza se guarda; el que no, vuelve a heredar del negocio
  const web = { ...(ctx.configSedes[sedeId]?.web ?? {}) } as Record<string, unknown>
  for (const g of GRUPOS_WEB) for (const k of g.claves) delete web[k]
  const on = (g: string) => fd.get(`ov_${g}`) === 'on'
  if (on('reglas')) {
    const dias = entero(text(fd, 'dias_adelante'), 1, 365), anticip = entero(text(fd, 'horas_anticipacion'), 0, 72), pmin = entero(text(fd, 'personas_min'), 1, 100), pmax = entero(text(fd, 'personas_max'), 1, 200)
    const validez = entero(text(fd, 'validez_horas'), 1, 168), maxMesas = entero(text(fd, 'max_mesas'), 1, 12)
    if (!dias) return fail('Los días hacia adelante van de 1 a 365')
    if (anticip === null) return fail('La anticipación va de 0 a 72 horas')
    if (!pmin || !pmax || pmin > pmax) return fail('Revisá la cantidad de personas: el mínimo no puede superar al máximo')
    if (!validez) return fail('La solicitud puede esperar de 1 a 168 horas')
    if (!maxMesas) return fail('El máximo de mesas por reserva va de 1 a 12')
    Object.assign(web, { dias_adelante: dias, horas_anticipacion: anticip, personas_min: pmin, personas_max: pmax, validez_horas: validez, max_mesas: maxMesas })
  }
  if (on('textos')) {
    const titulo = text(fd, 'titulo'), subtitulo = text(fd, 'subtitulo'), plantilla = String(fd.get('texto_whatsapp') ?? '').replace(/\r\n/g, '\n').trim()
    if (titulo.length > 80) return fail('El título puede tener hasta 80 letras')
    if (subtitulo.length > 160) return fail('El subtítulo puede tener hasta 160 letras')
    if (plantilla) {
      if (plantilla.length > 1200) return fail('El mensaje de WhatsApp puede tener hasta 1200 letras')
      if (!plantilla.includes('{codigo}')) return fail('El mensaje de WhatsApp tiene que llevar {codigo}')
      const permitidas = new Set<string>(VARIABLES_WA.map((v) => v[0]))
      const rara = [...plantilla.matchAll(/\{([a-z_]+)\}/g)].map((m) => m[1]).find((v) => !permitidas.has(v))
      if (rara) return fail(`En el mensaje de WhatsApp no existe la variable {${rara}}`)
    }
    Object.assign(web, { titulo: titulo || null, subtitulo: subtitulo || null, texto_whatsapp: plantilla || null })
  }
  if (on('cualquiera')) {
    const t = text(fd, 'texto_cualquier_ubicacion'); if (t.length > 60) return fail('El texto de “cualquier ubicación” puede tener hasta 60 letras')
    Object.assign(web, { cualquier_ubicacion: fd.get('cualquier_ubicacion') === 'on', texto_cualquier_ubicacion: t || null })
  }
  if (on('cumple')) Object.assign(web, { pedir_cumple: fd.get('pedir_cumple') === 'on' })
  if (on('escasez')) {
    const modo = ['off', 'pocos', 'cantidad'].includes(text(fd, 'escasez_modo')) ? text(fd, 'escasez_modo') : 'off'
    const umbral = entero(text(fd, 'escasez_umbral') || '10', 1, 500), t = text(fd, 'escasez_texto')
    if (!umbral) return fail('El aviso de pocos lugares va de 1 a 500 lugares')
    if (t.length > 40) return fail('El texto de “pocos lugares” puede tener hasta 40 letras')
    Object.assign(web, { escasez_modo: modo, escasez_umbral: umbral, escasez_texto: t || null })
  }
  if (on('tipos')) Object.assign(web, { tipos: fd.getAll('tipos').map(String).filter((t) => /^[a-z0-9_]{1,40}$/.test(t)) })
  const err = await guardarConfigSede(ctx, sedeId, { web }); if (err) return fail(err)
  refrescar(ctx.negocio.slug)
  return { ok: true }
}
