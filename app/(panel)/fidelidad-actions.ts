'use server'

import { revalidatePath } from 'next/cache'
import { getContexto } from '@/lib/context'
import type { ActionResult } from './actions'

const fail = (error: string): ActionResult => ({ ok: false, error })
const text = (fd: FormData, k: string) => String(fd.get(k) ?? '').trim()
const UUID = /^[0-9a-f-]{36}$/i
const refrescar = () => { revalidatePath('/fidelizacion'); revalidatePath('/reservas'); revalidatePath('/clientes', 'layout') }

async function permiso(admin: boolean) {
  const ctx = await getContexto()
  if (!ctx.modulosActivos.fidelizacion) return { ctx, error: 'Este negocio no tiene el módulo de Fidelización' }
  if (admin && !ctx.puedeAdministrar) return { ctx, error: 'Solo dueños y administradores pueden cambiar el programa de fidelización' }
  if (!admin && !ctx.puedeEscribir) return { ctx, error: 'Tu usuario es de solo lectura' }
  return { ctx, error: null as string | null }
}

export async function guardarConfigFidelidad(_prev: ActionResult | null, fd: FormData): Promise<ActionResult> {
  const { ctx, error } = await permiso(true); if (error) return fail(error)
  const criterio = text(fd, 'criterio'), desde = text(fd, 'contar_desde')
  if (!['confirmadas', 'asistencia'].includes(criterio)) return fail('Elegí qué cuenta como visita')
  if (!/^\d{4}-\d{2}-\d{2}$/.test(desde) || Number.isNaN(Date.parse(desde))) return fail('Indicá desde qué fecha se cuentan las visitas')
  const { error: e } = await ctx.supabase.from('fidelidad_config').upsert({ negocio_id: ctx.negocio.id, activo: fd.get('activo') === 'on', criterio, contar_desde: desde })
  if (e) return fail('No se pudo guardar')
  refrescar()
  return { ok: true }
}

export async function guardarReglaFidelidad(_prev: ActionResult | null, fd: FormData): Promise<ActionResult> {
  const { ctx, error } = await permiso(true); if (error) return fail(error)
  const id = text(fd, 'id'), nombre = text(fd, 'nombre').replace(/\s+/g, ' '), beneficio = text(fd, 'beneficio').replace(/\s+/g, ' ')
  const visitas = Number(text(fd, 'visitas')), venceTxt = text(fd, 'vence_dias'), vence = venceTxt ? Number(venceTxt) : null
  if (!nombre) return fail('Poné un nombre a la regla (ej. “Postre de regalo”)')
  if (nombre.length > 60) return fail('El nombre puede tener hasta 60 letras')
  if (!Number.isInteger(visitas) || visitas < 2 || visitas > 200) return fail('Las visitas tienen que ser un número entre 2 y 200')
  if (!beneficio) return fail('Indicá cuál es el premio')
  if (beneficio.length > 120) return fail('El premio puede tener hasta 120 letras')
  if (vence !== null && (!Number.isInteger(vence) || vence < 1 || vence > 3650)) return fail('El vencimiento tiene que ser de 1 a 3650 días (o vacío si no vence)')
  const datos = { nombre, visitas, repetir: text(fd, 'tipo') === 'cada', beneficio, vence_dias: vence, activa: fd.get('activa') === 'on' }
  if (id) {
    if (!UUID.test(id)) return fail('Regla no válida')
    const { error: e } = await ctx.supabase.from('fidelidad_reglas').update(datos).eq('id', id).eq('negocio_id', ctx.negocio.id)
    if (e) return fail('No se pudo guardar la regla')
  } else {
    const { error: e } = await ctx.supabase.from('fidelidad_reglas').insert({ ...datos, negocio_id: ctx.negocio.id })
    if (e) return fail('No se pudo crear la regla')
  }
  refrescar()
  return { ok: true }
}

export async function alternarReglaFidelidad(id: string): Promise<ActionResult> {
  const { ctx, error } = await permiso(true); if (error) return fail(error)
  if (!UUID.test(id)) return fail('Regla no válida')
  const { data } = await ctx.supabase.from('fidelidad_reglas').select('activa').eq('id', id).eq('negocio_id', ctx.negocio.id).maybeSingle()
  if (!data) return fail('Regla no encontrada')
  const { error: e } = await ctx.supabase.from('fidelidad_reglas').update({ activa: !data.activa }).eq('id', id).eq('negocio_id', ctx.negocio.id)
  if (e) return fail('No se pudo cambiar')
  refrescar()
  return { ok: true }
}

export async function eliminarReglaFidelidad(id: string): Promise<ActionResult> {
  const { ctx, error } = await permiso(true); if (error) return fail(error)
  if (!UUID.test(id)) return fail('Regla no válida')
  const { count } = await ctx.supabase.from('fidelidad_premios').select('id', { count: 'exact', head: true }).eq('regla_id', id).eq('negocio_id', ctx.negocio.id)
  if (count) return fail(`Esta regla ya entregó ${count} premio${count === 1 ? '' : 's'}: desactivala en vez de borrarla, así no se pierde el historial ni se vuelven a entregar`)
  const { error: e } = await ctx.supabase.from('fidelidad_reglas').delete().eq('id', id).eq('negocio_id', ctx.negocio.id)
  if (e) return fail('No se pudo borrar la regla')
  refrescar()
  return { ok: true }
}

/** Emite ya los premios que corresponden (el resto del tiempo se emiten solos al cambiar una reserva y todas las madrugadas). */
export async function emitirPremiosAhora(): Promise<ActionResult> {
  const { ctx, error } = await permiso(false); if (error) return fail(error)
  if (!(ctx.puedeAdministrar || ctx.rol === 'encargado')) return fail('Solo dueños, administradores y encargados pueden emitir premios')
  const { data, error: e } = await ctx.supabase.rpc('fidelidad_emitir_ahora', { p_negocio: ctx.negocio.id })
  if (e) return fail('No se pudieron emitir los premios')
  refrescar()
  return { ok: true, cantidad: Number(data) || 0 }
}

/** Marca (o desmarca) que el cliente llegó a su reserva. Cuenta como visita cuando el programa usa el criterio “Llegó”. */
export async function marcarLlego(reservaId: string, llego: boolean): Promise<ActionResult> {
  const ctx = await getContexto()
  if (!ctx.puedeEscribir) return fail('Tu usuario es de solo lectura')
  if (!UUID.test(reservaId)) return fail('Reserva no válida')
  const { data, error } = await ctx.supabase.from('reservas').update({ asistio_en: llego ? new Date().toISOString() : null }).eq('id', reservaId).eq('negocio_id', ctx.negocio.id).select('id').maybeSingle()
  if (error || !data) return fail('No se pudo marcar la reserva')
  refrescar()
  return { ok: true }
}
