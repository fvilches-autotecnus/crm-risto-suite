'use server'

import { UUID } from '@/lib/validar'
import { revalidatePath } from 'next/cache'
import { getContexto } from '@/lib/context'
import { nombreSuscriptor } from '@/lib/botconversa'
import { cuentaBCUsable } from '@/lib/etiquetas'
import type { ActionResult } from './actions'

const fail = (error: string): ActionResult => ({ ok: false, error })
const MAX_NOMBRE = 120

/**
 * Corrige el nombre de un cliente. Solo cambia el nombre del cliente: lo que ya se cargó con otro nombre
 * (titular de una reserva, reseña, voucher) queda como se escribió en su momento.
 * Un nombre cargado a mano no lo pisa ninguna reserva ni función del bot: solo se completa si estaba vacío o decía "Sin nombre".
 */
export async function guardarNombreCliente(_prev: ActionResult | null, fd: FormData): Promise<ActionResult> {
  const ctx = await getContexto()
  if (!ctx.puedeEscribir) return fail('Tu usuario es de solo lectura')
  const id = String(fd.get('id') ?? '')
  if (!UUID.test(id)) return fail('Cliente no válido')
  // se quitan caracteres de control y se juntan los espacios repetidos
  const nombre = String(fd.get('nombre') ?? '').replace(/[\u0000-\u001f\u007f]/g, ' ').replace(/\s+/g, ' ').trim()
  if (!nombre) return fail('El nombre no puede quedar vacío')
  if (nombre.length > MAX_NOMBRE) return fail(`El nombre es demasiado largo (máximo ${MAX_NOMBRE} caracteres)`)
  const { data, error } = await ctx.supabase.from('clientes').update({ nombre }).eq('id', id).eq('negocio_id', ctx.negocio.id).select('id').maybeSingle()
  if (error) return fail('No se pudo guardar el nombre')
  if (!data) return fail('El cliente no existe')
  revalidatePath('/', 'layout')
  return { ok: true }
}

/** Avance de "Completar nombres desde BotConversa": se procesa de a lotes y la pantalla va pidiendo el siguiente con `ultimo`. */
export interface AvanceNombres {
  ok: boolean
  error?: string
  total?: number        // solo en el primer lote: cuántas fichas "Sin nombre" con teléfono hay
  revisados: number
  completados: number
  sinDato: number       // no está en BotConversa o no tiene nombre (o es solo símbolos)
  errores: number       // BotConversa no respondió para ese número
  ultimo: string | null
  hecho: boolean
}

const LOTE_NOMBRES = 20
const SIN_NOMBRE = 'nombre.ilike."sin nombre",nombre.eq.""'
const vacio = (error: string): AvanceNombres => ({ ok: false, error, revisados: 0, completados: 0, sinDato: 0, errores: 0, ultimo: null, hecho: true })

/**
 * Completa las fichas que están en "Sin nombre" con el nombre que ese contacto tiene en BotConversa (el del perfil de WhatsApp),
 * buscándolo por teléfono en la cuenta del negocio. Solo toca fichas que siguen sin nombre en el momento de guardar: un nombre cargado
 * (a mano, por una reserva o por el bot) nunca se pisa. Los nombres que no tienen ninguna letra se descartan.
 */
export async function completarNombresDesdeBotConversa(desde: string | null): Promise<AvanceNombres> {
  const ctx = await getContexto()
  if (!ctx.puedeEscribir) return vacio('Tu usuario es de solo lectura')
  if (desde !== null && !UUID.test(desde)) return vacio('Dato no válido')
  const cuenta = await cuentaBCUsable(ctx.negocio.id, null)
  if (!cuenta) return vacio('La integración con BotConversa no está activa')
  const { supabase, negocio } = ctx

  let total: number | undefined
  if (desde === null) {
    const { count } = await supabase.from('clientes').select('id', { count: 'exact', head: true }).eq('negocio_id', negocio.id).not('telefono', 'is', null).or(SIN_NOMBRE)
    total = count ?? 0
  }
  let q = supabase.from('clientes').select('id, telefono').eq('negocio_id', negocio.id).not('telefono', 'is', null).or(SIN_NOMBRE).order('id').limit(LOTE_NOMBRES)
  if (desde) q = q.gt('id', desde)
  const { data: lote, error } = await q
  if (error) return vacio('No se pudieron leer los clientes')
  const filas = (lote ?? []) as { id: string; telefono: string }[]

  const r: AvanceNombres = { ok: true, total, revisados: filas.length, completados: 0, sinDato: 0, errores: 0, ultimo: filas.length ? filas[filas.length - 1].id : desde, hecho: filas.length < LOTE_NOMBRES }
  let claveMala = false
  const uno = async (f: { id: string; telefono: string }) => {
    const b = await nombreSuscriptor(cuenta.clave, f.telefono)
    if (!b.ok) { if (b.error === 'clave') claveMala = true; if (b.error === 'no_encontrado') r.sinDato++; else r.errores++; return }
    // sin caracteres de control, espacios juntados y un tope de largo; hace falta al menos una letra
    const nombre = (b.datos ?? '').replace(/[\u0000-\u001f\u007f]/g, ' ').replace(/\s+/g, ' ').trim().slice(0, MAX_NOMBRE)
    if (!/\p{L}/u.test(nombre)) { r.sinDato++; return }
    const { data, error: e } = await supabase.from('clientes').update({ nombre }).eq('id', f.id).eq('negocio_id', negocio.id).or(SIN_NOMBRE).select('id')
    if (e) r.errores++
    else if (data && data.length) r.completados++
  }
  // de a 4 a la vez para no saturar la API de BotConversa
  for (let i = 0; i < filas.length; i += 4) { await Promise.all(filas.slice(i, i + 4).map(uno)); if (claveMala) break }
  if (claveMala) return vacio('BotConversa rechazó la clave de la API (revisala en Configuración)')
  if (r.hecho) revalidatePath('/', 'layout')
  return r
}
