'use server'

import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import { revalidatePath } from 'next/cache'
import { getContexto, NEGOCIO_COOKIE, SEDE_COOKIE } from '@/lib/context'
import { createAdminClient, createClient } from '@/lib/supabase/server'
import { avisarCambioDeEstado } from '@/lib/notify'
import { TIPOS_RESERVA } from '@/lib/reservas'

export interface ActionResult {
  ok: boolean
  error?: string
}

const FECHA_RE = /^\d{4}-\d{2}-\d{2}$/
const HORA_RE = /^\d{2}:\d{2}(:\d{2})?$/
const fail = (error: string): ActionResult => ({ ok: false, error })
const text = (fd: FormData, k: string) => String(fd.get(k) ?? '').trim()

export async function cerrarSesion() {
  const supabase = await createClient()
  await supabase.auth.signOut()
  redirect('/login')
}

export async function cambiarNegocio(formData: FormData) {
  const ctx = await getContexto()
  const id = text(formData, 'negocio_id')
  if (ctx.negocios.some((n) => n.id === id)) {
    ;(await cookies()).set(NEGOCIO_COOKIE, id, { path: '/', httpOnly: true, sameSite: 'lax', maxAge: 60 * 60 * 24 * 365 })
  }
  revalidatePath('/', 'layout')
}

// Interruptor general del bot de WhatsApp: el workflow de n8n lee negocios.bot_activo en cada mensaje
// ("IF - Bot Pausado") y, si es false, no responde. Lo puede mover un encargado o superior; como RLS
// solo deja editar el negocio a owner/admin, se escribe con service_role después de validar el rol acá.
export async function cambiarEstadoBot(activo: boolean): Promise<ActionResult> {
  const ctx = await getContexto()
  if (!ctx.tieneApagadoBot) return fail('Este negocio no tiene habilitado el botón de apagado del bot')
  if (!ctx.puedeApagarBot) return fail('No tenés permiso para cambiar el estado del bot')
  const { error } = await createAdminClient().from('negocios').update({ bot_activo: !!activo }).eq('id', ctx.negocio.id)
  if (error) return fail('No se pudo cambiar el estado del bot')
  revalidatePath('/', 'layout')
  return { ok: true }
}

// Funciones por negocio (plan comercial): solo Autotecnus. Hoy: el botón de apagado del bot.
// Al deshabilitarlo, un trigger de la base vuelve a dejar el bot encendido (bot_activo = true).
export async function guardarFuncionesNegocio(_prev: ActionResult | null, fd: FormData): Promise<ActionResult> {
  const ctx = await getContexto()
  if (!ctx.esSuperadmin) return fail('Solo un superadmin puede cambiar las funciones del negocio')
  const admin = createAdminClient()
  const { data: actual, error: e1 } = await admin.from('negocios').select('modulos').eq('id', ctx.negocio.id).single()
  if (e1 || !actual) return fail('No se pudo leer el negocio')
  const modulos = { ...(actual.modulos as Record<string, unknown>), apagado_bot: fd.get('apagado_bot') === 'on' }
  const { error } = await admin.from('negocios').update({ modulos }).eq('id', ctx.negocio.id)
  if (error) return fail('No se pudo guardar')
  revalidatePath('/', 'layout')
  return { ok: true }
}

export async function cambiarSede(formData: FormData) {
  const ctx = await getContexto()
  const id = text(formData, 'sede_id')
  const jar = await cookies()
  if (id === 'todas') jar.delete(SEDE_COOKIE)
  else if (ctx.sedes.some((x) => x.id === id)) jar.set(SEDE_COOKIE, id, { path: '/', httpOnly: true, sameSite: 'lax', maxAge: 60 * 60 * 24 * 365 })
  revalidatePath('/', 'layout')
}

// ---------------------------------------------------------------------------
// Reservas
// ---------------------------------------------------------------------------

