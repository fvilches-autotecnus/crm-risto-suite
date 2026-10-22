import { Suspense } from 'react'
import { getContexto } from '@/lib/context'
import { hoyEn, sumarDias } from '@/lib/fechas'
import { RESERVA_COLS, type Reserva } from '@/lib/reservas'
import { NuevaReservaBtn, ReservasTabla } from '@/components/reservas-ui'
import FiltrosReservas from '@/components/filtros-reservas'
import { cargarOpciones } from '@/lib/sedes'

type SP = { estado?: string; rango?: string; tipo?: string; q?: string; desde?: string; hasta?: string }

export default async function ReservasPage({ searchParams }: { searchParams: Promise<SP> }) {
  const ctx = await getContexto()
  const { supabase, negocio, sede } = ctx
  const op = await cargarOpciones(ctx)
  const sp = await searchParams
  const hoy = hoyEn(negocio.zona_horaria)
  const rango = sp.rango ?? 'hoy'

  let q = supabase.from('reservas').select(RESERVA_COLS).eq('negocio_id', negocio.id).is('eliminado_en', null)

  if (sede) q = q.eq('sucursal_id', sede.id)

  if (rango === 'hoy') q = q.eq('fecha', hoy)
  else if (rango === 'manana') q = q.eq('fecha', sumarDias(hoy, 1))
  else if (rango === '7d') q = q.gte('fecha', hoy).lte('fecha', sumarDias(hoy, 6))
  else if (rango === 'futuras') q = q.gte('fecha', hoy)
  else if (rango === 'rango') {
    if (sp.desde) q = q.gte('fecha', sp.desde)
    if (sp.hasta) q = q.lte('fecha', sp.hasta)
  }

  if (sp.estado === 'sin_confirmar') q = q.eq('estado', 'nueva')
  else if (sp.estado) q = q.eq('estado', sp.estado)
  if (sp.tipo) q = q.eq('tipo_reserva', sp.tipo)

  const busqueda = sp.q?.trim().replace(/[,()%*]/g, ' ')
  if (busqueda) q = q.or(`cliente_nombre.ilike.%${busqueda}%,cliente_telefono.ilike.%${busqueda}%`)

  const { data } = await q.order('fecha', { ascending: true, nullsFirst: true }).order('hora', { ascending: true }).limit(500)

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 md:flex-row md:items-start">
        {ctx.puedeEscribir && <div><NuevaReservaBtn fechaDefault={hoy} op={op} /></div>}
        <div className="min-w-0 flex-1">
          <Suspense><FiltrosReservas /></Suspense>
        </div>
      </div>
      <ReservasTabla reservas={(data ?? []) as Reserva[]} puedeEscribir={ctx.puedeEscribir} op={op} />
      {(data?.length ?? 0) === 500 && <p className="text-xs text-rs-muted">Mostrando las primeras 500 reservas — afiná los filtros para ver el resto.</p>}
    </div>
  )
}
