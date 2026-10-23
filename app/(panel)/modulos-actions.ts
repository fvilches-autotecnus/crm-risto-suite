'use server'

import { revalidatePath } from 'next/cache'
import { getContexto } from '@/lib/context'
import type { ActionResult } from './actions'

const fail = (error: string): ActionResult => ({ ok: false, error })
const text = (fd: FormData, k: string) => String(fd.get(k) ?? '').trim()
const digitos = (t: string) => t.replace(/\D/g, '')
const telefonoValido = (t: string) => { const d = digitos(t); return d.length >= 6 && d.length <= 20 ? d : null }
const FECHA_RE = /^\d{4}-\d{2}-\d{2}$/

function refrescar() {
  revalidatePath('/', 'layout')
}

// ---------------------------------------------------------------------------
// Vouchers
// ---------------------------------------------------------------------------
const PREFIJOS: Record<string, string> = { cumpleanos: 'CUMPLE', inactividad: 'INACT', encuesta: 'ENC' }
const ALFABETO = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789' // sin 0/O/1/I: se dictan por teléfono

function generarCodigo(prefijo: string): string {
  const bytes = crypto.getRandomValues(new Uint8Array(5))
  return `${prefijo}-${[...bytes].map((b) => ALFABETO[b % ALFABETO.length]).join('')}`
}

export async function crearVoucher(_prev: ActionResult | null, fd: FormData): Promise<ActionResult> {
  const ctx = await getContexto()
  if (!ctx.puedeEscribir) return fail('Tu usuario es de solo lectura')

  const nombre = text(fd, 'nombre')
  const telRaw = text(fd, 'telefono')
  const tel = telRaw ? telefonoValido(telRaw) : null
  if (telRaw && !tel) return fail('El teléfono no es válido')
  const beneficio = text(fd, 'beneficio')
  if (!beneficio) return fail('Escribí el beneficio del voucher (ej. "1 postre de regalo")')
  const campanaSel = text(fd, 'campana') || 'otra'
  const campana = campanaSel === 'otra' ? text(fd, 'campana_otra').toLowerCase() || 'otra' : campanaSel
  const vence = text(fd, 'vence_el')
  if (vence && !FECHA_RE.test(vence)) return fail('La fecha de vencimiento no es válida')
  const codigoManual = text(fd, 'codigo').toUpperCase().replace(/\s+/g, '')
  if (codigoManual && !/^[A-Z0-9._-]{3,30}$/.test(codigoManual)) return fail('El código debe tener 3 a 30 letras, números, punto o guion')

  let clienteId = text(fd, 'cliente_id') || null
  if (!clienteId && tel) {
    const { data: c } = await ctx.supabase.from('clientes').select('id').eq('negocio_id', ctx.negocio.id).eq('telefono', tel).maybeSingle()
    clienteId = c?.id ?? null
  }

  // El código se genera solo salvo que lo escriban; ante un choque (muy improbable) se reintenta.
  const prefijo = PREFIJOS[campana] ?? 'VCH'
  for (let intento = 0; intento < 5; intento++) {
    const codigo = codigoManual || generarCodigo(prefijo)
    const { error } = await ctx.supabase.from('vouchers').insert({
      negocio_id: ctx.negocio.id, cliente_id: clienteId, codigo, nombre: nombre || null, telefono: tel, beneficio, campana, vence_el: vence || null,
    })
    if (!error) { refrescar(); return { ok: true } }
    if (error.code === '23505') { if (codigoManual) return fail('Ya existe un voucher con ese código'); continue }
    return fail('No se pudo crear el voucher')
  }
  return fail('No se pudo generar un código libre, probá de nuevo')
}

export async function cambiarEstadoVoucher(id: string, estado: 'vigente' | 'usado' | 'anulado'): Promise<ActionResult> {
  const ctx = await getContexto()
  if (!ctx.puedeEscribir) return fail('Tu usuario es de solo lectura')
  if (!['vigente', 'usado', 'anulado'].includes(estado)) return fail('Estado no válido')
  const { error } = await ctx.supabase.from('vouchers').update({ estado, usado_en: estado === 'usado' ? new Date().toISOString() : null }).eq('id', id).eq('negocio_id', ctx.negocio.id)
  if (error) return fail('No se pudo actualizar el voucher')
  refrescar()
  return { ok: true }
}