export async function guardarReserva(_prev: ActionResult | null, fd: FormData): Promise<ActionResult> {
  const ctx = await getContexto()
  if (!ctx.puedeEscribir) return fail('Tu usuario es de solo lectura')

  const id = text(fd, 'id')
  const nombre = text(fd, 'cliente_nombre')
  const telefono = text(fd, 'cliente_telefono')
  const fecha = text(fd, 'fecha')
  const hora = text(fd, 'hora')
  const cantidad = Number(text(fd, 'cantidad_personas'))
  const tipo = text(fd, 'tipo_reserva') || 'comun'
  const diaCump = text(fd, 'cumpleanos_dia')
  const mesCump = text(fd, 'cumpleanos_mes')
  const sucursalId = text(fd, 'sucursal_id') || null
  const ubicacion = text(fd, 'ubicacion') || null

  if (!nombre) return fail('Falta el nombre del titular')
  if (fecha && !FECHA_RE.test(fecha)) return fail('La fecha no es válida')
  if (hora && !HORA_RE.test(hora)) return fail('La hora no es válida')
  if (!Number.isInteger(cantidad) || cantidad <= 0) return fail('La cantidad de personas no es válida')
  if (!TIPOS_RESERVA.some((t) => t.value === tipo)) return fail('Tipo de reserva no válido')
  if (telefono && telefono.replace(/\D/g, '').length < 6) return fail('El teléfono no es válido')
  if (!!diaCump !== !!mesCump) return fail('Falta el día o el mes del cumpleaños')
  if (ctx.sedes.length > 0 && !sucursalId) return fail('Elegí la sede de la reserva')
  if (sucursalId && !ctx.sedes.some((x) => x.id === sucursalId)) return fail('La sede no es válida o no tenés acceso a ella')

  const fila = {
    cliente_nombre: nombre,
    cliente_telefono: telefono || null,
    fecha: fecha || null,
    hora: hora || null,
    cantidad_personas: cantidad,
    tipo_reserva: tipo,
    observaciones: text(fd, 'observaciones') || null,
    cumpleanos_dia: diaCump ? Number(diaCump) : null,
    cumpleanos_mes: mesCump ? Number(mesCump) : null,
    sucursal_id: sucursalId,
    ubicacion,
  }

  const { supabase, negocio } = ctx
  const { error } = id
    ? await supabase.from('reservas').update(fila).eq('id', id).eq('negocio_id', negocio.id)
    : await supabase.from('reservas').insert({ ...fila, negocio_id: negocio.id, estado: 'nueva', es_manual: true })
  if (error) return fail('No se pudo guardar la reserva: ' + error.message)

  revalidatePath('/', 'layout')
  return { ok: true }
}

export async function cambiarEstadoReserva(id: string, estado: 'nueva' | 'confirmada' | 'cancelada' | 'no_show', motivo?: string): Promise<ActionResult> {
  const ctx = await getContexto()
  if (!ctx.puedeEscribir) return fail('Tu usuario es de solo lectura')
  if (!['nueva', 'confirmada', 'cancelada', 'no_show'].includes(estado)) return fail('Estado no válido')

  const { supabase, negocio } = ctx
  const { data: r, error } = await supabase
    .from('reservas')
    .update({ estado, motivo_cancelacion: estado === 'cancelada' ? motivo?.trim() || null : null })
    .eq('id', id)
    .eq('negocio_id', negocio.id)
    .select('numero, cliente_nombre, cliente_telefono, cantidad_personas, fecha, hora, motivo_cancelacion')
    .maybeSingle()
  if (error || !r) return fail('No se pudo actualizar la reserva')

  if (estado === 'confirmada' || estado === 'cancelada') {
    await avisarCambioDeEstado({
      negocioId: negocio.id,
      telefono: r.cliente_telefono,
      numero: r.numero,
      estado,
      clienteNombre: r.cliente_nombre,
      cantidadPersonas: r.cantidad_personas,
      fecha: r.fecha,
      hora: r.hora,
      motivoCancelacion: r.motivo_cancelacion,
    })
  }
  revalidatePath('/', 'layout')
  return { ok: true }
}

