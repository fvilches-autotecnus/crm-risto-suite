'use client'
import { NombreApellidoInput } from '@/components/inputs'
import { diaMesDe } from '@/lib/fechas'

import Link from 'next/link'
import { useEffect, useMemo, useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { createBrowserClient } from '@supabase/ssr'
import { Check, ExternalLink, MessageCircle, Phone, Plus, Power, Printer, Settings, ShoppingBag, Trash2, X } from 'lucide-react'
import { alternarRecibePedidos, cambiarEstadoPedido, crearPedidoManual } from '@/app/(panel)/pedidos-actions'
import { useToast } from '@/components/feedback'
import Modal from '@/components/modal'
import { EstadoVacio, Spinner } from '@/components/ui'
import { useAccionFormulario } from '@/components/use-accion-formulario'
import { costoEnvioFinal } from '@/lib/pedidos-horarios'
import {
  ESTADOS_PEDIDO, dinero, labelEntrega, labelPago, linkWhatsApp, mensajeWhatsApp, siguientePaso,
  type ConfigPedidos, type Pedido,
} from '@/lib/pedidos'

export interface OpcionCatalogo { clave: string; producto_id: string; variante: string | null; label: string; precio: number; categoria: string }

const hace = (iso: string) => {
  const m = Math.max(0, Math.round((Date.now() - new Date(iso).getTime()) / 60000))
  return m < 1 ? 'recién' : m < 60 ? `hace ${m} min` : m < 1440 ? `hace ${Math.floor(m / 60)} h` : diaMesDe(iso)
}
const hora = (iso: string) => new Date(iso).toLocaleTimeString('es-AR', { timeZone: 'America/Argentina/Buenos_Aires', hour: '2-digit', minute: '2-digit' })

function useCerrarAlGuardar(state: { ok: boolean } | null, texto: string, onDone: () => void) {
  const toast = useToast()
  useEffect(() => { if (state?.ok) { toast({ texto }); onDone() } }, [state]) // eslint-disable-line react-hooks/exhaustive-deps
}
function Acciones({ pending, texto, onCancel }: { pending: boolean; texto: string; onCancel: () => void }) {
  return (
    <div className="mt-2 flex justify-end gap-2">
      <button type="button" onClick={onCancel} className="btn">Cancelar</button>
      <button disabled={pending} className="btn btn-primary">{pending && <Spinner />}{pending ? 'Guardando…' : texto}</button>
    </div>
  )
}

/** Mantiene la pantalla al día: un pedido nuevo o un cambio de estado (de otra persona del equipo) recarga la lista solo. */
export function PedidosEnVivo({ negocioId }: { negocioId: string }) {
  const router = useRouter()
  useEffect(() => {
    const sb = createBrowserClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!)
    let activo = true, timer: ReturnType<typeof setTimeout> | null = null, canal: ReturnType<typeof sb.channel> | null = null, conectado = false
    const recargar = () => { if (timer) return; timer = setTimeout(() => { timer = null; if (activo) router.refresh() }, 500) }
    const escuchar = (intento = 1) => {
      const c = sb.channel(`pedidos-${negocioId}-${intento}`)
        .on('postgres_changes', { event: '*', schema: 'public', table: 'pedidos', filter: `negocio_id=eq.${negocioId}` }, recargar)
        .subscribe((estado) => {
          if (!activo) return
          if (estado === 'SUBSCRIBED') { if (conectado) recargar(); conectado = true; return }
          if (estado !== 'CHANNEL_ERROR' && estado !== 'TIMED_OUT') return
          void sb.removeChannel(c); setTimeout(() => { if (activo) escuchar(intento + 1) }, Math.min(1500 * intento, 15000))
        })
      canal = c
    }
    void (async () => {
      const { data } = await sb.auth.getSession(); if (!activo) return
      if (data.session) sb.realtime.setAuth(data.session.access_token)
      escuchar()
    })()
    return () => { activo = false; if (timer) clearTimeout(timer); if (canal) void sb.removeChannel(canal) }
  }, [negocioId, router])
  return null
}

// ---------------------------------------------------------------------------
// Lista de pedidos
// ---------------------------------------------------------------------------
function DialogoCancelar({ pedido, onClose, onConfirmar }: { pedido: Pedido; onClose: () => void; onConfirmar: (motivo: string) => void }) {
  const [motivo, setMotivo] = useState('')
  return (
    <Modal titulo={`Cancelar el pedido #${pedido.numero}`} onClose={onClose}>
      <div className="space-y-3">
        <p className="text-sm text-rs-muted">Opcionalmente, anotá el motivo (queda en el pedido y en el mensaje de aviso al cliente).</p>
        <input autoFocus value={motivo} onChange={(e) => setMotivo(e.target.value)} maxLength={200} placeholder="Ej. Sin stock de un producto" aria-label="Motivo de la cancelación" className="input w-full" />
        <div className="flex justify-end gap-2"><button type="button" onClick={onClose} className="btn">Volver</button><button type="button" onClick={() => onConfirmar(motivo)} className="btn btn-danger">Cancelar pedido</button></div>
      </div>
    </Modal>
  )
}

