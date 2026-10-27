'use server'

import { revalidatePath } from 'next/cache'
import { getContexto } from '@/lib/context'
import { guardarConfigSede } from '@/lib/config-sedes-servidor'
import { seSuperponen } from '@/lib/mesas'
import type { ActionResult } from './actions'

const fail = (error: string): ActionResult => ({ ok: false, error })
const text = (fd: FormData, k: string) => String(fd.get(k) ?? '').trim()
const UUID = /^[0-9a-f-]{36}$/i
const entero = (v: string, min: number, max: number) => { const n = Number(v); return Number.isInteger(n) && n >= min && n <= max ? n : null }
const refrescar = () => { revalidatePath('/mesas'); revalidatePath('/reservas'); revalidatePath('/') }

async function permiso(estructura: boolean) {
  const ctx = await getContexto()
  if (!ctx.modulosActivos.mesas) return { ctx, error: 'Este negocio no tiene el módulo Salón y mesas' }
  if (!ctx.puedeEscribir) return { ctx, error: 'Tu usuario es de solo lectura' }
  if (estructura && !(ctx.puedeAdministrar || ctx.rol === 'encargado')) return { ctx, error: 'Solo dueños, administradores y encargados pueden cambiar el plano' }
  return { ctx, error: null as string | null }
}
type Ctx = Awaited<ReturnType<typeof getContexto>>

/** Mesas del salón (sin la que se está moviendo) y el tamaño del plano, para validar límites y superposiciones. */
async function datosSalon(ctx: Ctx, salonId: string, excluir?: string) {
  const [{ data: salon }, { data: mesas }] = await Promise.all([
    ctx.supabase.from('salones').select('id, nombre, ancho, alto').eq('id', salonId).eq('negocio_id', ctx.negocio.id).maybeSingle(),
    ctx.supabase.from('mesas').select('id, numero, x, y, w, h').eq('salon_id', salonId).eq('negocio_id', ctx.negocio.id),
  ])
  return { salon, mesas: (mesas ?? []).filter((m) => m.id !== excluir) }
}
function validarRect(salon: { ancho: number; alto: number }, otras: { numero: string; x: number; y: number; w: number; h: number }[], r: { x: number; y: number; w: number; h: number }): string | null {
  if (r.x < 0 || r.y < 0 || r.x + r.w > salon.ancho || r.y + r.h > salon.alto) return 'Se sale del plano: achicalo o ampliá el salón'
  const choca = otras.find((o) => seSuperponen(r, o))
  return choca ? `Se superpone con “${choca.numero}”` : null
}
function buscarHueco(salon: { ancho: number; alto: number }, otras: { x: number; y: number; w: number; h: number }[], w: number, h: number): { x: number; y: number } | null {
  for (let y = 0; y + h <= salon.alto; y++) for (let x = 0; x + w <= salon.ancho; x++) if (!otras.some((o) => seSuperponen({ x, y, w, h }, o))) return { x, y }
  return null
}

