'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { Check, ChefHat, CircleDot, PackageCheck, Search, Truck, XCircle } from 'lucide-react'
import { estadoPedidoPublico, type SeguimientoPedido } from '@/app/carta/[slug]/actions'
import type { Marca } from '@/lib/marca'
import { labelTipo } from '@/lib/pedidos'
import { PASOS_SEGUIMIENTO } from '@/lib/seguimiento'

const ICONOS = { nuevo: CircleDot, aceptado: Check, preparando: ChefHat, listo: PackageCheck, en_camino: Truck, entregado: PackageCheck } as const
const hora = (iso: string | null) => (iso ? new Date(iso).toLocaleTimeString('es-AR', { timeZone: 'America/Argentina/Buenos_Aires', hour: '2-digit', minute: '2-digit', hour12: false }) : null)
const FINALES = ['entregado', 'cancelado']
const REFRESCO_MS = 20_000

/** Seguimiento público de un pedido: número → estado actual con los pasos. Se actualiza solo mientras el pedido sigue en curso. */
export default function SeguimientoPedidoUI({ slug, nombre, marca, numeroInicial, logoRisto }: { slug: string; nombre: string; marca: Marca; numeroInicial: number | null; logoRisto: string }) {
  const [numero, setNumero] = useState(numeroInicial ? String(numeroInicial) : '')
  const [cargando, setCargando] = useState(false)
  const [error, setError] = useState('')
  const [pedido, setPedido] = useState<Extract<SeguimientoPedido, { ok: true }> | null>(null)
  const volver = useRef('')

  const buscar = useCallback(async (n: string, silencioso = false) => {
    if (!silencioso) { setCargando(true); setError('') }
    const r = await estadoPedidoPublico(slug, Number(n.replace(/\D/g, ''))).catch(() => ({ ok: false as const, error: 'No pudimos consultar el pedido. Probá de nuevo en un momento.' }))
    if (r.ok) { setPedido(r); setError('') } else if (!silencioso) { setPedido(null); setError(r.error) }
    if (!silencioso) setCargando(false)
  }, [slug])

  useEffect(() => { volver.current = window.location.pathname.replace(/\/pedido\/?$/, '') || '/'; if (numeroInicial) void buscar(String(numeroInicial)) }, [numeroInicial, buscar])
  useEffect(() => {
    if (!pedido || FINALES.includes(pedido.estado)) return
    const t = setInterval(() => { void buscar(String(pedido.numero), true) }, REFRESCO_MS)
    return () => clearInterval(t)
  }, [pedido, buscar])

  const pasos = PASOS_SEGUIMIENTO.filter((p) => !('soloDelivery' in p) || pedido?.tipo === 'delivery')
  const indice = pedido ? pasos.findIndex((p) => p.estado === pedido.estado) : -1
  const horaDe: Record<string, string | null> = pedido ? { nuevo: hora(pedido.creado_en), aceptado: hora(pedido.aceptado_en), listo: hora(pedido.listo_en), entregado: hora(pedido.entregado_en) } : {}

  return (
    <div className="min-h-screen">
      <header className="border-b border-rs-raised bg-rs-header px-4 pb-5 pt-8 text-center">
        {marca.logo_url
          ? <img src={marca.logo_url} alt={nombre} className="mx-auto mb-2 h-auto max-h-24 w-auto max-w-[75%] object-contain" />
          : <h1 className="text-2xl font-bold text-rs-lime">{nombre}</h1>}
        <p className="text-sm text-rs-muted">Seguí el estado de tu pedido</p>
      </header>

      <main className="mx-auto max-w-md space-y-4 px-4 py-6">
        <form onSubmit={(e) => { e.preventDefault(); if (numero.trim()) void buscar(numero) }} className="space-y-2">
          <label htmlFor="numero-pedido" className="text-xs font-semibold uppercase tracking-wide text-rs-muted">Número de pedido</label>
          <div className="flex gap-2">
            <input id="numero-pedido" inputMode="numeric" autoComplete="off" placeholder="Ej. 125" value={numero} onChange={(e) => setNumero(e.target.value.replace(/\D/g, '').slice(0, 7))} className="input h-12 min-w-0 flex-1 text-lg" />
            <button disabled={cargando || !numero.trim()} className="btn btn-primary h-12 px-4"><Search size={16} />{cargando ? 'Buscando…' : 'Ver estado'}</button>
          </div>
          <p className="text-xs text-rs-muted">Es el número que te llegó por WhatsApp al hacer el pedido.</p>
        </form>

        {error && <p role="alert" className="rounded-md border border-rs-warn/40 bg-rs-warn/10 px-3 py-2 text-sm text-rs-warn">{error}</p>}

        {pedido && (
          <section className="card space-y-4 p-4" aria-live="polite">
            <div className="flex items-baseline justify-between gap-2">
              <p className="text-3xl font-bold tabular-nums text-rs-lime">#{pedido.numero}</p>
              <p className="text-sm text-rs-muted">{pedido.entrega_nombre || labelTipo(pedido.tipo)}</p>
            </div>
            {pedido.estado === 'cancelado' ? (
              <div className="flex items-start gap-3 rounded-md border border-rs-danger/40 bg-rs-danger/10 p-3 text-rs-danger">
                <XCircle size={22} className="mt-0.5 shrink-0" />
                <div><p className="font-semibold">Pedido cancelado</p><p className="text-sm">Si tenés dudas, escribinos por WhatsApp.</p></div>
              </div>
            ) : (
              <ol className="space-y-0">
                {pasos.map((p, i) => {
                  const hecho = i < indice, actual = i === indice, Icono = ICONOS[p.estado]
                  return (
                    <li key={p.estado} className="flex gap-3">
                      <div className="flex flex-col items-center">
                        <span className={'grid h-8 w-8 shrink-0 place-items-center rounded-full border ' + (actual ? 'border-rs-lime bg-rs-lime text-rs-on-lime' : hecho ? 'border-rs-ok bg-rs-ok/15 text-rs-ok' : 'border-rs-border text-rs-muted')}><Icono size={16} /></span>
                        {i < pasos.length - 1 && <span className={'my-0.5 w-px flex-1 min-h-4 ' + (hecho ? 'bg-rs-ok' : 'bg-rs-border')} />}
                      </div>
                      <div className="pb-3 pt-1">
                        <p className={actual ? 'font-bold' : hecho ? '' : 'text-rs-muted'}>{p.label}</p>
                        {(hecho || actual) && horaDe[p.estado] && <p className="text-xs text-rs-muted">{horaDe[p.estado]} h</p>}
                      </div>
                    </li>
                  )
                })}
              </ol>
            )}
            {!FINALES.includes(pedido.estado) && <p className="text-xs text-rs-muted">Esta pantalla se actualiza sola.</p>}
          </section>
        )}

        <p className="text-center"><a href={volver.current || '#'} className="text-sm text-rs-lime underline underline-offset-2">Volver a la carta</a></p>
      </main>
      <p className="pb-6 text-center text-[11px] text-rs-muted"><img src={logoRisto} alt="" className="mr-1 inline h-3 w-3 rounded-sm align-[-2px]" />Pedidos con Risto Suite</p>
    </div>
  )
}