export function ListaPedidos({ pedidos, negocio, tiempo, puedeEscribir }: { pedidos: Pedido[]; negocio: string; tiempo: string | null; puedeEscribir: boolean }) {
  const toast = useToast()
  const [pend, start] = useTransition()
  const [cancelando, setCancelando] = useState<Pedido | null>(null)
  const mover = (p: Pedido, estado: string, motivo?: string) => start(async () => {
    const r = await cambiarEstadoPedido(p.id, estado, motivo)
    toast(r.ok ? { texto: `Pedido #${p.numero}: ${ESTADOS_PEDIDO.find((e) => e.value === estado)?.label.toLowerCase()}` } : { tipo: 'error', texto: r.error ?? 'Error' })
  })
  if (pedidos.length === 0) return <div className="card"><EstadoVacio icono={<ShoppingBag size={26} />} titulo="No hay pedidos para mostrar" texto="Cuando un cliente haga un pedido desde la carta, el bot o lo cargues a mano, aparece acá al instante." /></div>
  return (
    <>
      <ul className="grid gap-3 lg:grid-cols-2">
        {pedidos.map((p) => {
          const est = ESTADOS_PEDIDO.find((e) => e.value === p.estado)!
          const paso = siguientePaso(p)
          const abierto = !['entregado', 'cancelado'].includes(p.estado)
          return (
            <li key={p.id} className={'card flex flex-col gap-3 p-4 ' + (p.estado === 'nuevo' ? 'border-rs-lav/50 shadow-[0_0_24px_-10px_rgba(165,180,252,.6)]' : '')}>
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-lg font-bold tabular-nums">#{p.numero}</span>
                  <span className={'badge ' + est.color}><span className={'h-1.5 w-1.5 rounded-full ' + est.punto} />{est.label}</span>
                  <span className="badge bg-rs-raised text-rs-text">{labelEntrega(p)}{p.tipo === 'mesa' && p.mesa ? ` ${p.mesa}` : ''}</span>
                  {p.origen !== 'web' && <span className="badge bg-rs-raised text-rs-muted">{p.origen === 'bot' ? 'Bot' : 'Manual'}</span>}
                </div>
                <span className="text-xs text-rs-muted" title={new Date(p.creado_en).toLocaleString('es-AR')}>{hora(p.creado_en)} · {hace(p.creado_en)}</span>
              </div>
              <div className="text-sm">
                <p className="font-semibold">{p.nombre}</p>
                <p className="flex flex-wrap items-center gap-x-3 text-rs-muted">
                  {p.telefono && <span className="inline-flex items-center gap-1"><Phone size={12} />{p.telefono}</span>}
                  {p.direccion && <span>📍 {p.direccion}</span>}
                </p>
              </div>
              <ul className="divide-y divide-rs-border/50 rounded-md bg-rs-raised/40 px-3 text-sm">
                {p.items.map((i) => (
                  <li key={i.id} className="flex items-start justify-between gap-3 py-2">
                    <span><span className="font-semibold tabular-nums">{i.cantidad}×</span> {i.nombre}{i.variante ? <span className="text-rs-muted"> · {i.variante}</span> : null}{i.observaciones && <span className="block text-xs text-rs-warn">“{i.observaciones}”</span>}</span>
                    <span className="shrink-0 tabular-nums text-rs-muted">{dinero(i.subtotal)}</span>
                  </li>
                ))}
              </ul>
              {p.observaciones && <p className="rounded-md border border-rs-warn/30 bg-rs-warn/10 px-3 py-2 text-sm text-rs-warn">📝 {p.observaciones}</p>}
              {p.estado === 'cancelado' && p.motivo_cancelacion && <p className="text-sm text-rs-danger">Motivo: {p.motivo_cancelacion}</p>}
              <div className="flex flex-wrap items-center justify-between gap-2 text-sm">
                <span className="text-rs-muted">{labelPago(p.medio_pago, p.medio_pago_nombre)}{p.envio > 0 ? ` · envío ${dinero(p.envio)}` : ''}</span>
                <span className="text-lg font-bold tabular-nums text-rs-lime">{dinero(p.total)}</span>
              </div>
              <div className="flex flex-wrap items-center gap-2 border-t border-rs-border/60 pt-3">
                {puedeEscribir && paso && <button disabled={pend} onClick={() => mover(p, paso.estado)} className="btn btn-primary"><Check size={14} />{paso.label}</button>}
                {puedeEscribir && abierto && <button disabled={pend} onClick={() => setCancelando(p)} className="btn btn-danger btn-sm"><X size={13} />Cancelar</button>}
                {puedeEscribir && !abierto && <button disabled={pend} onClick={() => mover(p, 'nuevo')} className="btn btn-sm">Reabrir</button>}
                <span className="ml-auto flex items-center gap-1.5">
                  {p.telefono && <a href={linkWhatsApp(p.telefono, mensajeWhatsApp(p, negocio, tiempo))} target="_blank" rel="noopener noreferrer" className="btn btn-sm" title="Avisar al cliente por WhatsApp (el mensaje cambia según el estado)"><MessageCircle size={13} />WhatsApp</a>}
                  <a href={`/ticket/${p.id}`} target="_blank" rel="noopener noreferrer" className="btn btn-sm" title="Imprimir ticket"><Printer size={13} /></a>
                </span>
              </div>
            </li>
          )
        })}
      </ul>
      {cancelando && <DialogoCancelar pedido={cancelando} onClose={() => setCancelando(null)} onConfirmar={(m) => { const p = cancelando; setCancelando(null); mover(p, 'cancelado', m) }} />}
    </>
  )
}

