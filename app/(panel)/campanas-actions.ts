'use server'

import { revalidatePath } from 'next/cache'
import { getContexto } from '@/lib/context'
import { CAMPANAS_EDITABLES, ESTADOS_CAMPANA, MODOS_CAMPANA } from '@/lib/campanas'
import type { ActionResult } from './actions'

const fail = (error: string): ActionResult => ({ ok: false, error })
const text = (fd: FormData, k: string) => String(fd.get(k) ?? '').trim()
const FECHA_RE = /^\d{4}-\d{2}-\d{2}$/
const HORA_RE = /^\d{2}:\d{2}$/
const MAX_MASIVO = 5000

const refrescar = () => revalidatePath('/', 'layout')

/** Permisos comunes: módulo habilitado, edición manual activa y usuario con permiso de escritura. */
async function puedeEditar() {
  const ctx = await getContexto()
  if (!ctx.modulosActivos.campanas) return { ctx, error: 'Este negocio no tiene el módulo de campañas' }
  if (!CAMPANAS_EDITABLES) return { ctx, error: 'Las campañas son solo de consulta' }
  if (!ctx.puedeEscribir) return { ctx, error: 'Tu usuario es de solo lectura' }
  return { ctx, error: null }
}

export async function guardarCampana(_prev: ActionResult | null, fd: FormData): Promise<ActionResult> {
  const { ctx, error: sinPermiso } = await puedeEditar()
  if (sinPermiso) return fail(sinPermiso)
  const id = text(fd, 'id')
  const nombre = text(fd, 'nombre')
  const tipoSel = text(fd, 'tipo') || 'otra'
  const tipo = tipoSel === 'otro_texto' ? text(fd, 'tipo_otro').toLowerCase().replace(/\s+/g, '_') : tipoSel
  const estado = text(fd, 'estado') || 'activa'
  const modo = text(fd, 'modo') || 'manual'
  const inicio = text(fd, 'fecha_inicio')
  const fin = text(fd, 'fecha_fin')
  if (!nombre) return fail('Escribí el nombre de la campaña')
  if (nombre.length > 120) return fail('El nombre es demasiado largo (máximo 120 caracteres)')
  if (!/^[a-z0-9_áéíóúñ]{2,40}$/.test(tipo)) return fail('El tipo de campaña no es válido')
  if (!ESTADOS_CAMPANA.some((e) => e.value === estado)) return fail('Estado no válido')
  if (!MODOS_CAMPANA.some((m) => m.value === modo)) return fail('Elegí si la campaña es automática o manual')
  if (inicio && !FECHA_RE.test(inicio)) return fail('La fecha de inicio no es válida')
  if (fin && !FECHA_RE.test(fin)) return fail('La fecha de fin no es válida')
  if (inicio && fin && fin < inicio) return fail('La fecha de fin no puede ser anterior al inicio')

  const fila = { nombre, tipo, estado, modo, mensaje: text(fd, 'mensaje') || null, fecha_inicio: inicio || null, fecha_fin: fin || null }
  const { error } = id
    ? await ctx.supabase.from('campanas').update(fila).eq('id', id).eq('negocio_id', ctx.negocio.id)
    : await ctx.supabase.from('campanas').insert({ ...fila, negocio_id: ctx.negocio.id })
  if (error) return fail(error.code === '23505' ? 'Ya hay una campaña con ese nombre' : 'No se pudo guardar la campaña')
  refrescar()
  return { ok: true }
}

export async function eliminarCampana(id: string): Promise<ActionResult> {
  const { ctx, error: sinPermiso } = await puedeEditar()
  if (sinPermiso) return fail(sinPermiso)
  if (!ctx.puedeAdministrar) return fail('Solo un dueño o administrador puede eliminar campañas')
  const { error } = await ctx.supabase.from('campanas').delete().eq('id', id).eq('negocio_id', ctx.negocio.id)
  if (error) return fail('No se pudo eliminar la campaña')
  refrescar()
  return { ok: true }
}

/** Registra uno o varios envíos de una campaña. Con cantidad > 1 se cargan envíos sin destinatario (solo para llevar la cuenta). */
export async function registrarEnvios(_prev: ActionResult | null, fd: FormData): Promise<ActionResult> {
  const { ctx, error: sinPermiso } = await puedeEditar()
  if (sinPermiso) return fail(sinPermiso)
  const campanaId = text(fd, 'campana_id')
  const fecha = text(fd, 'fecha')
  const hora = text(fd, 'hora') || '12:00'
  const cantidad = Math.floor(Number(text(fd, 'cantidad') || '1'))
  const telRaw = text(fd, 'telefono')
  const tel = telRaw.replace(/\D/g, '')

  if (!Number.isInteger(cantidad) || cantidad < 1 || cantidad > MAX_MASIVO) return fail(`La cantidad tiene que estar entre 1 y ${MAX_MASIVO}`)
  if (fecha && !FECHA_RE.test(fecha)) return fail('La fecha no es válida')
  if (!HORA_RE.test(hora)) return fail('La hora no es válida')
  if (cantidad === 1 && telRaw && (tel.length < 6 || tel.length > 20)) return fail('El teléfono no es válido')

  const { data: c } = await ctx.supabase.from('campanas').select('id').eq('id', campanaId).eq('negocio_id', ctx.negocio.id).maybeSingle()
  if (!c) return fail('La campaña no existe')

  // Fecha y hora en horario de Argentina (el negocio siempre trabaja en GMT-3)
  const cuando = fecha ? new Date(`${fecha}T${hora}:00-03:00`).toISOString() : new Date().toISOString()
  const nombre = text(fd, 'nombre') || null
  const detalle = text(fd, 'detalle') || null
  let clienteId: string | null = null
  if (cantidad === 1 && tel) {
    const { data: cli } = await ctx.supabase.from('clientes').select('id').eq('negocio_id', ctx.negocio.id).eq('telefono', tel).maybeSingle()
    clienteId = cli?.id ?? null
  }
  const base = { negocio_id: ctx.negocio.id, campana_id: campanaId, estado: 'enviado', enviado_en: cuando, detalle }
  const filas = cantidad === 1
    ? [{ ...base, nombre, telefono: tel || null, cliente_id: clienteId }]
    : Array.from({ length: cantidad }, () => ({ ...base, nombre: null, telefono: null, cliente_id: null }))
  for (let i = 0; i < filas.length; i += 1000) {
    const { error } = await ctx.supabase.from('campanas_envios').insert(filas.slice(i, i + 1000))
    if (error) return fail('No se pudieron registrar los envíos')
  }
  refrescar()
  return { ok: true }
}

export async function eliminarEnvio(id: string): Promise<ActionResult> {
  const { ctx, error: sinPermiso } = await puedeEditar()
  if (sinPermiso) return fail(sinPermiso)
  if (!ctx.puedeAdministrar) return fail('Solo un dueño o administrador puede eliminar envíos')
  const { error } = await ctx.supabase.from('campanas_envios').delete().eq('id', id).eq('negocio_id', ctx.negocio.id)
  if (error) return fail('No se pudo eliminar el envío')
  refrescar()
  return { ok: true }
}
