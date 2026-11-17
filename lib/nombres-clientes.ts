/**
 * Limpieza de nombres de clientes: una ficha sin nombre real ("Sin nombre", vacío, solo puntos o emojis, un teléfono, una sola letra)
 * toma el nombre de la reserva que hizo, de sus pedidos, de su reseña o de su perfil de WhatsApp (en ese orden).
 * Nunca pisa un nombre real. Sin dependencias del servidor de la app: se puede correr desde un script con la clave de servicio.
 */
import type { SupabaseClient } from '@supabase/supabase-js'

export const MAX_NOMBRE = 80
/** Filtro de PostgREST (or=) de las fichas que NO tienen un nombre real. Se vuelve a comprobar en código con `nombreValido`. */
export const FILTRO_SIN_NOMBRE = 'nombre.is.null,nombre.eq.,nombre.ilike.sin nombre,nombre.like._,nombre.match.^[^[:alpha:]]*$'

/** Sin caracteres de control ni invisibles, espacios juntados y con tope de largo. */
export const limpiarNombre = (n: unknown): string => String(n ?? '').replace(/[\u0000-\u001f\u007f​-‏⁠ㅤ﻿]/g, ' ').replace(/\s+/g, ' ').trim().slice(0, MAX_NOMBRE)

/** Un nombre real: al menos 2 caracteres, alguna letra, y no es el texto "Sin nombre". */
export function nombreValido(n: unknown): boolean {
  const t = limpiarNombre(n)
  return t.length >= 2 && /\p{L}/u.test(t) && !/^sin\s*nombre$/i.test(t)
}

export interface ResultadoLimpieza { revisados: number; completados: number; sinDato: number; porFuente: Record<string, number> }

type Fila = Record<string, unknown>
const lotes = <T,>(xs: T[], n: number) => Array.from({ length: Math.ceil(xs.length / n) }, (_, i) => xs.slice(i * n, i * n + n))

/**
 * Completa los nombres de las fichas del negocio con lo que ya hay en el CRM. `soloIds` limita a esas fichas (opcional).
 * Fuentes por orden: reservas (la más reciente con nombre), pedidos, reseñas y sesiones del bot (perfil de WhatsApp).
 */
export async function completarNombresLocales(sb: SupabaseClient, negocioId: string, soloIds?: string[]): Promise<ResultadoLimpieza> {
  // 1) fichas sin nombre real
  const fichas: { id: string; telefono: string | null }[] = []
  for (let desde = '';;) {
    let q = sb.from('clientes').select('id, telefono, nombre').eq('negocio_id', negocioId).or(FILTRO_SIN_NOMBRE).order('id').limit(1000)
    if (desde) q = q.gt('id', desde)
    if (soloIds) q = q.in('id', soloIds)
    const { data, error } = await q
    if (error) throw new Error('No se pudieron leer los clientes')
    const filas = (data ?? []) as Fila[]
    for (const f of filas) if (!nombreValido(f.nombre)) fichas.push({ id: String(f.id), telefono: (f.telefono as string | null) ?? null })
    if (filas.length < 1000) break
    desde = String(filas[filas.length - 1].id)
  }
  const r: ResultadoLimpieza = { revisados: fichas.length, completados: 0, sinDato: 0, porFuente: {} }
  if (!fichas.length) return r

  // 2) nombre por ficha, por fuente (el primero válido de cada una; las consultas vienen de la más reciente a la más vieja)
  const elegido = new Map<string, { nombre: string; fuente: string }>()
  const poner = (id: string, nombre: unknown, fuente: string) => { if (!elegido.has(id) && nombreValido(nombre)) elegido.set(id, { nombre: limpiarNombre(nombre), fuente }) }
  const ids = fichas.map((f) => f.id)
  const porTelefono = new Map(fichas.filter((f) => f.telefono).map((f) => [f.telefono as string, f.id]))
  for (const lote of lotes(ids, 100)) {
    const [{ data: rs }, { data: ps }, { data: rv }] = await Promise.all([
      sb.from('reservas').select('cliente_id, cliente_nombre').eq('negocio_id', negocioId).in('cliente_id', lote).is('eliminado_en', null).not('cliente_nombre', 'is', null).order('creado_en', { ascending: false }).limit(5000),
      sb.from('pedidos').select('cliente_id, nombre').eq('negocio_id', negocioId).in('cliente_id', lote).order('creado_en', { ascending: false }).limit(5000),
      sb.from('resenas').select('cliente_id, nombre').eq('negocio_id', negocioId).in('cliente_id', lote).not('nombre', 'is', null).order('creado_en', { ascending: false }).limit(5000),
    ])
    for (const x of (rs ?? []) as Fila[]) poner(String(x.cliente_id), x.cliente_nombre, 'reserva')
    for (const x of (ps ?? []) as Fila[]) if (!/^mesa\b/i.test(limpiarNombre(x.nombre))) poner(String(x.cliente_id), x.nombre, 'pedido')
    for (const x of (rv ?? []) as Fila[]) poner(String(x.cliente_id), x.nombre, 'reseña')
  }
  for (const lote of lotes([...porTelefono.keys()], 100)) {
    const { data } = await sb.from('sesiones_bot').select('telefono, nombre_whatsapp, actualizado_en').eq('negocio_id', negocioId).in('telefono', lote).not('nombre_whatsapp', 'is', null).order('actualizado_en', { ascending: false }).limit(5000)
    for (const x of (data ?? []) as Fila[]) { const id = porTelefono.get(String(x.telefono)); if (id) poner(id, x.nombre_whatsapp, 'whatsapp') }
  }

  // 3) guardar (solo si la ficha SIGUE sin nombre real en ese momento)
  for (const f of fichas) {
    const e = elegido.get(f.id)
    if (!e) { r.sinDato++; continue }
    const { data, error } = await sb.from('clientes').update({ nombre: e.nombre }).eq('id', f.id).eq('negocio_id', negocioId).or(FILTRO_SIN_NOMBRE).select('id')
    if (error) throw new Error('No se pudo guardar un nombre')
    if (data && data.length) { r.completados++; r.porFuente[e.fuente] = (r.porFuente[e.fuente] ?? 0) + 1 } else r.sinDato++
  }
  return r
}