// ---------------------------------------------------------------------------
// Ajustes y pedido manual
// ---------------------------------------------------------------------------
interface LineaManual { clave: string; cantidad: number }
function FormManual({ catalogo, config, onDone }: { catalogo: OpcionCatalogo[]; config: ConfigPedidos; onDone: () => void }) {
  const { state, pending, formProps } = useAccionFormulario(crearPedidoManual)
  useCerrarAlGuardar(state, 'Pedido creado', onDone)
  const entregas = config.entregas.filter((e) => e.activo).length ? config.entregas.filter((e) => e.activo) : config.entregas
  const [tipo, setTipo] = useState<string>(entregas[0]?.clave ?? 'retiro')
  const ent = entregas.find((e) => e.clave === tipo) ?? entregas[0]
  const base = ent?.base ?? 'retiro'
  const [lineas, setLineas] = useState<LineaManual[]>([{ clave: '', cantidad: 1 }])
  const porClave = useMemo(() => new Map(catalogo.map((o) => [o.clave, o])), [catalogo])
  const items = lineas.filter((l) => porClave.has(l.clave)).map((l) => ({ producto_id: porClave.get(l.clave)!.producto_id, variante: porClave.get(l.clave)!.variante, cantidad: l.cantidad }))
  const subtotal = lineas.reduce((s, l) => s + (porClave.get(l.clave)?.precio ?? 0) * l.cantidad, 0)
  const envio = ent ? costoEnvioFinal(ent, subtotal) : 0
  const grupos = useMemo(() => { const m = new Map<string, OpcionCatalogo[]>(); for (const o of catalogo) m.set(o.categoria, [...(m.get(o.categoria) ?? []), o]); return [...m] }, [catalogo])
  return (
    <form {...formProps} className="grid grid-cols-2 gap-3">
      <input type="hidden" name="items" value={JSON.stringify(items)} />
      <div className="col-span-2"><span className="label">Tipo</span><div className="flex flex-wrap gap-2">{entregas.map((t) => <label key={t.clave} className="flex cursor-pointer items-center gap-1.5 rounded-full border border-rs-control px-3 py-1 text-sm has-[:checked]:border-rs-lime/60 has-[:checked]:bg-rs-lime/10"><input type="radio" name="tipo" value={t.clave} checked={tipo === t.clave} onChange={() => setTipo(t.clave)} className="sr-only" />{t.etiqueta}</label>)}</div></div>
      <div className="col-span-2"><NombreApellidoInput id="pm_nombre" name="nombre" nombreRequerido={base !== 'mesa'} /></div>
      <div className="col-span-2 sm:col-span-1"><label className="label" htmlFor="pm_tel">Teléfono {base === 'mesa' ? '' : '*'}</label><input id="pm_tel" name="telefono" inputMode="tel" placeholder="Ej. 341 6582156" className="input w-full" required={base !== 'mesa'} /></div>
      {base === 'delivery' && <div className="col-span-2"><label className="label" htmlFor="pm_dir">Dirección *</label><input id="pm_dir" name="direccion" maxLength={200} className="input w-full" required /></div>}
      {base === 'mesa' && <div className="col-span-2 sm:col-span-1"><label className="label" htmlFor="pm_mesa">Mesa *</label><input id="pm_mesa" name="mesa" maxLength={20} className="input w-full" required /></div>}
      <div className="col-span-2">
        <span className="label">Productos</span>
        <ul className="space-y-2">
          {lineas.map((l, i) => (
            <li key={i} className="grid grid-cols-[1fr_70px_auto] items-center gap-2">
              <select aria-label={`Producto ${i + 1}`} value={l.clave} onChange={(e) => setLineas((x) => x.map((y, k) => (k === i ? { ...y, clave: e.target.value } : y)))} className="input min-w-0">
                <option value="">Elegir producto…</option>
                {grupos.map(([cat, ops]) => <optgroup key={cat} label={cat}>{ops.map((o) => <option key={o.clave} value={o.clave}>{o.label} — {dinero(o.precio)}</option>)}</optgroup>)}
              </select>
              <input aria-label={`Cantidad ${i + 1}`} type="number" min={1} max={99} value={l.cantidad} onChange={(e) => setLineas((x) => x.map((y, k) => (k === i ? { ...y, cantidad: Math.max(1, Math.min(99, Number(e.target.value) || 1)) } : y)))} className="input" />
              <button type="button" onClick={() => setLineas((x) => (x.length > 1 ? x.filter((_, k) => k !== i) : [{ clave: '', cantidad: 1 }]))} aria-label="Quitar producto" className="btn btn-sm btn-danger w-8 px-0"><Trash2 size={13} /></button>
            </li>
          ))}
        </ul>
        <button type="button" onClick={() => setLineas((x) => [...x, { clave: '', cantidad: 1 }])} className="btn btn-sm mt-2"><Plus size={12} />Agregar producto</button>
      </div>
      <div className="col-span-2 sm:col-span-1"><label className="label" htmlFor="pm_pago">Medio de pago</label><select id="pm_pago" name="medio_pago" className="input w-full">{(config.medios.some((m) => m.activo) ? config.medios.filter((m) => m.activo) : config.medios).map((m) => <option key={m.clave} value={m.clave}>{m.etiqueta}</option>)}</select></div>
      <div className="col-span-2 sm:col-span-1 self-end text-right text-sm"><span className="text-rs-muted">Subtotal {dinero(subtotal)}{envio ? ` + envío ${dinero(envio)}` : ''}</span><div className="text-lg font-bold text-rs-lime">{dinero(subtotal + envio)}</div></div>
      <div className="col-span-2"><label className="label" htmlFor="pm_obs">Observaciones</label><textarea id="pm_obs" name="observaciones" rows={2} maxLength={500} placeholder="Aclaraciones del pedido" className="input w-full" /></div>
      {state && !state.ok && <p role="alert" className="col-span-2 text-sm text-rs-danger">{state.error}</p>}
      <div className="col-span-2"><Acciones pending={pending} texto="Crear pedido" onCancel={onDone} /></div>
    </form>
  )
}

