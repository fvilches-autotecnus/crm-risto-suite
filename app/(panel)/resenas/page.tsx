import Link from 'next/link'
import { redirect } from 'next/navigation'
import { Search, Star } from 'lucide-react'
import { GraficoColumnas, TarjetaGrafico } from '@/components/charts'
import { Tile } from '@/components/dashboard-ui'
import OrdenSelect from '@/components/orden-select'
import Paginacion from '@/components/paginacion'
import ResumenIA from '@/components/resumen-ia'
import { Estrellas, ListaResenas, NuevaResenaBtn, type ResenaUI } from '@/components/resenas-ui'
import { resumirResenas } from '../ia-actions'
import { getContexto } from '@/lib/context'
import { hoyEn, sumarDias } from '@/lib/fechas'
import { numPagina, paginar } from '@/lib/paginacion'
import { ORIGENES_LISTA } from '@/lib/resenas'

const ORDENES = [
  { value: 'alta_desc', label: 'Alta: más recientes primero' },
  { value: 'alta_asc', label: 'Alta: más antiguas primero' },
  { value: 'puntaje_desc', label: 'Puntaje: mayor a menor' },
  { value: 'puntaje_asc', label: 'Puntaje: menor a mayor' },
]
const PERIODOS = [{ v: 'todas', l: 'Todas' }, { v: '30', l: 'Últimos 30 días' }, { v: '90', l: 'Últimos 90 días' }, { v: '365', l: 'Último año' }]
const MESES = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic']