// ---------------------------------------------------------------------------
// Salones y mesas (armar el plano)
// ---------------------------------------------------------------------------
export async function guardarSalon(_prev: ActionResult | null, fd: FormData): Promise<ActionResult> {
  const { ctx, error } = await permiso(true); if (error) return fail(error)
  const id = text(fd, 'id'), nombre = text(fd, 'nombre').replace(/\s+/g, ' ')
  const ancho = entero(text(fd, 'ancho'), 8, 80), alto = entero(text(fd, 'alto'), 6, 60), ubicacion = text(fd, 'ubicacion').slice(0, 60) || null
  if (!nombre || nombre.length > 40) return fail('Poné un nombre de hasta 40 letras (ej. Salón, Patio, Terraza)')
  if (!ancho || !alto) return fail('El tamaño del plano va de 8 a 80 de ancho y de 6 a 60 de alto')
  const activo = fd.get('__activo_form') ? fd.get('activo') === 'on' : true
  const tema = ['redondas', 'cuadradas', 'respaldo', 'ninguna'].includes(text(fd, 'tema_sillas')) ? text(fd, 'tema_sillas') : 'redondas'
  const colorTxt = text(fd, 'color_sillas'), color = fd.get('color_defecto') === 'on' || !/^#[0-9a-fA-F]{6}$/.test(colorTxt) ? null : colorTxt.toLowerCase()
  if (id) {
    if (!UUID.test(id)) return fail('Salón no válido')
    const { mesas } = await datosSalon(ctx, id)
    const fuera = mesas.find((m) => m.x + m.w > ancho || m.y + m.h > alto)
    if (fuera) return fail(`La mesa “${fuera.numero}” quedaría fuera del plano: movela antes de achicar el salón`)
    const { error: e } = await ctx.supabase.from('salones').update({ nombre, ancho, alto, ubicacion, activo, tema_sillas: tema, color_sillas: color }).eq('id', id).eq('negocio_id', ctx.negocio.id)
    if (e) return fail(e.code === '23505' ? 'Ya hay un salón con ese nombre' : 'No se pudo guardar el salón')
  } else {
    const { data: ult } = await ctx.supabase.from('salones').select('orden').eq('negocio_id', ctx.negocio.id).order('orden', { ascending: false }).limit(1)
    const { error: e } = await ctx.supabase.from('salones').insert({ negocio_id: ctx.negocio.id, sucursal_id: ctx.sede?.id ?? null, nombre, ancho, alto, ubicacion, activo, tema_sillas: tema, color_sillas: color, orden: (ult?.[0]?.orden ?? -1) + 1 })
    if (e) return fail(e.code === '23505' ? 'Ya hay un salón con ese nombre' : 'No se pudo crear el salón')
  }
  refrescar()
  return { ok: true }
}

/** Activa o desactiva un plano. Uno inactivo se conserva con todas sus mesas, pero no se usa (ni en el servicio, ni en el sitio de reservas, ni al elegir mesa). */
export async function alternarSalon(id: string, activo: boolean): Promise<ActionResult> {
  const { ctx, error } = await permiso(true); if (error) return fail(error)
  if (!UUID.test(id)) return fail('Salón no válido')
  const { error: e } = await ctx.supabase.from('salones').update({ activo: !!activo }).eq('id', id).eq('negocio_id', ctx.negocio.id)
  if (e) return fail('No se pudo cambiar el plano')
  refrescar()
  revalidatePath('/configuracion')
  return { ok: true }
}

export async function eliminarSalon(id: string): Promise<ActionResult> {
  const { ctx, error } = await permiso(true); if (error) return fail(error)
  if (!UUID.test(id)) return fail('Salón no válido')
  if (!ctx.puedeAdministrar) return fail('Solo dueños y administradores pueden borrar un salón')
  const { error: e } = await ctx.supabase.from('salones').delete().eq('id', id).eq('negocio_id', ctx.negocio.id)
  if (e) return fail('No se pudo borrar el salón')
  refrescar()
  return { ok: true }
}

