'use server'

import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import { revalidatePath } from 'next/cache'
import { getContexto, NEGOCIO_COOKIE } from '@/lib/context'
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
  if (!ctx.puedeApagarBot) return fail('No tenés permiso para cambiar el estado del bot')
  const { error } = await createAdminClient().from('negocios').update({ bot_activo: !!activo }).eq('id', ctx.negocio.id)
  if (error) return fail('No se pudo cambiar el estado del bot')
  revalidatePath('/', 'layout')
  return { ok: true }
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

  if (!nombre) return fail('Falta el nombre del titular')
  if (fecha && !FECHA_RE.test(fecha)) return fail('La fecha no es válida')
  if (hora && !HORA_RE.test(hora)) return fail('La hora no es válida')
  if (!Number.isInteger(cantidad) || cantidad <= 0) return fail('La cantidad de personas no es válida')
  if (!TIPOS_RESERVA.some((t) => t.value === tipo)) return fail('Tipo de reserva no válido')
  if (telefono && telefono.replace(/\D/g, '').length < 6) return fail('El teléfono no es válido')
  if (!!diaCump !== !!mesCump) return fail('Falta el día o el mes del cumpleaños')

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
  const { error } = await ctx.supabase.from('negocios').update({ aforo_maximo_reservas: aforo }).eq('id', ctx.negocio.id)
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
  if (!FECHA_RE.test(fecha)) return fail('Elegí una fecha')
  if ((desde && !HORA_RE.test(desde)) || (hasta && !HORA_RE.test(hasta))) return fail('El horario no es válido')
  if (!!desde !== !!hasta) return fail('Completá el horario desde y hasta, o dejá ambos vacíos para bloquear todo el día')
  const { error } = await ctx.supabase.from('fechas_bloqueadas_reservas').insert({
    negocio_id: ctx.negocio.id,
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
