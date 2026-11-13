import { ambos, leerOrden } from '@/lib/orden'
import { Suspense } from 'react'
import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import { COLUMNAS_COOKIE, leerColumnas } from '@/lib/columnas-reservas'
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

const ORDENES_VALIDOS = ambos('alta', 'fecha', 'hora', 'nombre', 'telefono', 'personas', 'tipo', 'ubicacion')

export default async function ReservasPage({ searchParams }: { searchParams: Promise<SP> }) {
  const ctx = await getContexto()
  if (!ctx.modulosActivos.reservas) redirect('/')
  const { supabase, negocio, sede } = ctx
  const op = await cargarOpciones(ctx)
  const asistencia = await usaAsistencia(ctx)
  const sp = await searchParams
  const hoy = hoyEn(negocio.zona_horaria)
  const rango = sp.rango ?? 'hoy'
  const orden = leerOrden(sp.orden, ORDENES_VALIDOS, 'alta_desc')

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
  const busqueda = sp.q?.trim().replace(/[,()%*#]/g, ' ').trim()
  // también se busca por número de reserva ("12" o "#12"): el de la sede si numera aparte, si no el del negocio
  const nroBuscado = /^\d{1,9}$/.test(busqueda ?? '') ? Number(busqueda) : null
  if (busqueda) q = q.or(`cliente_nombre.ilike.%${busqueda}%,cliente_telefono.ilike.%${busqueda}%${nroBuscado !== null ? `,numero_sede.eq.${nroBuscado},and(numero_sede.is.null,numero.eq.${nroBuscado})` : ''}`)

  // orden pedido (?orden=campo_asc|campo_desc): cada campo se ordena por su columna y desempata por el otro dato que lo acompaña
  const asc = orden.endsWith('_asc')
  const campoOrden = orden.slice(0, orden.lastIndexOf('_'))
  const ordenado = campoOrden === 'alta' ? q.order('creado_en', { ascending: asc })
    : campoOrden === 'fecha' ? q.order('fecha', { ascending: asc, nullsFirst: asc }).order('hora', { ascending: asc })
    : campoOrden === 'hora' ? q.order('hora', { ascending: asc }).order('fecha', { ascending: asc })
    : campoOrden === 'nombre' ? q.order('cliente_nombre', { ascending: asc }).order('fecha', { ascending: false })
    : campoOrden === 'telefono' ? q.order('cliente_telefono', { ascending: asc }).order('fecha', { ascending: false })
    : campoOrden === 'personas' ? q.order('cantidad_personas', { ascending: asc }).order('fecha', { ascending: false })
    : campoOrden === 'tipo' ? q.order('tipo_reserva', { ascending: asc }).order('fecha', { ascending: false })
    : q.order('ubicacion', { ascending: asc, nullsFirst: false }).order('fecha', { ascending: false })
  const { data } = await ordenado.limit(20000)
  const todas = (data ?? []) as Reserva[]

  const conteos: Record<string, number> = {}
  for (const r of todas) conteos[r.estado] = (conteos[r.estado] ?? 0) + 1
  const filtradas = sp.estado ? todas.filter((r) => r.estado === sp.estado) : todas
  const pg = paginar(filtradas, numPagina(sp.pagina))
  const mostradas = pg.items

  const { data: cfgWeb } = await supabase.from('reservas_web_config').select('validez_horas').eq('negocio_id', negocio.id).maybeSingle()
  const validezHoras = (cfgWeb?.validez_horas as number | undefined) ?? 48
  // Solicitudes del sitio web que todavía esperan el mensaje de WhatsApp (no son reservas: no ocupan mesa ni aforo)
  let qSols = supabase.from('reservas_web_solicitudes').select('id, codigo, nombre, fecha, hora, personas, ubicacion, cualquier_ubicacion, tipo_reserva, observaciones, mesas, creado_en, sucursal_id, cumple_dia, cumple_mes')
    .eq('negocio_id', negocio.id).is('reserva_id', null).gte('creado_en', new Date(Date.now() - validezHoras * 3600 * 1000).toISOString()).order('creado_en', { ascending: false }).limit(100)
  if (sede) qSols = qSols.eq('sucursal_id', sede.id)   // con una sede elegida en el selector, solo las de esa sede
  const { data: sols } = await qSols
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
      <SolicitudesWeb solicitudes={solicitudes} puedeEscribir={ctx.puedeEscribir} etiquetasTipo={op.tiposEtiquetas} sedes={op.nombresSede} />
      <Suspense><FiltrosReservas conteos={conteos} tipos={op.tipos} etiquetasTipo={op.tiposEtiquetas} ubicaciones={ubicaciones} total={filtradas.length} /></Suspense>
      <ReservasTabla reservas={mostradas} puedeEscribir={ctx.puedeEscribir} op={op} asistencia={asistencia} mesas={await mesasPorReserva(ctx, mostradas.map((r) => r.id))} columnas={leerColumnas((await cookies()).get(COLUMNAS_COOKIE)?.value)} orden={{ ruta: '/reservas', params: sp, actual: orden }} />
      <Paginacion ruta="/reservas" params={sp} {...pg} />
    </div>
  )
}