export async function guardarMesa(_prev: ActionResult | null, fd: FormData): Promise<ActionResult> {
  const { ctx, error } = await permiso(true); if (error) return fail(error)
  const id = text(fd, 'id'), salonId = text(fd, 'salon_id'), tipo = text(fd, 'tipo') === 'deco' ? 'deco' : 'mesa', numero = text(fd, 'numero').replace(/\s+/g, ' ')
  if (!UUID.test(salonId)) return fail('Elegí un salón')
  if (!numero || numero.length > 24) return fail(tipo === 'deco' ? 'Escribí el texto del cartel (hasta 24 letras)' : 'Poné el número de la mesa (hasta 24 caracteres)')
  const capacidad = tipo === 'mesa' ? entero(text(fd, 'capacidad'), 1, 40) : null
  if (tipo === 'mesa' && !capacidad) return fail('La capacidad máxima va de 1 a 40 personas')
  const capacidadMin = tipo === 'mesa' ? entero(text(fd, 'capacidad_min') || '1', 1, 40) : 1
  if (!capacidadMin || (capacidad && capacidadMin > capacidad)) return fail('La capacidad mínima tiene que estar entre 1 y la máxima')
  const w = entero(text(fd, 'w') || (tipo === 'deco' ? '4' : '2'), 1, 40), h = entero(text(fd, 'h') || '2', 1, 40)
  if (!w || !h) return fail('El tamaño de la mesa no es válido')
  const forma = text(fd, 'forma') === 'redonda' ? 'redonda' : 'cuadrada'
  const { salon, mesas } = await datosSalon(ctx, salonId, id || undefined)
  if (!salon) return fail('Salón no encontrado')
  let x = entero(text(fd, 'x') || '-1', 0, 200), y = entero(text(fd, 'y') || '-1', 0, 200)
  if (!id && (x === null || y === null || text(fd, 'x') === '')) {
    const hueco = buscarHueco(salon, mesas, w, h)
    if (!hueco) return fail('No hay lugar libre en el plano: ampliá el salón o creá otro')
    x = hueco.x; y = hueco.y
  }
  if (x === null || y === null) return fail('Posición no válida')
  const e1 = validarRect(salon, mesas, { x, y, w, h }); if (e1) return fail(e1)
  const movil = tipo === 'mesa' && fd.get('movil') === 'on'
  // rotación y sillas solo vienen en el formulario de edición de una mesa; al crear quedan por defecto
  const lados = [...new Set(fd.getAll('sillas_lado').map(String).filter((l) => ['n', 'e', 's', 'o'].includes(l)))]
  const conSillas = tipo === 'mesa' && fd.get('__sillas_form') ? { rotacion: entero(text(fd, 'rotacion') || '0', 0, 359) ?? 0, sillas: fd.get('sillas') === 'on', sillas_lados: lados.length > 0 && lados.length < 4 ? lados : null } : {}
  const datos = { salon_id: salonId, tipo, numero, capacidad, capacidad_min: capacidadMin, movil, x, y, w, h, forma, activa: fd.get('__activa_form') ? fd.get('activa') === 'on' : true, ...conSillas }
  if (id) {
    if (!UUID.test(id)) return fail('Mesa no válida')
    const { error: e } = await ctx.supabase.from('mesas').update(datos).eq('id', id).eq('negocio_id', ctx.negocio.id)
    if (e) return fail(e.code === '23505' ? `Ya hay una mesa “${numero}” en este salón` : 'No se pudo guardar la mesa')
  } else {
    const { error: e } = await ctx.supabase.from('mesas').insert({ ...datos, negocio_id: ctx.negocio.id })
    if (e) return fail(e.code === '23505' ? `Ya hay una mesa “${numero}” en este salón` : 'No se pudo crear la mesa')
  }
  refrescar()
  return { ok: true }
}

/** Gira una mesa (con sus sillas) a un ángulo en grados. Es solo el dibujo: el espacio que ocupa en el plano no cambia. */
export async function rotarMesa(id: string, grados: number): Promise<ActionResult> {
  const { ctx, error } = await permiso(true); if (error) return fail(error)
  if (!UUID.test(id) || !Number.isFinite(grados)) return fail('Rotación no válida')
  const g = ((Math.round(grados) % 360) + 360) % 360
  const { error: e } = await ctx.supabase.from('mesas').update({ rotacion: g }).eq('id', id).eq('negocio_id', ctx.negocio.id).eq('tipo', 'mesa')
  if (e) return fail('No se pudo girar la mesa')
  refrescar()
  return { ok: true }
}

export async function moverMesa(id: string, x: number, y: number): Promise<ActionResult> {
  const { ctx, error } = await permiso(true); if (error) return fail(error)
  if (!UUID.test(id) || !Number.isInteger(x) || !Number.isInteger(y)) return fail('Posición no válida')
  const { data: m } = await ctx.supabase.from('mesas').select('salon_id, w, h').eq('id', id).eq('negocio_id', ctx.negocio.id).maybeSingle()
  if (!m) return fail('Mesa no encontrada')
  const { salon, mesas } = await datosSalon(ctx, m.salon_id, id)
  if (!salon) return fail('Salón no encontrado')
  const e1 = validarRect(salon, mesas, { x, y, w: m.w, h: m.h }); if (e1) return fail(e1)
  const { error: e } = await ctx.supabase.from('mesas').update({ x, y }).eq('id', id).eq('negocio_id', ctx.negocio.id)
  if (e) return fail('No se pudo mover la mesa')
  refrescar()
  return { ok: true }
}