export async function eliminarReserva(id: string): Promise<ActionResult> {
  const ctx = await getContexto()
  if (!ctx.puedeEscribir) return fail('Tu usuario es de solo lectura')
  const { error } = await ctx.supabase.from('reservas').update({ eliminado_en: new Date().toISOString() }).eq('id', id).eq('negocio_id', ctx.negocio.id)
  if (error) return fail('No se pudo eliminar la reserva')
  revalidatePath('/', 'layout')
  return { ok: true }
}

// ---------------------------------------------------------------------------
// Configuración de reservas
// ---------------------------------------------------------------------------

export async function guardarAforo(_prev: ActionResult | null, fd: FormData): Promise<ActionResult> {
  const ctx = await getContexto()
  if (!ctx.puedeAdministrar) return fail('Solo un administrador puede cambiar el aforo')
  const raw = text(fd, 'aforo')
  const aforo = raw === '' ? null : Number(raw)
  if (aforo !== null && (!Number.isInteger(aforo) || aforo <= 0)) return fail('El aforo debe ser un número entero mayor a 0')
  const sedeId = text(fd, 'sucursal_id')
  if (sedeId && !ctx.sedes.some((x) => x.id === sedeId)) return fail('La sede no es válida')
  const { error } = sedeId
    ? await ctx.supabase.from('sucursales').update({ aforo_maximo_reservas: aforo }).eq('id', sedeId).eq('negocio_id', ctx.negocio.id)
    : await ctx.supabase.from('negocios').update({ aforo_maximo_reservas: aforo }).eq('id', ctx.negocio.id)
  if (error) return fail('No se pudo guardar el aforo')
  revalidatePath('/', 'layout')
  return { ok: true }
}

export async function agregarFechaBloqueada(_prev: ActionResult | null, fd: FormData): Promise<ActionResult> {
  const ctx = await getContexto()
  if (!ctx.puedeAdministrar && ctx.rol !== 'encargado') return fail('No tenés permiso para bloquear fechas')
  const fecha = text(fd, 'fecha')
  const desde = text(fd, 'hora_desde')
  const hasta = text(fd, 'hora_hasta')
  const sedeBloq = text(fd, 'sucursal_id') || null
  if (sedeBloq && !ctx.sedes.some((x) => x.id === sedeBloq)) return fail('La sede no es válida')
  if (!sedeBloq && ctx.sedes.length > 0 && !ctx.sinRestriccionSede) return fail('Elegí una sede: no tenés alcance sobre todo el negocio')
  if (!FECHA_RE.test(fecha)) return fail('Elegí una fecha')
  if ((desde && !HORA_RE.test(desde)) || (hasta && !HORA_RE.test(hasta))) return fail('El horario no es válido')
  if (!!desde !== !!hasta) return fail('Completá el horario desde y hasta, o dejá ambos vacíos para bloquear todo el día')
  const { error } = await ctx.supabase.from('fechas_bloqueadas_reservas').insert({
    negocio_id: ctx.negocio.id,
    sucursal_id: sedeBloq,
    fecha,
    hora_desde: desde || null,
    hora_hasta: hasta || null,
    motivo: text(fd, 'motivo') || null,
  })
  if (error) return fail('No se pudo bloquear la fecha')
  revalidatePath('/', 'layout')
  return { ok: true }
}

export async function borrarFechaBloqueada(id: string): Promise<ActionResult> {
  const ctx = await getContexto()
  const { error } = await ctx.supabase.from('fechas_bloqueadas_reservas').delete().eq('id', id).eq('negocio_id', ctx.negocio.id)
  if (error) return fail('No se pudo borrar la fecha bloqueada')
  revalidatePath('/', 'layout')
  return { ok: true }
}

