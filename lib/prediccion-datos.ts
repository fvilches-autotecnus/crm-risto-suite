import 'server-only'
import type { Contexto } from '@/lib/context'
import { cargarReglas } from '@/lib/aforo'
import { TZ_AR, hoyEn, sumarDias } from '@/lib/fechas'
import { calcularPrediccion, type Especial, type Prediccion, type ReservaMin } from '@/lib/prediccion'
import { ESTADOS_OCUPAN } from '@/lib/reservas'
import { createAdminClient } from '@/lib/supabase/server'

export const DIAS_PREDICCION = 14
const fechaAR = (iso: string) => new Intl.DateTimeFormat('en-CA', { timeZone: TZ_AR }).format(new Date(iso))
const PAGINA = 1000

export interface DatosPrediccion { pred: Prediccion; hoy: string; marcasDisponibles: boolean }

/**
 * Predicción de demanda de los próximos días para lo que está viendo el usuario (el negocio o la sede elegida).
 * Se lee con service_role: son solo totales y tienen que ser reales aunque el usuario vea una sola sede (igual que el aforo del día).
 */
export async function cargarPrediccion(ctx: Contexto): Promise<DatosPrediccion> {
  const { negocio, sede } = ctx
  const admin = createAdminClient()
  const hoy = hoyEn(negocio.zona_horaria)
  const desde = sumarDias(hoy, -7 * 12 - 14)
  const hasta = sumarDias(hoy, DIAS_PREDICCION)

  const reservas: ReservaMin[] = []
  for (let i = 0; i < 30; i++) {
    let q = admin.from('reservas').select('fecha, hora, ubicacion, sucursal_id, cantidad_personas, creado_en').eq('negocio_id', negocio.id).is('eliminado_en', null).in('estado', ESTADOS_OCUPAN).gte('fecha', desde).lte('fecha', hasta).order('fecha').order('id').range(i * PAGINA, (i + 1) * PAGINA - 1)
    if (sede) q = q.eq('sucursal_id', sede.id)
    const { data } = await q
    for (const r of data ?? []) reservas.push({ fecha: r.fecha as string, hora: r.hora as string | null, ubicacion: r.ubicacion as string | null, sucursal_id: r.sucursal_id as string | null, personas: Number(r.cantidad_personas ?? 0), creado: fechaAR(r.creado_en as string) })
    if ((data?.length ?? 0) < PAGINA) break
  }
  let ultimaQ = admin.from('reservas').select('creado_en').eq('negocio_id', negocio.id).is('eliminado_en', null).order('creado_en', { ascending: false }).limit(1)
  if (sede) ultimaQ = ultimaQ.eq('sucursal_id', sede.id)
  const { data: ult } = await ultimaQ
  const ultimaCreada = ult?.[0]?.creado_en ? fechaAR(ult[0].creado_en as string) : null

  // Aforo: las reglas con horario que corresponden a lo que se está viendo (los topes "total del día" no sirven para armar franjas)
  const reglas = (await cargarReglas(ctx)).filter((g) => g.hora_desde && g.hora_hasta && (!sede || !g.sucursal_id || g.sucursal_id === sede.id))

  // Días atípicos: marcados a mano > bloqueos de todo el día > shows
  const especiales = new Map<string, Especial>()
  const poner = (e: Especial, pisar: boolean) => { if (pisar || !especiales.has(e.fecha)) especiales.set(e.fecha, e) }
  const delSitio = (s: string | null) => !s || !sede || s === sede.id
  const { data: shows } = await admin.from('shows').select('fecha, titulo').eq('negocio_id', negocio.id).eq('visible', true).gte('fecha', desde).lte('fecha', hasta)
  for (const s of shows ?? []) poner({ id: null, fecha: s.fecha as string, tipo: 'evento', motivo: (s.titulo as string | null)?.slice(0, 120) ?? null, origen: 'show' }, false)
  const { data: bloqueos } = await admin.from('fechas_bloqueadas_reservas').select('fecha, motivo, hora_desde, ubicaciones, sucursal_id').eq('negocio_id', negocio.id).gte('fecha', desde).lte('fecha', hasta)
  for (const b of bloqueos ?? []) if (!b.hora_desde && !(b.ubicaciones as string[] | null)?.length && delSitio(b.sucursal_id as string | null)) poner({ id: null, fecha: b.fecha as string, tipo: 'cerrado', motivo: (b.motivo as string | null)?.slice(0, 120) ?? null, origen: 'bloqueo' }, true)
  const { data: marcas, error } = await admin.from('dias_especiales').select('id, fecha, tipo, motivo, sucursal_id').eq('negocio_id', negocio.id).gte('fecha', desde).lte('fecha', hasta).order('sucursal_id', { nullsFirst: true })
  const marcasDisponibles = !error
  for (const m of marcas ?? []) if (delSitio(m.sucursal_id as string | null)) poner({ id: m.id as string, fecha: m.fecha as string, tipo: m.tipo as 'evento' | 'cerrado', motivo: m.motivo as string | null, origen: 'manual' }, true)

  const pred = calcularPrediccion({ hoy, dias: DIAS_PREDICCION, reservas, reglas, especiales: [...especiales.values()], ultimaCreada })
  return { pred, hoy, marcasDisponibles }
}