export async function eliminarVoucher(id: string): Promise<ActionResult> {
  const ctx = await getContexto()
  if (!ctx.puedeAdministrar) return fail('Solo un dueño o administrador puede eliminar vouchers')
  const { error } = await ctx.supabase.from('vouchers').delete().eq('id', id).eq('negocio_id', ctx.negocio.id)
  if (error) return fail('No se pudo eliminar el voucher')
  refrescar()
  return { ok: true }
}

// ---------------------------------------------------------------------------
// Cumpleaños (se guardan en el cliente)
// ---------------------------------------------------------------------------
const DIAS_MES = [31, 29, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31]

/** Carga o corrige el cumpleaños de un cliente (por id) o de un teléfono (crea el cliente si no existe). */
export async function guardarCumple(_prev: ActionResult | null, fd: FormData): Promise<ActionResult> {
  const ctx = await getContexto()
  if (!ctx.puedeEscribir) return fail('Tu usuario es de solo lectura')
  const dia = Number(text(fd, 'dia'))
  const mes = Number(text(fd, 'mes'))
  if (!Number.isInteger(mes) || mes < 1 || mes > 12) return fail('Elegí el mes')
  if (!Number.isInteger(dia) || dia < 1 || dia > DIAS_MES[mes - 1]) return fail(`El día no es válido para ese mes`)

  // año de nacimiento opcional: si viene, se guarda la fecha completa (para mostrar la edad)
  const anioTxt = text(fd, 'anio')
  let nacimiento: string | null = null
  if (anioTxt) {
    const anio = Number(anioTxt)
    const d = new Date(Date.UTC(anio, mes - 1, dia))
    if (!Number.isInteger(anio) || anio < 1900 || anio > new Date().getFullYear() || d.getUTCMonth() !== mes - 1 || d.getUTCDate() !== dia) return fail('El año de nacimiento no es válido para esa fecha')
    nacimiento = `${anio}-${String(mes).padStart(2, '0')}-${String(dia).padStart(2, '0')}`
  }

  // el nombre se puede reescribir al cargar el cumpleaños (la base lo guarda en mayúsculas para quien tiene cumpleaños)
  const nombreNuevo = text(fd, 'nombre').replace(/\s+/g, ' ')
  if (nombreNuevo.length > 120) return fail('El nombre es demasiado largo (máximo 120 caracteres)')

  const clienteId = text(fd, 'cliente_id')
  if (clienteId) {
    const { error } = await ctx.supabase.from('clientes').update({ cumple_dia: dia, cumple_mes: mes, fecha_nacimiento: nacimiento, ...(nombreNuevo ? { nombre: nombreNuevo } : {}) }).eq('id', clienteId).eq('negocio_id', ctx.negocio.id)
    if (error) return fail('No se pudo guardar el cumpleaños')
    refrescar()
    return { ok: true }
  }

  const tel = telefonoValido(text(fd, 'telefono'))
  const nombre = text(fd, 'nombre')
  if (!nombre) return fail('El nombre es obligatorio')
  if (!tel) return fail('Ingresá un teléfono válido (con código de país)')
  const { data: existente } = await ctx.supabase.from('clientes').select('id').eq('negocio_id', ctx.negocio.id).eq('telefono', tel).maybeSingle()
  const { error } = existente
    ? await ctx.supabase.from('clientes').update({ cumple_dia: dia, cumple_mes: mes, fecha_nacimiento: nacimiento, nombre }).eq('id', existente.id)
    : await ctx.supabase.from('clientes').insert({ negocio_id: ctx.negocio.id, nombre, telefono: tel, cumple_dia: dia, cumple_mes: mes, fecha_nacimiento: nacimiento, canal_origen: 'manual' })
  if (error) return fail('No se pudo guardar el cumpleaños')
  refrescar()
  return { ok: true }
}

export async function quitarCumple(clienteId: string): Promise<ActionResult> {
  const ctx = await getContexto()
  if (!ctx.puedeEscribir) return fail('Tu usuario es de solo lectura')
  const { error } = await ctx.supabase.from('clientes').update({ cumple_dia: null, cumple_mes: null, fecha_nacimiento: null }).eq('id', clienteId).eq('negocio_id', ctx.negocio.id)
  if (error) return fail('No se pudo quitar el cumpleaños')
  refrescar()
  return { ok: true }
}