export default async function ResenasPage({ searchParams }: { searchParams: Promise<{ puntaje?: string; origen?: string; periodo?: string; q?: string; orden?: string; voucher?: string; pagina?: string }> }) {
  const ctx = await getContexto()
  if (!ctx.modulosActivos.resenas) redirect('/')
  const { supabase, negocio, sede } = ctx
  const sp = await searchParams
  const hoy = hoyEn(negocio.zona_horaria)
  const puntaje = ['1', '2', '3', '4', '5'].includes(sp.puntaje ?? '') ? Number(sp.puntaje) : 0
  const origen = ORIGENES_LISTA.some((o) => o.value === sp.origen) ? sp.origen! : ''
  const periodo = PERIODOS.some((p) => p.v === sp.periodo) ? sp.periodo! : 'todas'
  const orden = ['alta_asc', 'puntaje_desc', 'puntaje_asc'].includes(sp.orden ?? '') ? sp.orden! : 'alta_desc'
  const voucherFiltro = ['pendiente', 'emitido'].includes(sp.voucher ?? '') ? sp.voucher! : ''
  const q = (sp.q ?? '').trim().replace(/[,()%*]/g, ' ')

  // Base (período, origen, búsqueda, sede) para KPIs y distribución; el filtro de puntaje se aplica solo a la lista.
  let base = supabase.from('resenas').select('id, nombre, telefono, puntaje, comentario, origen, fecha, creado_en, cliente_id, sucursal_id, datos_origen').eq('negocio_id', negocio.id)
  if (sede) base = base.eq('sucursal_id', sede.id)
  if (periodo !== 'todas') base = base.gte('fecha', sumarDias(hoy, -Number(periodo)))
  if (origen) base = base.eq('origen', origen)
  if (q) base = base.or(`nombre.ilike.%${q}%,telefono.ilike.%${q}%,comentario.ilike.%${q}%`)
  const ordenada = orden === 'alta_desc' ? base.order('creado_en', { ascending: false }) : orden === 'alta_asc' ? base.order('creado_en', { ascending: true })
    : orden === 'puntaje_desc' ? base.order('puntaje', { ascending: false }).order('creado_en', { ascending: false }) : base.order('puntaje', { ascending: true }).order('creado_en', { ascending: false })
  const { data } = await ordenada.limit(5000)
  // Voucher: solo corresponde a quienes puntuaron 4–5 ★. "Emitido" si el teléfono ya tiene uno en Vouchers (o vino marcado como enviado al importar)
  const conVoucher = ctx.modulosActivos.vouchers
  const telConVoucher = new Set<string>()
  if (conVoucher) {
    const { data: vs } = await supabase.from('vouchers').select('telefono').eq('negocio_id', negocio.id).neq('estado', 'anulado').not('telefono', 'is', null).limit(20000)
    for (const v of vs ?? []) if (v.telefono) telConVoucher.add(v.telefono)
  }
  const todasBase = ((data ?? []) as ResenaUI[]).map((r) => ({ ...r, voucher: conVoucher && r.puntaje >= 4 ? ((r.telefono && telConVoucher.has(r.telefono)) || r.datos_origen?.voucher_enviado ? 'emitido' : 'pendiente') as 'emitido' | 'pendiente' : null }))
  const todas = todasBase
  const personasPendientes = new Set(todasBase.filter((r) => r.voucher === 'pendiente').map((r) => r.telefono ?? r.id)).size

  const total = todas.length
  const promedio = total ? todas.reduce((s, r) => s + r.puntaje, 0) / total : 0
  const positivas = todas.filter((r) => r.puntaje >= 4).length
  const porPuntaje = [5, 4, 3, 2, 1].map((n) => ({ n, c: todas.filter((r) => r.puntaje === n).length }))
  const pg = paginar(todas.filter((r) => (!puntaje || r.puntaje === puntaje) && (!voucherFiltro || r.voucher === voucherFiltro)), numPagina(sp.pagina))
  const lista = pg.items

  // Reseñas por mes (últimos 6 meses)
  const [y, m] = [Number(hoy.slice(0, 4)), Number(hoy.slice(5, 7))]
  const meses = Array.from({ length: 6 }, (_, i) => { const t = y * 12 + (m - 1) - (5 - i); return { y: Math.floor(t / 12), m: (t % 12) + 1 } })
  const porMes = meses.map(({ y: yy, m: mm }) => ({ etiqueta: MESES[mm - 1], valor: todas.filter((r) => r.fecha.startsWith(`${yy}-${String(mm).padStart(2, '0')}`)).length }))

  const url = (cambios: Record<string, string>) => {
    const p = new URLSearchParams({ ...(puntaje ? { puntaje: String(puntaje) } : {}), ...(origen ? { origen } : {}), ...(periodo !== 'todas' ? { periodo } : {}), ...(q ? { q } : {}), ...(voucherFiltro ? { voucher: voucherFiltro } : {}), ...(orden !== 'alta_desc' ? { orden } : {}), ...cambios })
    for (const [k, v] of [...p.entries()]) if (!v) p.delete(k)
    return `/resenas?${p.toString()}`
  }
  const sedesOpc = ctx.sedes.map((x) => ({ id: x.id, nombre: x.nombre }))
  const nombresSede = Object.fromEntries(ctx.sedesTodas.map((x) => [x.id, x.nombre]))

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div className="animate-fade-up">
          <h1 className="flex items-center gap-2 text-xl font-bold sm:text-2xl"><Star className="text-rs-lime" size={22} />Reseñas</h1>
          <p className="text-sm text-rs-muted">Cuántas conseguimos y qué dicen los clientes</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <ResumenIA key={JSON.stringify({ puntaje: puntaje ? String(puntaje) : '', origen, periodo, q })} titulo="Resumen de reseñas con IA" pista="Resume lo que dicen las reseñas que ves con los filtros actuales" generar={resumirResenas.bind(null, { puntaje: puntaje ? String(puntaje) : '', origen, periodo, q })} />
          {ctx.puedeEscribir && <NuevaResenaBtn sedes={sedesOpc} hoy={hoy} />}
        </div>
      </div>

      <div className={'grid grid-cols-2 gap-3 sm:gap-4 ' + (conVoucher ? 'lg:grid-cols-5' : 'lg:grid-cols-4')}>
        <Tile i={0} valor={total} etiqueta="Reseñas conseguidas" color="text-rs-text" sub={periodo === 'todas' ? 'En total' : `Últimos ${periodo} días`} />
        <div className="reveal card card-hover p-4 sm:p-5" style={{ ['--i' as string]: 1 }}>
          <div className="text-2xl font-bold tabular-nums text-rs-lime sm:text-3xl">{promedio ? promedio.toLocaleString('es-AR', { minimumFractionDigits: 1, maximumFractionDigits: 1 }) : '—'}</div>
          <div className="card-title mt-3">Puntaje promedio</div><div className="mt-1"><Estrellas n={Math.round(promedio)} tam={12} /></div>
        </div>
        <Tile i={2} valor={total ? Math.round((positivas / total) * 100) : 0} etiqueta="% positivas (4–5 ★)" color="text-rs-ok" sub={`${positivas} de ${total}`} />
        <Tile i={3} valor={todas.filter((r) => r.puntaje <= 2).length} etiqueta="A atender (1–2 ★)" color="text-rs-danger" sub="Puntajes bajos" />
        {conVoucher && <Tile i={4} valor={personasPendientes} etiqueta="Vouchers por emitir" color="text-rs-warn" sub="Personas sin voucher" />}
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <section className="reveal card p-5" style={{ ['--i' as string]: 4 }}>
          <h2 className="card-title mb-4">Por puntaje <span className="font-normal normal-case tracking-normal text-rs-muted">· tocá para filtrar</span></h2>
          <ul className="space-y-2.5">
            {porPuntaje.map(({ n, c }) => (
              <li key={n}>
                <Link href={url({ puntaje: puntaje === n ? '' : String(n) })} className={'group grid grid-cols-[3.5rem_1fr_3.5rem] items-center gap-3 rounded-md px-1 py-0.5 text-sm transition hover:bg-rs-raised/60 ' + (puntaje === n ? 'bg-rs-raised' : '')}>
                  <span className="inline-flex items-center gap-1 tabular-nums"><Star size={13} className="fill-rs-lime text-rs-lime" />{n}</span>
                  <span className="h-2.5 overflow-hidden rounded-full bg-rs-raised"><span className="grow-x block h-full rounded-full bg-rs-lime" style={{ width: `${total ? (c / total) * 100 : 0}%`, opacity: puntaje && puntaje !== n ? 0.35 : 1 }} /></span>
                  <span className="text-right tabular-nums"><span className="font-semibold">{c}</span> <span className="text-xs text-rs-muted">{total ? Math.round((c / total) * 100) : 0}%</span></span>
                </Link>
              </li>
            ))}
          </ul>
        </section>
        <TarjetaGrafico i={5} titulo="Reseñas por mes — últimos 6 meses" vacio={porMes.every((x) => x.valor === 0)} columnas={['Mes', 'Reseñas']} filas={porMes.map((d) => [d.etiqueta, d.valor])}>
          <GraficoColumnas datos={porMes} unidad="reseñas" />
        </TarjetaGrafico>
      </div>

      <div className="card space-y-3 p-4">
        <div className="flex flex-wrap items-center gap-2">
          <form className="relative min-w-[220px] flex-1">
            {voucherFiltro ? <input type="hidden" name="voucher" value={voucherFiltro} /> : null}{puntaje ? <input type="hidden" name="puntaje" value={puntaje} /> : null}{origen ? <input type="hidden" name="origen" value={origen} /> : null}{periodo !== 'todas' ? <input type="hidden" name="periodo" value={periodo} /> : null}
            <Search size={14} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-rs-muted" />
            <input name="q" defaultValue={q} placeholder="Buscar por nombre, teléfono o comentario" className="input w-full pl-9" />
          </form>
          <OrdenSelect opciones={ORDENES} />
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <span className="label mb-0 mr-1 w-14 shrink-0">Puntaje</span>
          <Link href={url({ puntaje: '' })} className={'btn btn-sm ' + (!puntaje ? 'btn-primary' : '')}>Todos</Link>
          {[5, 4, 3, 2, 1].map((n) => <Link key={n} href={url({ puntaje: puntaje === n ? '' : String(n) })} className={'btn btn-sm ' + (puntaje === n ? 'btn-primary' : '')}>{n} ★</Link>)}
        </div>
        {conVoucher && (
          <div className="flex flex-wrap items-center gap-2">
            <span className="label mb-0 mr-1 w-14 shrink-0">Voucher</span>
            <Link href={url({ voucher: '' })} className={'btn btn-sm ' + (!voucherFiltro ? 'btn-primary' : '')}>Todos</Link>
            <Link href={url({ voucher: voucherFiltro === 'pendiente' ? '' : 'pendiente' })} className={'btn btn-sm ' + (voucherFiltro === 'pendiente' ? 'btn-primary' : '')}>Pendiente</Link>
            <Link href={url({ voucher: voucherFiltro === 'emitido' ? '' : 'emitido' })} className={'btn btn-sm ' + (voucherFiltro === 'emitido' ? 'btn-primary' : '')}>Emitido</Link>
          </div>
        )}
        <div className="flex flex-wrap items-center gap-2">
          <span className="label mb-0 mr-1 w-14 shrink-0">Período</span>
          {PERIODOS.map((p) => <Link key={p.v} href={url({ periodo: p.v === 'todas' ? '' : p.v })} className={'btn btn-sm ' + (periodo === p.v ? 'btn-primary' : '')}>{p.l}</Link>)}
          <span className="label mb-0 ml-3 mr-1">Origen</span>
          <Link href={url({ origen: '' })} className={'btn btn-sm ' + (!origen ? 'btn-primary' : '')}>Todos</Link>
          {ORIGENES_LISTA.map((o) => <Link key={o.value} href={url({ origen: origen === o.value ? '' : o.value })} className={'btn btn-sm ' + (origen === o.value ? 'btn-primary' : '')}>{o.label}</Link>)}
        </div>
      </div>

      <ListaResenas resenas={lista} sedes={sedesOpc} nombresSede={nombresSede} hoy={hoy} puedeEscribir={ctx.puedeEscribir} puedeEliminar={ctx.puedeAdministrar} />
      <Paginacion ruta="/resenas" params={sp} {...pg} />
    </div>
  )
}
