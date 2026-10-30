'use server'

import { revalidatePath } from 'next/cache'
import { getContexto } from '@/lib/context'
import { leerMarca } from '@/lib/marca'
import type { ActionResult } from './actions'

const fail = (error: string): ActionResult => ({ ok: false, error })
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
const text = (fd: FormData, k: string) => String(fd.get(k) ?? '').trim()

/** Crea o cambia un sitio de reservas que agrupa las sedes elegidas (/reservar/<dirección>). */
export async function guardarSitioWeb(_prev: ActionResult | null, fd: FormData): Promise<ActionResult> {
  const ctx = await getContexto()
  if (!ctx.modulosActivos.reservas) return fail('Este negocio no tiene el módulo Reservas')
  if (!ctx.esSuperadmin) return fail('Los sitios de reservas con dirección propia los configura el equipo de Risto Suite')
  const id = text(fd, 'id')
  if (id && !UUID.test(id)) return fail('Sitio no válido')
  const alias = text(fd, 'alias').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '')
  if (alias.length < 3 || alias.length > 60) return fail('La dirección del sitio va de 3 a 60 letras, números o guiones')
  const nombre = text(fd, 'nombre')
  if (nombre.length < 1 || nombre.length > 60) return fail('Ponele un nombre al sitio (hasta 60 letras): es solo para reconocerlo acá')
  const titulo = text(fd, 'titulo'), subtitulo = text(fd, 'subtitulo')
  if (titulo.length > 80) return fail('El título puede tener hasta 80 letras')
  if (subtitulo.length > 160) return fail('El subtítulo puede tener hasta 160 letras')
  const marca = leerMarca(fd)
  if (!marca.ok) return fail(marca.error)
  const validas = new Set(ctx.sedesTodas.filter((s) => s.activa).map((s) => s.id))
  const sedes = [...new Set(fd.getAll('sedes').map(String).filter((s) => UUID.test(s) && validas.has(s)))]
  if (sedes.length === 0) return fail('Elegí al menos una sede para este sitio')
  const fila = { negocio_id: ctx.negocio.id, alias, nombre, titulo: titulo || null, subtitulo: subtitulo || null, sedes, marca: marca.marca, activo: fd.get('activo') === 'on' }
  let anterior: string | null = null
  let error
  if (id) {
    const { data: actual } = await ctx.supabase.from('sitios_web').select('alias').eq('id', id).eq('negocio_id', ctx.negocio.id).maybeSingle()
    if (!actual) return fail('No se encontró ese sitio')
    anterior = actual.alias as string
    ;({ error } = await ctx.supabase.from('sitios_web').update(fila).eq('id', id).eq('negocio_id', ctx.negocio.id))
  } else {
    ;({ error } = await ctx.supabase.from('sitios_web').insert(fila))
  }
  if (error) {
    if (error.code === '23505') return fail(`La dirección “${alias}” ya la usa otro negocio, otra sede u otro sitio. Elegí otra.`)
    if (error.code === '23514') return fail('Alguna de las sedes elegidas no es de este negocio')
    return fail('No se pudo guardar el sitio')
  }
  revalidatePath('/configuracion'); revalidatePath(`/reservar/${alias}`); if (anterior && anterior !== alias) revalidatePath(`/reservar/${anterior}`)
  return { ok: true }
}

export async function borrarSitioWeb(id: string): Promise<ActionResult> {
  const ctx = await getContexto()
  if (!ctx.esSuperadmin) return fail('Los sitios de reservas con dirección propia los configura el equipo de Risto Suite')
  if (!UUID.test(id)) return fail('Sitio no válido')
  const { data } = await ctx.supabase.from('sitios_web').delete().eq('id', id).eq('negocio_id', ctx.negocio.id).select('alias')
  if (!data?.length) return fail('No se encontró ese sitio')
  revalidatePath('/configuracion'); revalidatePath(`/reservar/${data[0].alias}`)
  return { ok: true }
}
