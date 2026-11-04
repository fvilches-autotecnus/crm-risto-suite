'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { createBrowserClient } from '@supabase/ssr'
import { AlertTriangle, Printer, Power, RotateCcw } from 'lucide-react'
import { activarComandera, confirmarImpresion, estadoComandera, liberarImpresion, reclamarImpresion, type EstadoComandera } from '@/app/(panel)/pedidos-actions'
import TicketPedido from '@/components/ticket-pedido'
import { Spinner } from '@/components/ui'
import type { DatosTicket } from '@/lib/comandera'
import { fechaHoraCorta } from '@/lib/fechas'
import { labelEntrega } from '@/lib/pedidos'

// Cuánto esperar a que el navegador avise que terminó de imprimir ('afterprint'). Con impresión silenciosa (--kiosk-printing) puede no llegar nunca
// (sin papel, impresora apagada…): sin este límite UN ticket trabado frenaría todos los que vengan después.
const ESPERA_IMPRESION_MS = 10_000
const SONDEO_MS = 10_000
const RECLAMO_VENCE_MS = 90_000

type EnCola = { p: DatosTicket; manual: boolean }
type Pedido = EstadoComandera['pedidos'][number]

const hora = (iso: string) => new Date(iso).toLocaleTimeString('es-AR', { timeZone: 'America/Argentina/Buenos_Aires', hour: '2-digit', minute: '2-digit' })

const pitar = () => {
  try {
    const A = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext
    const ctx = new A(), o = ctx.createOscillator(), g = ctx.createGain()
    o.type = 'square'; o.frequency.value = 520; g.gain.value = 0.15; o.connect(g); g.connect(ctx.destination); o.start(); o.stop(ctx.currentTime + 0.6)
  } catch { /* sin sonido */ }
}

const PRUEBA: DatosTicket = {
  id: 'prueba', numero: 0, creado_en: new Date().toISOString(), nombre: 'PRUEBA DE IMPRESIÓN', telefono: null, tipo: 'retiro', entrega_nombre: 'Retiro en el local', mesa: null, direccion: null,
  medio_pago: 'efectivo', medio_pago_nombre: 'Efectivo', observaciones: 'Si ves este ticket, la comandera imprime bien.', subtotal: 0, envio: 0, descuento: 0, descuento_nombre: null, total: 0,
  items: [{ id: 'p1', nombre: 'Producto de ejemplo', variante: 'Variante', cantidad: 1, observaciones: null, subtotal: 0, categoria: 'Categoría' }],
}

