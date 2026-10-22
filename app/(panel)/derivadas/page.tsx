import Link from 'next/link'
import { redirect } from 'next/navigation'
import { CornerUpRight, Search } from 'lucide-react'
import OrdenSelect from '@/components/orden-select'
import Paginacion from '@/components/paginacion'
import { Tile } from '@/components/dashboard-ui'
import { EstadoVacio } from '@/components/ui'
import { getContexto } from '@/lib/context'
import { fechaCorta, fechaHoraLarga, hoyEn, horaCorta } from '@/lib/fechas'
import { numPagina, paginar } from '@/lib/paginacion'

const ORDENES = [
  { value: 'alta_desc', label: 'Alta: más recientes primero' },
  { value: 'alta_asc', label: 'Alta: más antiguas primero' },
  { value: 'fecha_asc', label: 'Fecha de la reserva: próximas primero' },
  { value: 'fecha_desc', label: 'Fecha de la reserva: lejanas primero' },
]
const RANGOS = [{ v: 'todas', l: 'Todas' }, { v: 'proximas', l: 'Próximas' }, { v: 'pasadas', l: 'Pasadas' }]

interface Derivada { id: string; cliente_id: string | null; cliente_nombre: string | null; nombre_whatsapp: string | null; telefono: string | null; cantidad_personas: number | null; fecha: string | null; hora: string | null; observaciones: string | null; derivada_a: string | null; creado_en: string }

