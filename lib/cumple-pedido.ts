import 'server-only'
import { createAdminClient } from '@/lib/supabase/server'
import { cumpleValido, fechaNacimiento } from '@/lib/cumples'

export interface CumpleCrudo { dia?: unknown; mes?: unknown; anio?: unknown }

/** Lo que mandó el formulario → día, mes y año (opcional) válidos, o null si no dejó el cumpleaños o no sirve. Nunca hace fallar el pedido. */
export function leerCumple(c: CumpleCrudo): { dia: number; mes: number; anio: number | null } | null {
  const dia = Number(c.dia), mes = Number(c.mes), anio = String(c.anio ?? '').trim() === '' ? null : Number(c.anio)
  if (!cumpleValido(dia, mes)) return null
  return { dia, mes, anio: anio !== null && Number.isInteger(anio) ? anio : null }
}

/**
 * Deja el cumpleaños del pedido en la ficha del cliente, igual que las reservas: pisa el día y el mes; con año arma la fecha de nacimiento completa y
 * sin año conserva el que ya tenía. Solo si el negocio pide el cumpleaños en pedidos. Best-effort: los errores solo se loguean.
 */
export async function guardarCumplePedido(negocioId: string, pedidoId: string, cumple: { dia: number; mes: number; anio: number | null }) {
  try {
    const admin = createAdminClient()
    const { data: cfg } = await admin.from('pedidos_config').select('pedir_cumple').eq('negocio_id', negocioId).maybeSingle()
    if (cfg?.pedir_cumple !== true) return
    const { data: p } = await admin.from('pedidos').select('cliente_id').eq('id', pedidoId).eq('negocio_id', negocioId).maybeSingle()
    if (!p?.cliente_id) return
    const { data: c } = await admin.from('clientes').select('fecha_nacimiento').eq('id', p.cliente_id).eq('negocio_id', negocioId).maybeSingle()
    const previa = (c?.fecha_nacimiento as string | null) ?? null
    const anioPrevio = previa ? Number(previa.slice(0, 4)) : null
    const fn = fechaNacimiento(cumple.anio, cumple.mes, cumple.dia) ?? fechaNacimiento(anioPrevio, cumple.mes, cumple.dia) ?? previa
    await admin.from('clientes').update({ cumple_dia: cumple.dia, cumple_mes: cumple.mes, fecha_nacimiento: fn }).eq('id', p.cliente_id).eq('negocio_id', negocioId)
  } catch (e) {
    console.error('[cumple del pedido] no se pudo guardar:', e)
  }
}
