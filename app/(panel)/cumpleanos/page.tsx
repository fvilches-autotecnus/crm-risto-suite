import { ThOrden } from '@/components/th-orden'
import { ambos, leerOrden } from '@/lib/orden'
import Link from 'next/link'
import { redirect } from 'next/navigation'
import { Cake } from 'lucide-react'
import { GraficoColumnas, TarjetaGrafico } from '@/components/charts'
import { Tile } from '@/components/dashboard-ui'
import { AgregarCumpleBtn, EditarCumple } from '@/components/cumples-ui'
import OrdenSelect from '@/components/orden-select'
import Paginacion from '@/components/paginacion'
import { EstadoVacio } from '@/components/ui'
import { PERIODOS_CUMPLE, edadQueCumple, proximoCumple, rangoPeriodo, textoCumple, textoFaltan, type PeriodoCumple } from '@/lib/cumples'
import { getContexto } from '@/lib/context'
import { fechaHoraLarga, hoyEn } from '@/lib/fechas'
import { numPagina, paginar } from '@/lib/paginacion'

const ORDENES = [
  { value: 'cumple_asc', label: 'Cumpleaños: próximos primero' },
  { value: 'cumple_desc', label: 'Cumpleaños: más lejanos primero' },
  { value: 'alta_desc', label: 'Alta: más recientes primero' },
  { value: 'alta_asc', label: 'Alta: más antiguas primero' },
  { value: 'nombre_asc', label: 'Nombre (A–Z)' },
  { value: 'nombre_desc', label: 'Nombre (Z–A)' },
]
const ORDENES_VALIDOS = ambos('cumple', 'alta', 'nombre', 'telefono', 'edad')

