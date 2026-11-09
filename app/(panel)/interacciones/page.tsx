import Link from 'next/link'
import { redirect } from 'next/navigation'
import { Check, CheckCheck, Clock, Megaphone, MessagesSquare, TriangleAlert } from 'lucide-react'
import { EstadoVacio } from '@/components/ui'
import { cargarChatsCampanas, filtrarChats, FILTROS_CHAT, textoEntrante, type Burbuja, type ChatResumen, type EstadoEntrega, type FiltroChat } from '@/lib/chats-campanas'
import { getContexto } from '@/lib/context'
import { fechaHoraCorta } from '@/lib/fechas'

const DIAS = [7, 14, 30, 90]
const ESTADO: Record<EstadoEntrega, { txt: string; cls: string }> = {
  leido: { txt: 'Leído', cls: 'text-rs-lime' }, entregado: { txt: 'Entregado', cls: 'text-rs-ok' }, enviado: { txt: 'Enviado', cls: 'text-rs-muted' },
  fallido: { txt: 'No entregado', cls: 'text-rs-warn' }, sin_seguimiento: { txt: 'Sin seguimiento', cls: 'text-rs-muted' },
}

function Tick({ estado }: { estado: EstadoEntrega | null }) {
  if (!estado) return null
  const c = ESTADO[estado]
  const icono = estado === 'leido' || estado === 'entregado' ? <CheckCheck size={14} /> : estado === 'fallido' ? <TriangleAlert size={14} /> : estado === 'enviado' ? <Check size={14} /> : <Clock size={14} />
  return <span className={'inline-flex shrink-0 items-center ' + c.cls} title={c.txt} aria-label={c.txt}>{icono}</span>
}

// Solo el superadmin: es una herramienta de seguimiento de las campañas de todos los negocios.
export default async function InteraccionesPage({ searchParams }: { searchParams: Promise<{ tel?: string; filtro?: string; campana?: string; dias?: string; q?: string }> }) {
  const ctx = await getContexto()
  if (!ctx.esSuperadmin) redirect('/')
  const { negocio } = ctx
  const sp = await searchParams
  const dias = DIAS.includes(Number(sp.dias)) ? Number(sp.dias) : 30
  const filtro: FiltroChat = FILTROS_CHAT.some((f) => f.v === sp.filtro) ? (sp.filtro as FiltroChat) : 'todos'
  const q = (sp.q ?? '').slice(0, 60)
  const campanaSel = /^[0-9a-f-]{36}$/i.test(sp.campana ?? '') ? sp.campana! : ''

  const { chats, hilo, campanas } = await cargarChatsCampanas(ctx, dias)
  const lista = filtrarChats(chats, filtro, q, campanaSel)
  const k = sp.tel && /^\d{6,20}$/.test(sp.tel) ? sp.tel.slice(-10) : lista[0]?.tel10
  const activo = chats.find((c) => c.tel10 === k)
  const burbujas = activo ? hilo(activo.tel10) : []

  const href = (cambio: Record<string, string | undefined>) => {
    const p = new URLSearchParams()
    const base: Record<string, string | undefined> = { filtro: filtro !== 'todos' ? filtro : undefined, campana: campanaSel || undefined, dias: dias !== 30 ? String(dias) : undefined, q: q || undefined, tel: undefined, ...cambio }
    for (const [a, b] of Object.entries(base)) if (b) p.set(a, b)
    const s = p.toString()
    return `/interacciones${s ? `?${s}` : ''}`
  }
  const respondieron = chats.filter((c) => c.respondio).length
  const chip = (activa: boolean) => 'btn btn-sm ' + (activa ? 'btn-primary' : '')

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div className="animate-fade-up">
          <h1 className="flex items-center gap-2 text-xl font-bold sm:text-2xl"><Megaphone className="text-rs-lime" size={22} />Interacciones de campañas</h1>
          <p className="text-sm text-rs-muted">{negocio.nombre} · {chats.length} conversaciones · {respondieron} respondieron · últimos {dias} días · solo superadmin</p>
        </div>
        <nav aria-label="Período" className="flex gap-1.5">{DIAS.map((d) => <Link key={d} href={href({ dias: d !== 30 ? String(d) : undefined })} className={chip(d === dias)}>{d} d</Link>)}</nav>
      </div>

      <div className="flex flex-wrap items-center gap-1.5">
        {FILTROS_CHAT.map((f) => <Link key={f.v} href={href({ filtro: f.v !== 'todos' ? f.v : undefined })} className={chip(f.v === filtro)}>{f.l}</Link>)}
        {campanas.length > 0 && <span className="mx-1 text-rs-muted">·</span>}
        {campanas.length > 1 && <Link href={href({ campana: undefined })} className={chip(!campanaSel)}>Todas las campañas</Link>}
        {campanas.length > 1 && campanas.map((c) => <Link key={c.id} href={href({ campana: c.id })} className={chip(c.id === campanaSel)}>{c.nombre}</Link>)}
        <form action="/interacciones" className="ml-auto flex gap-1.5">
          {filtro !== 'todos' && <input type="hidden" name="filtro" value={filtro} />}{campanaSel && <input type="hidden" name="campana" value={campanaSel} />}{dias !== 30 && <input type="hidden" name="dias" value={dias} />}
          <input name="q" defaultValue={q} placeholder="Buscar nombre o teléfono" aria-label="Buscar" className="input h-8 w-48" maxLength={60} />
        </form>
      </div>

      <div className="grid gap-4 lg:grid-cols-[340px_1fr]">
        <aside className="card max-h-[70vh] overflow-y-auto">
          {lista.length === 0 && <EstadoVacio icono={<MessagesSquare size={24} />} titulo="No hay conversaciones" texto="Probá con otro filtro o un período más largo." />}
          {lista.map((c, i) => <FilaChat key={c.tel10} c={c} activa={c.tel10 === k} i={i} href={href({ tel: c.tel10 })} zona={negocio.zona_horaria} />)}
        </aside>

        <section className="card flex max-h-[70vh] flex-col">
          {!activo ? <p className="p-10 text-center text-sm text-rs-muted">Elegí una conversación.</p> : (
            <>
              <header className="flex flex-wrap items-center justify-between gap-2 border-b border-rs-border px-5 py-3">
                <div>
                  <div className="font-semibold">{activo.clienteId ? <Link href={`/clientes/${activo.clienteId}`} className="hover:text-rs-lime">{activo.nombre ?? activo.telefono}</Link> : (activo.nombre ?? activo.telefono)}</div>
                  <div className="text-xs text-rs-muted">+{activo.telefono.replace(/\D/g, '')} · {activo.envios} {activo.envios === 1 ? 'envío' : 'envíos'} de campaña · {activo.entrantes} {activo.entrantes === 1 ? 'mensaje' : 'mensajes'} del cliente</div>
                </div>
                {activo.respondio ? <span className="badge bg-rs-lav/15 text-rs-lav">Respondió</span> : null}
              </header>
              <div className="flex-1 space-y-2 overflow-y-auto p-5">
                {burbujas.map((b, i) => <BurbujaMsg key={b.tipo + b.id} b={b} i={i} zona={negocio.zona_horaria} />)}
              </div>
            </>
          )}
        </section>
      </div>
    </div>
  )
}

