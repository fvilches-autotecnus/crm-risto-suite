import Link from 'next/link'
import { redirect } from 'next/navigation'
import { Gift, Search } from 'lucide-react'
import { Tile } from '@/components/dashboard-ui'
import { BotonesFidelidad, ReglasPanel } from '@/components/fidelidad-ui'
import Paginacion from '@/components/paginacion'
import { EstadoVacio } from '@/components/ui'
import { getContexto } from '@/lib/context'
import { fechaCorta, fechaHoraLarga, hoyEn } from '@/lib/fechas'
import { CRITERIOS, proximoPremio, textoVisitas, type ClienteFidelidad, type ConfigFidelidad, type ReglaFidelidad } from '@/lib/fidelidad'
import { numPagina, paginar } from '@/lib/paginacion'

const FILTROS = [{ v: 'todos', l: 'Todos' }, { v: 'cerca', l: 'A 1 visita de un premio' }, { v: 'premiados', l: 'Con premios recibidos' }]
const norm = (t: string) => t.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '')

interface PremioFila { id: string; hito: number; creado_en: string; avisado_en: string | null; cliente: { id: string; nombre: string } | null; regla: { nombre: string } | null; voucher: { codigo: string; estado: string } | null }

export default async function FidelizacionPage({ searchParams }: { searchParams: Promise<{ filtro?: string; q?: string; pagina?: string }> }) {
  const ctx = await getContexto()
  if (!ctx.modulosActivos.fidelizacion) redirect('/')
  const { supabase, negocio } = ctx
  const sp = await searchParams
  const filtro = FILTROS.some((f) => f.v === sp.filtro) ? sp.filtro! : 'todos'
  const q = norm((sp.q ?? '').trim())
  const hoy = hoyEn(negocio.zona_horaria)

  const [{ data: cfg }, { data: reglasDb }, { data: premiosDb }, { count: totalPremios }, { count: sinAvisar }, { data: porEmitirDb }] = await Promise.all([
    supabase.from('fidelidad_config').select('activo, criterio, contar_desde').eq('negocio_id', negocio.id).maybeSingle(),
    supabase.from('fidelidad_reglas').select('id, nombre, visitas, repetir, beneficio, vence_dias, activa').eq('negocio_id', negocio.id).order('visitas').order('creado_en'),
    supabase.from('fidelidad_premios').select('id, hito, creado_en, avisado_en, cliente:clientes(id, nombre), regla:fidelidad_reglas(nombre), voucher:vouchers(codigo, estado)').eq('negocio_id', negocio.id).order('creado_en', { ascending: false }).limit(15),
    supabase.from('fidelidad_premios').select('id', { count: 'exact', head: true }).eq('negocio_id', negocio.id),
    supabase.from('fidelidad_premios').select('id', { count: 'exact', head: true }).eq('negocio_id', negocio.id).is('avisado_en', null),
    supabase.rpc('fidelidad_por_emitir', { p_negocio: negocio.id }).limit(5000),
  ])
  const config: ConfigFidelidad = { activo: cfg?.activo ?? false, criterio: (cfg?.criterio as ConfigFidelidad['criterio']) ?? 'confirmadas', contar_desde: cfg?.contar_desde ?? hoy }
  const reglas = (reglasDb ?? []) as ReglaFidelidad[]
  const porEmitir = (porEmitirDb ?? []).filter((x: { tiene_telefono: boolean }) => x.tiene_telefono).length

  // ranking de clientes (la función devuelve de a 1000: se pide de a tandas)
  let todos: ClienteFidelidad[] = []
  if (config.activo || cfg) {
    for (let i = 0; i < 10; i++) {
      const { data } = await supabase.rpc('fidelidad_clientes', { p_negocio: negocio.id }).order('visitas', { ascending: false }).order('cliente_id').range(i * 1000, i * 1000 + 999)
      todos = todos.concat((data ?? []) as ClienteFidelidad[])
      if ((data ?? []).length < 1000) break
    }
  }
  const conVisitas = todos.filter((c) => c.visitas > 0)
  const filas = conVisitas
    .map((c) => ({ ...c, prox: proximoPremio(c.visitas, reglas) }))
    .filter((c) => (!q || norm(c.nombre).includes(q) || (c.telefono ?? '').includes(q)) && (filtro === 'todos' || (filtro === 'cerca' ? c.prox?.faltan === 1 : c.premios > 0)))
  const pg = paginar(filas, numPagina(sp.pagina))
  const link = (f: string) => `/fidelizacion?filtro=${f}${q ? `&q=${encodeURIComponent(sp.q ?? '')}` : ''}`
  const criterio = CRITERIOS.find((c) => c.value === config.criterio)!

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div className="animate-fade-up">
          <h1 className="flex items-center gap-2 text-xl font-bold sm:text-2xl"><Gift className="text-rs-lime" size={22} />Fidelización</h1>
          <p className="text-sm text-rs-muted">Premios para los clientes que vuelven, según sus visitas</p>
        </div>
        <BotonesFidelidad config={config} hoy={hoy} porEmitir={porEmitir} puedeAdministrar={ctx.puedeAdministrar} puedeEmitir={ctx.puedeAdministrar || ctx.rol === 'encargado'} />
      </div>

      {config.activo ? (
        <p className="rounded-md bg-rs-raised/60 px-3 py-2 text-sm text-rs-muted">Programa <span className="font-semibold text-rs-ok">activo</span> · visitas: <span className="text-rs-text">{criterio.titulo.toLowerCase()}</span> · se cuentan desde el <span className="text-rs-text">{fechaCorta(config.contar_desde)}</span>. Los premios se emiten solos al cambiar una reserva y todas las madrugadas.</p>
      ) : (
        <p role="status" className="rounded-md border border-rs-warn/40 bg-rs-warn/10 px-3 py-2 text-sm text-rs-warn">El programa está apagado: no se cuentan visitas ni se emiten premios. {ctx.puedeAdministrar ? 'Activalo en Ajustes cuando tengas las reglas listas.' : 'Pedile a un administrador que lo active.'}</p>
      )}

      <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
        <Tile i={0} valor={conVisitas.length} etiqueta="Clientes con visitas" color="text-rs-text" sub="Desde que arrancó el programa" />
        <Tile i={1} valor={totalPremios ?? 0} etiqueta="Premios emitidos" color="text-rs-lime" sub="En total" />
        <Tile i={2} valor={sinAvisar ?? 0} etiqueta="Sin avisar al cliente" color={(sinAvisar ?? 0) > 0 ? 'text-rs-warn' : 'text-rs-muted'} sub="Esperan el mensaje de WhatsApp" />
        <Tile i={3} valor={porEmitir} etiqueta="Por emitir" color={porEmitir > 0 ? 'text-rs-warn' : 'text-rs-muted'} sub="Ya cumplieron una regla" />
      </div>

      <ReglasPanel reglas={reglas} puedeAdministrar={ctx.puedeAdministrar} />

      <section className="card space-y-3 p-4">
        <div className="flex flex-wrap items-center gap-2">
          <h2 className="card-title mr-auto">Visitas por cliente</h2>
          <form className="relative w-full sm:w-64">
            <input type="hidden" name="filtro" value={filtro} />
            <Search size={14} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-rs-muted" />
            <input name="q" defaultValue={sp.q ?? ''} placeholder="Buscar por nombre o teléfono" className="input w-full pl-9" />
          </form>
        </div>
        <div className="flex flex-wrap items-center gap-2">{FILTROS.map((f) => <Link key={f.v} href={link(f.v)} className={'btn btn-sm ' + (filtro === f.v ? 'btn-primary' : '')}>{f.l}</Link>)}</div>
        {filas.length === 0 ? (
          <EstadoVacio icono={<Gift size={26} />} titulo={conVisitas.length === 0 ? 'Todavía no hay visitas contadas' : 'No hay clientes para mostrar'} texto={conVisitas.length === 0 ? (config.activo ? 'Las visitas aparecen a medida que pasan las reservas confirmadas.' : 'Activá el programa para empezar a contar visitas.') : 'Probá con otro filtro o búsqueda.'} />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[640px]">
              <thead className="border-b border-rs-border"><tr><th className="th">Cliente</th><th className="th">Visitas</th><th className="th">Última visita</th><th className="th">Próximo premio</th><th className="th text-right">Premios</th></tr></thead>
              <tbody>
                {pg.items.map((c, i) => (
                  <tr key={c.cliente_id} className="reveal border-b border-rs-border/60 transition-colors last:border-0 hover:bg-rs-raised/50" style={{ ['--i' as string]: Math.min(i, 12) }}>
                    <td className="td"><Link href={`/clientes/${c.cliente_id}`} className="font-medium transition-colors hover:text-rs-lime">{c.nombre}</Link><div className="text-xs text-rs-muted">{c.telefono ?? 'Sin teléfono'}</div></td>
                    <td className="td whitespace-nowrap"><span className="font-semibold tabular-nums">{c.visitas}</span> {c.total !== c.visitas && <span className="text-xs text-rs-muted">({c.total} en total)</span>}</td>
                    <td className="td whitespace-nowrap text-rs-muted">{c.ultima ? fechaCorta(c.ultima) : '—'}</td>
                    <td className="td">{c.prox ? <span className={c.prox.faltan === 1 ? 'font-semibold text-rs-lime' : ''}>{c.prox.faltan === 1 ? 'Le falta 1 visita' : `Le faltan ${c.prox.faltan} visitas`}</span> : <span className="text-rs-muted">—</span>}{c.prox && <div className="text-xs text-rs-muted">{c.prox.regla.beneficio}</div>}</td>
                    <td className="td text-right tabular-nums">{c.premios || <span className="text-rs-muted">—</span>}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
      <Paginacion ruta="/fidelizacion" params={sp} {...pg} />

      <section className="card p-5">
        <h2 className="card-title">Premios recientes</h2>
        {(premiosDb ?? []).length === 0 ? <p className="mt-3 text-sm text-rs-muted">Todavía no se emitió ningún premio.</p> : (
          <ul className="mt-3 divide-y divide-rs-border/60">
            {((premiosDb ?? []) as unknown as PremioFila[]).map((p) => (
              <li key={p.id} className="flex flex-wrap items-center justify-between gap-2 py-2.5 text-sm">
                <span>
                  {p.cliente ? <Link href={`/clientes/${p.cliente.id}`} className="font-medium hover:text-rs-lime">{p.cliente.nombre}</Link> : '—'}
                  <span className="text-rs-muted"> · {p.regla?.nombre ?? '—'} · visita {p.hito} · </span>
                  <span className="font-mono font-semibold text-rs-lime">{p.voucher?.codigo ?? '—'}</span>
                </span>
                <span className="flex items-center gap-2 text-xs text-rs-muted">{fechaHoraLarga(p.creado_en)}{p.avisado_en ? <span className="badge bg-rs-ok/15 text-rs-ok">Avisado</span> : <span className="badge bg-rs-warn/15 text-rs-warn">Sin avisar</span>}</span>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  )
}
