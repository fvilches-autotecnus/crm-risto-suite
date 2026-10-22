import Link from 'next/link'
import { redirect } from 'next/navigation'
import { Cake } from 'lucide-react'
import { AgregarCumpleBtn, EditarCumple } from '@/components/cumples-ui'
import OrdenSelect from '@/components/orden-select'
import { EstadoVacio } from '@/components/ui'
import { PERIODOS_CUMPLE, edadQueCumple, proximoCumple, rangoPeriodo, textoCumple, textoFaltan, type PeriodoCumple } from '@/lib/cumples'
import { getContexto } from '@/lib/context'
import { fechaHoraLarga, hoyEn } from '@/lib/fechas'

const ORDENES = [
  { value: 'proximo', label: 'Cumpleaños: próximos primero' },
  { value: 'alta_desc', label: 'Alta: más recientes primero' },
  { value: 'alta_asc', label: 'Alta: más antiguas primero' },
]

export default async function CumpleanosPage({ searchParams }: { searchParams: Promise<{ periodo?: string; orden?: string }> }) {
  const ctx = await getContexto()
  if (!ctx.modulosActivos.cumpleanos) redirect('/')
  const { supabase, negocio } = ctx
  const sp = await searchParams
  const periodo = (PERIODOS_CUMPLE.some((p) => p.value === sp.periodo) ? sp.periodo : 'semana') as PeriodoCumple
  const orden = ['alta_desc', 'alta_asc'].includes(sp.orden ?? '') ? sp.orden! : 'proximo'
  const hoy = hoyEn(negocio.zona_horaria)

  const { data: clientes } = await supabase.from('clientes').select('id, nombre, telefono, cumple_dia, cumple_mes, fecha_nacimiento, creado_en').eq('negocio_id', negocio.id).not('cumple_mes', 'is', null).limit(5000)

  const rango = rangoPeriodo(periodo, hoy)
  const filas = (clientes ?? [])
    .map((c) => ({ ...c, prox: proximoCumple(c.cumple_dia!, c.cumple_mes!, hoy) }))
    .filter((c) => !rango || (c.prox.fecha >= rango.desde && c.prox.fecha <= rango.hasta))
    .sort((a, b) =>
      orden === 'alta_desc' ? b.creado_en.localeCompare(a.creado_en)
      : orden === 'alta_asc' ? a.creado_en.localeCompare(b.creado_en)
      : a.prox.dias - b.prox.dias || a.nombre.localeCompare(b.nombre))

  const link = (p: string) => `/cumpleanos?periodo=${p}${orden !== 'proximo' ? `&orden=${orden}` : ''}`

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div className="animate-fade-up">
          <h1 className="flex items-center gap-2 text-xl font-bold sm:text-2xl"><Cake className="text-rs-lime" size={22} />Cumpleaños</h1>
          <p className="text-sm text-rs-muted">Próximos cumpleaños de clientes</p>
        </div>
        {ctx.puedeEscribir && <AgregarCumpleBtn />}
      </div>

      <div className="flex flex-wrap items-center gap-2">
        {PERIODOS_CUMPLE.map((p) => <Link key={p.value} href={link(p.value)} className={'btn btn-sm ' + (periodo === p.value ? 'btn-primary' : '')}>{p.label}</Link>)}
        <div className="ml-auto"><OrdenSelect opciones={ORDENES} porDefecto="proximo" /></div>
      </div>

      <p className="text-sm text-rs-muted"><span className="font-semibold text-rs-text">{filas.length}</span> cumpleaños en este período</p>

      {filas.length === 0 ? (
        <div className="card"><EstadoVacio icono={<Cake size={26} />} titulo="No hay cumpleaños en este período" texto="Los cumpleaños se cargan solos cuando una reserva trae la fecha, o a mano con “Agregar cumpleaños”." /></div>
      ) : (
        <div className="card overflow-x-auto">
          <table className="w-full min-w-[720px]">
            <thead className="border-b border-rs-border"><tr><th className="th">Nombre</th><th className="th">Teléfono</th><th className="th">Cumpleaños</th><th className="th">Edad</th><th className="th">Alta</th>{ctx.puedeEscribir && <th className="th text-right">Acciones</th>}</tr></thead>
            <tbody>
              {filas.map((c, i) => (
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
    </div>
  )
}