export default async function CumpleanosPage({ searchParams }: { searchParams: Promise<{ periodo?: string; orden?: string; pagina?: string }> }) {
  const ctx = await getContexto()
  if (!ctx.modulosActivos.cumpleanos) redirect('/')
  const { supabase, negocio } = ctx
  const sp = await searchParams
  const periodo = (PERIODOS_CUMPLE.some((p) => p.value === sp.periodo) ? sp.periodo : 'semana') as PeriodoCumple
  const orden = leerOrden(sp.orden === 'proximo' ? 'cumple_asc' : sp.orden, ORDENES_VALIDOS, 'cumple_asc')
  const hoy = hoyEn(negocio.zona_horaria)

  const { data: clientes } = await supabase.from('clientes').select('id, nombre, telefono, cumple_dia, cumple_mes, fecha_nacimiento, creado_en').eq('negocio_id', negocio.id).not('cumple_mes', 'is', null).limit(5000)

  const rango = rangoPeriodo(periodo, hoy)
  const filas = (clientes ?? [])
    .map((c) => ({ ...c, prox: proximoCumple(c.cumple_dia!, c.cumple_mes!, hoy) }))
    .filter((c) => !rango || (c.prox.fecha >= rango.desde && c.prox.fecha <= rango.hasta))
    .sort((a, b) => {
      // cada columna ordena por su dato; los empates se resuelven por cercanía del cumpleaños y nombre. Sin edad (no cargaron el año) va siempre al final.
      const sentido = orden.endsWith('_desc') ? -1 : 1
      const campo = orden.slice(0, orden.lastIndexOf('_'))
      let r = 0
      if (campo === 'alta') r = a.creado_en.localeCompare(b.creado_en)
      else if (campo === 'nombre') r = a.nombre.localeCompare(b.nombre, 'es')
      else if (campo === 'telefono') r = (a.telefono ?? '').localeCompare(b.telefono ?? '')
      else if (campo === 'edad') {
        if (!a.fecha_nacimiento !== !b.fecha_nacimiento) return a.fecha_nacimiento ? -1 : 1
        if (a.fecha_nacimiento && b.fecha_nacimiento) r = edadQueCumple(a.fecha_nacimiento, a.prox.fecha) - edadQueCumple(b.fecha_nacimiento, b.prox.fecha)
      } else r = a.prox.dias - b.prox.dias
      return sentido * r || a.prox.dias - b.prox.dias || a.nombre.localeCompare(b.nombre, 'es')
    })

  const pg = paginar(filas, numPagina(sp.pagina))

  // Cumpleaños por mes (de todos los clientes con cumpleaños cargado, sin importar el período elegido)
  const MESES = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic']
  const MESES_LARGO = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre']
  const porMes = MESES.map((etiqueta, i) => ({ etiqueta, valor: (clientes ?? []).filter((c) => c.cumple_mes === i + 1).length }))
  const totalCumples = (clientes ?? []).length
  const mesActual = Number(hoy.slice(5, 7))
  const maxMes = Math.max(...porMes.map((m) => m.valor), 0)
  const mesTop = porMes.findIndex((m) => m.valor === maxMes)
  const link = (p: string) => `/cumpleanos?periodo=${p}${orden !== 'cumple_asc' ? `&orden=${orden}` : ''}`

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div className="animate-fade-up">
          <h1 className="flex items-center gap-2 text-xl font-bold sm:text-2xl"><Cake className="text-rs-lime" size={22} />Cumpleaños</h1>
          <p className="text-sm text-rs-muted">Próximos cumpleaños de clientes</p>
        </div>
        {ctx.puedeEscribir && <AgregarCumpleBtn />}
      </div>

      {totalCumples > 0 && (
        <>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3 sm:gap-4">
            <Tile i={0} valor={totalCumples} etiqueta="Con cumpleaños cargado" color="text-rs-text" sub="Clientes en total" />
            <Tile i={1} valor={porMes[mesActual - 1].valor} etiqueta={`Cumplen en ${MESES_LARGO[mesActual - 1]}`} color="text-rs-lime" sub="Este mes" />
            <Tile i={2} valor={maxMes} etiqueta={`Mes con más: ${MESES_LARGO[mesTop]}`} color="text-rs-ok" sub={`${Math.round((maxMes / totalCumples) * 100)}% de todos los cumpleaños`} />
          </div>
          <TarjetaGrafico i={3} titulo="Cumpleaños por mes" columnas={['Mes', 'Cumpleaños']} filas={porMes.map((m) => [m.etiqueta, m.valor])}>
            <GraficoColumnas datos={porMes} unidad="cumpleaños" titulo="Cumpleaños por mes" />
          </TarjetaGrafico>
        </>
      )}

      <div className="flex flex-wrap items-center gap-2">
        {PERIODOS_CUMPLE.map((p) => <Link key={p.value} href={link(p.value)} className={'btn btn-sm ' + (periodo === p.value ? 'btn-primary' : '')}>{p.label}</Link>)}
        <div className="ml-auto"><OrdenSelect opciones={ORDENES} porDefecto="cumple_asc" /></div>
      </div>

      <p className="text-sm text-rs-muted"><span className="font-semibold text-rs-text">{filas.length}</span> cumpleaños en este período</p>

      {filas.length === 0 ? (
        <div className="card"><EstadoVacio icono={<Cake size={26} />} titulo="No hay cumpleaños en este período" texto="Los cumpleaños se cargan solos cuando una reserva trae la fecha, o a mano con “Agregar cumpleaños”." /></div>
      ) : (
        <div className="card overflow-x-auto">
          <table className="w-full min-w-[720px]">
            <thead className="border-b border-rs-border"><tr><ThOrden ruta="/cumpleanos" params={sp} campo="nombre" orden={orden}>Nombre</ThOrden><ThOrden ruta="/cumpleanos" params={sp} campo="telefono" orden={orden}>Teléfono</ThOrden><ThOrden ruta="/cumpleanos" params={sp} campo="cumple" orden={orden}>Cumpleaños</ThOrden><ThOrden ruta="/cumpleanos" params={sp} campo="edad" orden={orden} primero="desc">Edad</ThOrden><ThOrden ruta="/cumpleanos" params={sp} campo="alta" orden={orden} primero="desc">Alta</ThOrden>{ctx.puedeEscribir && <th className="th text-right">Acciones</th>}</tr></thead>
            <tbody>
              {pg.items.map((c, i) => (
                <tr key={c.id} className="reveal border-b border-rs-border/60 transition-colors last:border-0 hover:bg-rs-raised/50" style={{ ['--i' as string]: Math.min(i, 12) }}>
                  <td className="td font-medium"><Link href={`/clientes/${c.id}`} className="transition-colors hover:text-rs-lime">{c.nombre}</Link></td>
                  <td className="td text-rs-muted">{c.telefono ?? '—'}</td>
                  <td className="td"><span className="font-semibold">{textoCumple(c.cumple_dia!, c.cumple_mes!)}</span> <span className={'text-xs ' + (c.prox.dias <= 1 ? 'font-semibold text-rs-lime' : 'text-rs-muted')}>· {textoFaltan(c.prox.dias)}</span></td>
                  <td className="td whitespace-nowrap">{c.fecha_nacimiento ? <span title="Edad que cumple"><span className="font-semibold">{edadQueCumple(c.fecha_nacimiento, c.prox.fecha)}</span> <span className="text-xs text-rs-muted">años</span></span> : <span className="text-rs-muted">—</span>}</td>
                  <td className="td whitespace-nowrap text-xs text-rs-muted">{fechaHoraLarga(c.creado_en)}</td>
                  {ctx.puedeEscribir && <td className="td"><div className="flex justify-end gap-1.5"><EditarCumple cliente={{ id: c.id, nombre: c.nombre, dia: c.cumple_dia, mes: c.cumple_mes, anio: c.fecha_nacimiento ? Number(c.fecha_nacimiento.slice(0, 4)) : null }} /></div></td>}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      <Paginacion ruta="/cumpleanos" params={sp} {...pg} />
    </div>
  )
}