// ---------------------------------------------------------------------------
// Módulos habilitados por negocio (solo superadmin)
// ---------------------------------------------------------------------------
export async function guardarModulos(_prev: ActionResult | null, fd: FormData): Promise<ActionResult> {
  const ctx = await getContexto()
  if (!ctx.esSuperadmin) return fail('Solo un superadmin puede cambiar los módulos')
  const { createAdminClient } = await import('@/lib/supabase/server')
  const admin = createAdminClient()
  const { data: actual } = await admin.from('negocios').select('modulos').eq('id', ctx.negocio.id).single()
  if (!actual) return fail('No se pudo leer el negocio')
  const modulos = {
    ...(actual.modulos as Record<string, unknown>),
    metricas: fd.get('metricas') === 'on',
    cumpleanos: fd.get('cumpleanos') === 'on',
    vouchers: fd.get('vouchers') === 'on',
    resenas: fd.get('resenas') === 'on',
    conversaciones: fd.get('conversaciones') === 'on',
    derivadas: fd.get('derivadas') === 'on',
    campanas: fd.get('campanas') === 'on',
  }
  const { error } = await admin.from('negocios').update({ modulos }).eq('id', ctx.negocio.id)
  if (error) return fail('No se pudo guardar')
  refrescar()
  return { ok: true }
}

// ---------------------------------------------------------------------------
// Consultas y reclamos
// ---------------------------------------------------------------------------
export async function cambiarTipoConsulta(id: string, tipo: 'consulta' | 'reclamo'): Promise<ActionResult> {
  const ctx = await getContexto()
  if (!ctx.puedeEscribir) return fail('Tu usuario es de solo lectura')
  if (tipo !== 'consulta' && tipo !== 'reclamo') return fail('Tipo no válido')
  const { error } = await ctx.supabase.from('consultas_reclamos').update({ tipo }).eq('id', id).eq('negocio_id', ctx.negocio.id)
  if (error) return fail('No se pudo actualizar el tipo')
  refrescar()
  return { ok: true }
}

// ---------------------------------------------------------------------------
// Reseñas
// ---------------------------------------------------------------------------
const ORIGENES = ['google', 'encuesta', 'manual', 'otro']

export async function guardarResena(_prev: ActionResult | null, fd: FormData): Promise<ActionResult> {
  const ctx = await getContexto()
  if (!ctx.puedeEscribir) return fail('Tu usuario es de solo lectura')
  const id = text(fd, 'id')
  const nombre = text(fd, 'nombre')
  const telRaw = text(fd, 'telefono')
  const tel = telRaw ? telefonoValido(telRaw) : null
  const puntaje = Number(text(fd, 'puntaje'))
  const origen = ORIGENES.includes(text(fd, 'origen')) ? text(fd, 'origen') : 'manual'
  const fecha = text(fd, 'fecha')
  const sedeId = text(fd, 'sucursal_id') || null

  if (!nombre) return fail('El nombre es obligatorio')
  if (!tel) return fail('Ingresá un teléfono válido (con código de país)')
  if (!Number.isInteger(puntaje) || puntaje < 1 || puntaje > 5) return fail('Elegí el puntaje (1 a 5 estrellas)')
  if (fecha && !FECHA_RE.test(fecha)) return fail('La fecha no es válida')
  if (sedeId && !ctx.sedes.some((x) => x.id === sedeId)) return fail('La sede no es válida')
  if (ctx.sedes.length > 0 && !sedeId) return fail('Elegí la sede de la reseña')

  const fila = { nombre, telefono: tel, puntaje, comentario: text(fd, 'comentario') || null, origen, ...(fecha ? { fecha } : {}), sucursal_id: sedeId }
  const { error } = id
    ? await ctx.supabase.from('resenas').update(fila).eq('id', id).eq('negocio_id', ctx.negocio.id)
    : await ctx.supabase.from('resenas').insert({ ...fila, negocio_id: ctx.negocio.id, cliente_id: text(fd, 'cliente_id') || null })
  if (error) return fail('No se pudo guardar la reseña')
  refrescar()
  return { ok: true }
}

export async function eliminarResena(id: string): Promise<ActionResult> {
  const ctx = await getContexto()
  if (!ctx.puedeAdministrar) return fail('Solo un dueño o administrador puede eliminar reseñas')
  const { error } = await ctx.supabase.from('resenas').delete().eq('id', id).eq('negocio_id', ctx.negocio.id)
  if (error) return fail('No se pudo eliminar la reseña')
  refrescar()
  return { ok: true }
}
