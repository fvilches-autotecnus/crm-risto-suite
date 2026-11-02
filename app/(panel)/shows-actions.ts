'use server'

import { UUID } from '@/lib/validar'
import { revalidatePath } from 'next/cache'
import { getContexto } from '@/lib/context'
import { borrarImagenBucket, imagenDelNegocio, subirImagenBucket, type ResultadoSubida } from '@/lib/imagenes-bucket'
import { MODALIDADES, normalizarEnlace } from '@/lib/shows'
import type { ActionResult } from './actions'

const fail = (error: string): ActionResult => ({ ok: false, error })
const text = (fd: FormData, k: string) => String(fd.get(k) ?? '').trim()

async function permiso() {
  const ctx = await getContexto()
  if (!ctx.modulosActivos.shows) return { ctx, error: 'Este negocio no tiene el módulo Shows' }
  if (!ctx.puedeEscribir) return { ctx, error: 'Tu usuario es de solo lectura' }
  return { ctx, error: null as string | null }
}
const refrescar = (slug: string) => { revalidatePath('/shows'); revalidatePath(`/shows/${slug}`) }

export async function guardarShow(_prev: ActionResult | null, fd: FormData): Promise<ActionResult> {
  const { ctx, error } = await permiso(); if (error) return fail(error)
  const id = text(fd, 'id'), titulo = text(fd, 'titulo').replace(/\s+/g, ' '), descripcion = text(fd, 'descripcion')
  const fecha = text(fd, 'fecha'), hora = text(fd, 'hora'), ubicacion = text(fd, 'ubicacion_id'), modalidad = text(fd, 'modalidad')
  if (!titulo) return fail('Falta el nombre del show')
  if (titulo.length > 100) return fail('El nombre puede tener hasta 100 letras')
  if (descripcion.length > 1000) return fail('La descripción puede tener hasta 1000 letras')
  if (!/^\d{4}-\d{2}-\d{2}$/.test(fecha) || Number.isNaN(Date.parse(fecha))) return fail('Falta la fecha del show')
  if (hora && !/^([01]\d|2[0-3]):[0-5]\d$/.test(hora)) return fail('La hora no es válida')
  if (!MODALIDADES.some((m) => m.clave === modalidad)) return fail('Elegí cómo se reserva o se entra al show')
  const enlace = normalizarEnlace(text(fd, 'enlace'))
  if (enlace === undefined) return fail('El enlace no es válido: pegá una dirección web (https://…) o un número de WhatsApp')
  if (enlace && enlace.length > 500) return fail('El enlace es demasiado largo')
  if (modalidad !== 'reserva' && !enlace) return fail(modalidad === 'derivada' ? 'Falta el WhatsApp o el sitio de la producción que toma las reservas' : 'Falta el enlace donde se venden las entradas')
  if (ubicacion) {
    if (!UUID.test(ubicacion)) return fail('Ubicación no válida')
    const { count } = await ctx.supabase.from('ubicaciones').select('id', { count: 'exact', head: true }).eq('id', ubicacion).eq('negocio_id', ctx.negocio.id)
    if (!count) return fail('Esa ubicación no existe')
  }
  const imagen = text(fd, 'imagen_path') || null
  if (imagen && !imagenDelNegocio(imagen, ctx.negocio.id)) return fail('La imagen no es válida: volvé a subirla')
  const fila = { titulo, descripcion: descripcion || null, imagen_path: imagen, fecha, hora: hora || null, ubicacion_id: ubicacion || null, modalidad, enlace, visible: fd.get('visible') === 'on' }
  if (id) {
    if (!UUID.test(id)) return fail('Show no válido')
    const { data: previo } = await ctx.supabase.from('shows').select('imagen_path').eq('id', id).eq('negocio_id', ctx.negocio.id).maybeSingle()
    if (!previo) return fail('El show ya no existe')
    const { error: e } = await ctx.supabase.from('shows').update(fila).eq('id', id).eq('negocio_id', ctx.negocio.id)
    if (e) return fail('No se pudo guardar el show')
    if (previo.imagen_path && previo.imagen_path !== imagen) await borrarImagenBucket(previo.imagen_path)
  } else {
    const { error: e } = await ctx.supabase.from('shows').insert({ negocio_id: ctx.negocio.id, ...fila })
    if (e) return fail('No se pudo crear el show')
  }
  refrescar(ctx.negocio.slug)
  return { ok: true }
}

export async function alternarShow(id: string): Promise<ActionResult> {
  const { ctx, error } = await permiso(); if (error) return fail(error)
  if (!UUID.test(id)) return fail('Show no válido')
  const { data: s } = await ctx.supabase.from('shows').select('visible').eq('id', id).eq('negocio_id', ctx.negocio.id).maybeSingle()
  if (!s) return fail('El show ya no existe')
  const { error: e } = await ctx.supabase.from('shows').update({ visible: !s.visible }).eq('id', id).eq('negocio_id', ctx.negocio.id)
  if (e) return fail('No se pudo cambiar')
  refrescar(ctx.negocio.slug)
  return { ok: true }
}

export async function eliminarShow(id: string): Promise<ActionResult> {
  const { ctx, error } = await permiso(); if (error) return fail(error)
  if (!ctx.puedeAdministrar) return fail('Solo dueños y administradores pueden eliminar shows')
  if (!UUID.test(id)) return fail('Show no válido')
  const { data: s } = await ctx.supabase.from('shows').select('imagen_path').eq('id', id).eq('negocio_id', ctx.negocio.id).maybeSingle()
  const { error: e } = await ctx.supabase.from('shows').delete().eq('id', id).eq('negocio_id', ctx.negocio.id)
  if (e) return fail('No se pudo eliminar el show')
  await borrarImagenBucket(s?.imagen_path)
  refrescar(ctx.negocio.slug)
  return { ok: true }
}

// ---------------------------------------------------------------------------
// Imagen (mismo bucket público que las fotos de la carta; el navegador ya la achicó)
// ---------------------------------------------------------------------------
export async function subirImagenShow(fd: FormData): Promise<ResultadoSubida> {
  const { ctx, error } = await permiso(); if (error) return { ok: false, error }
  return subirImagenBucket(ctx.negocio.id, fd.get('archivo'), 'imagen')
}

/** Borra una imagen que se subió pero no se llegó a guardar en ningún show (se cerró el diálogo). */
export async function descartarImagenShow(path: string): Promise<ActionResult> {
  const { ctx, error } = await permiso(); if (error) return fail(error)
  if (!imagenDelNegocio(path, ctx.negocio.id)) return fail('Imagen no válida')
  const { count } = await ctx.supabase.from('shows').select('id', { count: 'exact', head: true }).eq('imagen_path', path).eq('negocio_id', ctx.negocio.id)
  if (!count) await borrarImagenBucket(path)
  return { ok: true }
}
