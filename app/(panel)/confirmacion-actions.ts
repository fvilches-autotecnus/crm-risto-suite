'use server'

import { revalidatePath } from 'next/cache'
import { falloAlcance } from '@/lib/config-tecnica'
import { getContexto } from '@/lib/context'
import { createAdminClient } from '@/lib/supabase/server'
import type { ReglaConfirmacion, ResultadoConfirmacion } from '@/lib/confirmacion'
import type { ActionResult } from './actions'

const fail = (error: string): ActionResult => ({ ok: false, error })
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
const FECHA = /^\d{4}-\d{2}-\d{2}$/
const RES = ['confirmada', 'nueva']

/** Guarda cómo entran las reservas: el resultado por defecto y las excepciones (en orden: manda la primera que coincide). */
export async function guardarConfirmacion(defecto: ResultadoConfirmacion, reglas: Omit<ReglaConfirmacion, 'uid'>[]): Promise<ActionResult> {
  const ctx = await getContexto()
  if (!ctx.modulosActivos.reservas) return fail('Este negocio no tiene el módulo Reservas')
  if (!ctx.puedeAdministrar) return fail('Solo dueños y administradores pueden cambiar la confirmación de reservas')
  { const e = falloAlcance(ctx); if (e) return fail(e) }
  if (!RES.includes(defecto)) return fail('El resultado por defecto no es válido')
  if (!Array.isArray(reglas) || reglas.length > 60) return fail('Hasta 60 excepciones')
  const filas: Record<string, unknown>[] = []
  for (const [i, r] of reglas.entries()) {
    const n = i + 1
    if (!RES.includes(r.resultado)) return fail(`Excepción ${n}: elegí qué pasa con la reserva`)
    if (r.sucursal_id && (!UUID.test(r.sucursal_id) || !ctx.sedesTodas.some((s) => s.id === r.sucursal_id))) return fail(`Excepción ${n}: la sede no es válida`)
    if (r.tipo_reserva && !/^[a-z0-9_]{1,40}$/.test(r.tipo_reserva)) return fail(`Excepción ${n}: el tipo de reserva no es válido`)
    if (!!r.fecha_desde !== !!r.fecha_hasta) return fail(`Excepción ${n}: completá las dos fechas (para un solo día, la misma en ambas)`)
    if (r.fecha_desde && (!FECHA.test(r.fecha_desde) || !FECHA.test(String(r.fecha_hasta)))) return fail(`Excepción ${n}: las fechas no son válidas`)
    if (r.fecha_desde && r.fecha_desde > String(r.fecha_hasta)) return fail(`Excepción ${n}: la fecha “hasta” no puede ser anterior a la “desde”`)
    const ent = (v: unknown) => (v === null || v === undefined || v === '' ? null : Number(v))
    const pmin = ent(r.personas_min), pmax = ent(r.personas_max)
    for (const v of [pmin, pmax]) if (v !== null && (!Number.isInteger(v) || v < 1 || v > 1000)) return fail(`Excepción ${n}: la cantidad de personas va de 1 en adelante`)
    if (pmin !== null && pmax !== null && pmin > pmax) return fail(`Excepción ${n}: “desde” no puede ser mayor que “hasta” en las personas`)
    const dias = [...new Set((r.dias_semana ?? []).map(Number).filter((d) => Number.isInteger(d) && d >= 0 && d <= 6))].sort()
    const nota = String(r.nota ?? '').trim().slice(0, 120)
    filas.push({
      negocio_id: ctx.negocio.id, orden: i, activo: r.activo !== false, sucursal_id: r.sucursal_id || null, tipo_reserva: r.tipo_reserva || null,
      fecha_desde: r.fecha_desde || null, fecha_hasta: r.fecha_hasta || null, dias_semana: dias.length > 0 && dias.length < 7 ? dias : null,
      personas_min: pmin, personas_max: pmax, resultado: r.resultado, nota: nota || null,
    })
  }
  const admin = createAdminClient()   // reserva_estado_inicial no está entre las columnas que el panel puede escribir; ya validamos el permiso
  const { data: viejas } = await ctx.supabase.from('reservas_confirmacion_reglas').select('id').eq('negocio_id', ctx.negocio.id)
  if (filas.length > 0) {
    const { error } = await ctx.supabase.from('reservas_confirmacion_reglas').insert(filas)
    if (error) return fail('No se pudieron guardar las excepciones')
  }
  const { error: e2 } = await admin.from('negocios').update({ reserva_estado_inicial: defecto }).eq('id', ctx.negocio.id)
  if (e2) return fail('No se pudo guardar el resultado por defecto')
  const ids = (viejas ?? []).map((v) => v.id as string)
  if (ids.length > 0) await ctx.supabase.from('reservas_confirmacion_reglas').delete().in('id', ids)   // recién ahora, así nunca queda sin reglas
  revalidatePath('/reservas')
  return { ok: true }
}
