'use server'

import { revalidatePath } from 'next/cache'
import { getContexto } from '@/lib/context'
import type { ActionResult } from './actions'

const fail = (error: string): ActionResult => ({ ok: false, error })
const UUID = /^[0-9a-f-]{36}$/i
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
