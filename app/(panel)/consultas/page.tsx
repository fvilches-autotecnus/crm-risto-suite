import Link from 'next/link'
import { MessageCircleQuestion, Search } from 'lucide-react'
import OrdenSelect from '@/components/orden-select'
import { EstadoVacio } from '@/components/ui'
import { getContexto } from '@/lib/context'
import { fechaHoraLarga } from '@/lib/fechas'
import ConsultaAcciones from './acciones'

const ESTADOS = [{ v: 'todas', l: 'Todas' }, { v: 'pendiente', l: 'Pendientes' }, { v: 'resuelta', l: 'Resueltas' }]
const TIPOS = [{ v: 'todos', l: 'Todos' }, { v: 'consulta', l: 'Consultas' }, { v: 'reclamo', l: 'Reclamos' }]

export default async function ConsultasYReclamosPage({ searchParams }: { searchParams: Promise<{ estado?: string; tipo?: string; q?: string; orden?: string }> }) {
  const ctx = await getContexto()
  const { supabase, negocio, sede } = ctx
  const sp = await searchParams
  const estado = ESTADOS.some((e) => e.v === sp.estado) ? sp.estado! : 'pendiente'
  const tipo = TIPOS.some((t) => t.v === sp.tipo) ? sp.tipo! : 'todos'
  const orden = sp.orden === 'alta_asc' ? 'alta_asc' : 'alta_desc'
  const q = (sp.q ?? '').trim().replace(/[,()%*]/g, ' ')

  let cq = supabase.from('consultas_reclamos').select('id, telefono, mensaje, estado, tipo, creado_en').eq('negocio_id', negocio.id)
  if (sede) cq = cq.eq('sucursal_id', sede.id)
  if (q) cq = cq.or(`telefono.ilike.%${q}%,mensaje.ilike.%${q}%`)
  const { data } = await cq.order('creado_en', { ascending: orden === 'alta_asc' }).limit(10000)
  const todas = data ?? []

  // conteos con el otro filtro aplicado, para ver cuánto hay en cada opción
  const base = todas.filter((c) => tipo === 'todos' || c.tipo === tipo)
  const porEstado = (e: string) => (e === 'todas' ? base.length : base.filter((c) => c.estado === e).length)
  const baseE = todas.filter((c) => estado === 'todas' || c.estado === estado)
  const porTipo = (t: string) => (t === 'todos' ? baseE.length : baseE.filter((c) => c.tipo === t).length)
  const lista = todas.filter((c) => (estado === 'todas' || c.estado === estado) && (tipo === 'todos' || c.tipo === tipo)).slice(0, 300)

  const url = (cambios: Record<string, string>) => {
    const p = new URLSearchParams({ estado, tipo, ...(q ? { q } : {}), ...(orden !== 'alta_desc' ? { orden } : {}), ...cambios })
    return `/consultas?${p.toString()}`
  }
  const badge = (t: string) => <span className={'badge ' + (t === 'reclamo' ? 'bg-rs-danger/15 text-rs-danger' : 'bg-rs-lav/15 text-rs-lav')}>{t === 'reclamo' ? 'Reclamo' : 'Consulta'}</span>
  const estadoBadge = (e: string) => <span className={'badge ' + (e === 'resuelta' ? 'bg-rs-ok/15 text-rs-ok' : 'bg-rs-warn/15 text-rs-warn')}><span className={'h-1.5 w-1.5 rounded-full ' + (e === 'resuelta' ? 'bg-rs-ok' : 'bg-rs-warn')} />{e === 'resuelta' ? 'Resuelta' : 'Pendiente'}</span>
  const telefono = (t: string | null) => (t ? (ctx.modulosActivos.conversaciones ? <Link href={`/conversaciones?tel=${t}`} className="font-semibold text-rs-lime hover:underline">{t}</Link> : <span className="text-rs-muted">{t}</span>) : <span className="text-rs-muted">Sin teléfono</span>)

  return (
    <div className="space-y-5">
      <div className="animate-fade-up">
        <h1 className="flex items-center gap-2 text-xl font-bold sm:text-2xl"><MessageCircleQuestion className="text-rs-lime" size={22} />Consultas y reclamos</h1>
        <p className="text-sm text-rs-muted">Lo que escriben los clientes y hay que responder o resolver</p>
      </div>

      <div className="card space-y-3 p-4">
        <div className="flex flex-wrap items-center gap-2">
          <form className="relative min-w-[220px] flex-1">
            <input type="hidden" name="estado" value={estado} /><input type="hidden" name="tipo" value={tipo} />
            <Search size={14} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-rs-muted" />
            <input name="q" defaultValue={q} placeholder="Buscar por teléfono o mensaje" className="input w-full pl-9" />
          </form>
          <OrdenSelect />
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <span className="label mb-0 mr-1 w-14 shrink-0">Estado</span>
          {ESTADOS.map((e) => <Link key={e.v} href={url({ estado: e.v })} className={'btn btn-sm ' + (estado === e.v ? 'btn-primary' : '')}>{e.l} <span className="opacity-70">{porEstado(e.v)}</span></Link>)}
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <span className="label mb-0 mr-1 w-14 shrink-0">Tipo</span>
          {TIPOS.map((t) => <Link key={t.v} href={url({ tipo: t.v })} className={'btn btn-sm ' + (tipo === t.v ? 'btn-primary' : '')}>{t.l} <span className="opacity-70">{porTipo(t.v)}</span></Link>)}
        </div>
      </div>

      {lista.length === 0 ? (
        <div className="card"><EstadoVacio icono={<MessageCircleQuestion size={26} />} titulo="No hay consultas ni reclamos para mostrar" texto="Cuando un cliente deje una consulta o reclamo por WhatsApp, aparece acá." /></div>
      ) : (
        <>
          <div className="card hidden overflow-x-auto md:block">
            <table className="w-full min-w-[760px]">
              <thead className="border-b border-rs-border"><tr><th className="th">Alta</th><th className="th">Tipo</th><th className="th">Teléfono</th><th className="th">Mensaje</th><th className="th">Estado</th>{ctx.puedeEscribir && <th className="th text-right">Acciones</th>}</tr></thead>
              <tbody>
                {lista.map((c, i) => (
                  <tr key={c.id} className="reveal border-b border-rs-border/60 align-top transition-colors last:border-0 hover:bg-rs-raised/50" style={{ ['--i' as string]: Math.min(i, 12) }}>
                    <td className="td whitespace-nowrap text-xs text-rs-muted">{fechaHoraLarga(c.creado_en)}</td>
                    <td className="td">{badge(c.tipo)}</td>
                    <td className="td whitespace-nowrap">{telefono(c.telefono)}</td>
                    <td className="td max-w-[360px] whitespace-pre-wrap">{c.mensaje}</td>
                    <td className="td">{estadoBadge(c.estado)}</td>
                    {ctx.puedeEscribir && <td className="td"><ConsultaAcciones id={c.id} estado={c.estado} tipo={c.tipo} /></td>}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <ul className="space-y-3 md:hidden">
            {lista.map((c, i) => (
              <li key={c.id} className="reveal card p-4" style={{ ['--i' as string]: Math.min(i, 8) }}>
                <div className="flex flex-wrap items-center justify-between gap-2 text-xs"><span className="flex items-center gap-2">{badge(c.tipo)}{estadoBadge(c.estado)}</span><span className="text-rs-muted">{fechaHoraLarga(c.creado_en)}</span></div>
                <p className="mt-2 text-sm">{telefono(c.telefono)}</p>
                <p className="mt-1 whitespace-pre-wrap text-sm">{c.mensaje}</p>
                {ctx.puedeEscribir && <div className="mt-3 border-t border-rs-border/60 pt-3"><ConsultaAcciones id={c.id} estado={c.estado} tipo={c.tipo} /></div>}
              </li>
            ))}
          </ul>
        </>
      )}
    </div>
  )
}
