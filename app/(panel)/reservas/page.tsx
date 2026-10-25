import { Suspense } from 'react'
import { redirect } from 'next/navigation'
import { NuevaReservaBtn, ReservasTabla } from '@/components/reservas-ui'
import FiltrosReservas from '@/components/filtros-reservas'
import { getContexto } from '@/lib/context'
import { hoyEn, sumarDias } from '@/lib/fechas'
import { RESERVA_COLS, type Reserva } from '@/lib/reservas'
import Paginacion from '@/components/paginacion'
import { numPagina, paginar } from '@/lib/paginacion'
import { cargarOpciones } from '@/lib/sedes'
import { usaAsistencia } from '@/lib/fidelidad-servidor'
import { mesasPorReserva } from '@/lib/mesas-servidor'
import SolicitudesWeb, { type SolicitudWebUI } from '@/components/solicitudes-web'

type SP = { pagina?: string; estado?: string; rango?: string; tipo?: string; ubic?: string; q?: string; desde?: string; hasta?: string; orden?: string }

export default async function ReservasPage({ searchParams }: { searchParams: Promise<SP> }) {
  const ctx = await getContexto()
  if (!ctx.modulosActivos.reservas) redirect('/')
  const { supabase, negocio, sede } = ctx
  const op = await cargarOpciones(ctx)
  const asistencia = await usaAsistencia(ctx)
  const sp = await searchParams
  const hoy = hoyEn(negocio.zona_horaria)
  const rango = sp.rango ?? 'hoy'
  const orden = ['alta_asc', 'fecha_asc', 'fecha_desc'].includes(sp.orden ?? '') ? sp.orden! : 'alta_desc'

  // Todos los filtros menos "estado": así se pueden mostrar los conteos por estado de lo que se está viendo.
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
  if (sp.tipo) q = q.eq('tipo_reserva', sp.tipo)
  if (sp.ubic) q = q.eq('ubicacion', sp.ubic)
  const busqueda = sp.q?.trim().replace(/[,()%*]/g, ' ')
  if (busqueda) q = q.or(`cliente_nombre.ilike.%${busqueda}%,cliente_telefono.ilike.%${busqueda}%`)

  const ordenado = orden === 'alta_desc' ? q.order('creado_en', { ascending: false })
    : orden === 'alta_asc' ? q.order('creado_en', { ascending: true })
    : orden === 'fecha_asc' ? q.order('fecha', { ascending: true, nullsFirst: true }).order('hora', { ascending: true })
    : q.order('fecha', { ascending: false, nullsFirst: false }).order('hora', { ascending: false })
  const { data } = await ordenado.limit(20000)
  const todas = (data ?? []) as Reserva[]

  const conteos: Record<string, number> = {}
  for (const r of todas) conteos[r.estado] = (conteos[r.estado] ?? 0) + 1
  const filtradas = sp.estado ? todas.filter((r) => r.estado === sp.estado) : todas
  const pg = paginar(filtradas, numPagina(sp.pagina))
  const mostradas = pg.items

  // Solicitudes del sitio web que todavía esperan el mensaje de WhatsApp (no son reservas: no ocupan mesa ni aforo)
  const { data: sols } = await supabase.from('reservas_web_solicitudes').select('id, codigo, nombre, fecha, hora, personas, ubicacion, tipo_reserva, observaciones, mesas, creado_en')
    .eq('negocio_id', negocio.id).is('reserva_id', null).gte('creado_en', new Date(Date.now() - 48 * 3600 * 1000).toISOString()).order('creado_en', { ascending: false }).limit(100)
  const idsMesas = [...new Set((sols ?? []).flatMap((s) => (s.mesas as string[] | null) ?? []))]
  const numerosMesa: Record<string, string> = {}
  if (idsMesas.length) for (const m of (await supabase.from('mesas').select('id, numero').in('id', idsMesas)).data ?? []) numerosMesa[m.id as string] = m.numero as string
  const solicitudes: SolicitudWebUI[] = (sols ?? []).map((s) => ({ ...s, mesas: ((s.mesas as string[] | null) ?? []).map((i) => numerosMesa[i]).filter(Boolean).join(' + ') || null })) as SolicitudWebUI[]

  // Opciones de los filtros: lo que ya existe (tipos usados + ubicaciones configuradas o usadas)
  const ubicaciones = [...new Set([...op.ubicaciones.map((u) => u.nombre), ...todas.map((r) => r.ubicacion).filter(Boolean) as string[]])].sort()

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3">
        <h1 className="text-xl font-bold sm:text-2xl">Reservas</h1>
        {ctx.puedeEscribir && <NuevaReservaBtn fechaDefault={hoy} op={op} />}
      </div>
      <SolicitudesWeb solicitudes={solicitudes} puedeEscribir={ctx.puedeEscribir} />
      <Suspense><FiltrosReservas conteos={conteos} tipos={op.tipos} ubicaciones={ubicaciones} total={filtradas.length} /></Suspense>
      <ReservasTabla reservas={mostradas} puedeEscribir={ctx.puedeEscribir} op={op} asistencia={asistencia} mesas={await mesasPorReserva(ctx, mostradas.map((r) => r.id))} />
      <Paginacion ruta="/reservas" params={sp} {...pg} />
    </div>
  )
}