export async function eliminarMesa(id: string): Promise<ActionResult> {
  const { ctx, error } = await permiso(true); if (error) return fail(error)
  if (!UUID.test(id)) return fail('Mesa no válida')
  const { error: e } = await ctx.supabase.from('mesas').delete().eq('id', id).eq('negocio_id', ctx.negocio.id)
  if (e) return fail('No se pudo borrar la mesa')
  refrescar()
  return { ok: true }
}

/** Crea varias mesas de una vez, acomodadas solas en los lugares libres del plano. */
export async function crearVariasMesas(_prev: ActionResult | null, fd: FormData): Promise<ActionResult> {
  const { ctx, error } = await permiso(true); if (error) return fail(error)
  const salonId = text(fd, 'salon_id'), cantidad = entero(text(fd, 'cantidad'), 1, 60), capacidad = entero(text(fd, 'capacidad'), 1, 40), desde = entero(text(fd, 'desde') || '1', 0, 9999)
  const capacidadMin = entero(text(fd, 'capacidad_min') || '1', 1, 40), movil = fd.get('movil') === 'on'
  const forma = text(fd, 'forma') === 'redonda' ? 'redonda' : 'cuadrada'
  if (!UUID.test(salonId)) return fail('Elegí un salón')
  if (!cantidad || !capacidad || desde === null) return fail('Indicá cuántas mesas (1 a 60), su capacidad y desde qué número')
  if (!capacidadMin || capacidadMin > capacidad) return fail('La capacidad mínima tiene que estar entre 1 y la máxima')
  const { salon, mesas } = await datosSalon(ctx, salonId)
  if (!salon) return fail('Salón no encontrado')
  const usados = new Set(mesas.map((m) => m.numero.trim().toLowerCase()))
  const ocupados = mesas.map((m) => ({ x: m.x, y: m.y, w: m.w, h: m.h }))
  const filas: Record<string, unknown>[] = []
  for (let n = desde; filas.length < cantidad && n < desde + 1000; n++) {
    if (usados.has(String(n))) continue
    const hueco = buscarHueco(salon, ocupados, 2, 2)
    if (!hueco) return fail(`Solo entran ${filas.length} mesas más en este plano: ampliá el salón para el resto`)
    ocupados.push({ ...hueco, w: 2, h: 2 })
    filas.push({ negocio_id: ctx.negocio.id, salon_id: salonId, tipo: 'mesa', numero: String(n), capacidad, capacidad_min: capacidadMin, movil, x: hueco.x, y: hueco.y, w: 2, h: 2, forma })
  }
  const { error: e } = await ctx.supabase.from('mesas').insert(filas)
  if (e) return fail('No se pudieron crear las mesas')
  refrescar()
  return { ok: true, cantidad: filas.length }
}

export async function guardarDuracionMesas(_prev: ActionResult | null, fd: FormData): Promise<ActionResult> {
  const { ctx, error } = await permiso(true); if (error) return fail(error)
  const min = entero(text(fd, 'duracion_min'), 30, 480)
  if (!min) return fail('La duración va de 30 a 480 minutos')
  if (ctx.sede && ctx.sedesTodas.length > 0) {   // con una sede elegida, la duración es la de esa sede
    const err = await guardarConfigSede(ctx, ctx.sede.id, { params: { ...(ctx.configSedes[ctx.sede.id]?.params ?? {}), duracion_min: min } })
    if (err) return fail(err)
    refrescar()
    return { ok: true }
  }
  const { error: e } = await ctx.supabase.from('mesas_config').upsert({ negocio_id: ctx.negocio.id, duracion_min: min })
  if (e) return fail('No se pudo guardar')
  refrescar()
  return { ok: true }
}

// ---------------------------------------------------------------------------
// Servicio del día
// ---------------------------------------------------------------------------
export type ResultadoAsignacion = ActionResult & { conflictos?: { mesa: string; reserva_numero: number; hora: string; cliente: string | null }[]; capacidadInsuficiente?: boolean; capacidadMinima?: boolean; capacidad?: number; capacidadMin?: number; personas?: number | null }