export default function Comandera({ negocio, negocioId, inicial, puedeAjustes }: { negocio: string; negocioId: string; inicial: EstadoComandera; puedeAjustes: boolean }) {
  const [estado, setEstado] = useState<EstadoComandera>(inicial)
  const [sinConexion, setSinConexion] = useState(false)
  const [fallidos, setFallidos] = useState<DatosTicket[]>([])
  const [imprimiendo, setImprimiendo] = useState<DatosTicket | null>(null)
  const [montado, setMontado] = useState(false)
  const [cambiando, setCambiando] = useState(false)
  const [errorAccion, setErrorAccion] = useState('')

  const cola = useRef<EnCola[]>([])
  const ocupado = useRef(false)
  const actual = useRef<EnCola | null>(null)
  const manejados = useRef(new Set<string>())
  const watchdog = useRef<ReturnType<typeof setTimeout> | null>(null)
  const estadoRef = useRef(estado); estadoRef.current = estado

  const procesar = useCallback(async () => {
    if (ocupado.current) return
    const siguiente = cola.current.shift(); if (!siguiente) return
    ocupado.current = true
    if (!siguiente.manual && !(await reclamarImpresion(siguiente.p.id).catch(() => false))) { ocupado.current = false; void procesar(); return }   // otra pantalla ya lo tomó
    actual.current = siguiente
    setImprimiendo(siguiente.p)
    await new Promise<void>((r) => requestAnimationFrame(() => requestAnimationFrame(() => r())))   // que el ticket esté pintado antes de imprimir
    if (watchdog.current) clearTimeout(watchdog.current)
    watchdog.current = setTimeout(() => {
      const fallo = actual.current; actual.current = null; ocupado.current = false; setImprimiendo(null)
      if (fallo && !fallo.manual) { setFallidos((l) => (l.some((x) => x.id === fallo.p.id) ? l : [...l, fallo.p])); void liberarImpresion(fallo.p.id).catch(() => {}); pitar() }
      void procesar()
    }, ESPERA_IMPRESION_MS)
    window.print()
  }, [])

  const refrescar = useCallback(async () => {
    try {
      const r = await estadoComandera()
      if (!r.ok) { setSinConexion(true); return }
      setSinConexion(false); setEstado(r.estado)
      const { desde, pedidos } = r.estado
      if (!desde) return
      const inicio = new Date(desde).getTime()
      for (const p of [...pedidos].sort((a, b) => a.creado_en.localeCompare(b.creado_en))) {
        const reclamoVigente = p.reclamado_en && Date.now() - new Date(p.reclamado_en).getTime() < RECLAMO_VENCE_MS
        if (new Date(p.creado_en).getTime() < inicio || p.impreso_en || manejados.current.has(p.id) || reclamoVigente) continue
        manejados.current.add(p.id); cola.current.push({ p, manual: false })
      }
      void procesar()
    } catch { setSinConexion(true) }
  }, [procesar])

  // el navegador terminó de imprimir: se confirma en la base y sigue el próximo
  useEffect(() => {
    const alTerminar = async () => {
      if (!ocupado.current || !actual.current) return
      if (watchdog.current) { clearTimeout(watchdog.current); watchdog.current = null }
      const hecho = actual.current; actual.current = null
      if (!hecho.manual) { await confirmarImpresion(hecho.p.id).catch(() => false); setEstado((e) => ({ ...e, pedidos: e.pedidos.map((x) => (x.id === hecho.p.id ? { ...x, impreso_en: new Date().toISOString() } : x)) })) }
      setImprimiendo(null); ocupado.current = false; void procesar()
    }
    window.addEventListener('afterprint', alTerminar)
    return () => window.removeEventListener('afterprint', alTerminar)
  }, [procesar])

  // pedidos nuevos al instante (tiempo real) y, por las dudas, cada pocos segundos; la pantalla de la PC del local queda abierta todo el día
  useEffect(() => {
    setMontado(true)
    const sb = createBrowserClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!)
    let activo = true, canal: ReturnType<typeof sb.channel> | null = null, lock: { release: () => Promise<void> } | null = null
    const escuchar = (intento = 1) => {
      const c = sb.channel(`comandera-${negocioId}-${intento}`)
        .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'pedidos', filter: `negocio_id=eq.${negocioId}` }, () => { void refrescar() })
        .subscribe((s) => { if (activo && (s === 'CHANNEL_ERROR' || s === 'TIMED_OUT')) { void sb.removeChannel(c); setTimeout(() => { if (activo) escuchar(intento + 1) }, Math.min(1500 * intento, 15000)) } })
      canal = c
    }
    void (async () => { const { data } = await sb.auth.getSession(); if (!activo) return; if (data.session) sb.realtime.setAuth(data.session.access_token); escuchar() })()
    const pedirPantalla = async () => { try { lock = (await (navigator as unknown as { wakeLock?: { request: (t: string) => Promise<{ release: () => Promise<void> }> } }).wakeLock?.request('screen')) ?? null } catch { /* no disponible */ } }
    const alVolver = () => { if (document.visibilityState === 'visible') { void pedirPantalla(); void refrescar() } }
    document.addEventListener('visibilitychange', alVolver); void pedirPantalla()
    void refrescar()
    const t = setInterval(() => { void refrescar() }, SONDEO_MS)
    return () => { activo = false; clearInterval(t); document.removeEventListener('visibilitychange', alVolver); if (canal) void sb.removeChannel(canal); void lock?.release() }
  }, [negocioId, refrescar])

  const encolarManual = (p: DatosTicket) => { cola.current.push({ p, manual: true }); void procesar() }
  const reintentar = (p: DatosTicket) => { setFallidos((l) => l.filter((x) => x.id !== p.id)); manejados.current.delete(p.id); void refrescar() }
  const cambiar = async (activa: boolean) => {
    setCambiando(true); setErrorAccion('')
    const r = await activarComandera(activa).catch(() => ({ ok: false as const, error: 'No se pudo conectar' }))
    if (!r.ok) setErrorAccion(r.error ?? 'No se pudo cambiar la comandera')
    await refrescar(); setCambiando(false)
  }

  const { desde, pedidos } = estado
  const estadoImpresion = (p: Pedido) => {
    if (p.impreso_en) return { t: `Impreso ${hora(p.impreso_en)}`, c: 'text-rs-ok' }
    if (!desde) return { t: 'Comandera apagada', c: 'text-rs-muted' }
    if (new Date(p.creado_en) < new Date(desde)) return { t: 'Anterior a la activación', c: 'text-rs-muted' }
    if (fallidos.some((f) => f.id === p.id)) return { t: 'No se confirmó', c: 'text-rs-danger' }
    return { t: 'Pendiente', c: 'text-rs-warn' }
  }

  return (
    <div className="mx-auto max-w-3xl space-y-4 p-4">
      <style>{`@media print { body > *:not(#comandera-print-area) { display: none !important; } #comandera-print-area { display: block !important; } @page { margin: 4mm; } } @media screen { #comandera-print-area { display: none; } }`}</style>
      <header className="flex flex-wrap items-center justify-between gap-2">
        <h1 className="flex items-center gap-2 text-xl font-bold"><Printer size={22} className="text-rs-lime" />Comandera · {negocio}</h1>
        <span className={'rounded-full border border-rs-border px-2.5 py-0.5 text-xs font-semibold ' + (sinConexion ? 'text-rs-danger' : 'text-rs-ok')}>{sinConexion ? 'Sin conexión: reintentando…' : 'Conectada'}</span>
      </header>

      <section className="card space-y-3 p-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="font-semibold">{desde ? 'Impresión automática ACTIVADA' : 'Impresión automática APAGADA'}</p>
            <p className="text-sm text-rs-muted">{desde ? `Imprime los pedidos que entraron desde el ${fechaHoraCorta(desde)}. Dejá esta pantalla abierta.` : 'Al activarla, imprime solo los pedidos que entren a partir de ese momento (los anteriores no).'}</p>
          </div>
          {puedeAjustes && (
            <button disabled={cambiando} onClick={() => cambiar(!desde)} className={'btn ' + (desde ? '' : 'btn-primary')}>
              {cambiando ? <Spinner /> : <Power size={14} />}{desde ? 'Pausar' : 'Activar'}
            </button>
          )}
        </div>
        {errorAccion && <p role="alert" className="text-sm text-rs-danger">{errorAccion}</p>}
        <div className="flex flex-wrap items-center gap-2">
          <button onClick={() => encolarManual({ ...PRUEBA, creado_en: new Date().toISOString() })} className="btn btn-sm"><Printer size={13} />Imprimir prueba</button>
          <p className="text-xs text-rs-muted">Si sale un cuadro de impresión, falta abrir Chrome con <span className="font-mono">--kiosk-printing</span> y dejar la térmica como impresora predeterminada.</p>
        </div>
      </section>

      {fallidos.map((p) => (
        <div key={p.id} role="alert" className="flex flex-wrap items-center justify-between gap-2 rounded-md border border-rs-danger/40 bg-rs-danger/10 px-3 py-2 text-sm text-rs-danger">
          <span className="flex items-center gap-2"><AlertTriangle size={16} />No se confirmó la impresión del pedido #{p.numero}. Revisá papel y conexión de la impresora.</span>
          <button onClick={() => reintentar(p)} className="btn btn-sm"><RotateCcw size={13} />Reintentar</button>
        </div>
      ))}

      <section className="card p-4">
        <h2 className="card-title mb-2">Últimos pedidos</h2>
        {pedidos.length === 0 ? <p className="text-sm text-rs-muted">Todavía no hay pedidos.</p> : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead><tr className="text-left text-xs text-rs-muted"><th className="py-1 pr-3">Pedido</th><th className="pr-3">Hora</th><th className="pr-3">Cliente</th><th className="pr-3">Entrega</th><th className="pr-3">Impresión</th><th /></tr></thead>
              <tbody>
                {pedidos.map((p) => { const e = estadoImpresion(p); return (
                  <tr key={p.id} className="border-t border-rs-border/50">
                    <td className="py-1.5 pr-3 font-semibold tabular-nums">#{p.numero}</td>
                    <td className="pr-3 tabular-nums">{hora(p.creado_en)}</td>
                    <td className="pr-3">{p.nombre}</td>
                    <td className="pr-3">{labelEntrega(p)}</td>
                    <td className={'pr-3 ' + e.c}>{e.t}</td>
                    <td className="text-right"><button onClick={() => encolarManual(p)} className="btn btn-sm" title="Imprimir otra vez"><Printer size={13} />Reimprimir</button></td>
                  </tr>
                ) })}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {montado && imprimiendo && createPortal(<div id="comandera-print-area" className="bg-white p-0 text-black"><TicketPedido negocio={negocio} p={imprimiendo} /></div>, document.body)}
    </div>
  )
}
