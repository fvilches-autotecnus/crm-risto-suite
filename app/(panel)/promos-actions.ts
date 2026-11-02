'use server'

import { UUID } from '@/lib/validar'
import { revalidatePath } from 'next/cache'
import { after } from 'next/server'
import { getContexto } from '@/lib/context'
import { falloAlcance } from '@/lib/config-tecnica'
import type { ModoPrecio } from '@/lib/promos'
import type { ActionResult } from './actions'

const fail = (error: string): ActionResult => ({ ok: false, error })

export interface PromoEntrada { id: string; nombre: string; descripcion: string; precio: string; modo_precio: ModoPrecio; activa: boolean }
export interface PromosTipoEntrada { clave: string; descripcion: string; promos: PromoEntrada[] }

/** "15000", "15.000", "15.000,50", "$ 15000" → 15000 / 15000 / 15000.5 / 15000. Vacío = sin precio (a consultar). NaN si no se entiende. */
function leerPrecio(t: string): number | null {
  const s = String(t ?? '').replace(/[$\s]/g, '')
  if (!s) return null
  const n = Number(s.includes(',') ? s.replace(/\./g, '').replace(',', '.') : /^\d{1,3}(\.\d{3})+$/.test(s) ? s.replace(/\./g, '') : s)
  return Number.isFinite(n) && n >= 0 && n < 100000000 ? Math.round(n * 100) / 100 : NaN
}

/**
 * Guarda la descripción de cada tipo de reserva y sus promos. Se guarda solo mientras se edita (por eso la invalidación del sitio público va en after()).
 * Las promos que ya no están en la lista se borran; lo ya reservado conserva su promo (queda anotada en cada reserva).
 */
export async function guardarPromosReserva(tipos: PromosTipoEntrada[]): Promise<ActionResult> {
  const ctx = await getContexto()
  if (!ctx.modulosActivos.promos) return fail('Este negocio no tiene el módulo de promos')
  if (!ctx.puedeAdministrar) return fail('Solo dueños y administradores pueden cambiar las promos')
  { const e = falloAlcance(ctx); if (e) return fail(e) }
  if (!Array.isArray(tipos) || tipos.length > 40) return fail('Los datos de las promos no son válidos')
  const { data: existentes } = await ctx.supabase.from('reserva_tipos').select('clave').eq('negocio_id', ctx.negocio.id)
  const claves = new Set((existentes ?? []).map((t) => t.clave as string))
  const vistos = new Set<string>()
  const filas: { id: string; negocio_id: string; tipo_clave: string; nombre: string; descripcion: string | null; precio: number | null; modo_precio: ModoPrecio; activa: boolean; orden: number }[] = []
  for (const t of tipos) {
    if (!claves.has(t.clave)) continue   // un tipo que todavía no se guardó o ya no existe: se ignora
    if (String(t.descripcion ?? '').length > 400) return fail('La descripción de un tipo puede tener hasta 400 letras')
    if ((t.promos ?? []).length > 12) return fail('Hasta 12 promos por tipo')
    for (const [i, p] of (t.promos ?? []).entries()) {
      const nombre = String(p.nombre ?? '').trim()
      if (!UUID.test(String(p.id))) return fail('Hay una promo con un dato no válido')
      if (vistos.has(p.id)) return fail('Hay una promo repetida')
      vistos.add(p.id)
      if (nombre.length < 1 || nombre.length > 60) return fail('Cada promo necesita un nombre (hasta 60 letras)')
      if (String(p.descripcion ?? '').length > 400) return fail(`La descripción de “${nombre}” puede tener hasta 400 letras`)
      const precio = leerPrecio(p.precio)
      if (Number.isNaN(precio)) return fail(`El precio de “${nombre}” no es válido (ej. 15000)`)
      if (p.modo_precio !== 'persona' && p.modo_precio !== 'reserva') return fail(`El precio de “${nombre}” tiene que ser por persona o por reserva`)
      filas.push({ id: p.id, negocio_id: ctx.negocio.id, tipo_clave: t.clave, nombre, descripcion: String(p.descripcion ?? '').trim() || null, precio, modo_precio: p.modo_precio, activa: !!p.activa, orden: i })
    }
  }
  for (const t of tipos.filter((x) => claves.has(x.clave))) {
    const { error } = await ctx.supabase.from('reserva_tipos').update({ descripcion: String(t.descripcion ?? '').trim() || null }).eq('negocio_id', ctx.negocio.id).eq('clave', t.clave)
    if (error) return fail('No se pudo guardar la descripción de un tipo')
  }
  if (filas.length) {
    const { error } = await ctx.supabase.from('reserva_tipo_opciones').upsert(filas, { onConflict: 'id' })
    if (error) return fail('No se pudieron guardar las promos')
  }
  // las promos que se sacaron de la lista (solo de los tipos que llegaron)
  for (const t of tipos.filter((x) => claves.has(x.clave))) {
    const quedan = filas.filter((f) => f.tipo_clave === t.clave).map((f) => f.id)
    let q = ctx.supabase.from('reserva_tipo_opciones').delete().eq('negocio_id', ctx.negocio.id).eq('tipo_clave', t.clave)
    if (quedan.length) q = q.not('id', 'in', `(${quedan.join(',')})`)
    const { error } = await q
    if (error) return fail('No se pudo quitar una promo')
  }
  const slug = ctx.negocio.slug
  after(() => revalidatePath(`/reservar/${slug}`))
  return { ok: true }
}
