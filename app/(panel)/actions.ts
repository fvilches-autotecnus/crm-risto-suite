'use server'

import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import { revalidatePath } from 'next/cache'
import { getContexto, NEGOCIO_COOKIE, SEDE_COOKIE } from '@/lib/context'
import { createAdminClient, createClient } from '@/lib/supabase/server'
import { avisarCambioDeEstado, enviarPrueba } from '@/lib/notify'
import { chequearReserva, type ChequeoAforo } from '@/lib/aforo'
import { ESTADOS, ESTADOS_AVISO, ESTADOS_OCUPAN, esEstadoAviso, type EstadoReserva } from '@/lib/reservas'

export interface ActionResult {
  ok: boolean
  error?: string
  aforo?: boolean            // true = la reserva supera un aforo (se puede guardar igual con forzar=1)
  detalle?: ChequeoAforo[]
  aviso?: 'enviado' | 'no_disponible' | 'fallo'   // resultado del aviso al cliente (solo si se pidió avisar)
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
    const jar = await cookies()
    jar.set(NEGOCIO_COOKIE, id, { path: '/', httpOnly: true, sameSite: 'lax', maxAge: 60 * 60 * 24 * 365 })
    jar.delete(SEDE_COOKIE) // la sede elegida era del negocio anterior
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

// Webhook para avisar al cliente (n8n o BotConversa): destino, URL, secreto opcional y estados que el flujo sabe tratar.
// Solo superadmin: la URL de BotConversa lleva su token adentro y el formato depende de cómo esté armado el flujo del otro lado.
const URL_PRIVADA = /^(localhost|127\.|10\.|0\.|169\.254\.|192\.168\.|172\.(1[6-9]|2\d|3[01])\.|\[?::1\]?$)/i
export async function guardarWebhookCliente(_prev: ActionResult | null, fd: FormData): Promise<ActionResult> {
  const ctx = await getContexto()
  if (!ctx.esSuperadmin) return fail('Solo un superadmin puede cambiar el webhook de aviso al cliente')
  const destino = text(fd, 'destino')
  if (destino !== 'n8n' && destino !== 'botconversa') return fail('Elegí el destino del webhook')
  const url = text(fd, 'url')
  if (url) {
    let u: URL
    try { u = new URL(url) } catch { return fail('La URL del webhook no es válida') }
    if (u.protocol !== 'https:') return fail('La URL del webhook tiene que empezar con https://')
    if (URL_PRIVADA.test(u.hostname)) return fail('La URL del webhook tiene que ser pública')
  }
  const admin = createAdminClient()
  const { data: actual, error: e1 } = await admin.from('negocios').select('modulos').eq('id', ctx.negocio.id).single()
  if (e1 || !actual) return fail('No se pudo leer el negocio')
  const avisos_estados = ESTADOS_AVISO.filter((e) => fd.get('aviso_' + e) === 'on')
  const cambios: Record<string, unknown> = {
    webhook_aviso_reserva_url: url || null,
    modulos: { ...(actual.modulos as Record<string, unknown>), avisos_estados, webhook_destino: destino },
  }
  const secreto = text(fd, 'secreto')
  if (fd.get('quitar_secreto') === 'on') cambios.webhook_secret = null   // sin secreto
  else if (secreto) cambios.webhook_secret = secreto                      // en blanco = se conserva el actual
  const { error } = await admin.from('negocios').update(cambios).eq('id', ctx.negocio.id)
  if (error) return fail('No se pudo guardar')
  revalidatePath('/', 'layout')
  return { ok: true }
}

// Manda un aviso de ejemplo (prueba: true) al teléfono indicado, con el formato del destino elegido
export async function probarWebhookCliente(_prev: ActionResult | null, fd: FormData): Promise<ActionResult> {
  const ctx = await getContexto()
  if (!ctx.esSuperadmin) return fail('Solo un superadmin puede probar el webhook')
  const tel = text(fd, 'telefono_prueba').replace(/\D/g, '')
  if (tel.length < 8) return fail('Ingresá un teléfono de prueba (con código de país)')
  const r = await enviarPrueba(ctx.negocio.id, tel, ctx.sedes[0]?.nombre ?? null)
  return r.ok ? { ok: true } : fail(r.error ?? 'No se pudo enviar la prueba')
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
  if (!/^[a-z0-9_]{2,40}$/.test(tipo)) return fail('Tipo de reserva no válido')
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

  // Aforo: si la reserva ocupa lugar y hay fecha, se verifica contra las reglas (sede / ubicación / franja). Se puede guardar igual.
  if (fecha && fd.get('forzar') !== '1') {
    let ocupa = true
    if (id) {
      const { data: actual } = await ctx.supabase.from('reservas').select('estado').eq('id', id).eq('negocio_id', ctx.negocio.id).maybeSingle()
      ocupa = !actual || ESTADOS_OCUPAN.includes(actual.estado as EstadoReserva)
    }
    if (ocupa) {
      const chk = await chequearReserva(ctx, { sucursal_id: sucursalId, ubicacion, hora: hora || null, fecha, personas: cantidad, excluirId: id || undefined })
      const excede = chk.filter((c) => c.excede)
      if (excede.length) return { ok: false, aforo: true, detalle: chk, error: 'Se supera el aforo: ' + excede.map((c) => `${c.etiqueta} (${c.despues} de ${c.maximo})`).join(' · ') }
    }
  }

  const { supabase, negocio } = ctx
  const { error } = id
    ? await supabase.from('reservas').update(fila).eq('id', id).eq('negocio_id', negocio.id)
    : await supabase.from('reservas').insert({ ...fila, negocio_id: negocio.id, estado: 'nueva', es_manual: true })
  if (error) return fail('No se pudo guardar la reserva: ' + error.message)

  revalidatePath('/', 'layout')
  return { ok: true }
}

export async function cambiarEstadoReserva(id: string, estado: EstadoReserva, motivo?: string, monto?: number, notificar?: boolean): Promise<ActionResult> {
  const ctx = await getContexto()
  if (!ctx.puedeEscribir) return fail('Tu usuario es de solo lectura')
  if (!ESTADOS.some((e) => e.value === estado)) return fail('Estado no válido')
  // Pendiente de pago: hay que indicar cuánto tiene que pagar (seña o total)
  if (estado === 'pendiente_pago' && !(typeof monto === 'number' && Number.isFinite(monto) && monto > 0 && monto < 100000000)) return fail('Ingresá el valor de la seña o del pago que tiene que hacer')

  const { supabase, negocio } = ctx
  const { data: r, error } = await supabase
    .from('reservas')
    .update({ estado, motivo_cancelacion: estado === 'cancelada' ? motivo?.trim() || null : null, ...(estado === 'pendiente_pago' ? { monto_sena: Math.round(monto! * 100) / 100 } : {}) })
    .eq('id', id)
    .eq('negocio_id', negocio.id)
    .select('numero, cliente_nombre, cliente_telefono, cantidad_personas, fecha, hora, motivo_cancelacion, monto_sena, tipo_reserva, ubicacion, observaciones, sucursal_id')
    .maybeSingle()
  if (error || !r) return fail('No se pudo actualizar la reserva')

  // El aviso al cliente solo sale si la persona del equipo lo eligió en el diálogo
  let aviso: ActionResult['aviso']
  if (notificar === true && esEstadoAviso(estado)) {
    aviso = await avisarCambioDeEstado({
      negocioId: negocio.id,
      telefono: r.cliente_telefono,
      numero: r.numero,
      estado,
      clienteNombre: r.cliente_nombre,
      cantidadPersonas: r.cantidad_personas,
      fecha: r.fecha,
      hora: r.hora,
      motivoCancelacion: r.motivo_cancelacion,
      monto: r.monto_sena,
      tipoReserva: r.tipo_reserva,
      ubicacion: r.ubicacion,
      observaciones: r.observaciones,
      sede: ctx.sedesTodas.find((x) => x.id === r.sucursal_id)?.nombre ?? null,
    })
  }
  revalidatePath('/', 'layout')
  return { ok: true, aviso }
}

/** Vuelve una reserva a un estado y monto anteriores (Deshacer): no pide el monto de nuevo. */
export async function restaurarEstadoReserva(id: string, estado: EstadoReserva, monto: number | null): Promise<ActionResult> {
  const ctx = await getContexto()
  if (!ctx.puedeEscribir) return fail('Tu usuario es de solo lectura')
  if (!ESTADOS.some((e) => e.value === estado)) return fail('Estado no válido')
  const { error } = await ctx.supabase.from('reservas').update({ estado, monto_sena: monto, motivo_cancelacion: null }).eq('id', id).eq('negocio_id', ctx.negocio.id)
  if (error) return fail('No se pudo restaurar el estado')
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

export async function restaurarReserva(id: string): Promise<ActionResult> {
  const ctx = await getContexto()
  if (!ctx.puedeEscribir) return fail('Tu usuario es de solo lectura')
  const { error } = await ctx.supabase.from('reservas').update({ eliminado_en: null }).eq('id', id).eq('negocio_id', ctx.negocio.id)
  if (error) return fail('No se pudo restaurar la reserva')
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
  const maps = text(fd, 'maps_url')
  if (maps && !/^https?:\/\//i.test(maps)) return fail('El link de Google Maps debe empezar con http:// o https://')
  const aforoRaw = text(fd, 'aforo')
  const aforo = aforoRaw ? Number(aforoRaw) : null
  if (!nombre) return fail('Falta el nombre de la sede')
  if (aforo !== null && (!Number.isInteger(aforo) || aforo <= 0)) return fail('El aforo debe ser un entero mayor a 0')
  if (!id && !ctx.sinRestriccionSede) return fail('Solo quien ve todas las sedes puede crear una nueva')
  const fila = { nombre, whatsapp_nro: wa || null, aforo_maximo_reservas: aforo, direccion: text(fd, 'direccion') || null, telefono: text(fd, 'telefono') || null, maps_url: maps || null }
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
  const sedeId = text(fd, 'sucursal_id') || null
  if (!nombre) return fail('Falta el nombre de la ubicación')
  if (sedeId && !ctx.sedes.some((x) => x.id === sedeId)) return fail('La sede no es válida')
  if (!sedeId && !ctx.sinRestriccionSede) return fail('Elegí una sede: no tenés alcance sobre todo el negocio')
  const { error } = await ctx.supabase.from('ubicaciones').insert({ negocio_id: ctx.negocio.id, sucursal_id: sedeId, nombre, orden: 99 })
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

/** Desactiva o reactiva una sede: deja de aparecer en selectores y formularios, pero sus reservas se conservan. */
export async function alternarSede(id: string, activa: boolean): Promise<ActionResult> {
  const ctx = await getContexto()
  if (!ctx.puedeAdministrar) return fail('No tenés permiso para editar sedes')
  if (!ctx.sedesGestion.some((x) => x.id === id)) return fail('No tenés alcance sobre esa sede')
  if (!activa && ctx.sedesTodas.filter((x) => x.activa && x.id !== id).length === 0) return fail('No se puede desactivar la única sede activa del negocio')
  const { error } = await ctx.supabase.from('sucursales').update({ activa }).eq('id', id).eq('negocio_id', ctx.negocio.id)
  if (error) return fail('No se pudo actualizar la sede')
  revalidatePath('/', 'layout')
  return { ok: true }
}

/** Elimina una sede SOLO si no tiene reservas (si las tiene, hay que desactivarla: borrarla dejaría esas reservas sin sede). */
export async function eliminarSede(id: string): Promise<ActionResult> {
  const ctx = await getContexto()
  if (!ctx.puedeAdministrar) return fail('No tenés permiso para editar sedes')
  if (!ctx.sedesGestion.some((x) => x.id === id)) return fail('No tenés alcance sobre esa sede')
  const admin = createAdminClient()
  const [{ count: nRes }, { count: nCons }, { count: nSes }] = await Promise.all([
    admin.from('reservas').select('id', { count: 'exact', head: true }).eq('sucursal_id', id),
    admin.from('consultas_reclamos').select('id', { count: 'exact', head: true }).eq('sucursal_id', id),
    admin.from('sesiones_bot').select('id', { count: 'exact', head: true }).eq('sucursal_id', id),
  ])
  if ((nRes ?? 0) + (nCons ?? 0) + (nSes ?? 0) > 0) return fail(`La sede tiene ${nRes ?? 0} reserva(s) y datos asociados: no se puede eliminar. Desactivala para ocultarla.`)
  // sacar la sede de los accesos de los usuarios que la tenían asignada
  const { data: ms } = await admin.from('membresias').select('user_id, negocio_id, sucursal_ids').eq('negocio_id', ctx.negocio.id).contains('sucursal_ids', [id])
  for (const m of ms ?? []) await admin.from('membresias').update({ sucursal_ids: (m.sucursal_ids as string[]).filter((x) => x !== id) }).eq('user_id', m.user_id).eq('negocio_id', m.negocio_id)
  const { error } = await admin.from('sucursales').delete().eq('id', id).eq('negocio_id', ctx.negocio.id)
  if (error) return fail('No se pudo eliminar la sede')
  revalidatePath('/', 'layout')
  return { ok: true }
}

// ---------------------------------------------------------------------------
// Aforo por franja horaria y ubicación
// ---------------------------------------------------------------------------

/** Cómo quedarían los aforos que le corresponden a una reserva (para el aviso en vivo del formulario). */
export async function consultarAforo(input: { sucursal_id: string | null; ubicacion: string | null; fecha: string; hora: string | null; personas: number; excluirId?: string }): Promise<ActionResult> {
  const ctx = await getContexto()
  if (!FECHA_RE.test(input.fecha) || !(input.personas > 0)) return { ok: true, detalle: [] }
  const detalle = await chequearReserva(ctx, { sucursal_id: input.sucursal_id || null, ubicacion: input.ubicacion || null, hora: input.hora && HORA_RE.test(input.hora) ? input.hora : null, fecha: input.fecha, personas: input.personas, excluirId: input.excluirId })
  return { ok: true, detalle }
}

export async function guardarRegla(_prev: ActionResult | null, fd: FormData): Promise<ActionResult> {
  const ctx = await getContexto()
  if (!ctx.puedeAdministrar) return fail('No tenés permiso para editar el aforo')
  const id = text(fd, 'id')
  const sedeId = text(fd, 'sucursal_id') || null
  const ubicacion = text(fd, 'ubicacion') || null
  const desde = text(fd, 'hora_desde')
  const hasta = text(fd, 'hora_hasta')
  const maximo = Number(text(fd, 'maximo'))
  if (!Number.isInteger(maximo) || maximo <= 0) return fail('El máximo de personas debe ser un entero mayor a 0')
  if (!!desde !== !!hasta) return fail('Completá la franja desde y hasta, o dejá ambas vacías para todo el día')
  if (desde && (!HORA_RE.test(desde) || !HORA_RE.test(hasta))) return fail('La franja horaria no es válida')
  if (desde && desde >= hasta) return fail('La franja debe terminar después de empezar (no puede cruzar la medianoche)')
  if (sedeId && !ctx.sedes.some((x) => x.id === sedeId)) return fail('La sede no es válida')
  if (!sedeId && !ctx.sinRestriccionSede) return fail('Elegí una sede: no tenés alcance sobre todo el negocio')
  const fila = { sucursal_id: sedeId, ubicacion, hora_desde: desde || null, hora_hasta: hasta || null, maximo }
  const { error } = id
    ? await ctx.supabase.from('aforos').update(fila).eq('id', id).eq('negocio_id', ctx.negocio.id)
    : await ctx.supabase.from('aforos').insert({ ...fila, negocio_id: ctx.negocio.id })
  if (error) return fail('No se pudo guardar la regla de aforo')
  revalidatePath('/', 'layout')
  return { ok: true }
}

export async function borrarRegla(id: string): Promise<ActionResult> {
  const ctx = await getContexto()
  if (!ctx.puedeAdministrar) return fail('No tenés permiso para editar el aforo')
  const { error } = await ctx.supabase.from('aforos').delete().eq('id', id).eq('negocio_id', ctx.negocio.id)
  if (error) return fail('No se pudo borrar la regla')
  revalidatePath('/', 'layout')
  return { ok: true }
}