export function BotonesPedidos({ config, catalogo, slug, puedeEscribir, puedeAjustes, hayConfig }: { config: ConfigPedidos; catalogo: OpcionCatalogo[]; slug: string; puedeEscribir: boolean; puedeAjustes: boolean; hayConfig: boolean }) {
  const toast = useToast()
  const [modal, setModal] = useState<'manual' | null>(null)
  const [pend, start] = useTransition()
  const alternar = () => start(async () => { const r = await alternarRecibePedidos(); toast(r.ok ? { texto: config.recibe ? 'Pedidos en pausa' : 'Ya se reciben pedidos' } : { tipo: 'error', texto: r.error ?? 'Error' }) })
  return (
    <>
      <div className="flex flex-wrap items-center gap-2">
        {puedeAjustes && hayConfig && (
          <button type="button" role="switch" aria-checked={config.recibe} disabled={pend} onClick={alternar} title={config.recibe ? 'Tocá para pausar los pedidos' : 'Tocá para empezar a recibir pedidos'}
            className={'inline-flex h-9 items-center gap-2 rounded-rs border px-3 text-sm font-semibold transition ' + (config.recibe ? 'border-rs-ok/50 bg-rs-ok/10 text-rs-ok' : 'border-rs-danger/50 bg-rs-danger/10 text-rs-danger')}>
            {pend ? <Spinner /> : <Power size={14} />}{config.recibe ? 'Recibiendo pedidos' : 'Pedidos en pausa'}
          </button>
        )}
        <a href={`/carta/${slug}`} target="_blank" rel="noopener noreferrer" className="btn"><ExternalLink size={14} />Ver carta</a>
        {puedeAjustes && <Link href="/configuracion#pedidos-general" className="btn"><Settings size={14} />Ajustes</Link>}
        {puedeEscribir && <button type="button" onClick={() => setModal('manual')} disabled={catalogo.length === 0} title={catalogo.length === 0 ? 'Cargá productos con precio en la Carta primero' : undefined} className="btn btn-primary"><Plus size={14} />Nuevo pedido</button>}
      </div>
      {modal === 'manual' && <Modal titulo="Nuevo pedido" onClose={() => setModal(null)} ancho="max-w-2xl"><FormManual catalogo={catalogo} config={config} onDone={() => setModal(null)} /></Modal>}
    </>
  )
}