/** Asigna (o reemplaza) las mesas de una reserva. Si alguna ya está tomada a esa hora devuelve los conflictos y no asigna, salvo `forzar`. */
export async function asignarMesas(reservaId: string, mesaIds: string[], forzar = false): Promise<ResultadoAsignacion> {
  const { ctx, error } = await permiso(false); if (error) return fail(error)
  if (!UUID.test(reservaId) || !mesaIds.every((m) => UUID.test(m)) || mesaIds.length > 8) return fail('Datos no válidos')
  const { data, error: e } = await ctx.supabase.rpc('asignar_mesas', { p_reserva: reservaId, p_mesas: mesaIds, p_forzar: forzar })
  if (e) return fail('No se pudo asignar la mesa')
  const r = data as { ok: boolean; error?: string; conflictos?: { mesa: string; reserva_numero: number; hora: string; cliente: string | null }[]; capacidad_insuficiente?: boolean; capacidad_minima_no_alcanzada?: boolean; capacidad?: number; capacidad_min?: number; personas?: number | null }
  if (!r.ok) {
    if (r.error === 'mesa_ocupada') return { ok: false, error: 'mesa_ocupada', conflictos: r.conflictos }
    return fail(r.error === 'mesas_fijas_no_se_juntan' ? 'Las mesas fijas no se pueden juntar: solo se juntan las móviles' : r.error === 'sin_permiso' ? 'No tenés permiso para asignar mesas' : r.error === 'mesa_invalida' ? 'Alguna mesa ya no existe o está fuera de servicio' : 'No se pudo asignar la mesa')
  }
  refrescar()
  return { ok: true, capacidadInsuficiente: r.capacidad_insuficiente, capacidadMinima: r.capacidad_minima_no_alcanzada, capacidad: r.capacidad, capacidadMin: r.capacidad_min, personas: r.personas }
}

/** Avanza la reserva en el salón: llegó → sentada → liberada (o la deja como estaba). */
export async function marcarServicio(reservaId: string, paso: 'llego' | 'sentada' | 'liberada' | 'reabrir'): Promise<ActionResult> {
  const { ctx, error } = await permiso(false); if (error) return fail(error)
  if (!UUID.test(reservaId)) return fail('Reserva no válida')
  const ahora = new Date().toISOString()
  const { data: r } = await ctx.supabase.from('reservas').select('asistio_en, sentada_en').eq('id', reservaId).eq('negocio_id', ctx.negocio.id).maybeSingle()
  if (!r) return fail('Reserva no encontrada')
  const cambios = paso === 'llego' ? { asistio_en: r.asistio_en ?? ahora }
    : paso === 'sentada' ? { asistio_en: r.asistio_en ?? ahora, sentada_en: r.sentada_en ?? ahora, liberada_en: null }
    : paso === 'liberada' ? { liberada_en: ahora }
    : { sentada_en: null, liberada_en: null }
  const { error: e } = await ctx.supabase.from('reservas').update(cambios).eq('id', reservaId).eq('negocio_id', ctx.negocio.id)
  if (e) return fail('No se pudo actualizar la reserva')
  refrescar()
  return { ok: true }
}

export async function ocuparMesa(id: string, pax: number | null): Promise<ActionResult> {
  const { ctx, error } = await permiso(false); if (error) return fail(error)
  if (!UUID.test(id)) return fail('Mesa no válida')
  const { data, error: e } = await ctx.supabase.rpc('ocupar_mesa', { p_mesa: id, p_pax: pax && pax > 0 && pax < 100 ? Math.trunc(pax) : null })
  if (e || !(data as { ok: boolean }).ok) return fail('No se pudo ocupar la mesa')
  refrescar()
  return { ok: true }
}

export async function liberarMesa(id: string): Promise<ActionResult> {
  const { ctx, error } = await permiso(false); if (error) return fail(error)
  if (!UUID.test(id)) return fail('Mesa no válida')
  const { data, error: e } = await ctx.supabase.rpc('liberar_mesa', { p_mesa: id })
  if (e || !(data as { ok: boolean }).ok) return fail('No se pudo liberar la mesa')
  refrescar()
  return { ok: true }
}
