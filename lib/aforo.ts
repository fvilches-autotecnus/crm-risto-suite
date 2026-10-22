import 'server-only'
import type { Contexto } from '@/lib/context'
import { createAdminClient } from '@/lib/supabase/server'
import { ESTADOS_OCUPAN } from '@/lib/reservas'

/** Una regla de aforo: tope de personas para una sede / ubicación / franja horaria (null = todas / todo el día). */
export interface ReglaAforo {
  id: string | null            // null = tope "total por día" del negocio o de la sede (no es una fila de `aforos`)
  etiqueta: string
  sucursal_id: string | null
  ubicacion: string | null
  hora_desde: string | null    // 'HH:MM:SS'
  hora_hasta: string | null
  maximo: number
}
export interface UsoAforo extends ReglaAforo { usado: number }

const hhmm = (h: string | null) => (h ? h.slice(0, 5) : '')
const hms = (h: string) => (h.length === 5 ? h + ':00' : h)

export function etiquetaRegla(r: Pick<ReglaAforo, 'sucursal_id' | 'ubicacion' | 'hora_desde' | 'hora_hasta'>, nombreSede: (id: string) => string): string {
  const partes: string[] = []
  if (r.sucursal_id) partes.push(nombreSede(r.sucursal_id))
  if (r.ubicacion) partes.push(r.ubicacion)
  partes.push(r.hora_desde && r.hora_hasta ? `${hhmm(r.hora_desde)}–${hhmm(r.hora_hasta)}` : 'todo el día')
  return partes.length === 1 && !r.sucursal_id && !r.ubicacion && !r.hora_desde ? 'Total del día' : partes.join(' · ')
}

/** Reglas del negocio: las cargadas en `aforos` + los topes totales (negocio y sede) que ya existían. */
export async function cargarReglas(ctx: Contexto): Promise<ReglaAforo[]> {
  const nombre = (id: string) => ctx.sedesTodas.find((x) => x.id === id)?.nombre ?? '—'
  const { data } = await createAdminClient().from('aforos').select('id, sucursal_id, ubicacion, hora_desde, hora_hasta, maximo').eq('negocio_id', ctx.negocio.id).order('creado_en')
  const reglas: ReglaAforo[] = (data ?? []).map((r) => ({ ...r, etiqueta: etiquetaRegla(r, nombre) }))
  if (ctx.negocio.aforo_maximo_reservas) reglas.unshift({ id: null, etiqueta: 'Total del día', sucursal_id: null, ubicacion: null, hora_desde: null, hora_hasta: null, maximo: ctx.negocio.aforo_maximo_reservas })
  for (const s of ctx.sedesTodas) if (s.aforo_maximo_reservas) reglas.push({ id: null, etiqueta: `Total del día · ${s.nombre}`, sucursal_id: s.id, ubicacion: null, hora_desde: null, hora_hasta: null, maximo: s.aforo_maximo_reservas })
  return reglas
}

export interface DatosReserva { sucursal_id: string | null; ubicacion: string | null; hora: string | null }

export function aplica(r: ReglaAforo, d: DatosReserva): boolean {
  if (r.sucursal_id && r.sucursal_id !== d.sucursal_id) return false
  if (r.ubicacion && r.ubicacion !== d.ubicacion) return false
  if (r.hora_desde && r.hora_hasta) {
    if (!d.hora) return false                       // "a coordinar": todavía no ocupa ninguna franja
    const h = hms(d.hora)
    if (!(h >= r.hora_desde && h < r.hora_hasta)) return false
  }
  return true
}

/** Personas ya reservadas (nueva o confirmada) ese día, por regla. Se lee con service_role: son solo totales y deben ser reales aunque el usuario vea una sola sede. */
export async function usoPorRegla(ctx: Contexto, fecha: string, reglas: ReglaAforo[], excluirReservaId?: string): Promise<UsoAforo[]> {
  const { data } = await createAdminClient()
    .from('reservas')
    .select('id, sucursal_id, ubicacion, hora, cantidad_personas')
    .eq('negocio_id', ctx.negocio.id).eq('fecha', fecha).is('eliminado_en', null).in('estado', ESTADOS_OCUPAN)
  const filas = (data ?? []).filter((r) => r.id !== excluirReservaId)
  return reglas.map((g) => ({ ...g, usado: filas.filter((r) => aplica(g, r)).reduce((s, r) => s + (r.cantidad_personas ?? 0), 0) }))
}

export interface ChequeoAforo { etiqueta: string; usado: number; maximo: number; despues: number; excede: boolean }

/** Cómo quedarían las reglas que le corresponden a una reserva nueva (o editada) de `personas` personas. */
export async function chequearReserva(ctx: Contexto, datos: DatosReserva & { fecha: string; personas: number; excluirId?: string }): Promise<ChequeoAforo[]> {
  const reglas = (await cargarReglas(ctx)).filter((g) => aplica(g, datos))
  if (!reglas.length) return []
  const uso = await usoPorRegla(ctx, datos.fecha, reglas, datos.excluirId)
  return uso.map((u) => ({ etiqueta: u.etiqueta, usado: u.usado, maximo: u.maximo, despues: u.usado + datos.personas, excede: u.usado + datos.personas > u.maximo }))
}