// ---------------------------------------------------------------------------
// Consultas y clientes
// ---------------------------------------------------------------------------

export async function marcarConsulta(id: string, estado: 'pendiente' | 'resuelta'): Promise<ActionResult> {
  const ctx = await getContexto()
  if (!ctx.puedeEscribir) return fail('Tu usuario es de solo lectura')
  const { error } = await ctx.supabase.from('consultas_reclamos').update({ estado }).eq('id', id).eq('negocio_id', ctx.negocio.id)
  if (error) return fail('No se pudo actualizar la consulta')
  revalidatePath('/', 'layout')
  return { ok: true }
}

export async function guardarNotasCliente(_prev: ActionResult | null, fd: FormData): Promise<ActionResult> {
  const ctx = await getContexto()
  if (!ctx.puedeEscribir) return fail('Tu usuario es de solo lectura')
  const { error } = await ctx.supabase.from('clientes').update({ notas: text(fd, 'notas') || null }).eq('id', text(fd, 'id')).eq('negocio_id', ctx.negocio.id)
  if (error) return fail('No se pudieron guardar las notas')
  revalidatePath('/', 'layout')
  return { ok: true }
}

// ---------------------------------------------------------------------------
// Sedes y ubicaciones (dueño / administrador sin restricción de sede)
// ---------------------------------------------------------------------------

export async function guardarSede(_prev: ActionResult | null, fd: FormData): Promise<ActionResult> {
  const ctx = await getContexto()
  if (!ctx.puedeAdministrar) return fail('No tenés permiso para editar sedes')
  const id = text(fd, 'id')
  const nombre = text(fd, 'nombre')
  const wa = text(fd, 'whatsapp_nro').replace(/\D/g, '')
  const aforoRaw = text(fd, 'aforo')
  const aforo = aforoRaw ? Number(aforoRaw) : null
  if (!nombre) return fail('Falta el nombre de la sede')
  if (aforo !== null && (!Number.isInteger(aforo) || aforo <= 0)) return fail('El aforo debe ser un entero mayor a 0')
  if (!id && !ctx.sinRestriccionSede) return fail('Solo quien ve todas las sedes puede crear una nueva')
  const fila = { nombre, whatsapp_nro: wa || null, aforo_maximo_reservas: aforo }
  const { error } = id
    ? await ctx.supabase.from('sucursales').update(fila).eq('id', id).eq('negocio_id', ctx.negocio.id)
    : await ctx.supabase.from('sucursales').insert({ ...fila, negocio_id: ctx.negocio.id, orden: ctx.sedesTodas.length + 1 })
  if (error) return fail(error.code === '23505' ? 'Ya hay una sede con ese nombre' : 'No se pudo guardar la sede')
  revalidatePath('/', 'layout')
  return { ok: true }
}

export async function guardarUbicacion(_prev: ActionResult | null, fd: FormData): Promise<ActionResult> {
  const ctx = await getContexto()
  if (!ctx.puedeAdministrar) return fail('No tenés permiso para editar ubicaciones')
  const nombre = text(fd, 'nombre').toUpperCase()
  if (!nombre) return fail('Falta el nombre de la ubicación')
  const { error } = await ctx.supabase.from('ubicaciones').insert({ negocio_id: ctx.negocio.id, nombre, orden: 99 })
  if (error) return fail(error.code === '23505' ? 'Esa ubicación ya existe' : 'No se pudo guardar la ubicación')
  revalidatePath('/', 'layout')
  return { ok: true }
}

export async function borrarUbicacion(id: string): Promise<ActionResult> {
  const ctx = await getContexto()
  if (!ctx.puedeAdministrar) return fail('No tenés permiso para editar ubicaciones')
  const { error } = await ctx.supabase.from('ubicaciones').delete().eq('id', id).eq('negocio_id', ctx.negocio.id)
  if (error) return fail('No se pudo borrar la ubicación')
  revalidatePath('/', 'layout')
  return { ok: true }
}