export default async function DerivadasPage({ searchParams }: { searchParams: Promise<{ rango?: string; a?: string; q?: string; orden?: string; pagina?: string }> }) {
  const ctx = await getContexto()
  if (!ctx.modulosActivos.derivadas) redirect('/')
  const { supabase, negocio } = ctx
  const sp = await searchParams
  const hoy = hoyEn(negocio.zona_horaria)
  const rango = RANGOS.some((r) => r.v === sp.rango) ? sp.rango! : 'todas'
  const orden = ORDENES.some((o) => o.value === sp.orden) ? sp.orden! : 'alta_desc'
  const q = (sp.q ?? '').trim().replace(/[,()%*]/g, ' ')
  const numeroSel = (sp.a ?? '').replace(/\D/g, '')

  let consulta = supabase.from('reservas_derivadas').select('id, cliente_id, cliente_nombre, nombre_whatsapp, telefono, cantidad_personas, fecha, hora, observaciones, derivada_a, creado_en').eq('negocio_id', negocio.id)
  if (q) consulta = consulta.or(`cliente_nombre.ilike.%${q}%,nombre_whatsapp.ilike.%${q}%,telefono.ilike.%${q}%,observaciones.ilike.%${q}%`)
  const ordenada = orden === 'alta_desc' ? consulta.order('creado_en', { ascending: false }) : orden === 'alta_asc' ? consulta.order('creado_en', { ascending: true })
    : orden === 'fecha_asc' ? consulta.order('fecha', { ascending: true, nullsFirst: false }).order('hora', { ascending: true }) : consulta.order('fecha', { ascending: false, nullsFirst: false }).order('hora', { ascending: false })
  const { data } = await ordenada.limit(20000)
  const todas = (data ?? []) as Derivada[]

  const baseRango = (d: Derivada) => rango === 'todas' || (rango === 'proximas' ? !!d.fecha && d.fecha >= hoy : !d.fecha || d.fecha < hoy)
  const porNumero = new Map<string, number>()
  for (const d of todas.filter(baseRango)) if (d.derivada_a) porNumero.set(d.derivada_a, (porNumero.get(d.derivada_a) ?? 0) + 1)
  const numeros = [...porNumero.entries()].sort((a, b) => b[1] - a[1])
  const filtradas = todas.filter((d) => baseRango(d) && (!numeroSel || d.derivada_a === numeroSel))
  const pg = paginar(filtradas, numPagina(sp.pagina))

  const proximas = todas.filter((d) => d.fecha && d.fecha >= hoy)
  const url = (c: Record<string, string>) => {
    const p = new URLSearchParams({ ...(rango !== 'todas' ? { rango } : {}), ...(numeroSel ? { a: numeroSel } : {}), ...(q ? { q } : {}), ...(orden !== 'alta_desc' ? { orden } : {}), ...c })
    for (const [k, v] of [...p.entries()]) if (!v) p.delete(k)
    return `/derivadas?${p.toString()}`
  }

  return (
    <div className="space-y-5">
      <div className="animate-fade-up">
        <h1 className="flex items-center gap-2 text-xl font-bold sm:text-2xl"><CornerUpRight className="text-rs-lime" size={22} />Reservas derivadas</h1>
        <p className="text-sm text-rs-muted">Las toma el bar pero las administra otra producción: no cuentan en el aforo ni en las métricas</p>
      </div>

      <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
        <Tile i={0} valor={todas.length} etiqueta="Derivadas" color="text-rs-text" sub="En total" />
        <Tile i={1} valor={proximas.length} etiqueta="Próximas" color="text-rs-lime" sub={`${proximas.reduce((s, d) => s + (d.cantidad_personas ?? 0), 0)} personas`} />
        <Tile i={2} valor={new Set(todas.map((d) => d.derivada_a).filter(Boolean)).size} etiqueta="Producciones" color="text-rs-text" sub="Números distintos" />
        <Tile i={3} valor={new Set(todas.map((d) => d.telefono).filter(Boolean)).size} etiqueta="Clientes" color="text-rs-text" sub="Teléfonos distintos" />
      </div>

      <div className="card space-y-3 p-4">
        <div className="flex flex-wrap items-center gap-2">
          <form className="relative min-w-[220px] flex-1">
            {rango !== 'todas' && <input type="hidden" name="rango" value={rango} />}{numeroSel && <input type="hidden" name="a" value={numeroSel} />}
            <Search size={14} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-rs-muted" />
            <input name="q" defaultValue={q} placeholder="Buscar por nombre, teléfono u observación" className="input w-full pl-9" />
          </form>
          <OrdenSelect opciones={ORDENES} />
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <span className="label mb-0 mr-1 w-16 shrink-0">Reserva</span>
          {RANGOS.map((r) => <Link key={r.v} href={url({ rango: r.v === 'todas' ? '' : r.v })} className={'btn btn-sm ' + (rango === r.v ? 'btn-primary' : '')}>{r.l}</Link>)}
        </div>
        {numeros.length > 0 && (
          <div className="flex flex-wrap items-center gap-2">
            <span className="label mb-0 mr-1 w-16 shrink-0">Derivada a</span>
            <Link href={url({ a: '' })} className={'btn btn-sm ' + (!numeroSel ? 'btn-primary' : '')}>Todas</Link>
            {numeros.map(([n, c]) => <Link key={n} href={url({ a: numeroSel === n ? '' : n })} className={'btn btn-sm tabular-nums ' + (numeroSel === n ? 'btn-primary' : '')}>+{n} <span className="opacity-70">{c}</span></Link>)}
          </div>
        )}
      </div>

      {pg.items.length === 0 ? (
        <div className="card"><EstadoVacio icono={<CornerUpRight size={26} />} titulo="No hay reservas derivadas para mostrar" texto="Acá aparecen las reservas de cena show que el bot toma y pasa a otra producción." /></div>
      ) : (
        <div className="card overflow-x-auto">
          <table className="w-full min-w-[860px]">
            <thead className="border-b border-rs-border"><tr><th className="th">Alta</th><th className="th">Cliente</th><th className="th">Fecha</th><th className="th">Hora</th><th className="th">Personas</th><th className="th">Derivada a</th><th className="th">Observaciones</th></tr></thead>
            <tbody>
              {pg.items.map((d, i) => (
                <tr key={d.id} className="reveal border-b border-rs-border/60 align-top transition-colors last:border-0 hover:bg-rs-raised/50" style={{ ['--i' as string]: Math.min(i, 12) }}>
                  <td className="td whitespace-nowrap text-xs text-rs-muted">{fechaHoraLarga(d.creado_en)}</td>
                  <td className="td">{d.cliente_id ? <Link href={`/clientes/${d.cliente_id}`} className="font-medium transition-colors hover:text-rs-lime">{d.cliente_nombre ?? d.nombre_whatsapp ?? '—'}</Link> : <span className="font-medium">{d.cliente_nombre ?? d.nombre_whatsapp ?? '—'}</span>}<div className="text-xs text-rs-muted">{d.telefono ?? ''}</div></td>
                  <td className="td whitespace-nowrap">{d.fecha ? fechaCorta(d.fecha) : <span className="text-rs-muted">A coordinar</span>}</td>
                  <td className="td whitespace-nowrap text-rs-muted">{d.hora ? horaCorta(d.hora) : '—'}</td>
                  <td className="td tabular-nums">{d.cantidad_personas ?? '—'}</td>
                  <td className="td whitespace-nowrap tabular-nums text-rs-muted">{d.derivada_a ? `+${d.derivada_a}` : '—'}</td>
                  <td className="td max-w-[260px] whitespace-pre-wrap text-rs-muted">{d.observaciones ?? '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      <Paginacion ruta="/derivadas" params={sp} {...pg} />
    </div>
  )
}