function FilaChat({ c, activa, i, href, zona }: { c: ChatResumen; activa: boolean; i: number; href: string; zona: string }) {
  return (
    <Link href={href} style={{ ['--i' as string]: Math.min(i, 10) }} className={'reveal block border-b border-rs-border/60 px-4 py-3 transition-colors last:border-0 hover:bg-rs-raised/50 ' + (activa ? 'border-l-2 border-l-rs-lime bg-rs-raised/60' : '')}>
      <div className="flex items-center justify-between gap-2">
        <span className="truncate text-sm font-medium">{c.nombre || `+${c.telefono.replace(/\D/g, '')}`}</span>
        <span className="shrink-0 text-[11px] text-rs-muted">{fechaHoraCorta(c.ultimaActividad, zona)}</span>
      </div>
      <div className="mt-0.5 flex items-center gap-1.5 text-xs text-rs-muted">
        {c.deQuien === 'campana' ? <Tick estado={c.estado} /> : null}
        <span className={'truncate ' + (c.deQuien === 'cliente' ? 'font-medium text-rs-text' : '')}>{c.vistaPrevia}</span>
        {c.respondio && c.deQuien === 'campana' ? <span className="badge ml-auto bg-rs-lav/15 text-rs-lav">Respondió</span> : null}
      </div>
    </Link>
  )
}

function BurbujaMsg({ b, i, zona }: { b: Burbuja; i: number; zona: string }) {
  if (b.tipo === 'entrante') {
    return (
      <div style={{ ['--i' as string]: Math.min(i, 14) }} className="reveal flex justify-start">
        <div className="max-w-[80%] rounded-2xl bg-rs-raised px-3.5 py-2 text-sm">
          <div className="mb-0.5 text-[10px] font-semibold uppercase tracking-wide opacity-70">Cliente · {fechaHoraCorta(b.cuando, zona)}</div>
          <p className="whitespace-pre-wrap">{textoEntrante(b)}</p>
        </div>
      </div>
    )
  }
  const e = ESTADO[b.estado]
  return (
    <div style={{ ['--i' as string]: Math.min(i, 14) }} className="reveal flex justify-end">
      <div className="max-w-[80%] rounded-2xl bg-rs-lime/15 px-3.5 py-2 text-sm text-rs-text">
        <div className="mb-0.5 text-[10px] font-semibold uppercase tracking-wide opacity-70">Campaña · {fechaHoraCorta(b.cuando, zona)}</div>
        <p className="font-medium">📣 {b.campana}</p>
        {b.detalle && <p className="text-xs text-rs-muted">{b.detalle}</p>}
        <p className={'mt-1 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-xs ' + e.cls}>
          <Tick estado={b.estado} />{e.txt}
          {b.estado === 'leido' && b.leidoEn && <span className="text-rs-muted">· {fechaHoraCorta(b.leidoEn, zona)}</span>}
          {b.estado === 'entregado' && b.entregadoEn && <span className="text-rs-muted">· {fechaHoraCorta(b.entregadoEn, zona)}</span>}
          {b.estado === 'fallido' && b.fallo && <span className="text-rs-muted">· {b.fallo}</span>}
        </p>
      </div>
    </div>
  )
}
