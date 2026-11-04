'use client'

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { createBrowserClient } from '@supabase/ssr'
import { AlertTriangle, Printer, Power, RotateCcw } from 'lucide-react'
import { activarComandera, confirmarImpresion, liberarImpresion, pendientesComandera, reclamarImpresion } from '@/app/(panel)/pedidos-actions'
import TicketPedido from '@/components/ticket-pedido'
import { Spinner } from '@/components/ui'
import type { DatosTicket } from '@/lib/comandera'
import { fechaHoraCorta } from '@/lib/fechas'

// Impresión automática de la comandera DENTRO de la pantalla de Pedidos: mientras esa pantalla está abierta en la PC del local, cada pedido nuevo imprime su ticket solo
// (sin cuadro de impresión si Chrome corre con --kiosk-printing y la térmica es la impresora predeterminada).

// Cuánto esperar a que el navegador avise que terminó de imprimir ('afterprint'). Con impresión silenciosa puede no llegar nunca (sin papel, impresora apagada…):
// sin este límite UN ticket trabado frenaría todos los que vengan después.
const ESPERA_IMPRESION_MS = 10_000
const SONDEO_MS = 10_000
const RECLAMO_VENCE_MS = 90_000

type EnCola = { p: DatosTicket; manual: boolean }
interface Impresora {
  desde: string | null; sinConexion: boolean; fallidos: DatosTicket[]; cambiando: boolean; error: string
  imprimir: (p: DatosTicket) => void; probar: () => void; reintentar: (p: DatosTicket) => void; cambiar: (activa: boolean) => void
}
const Contexto = createContext<Impresora | null>(null)

/** Para los botones "imprimir" de la lista: null si la impresión automática no está disponible en esta pantalla. */
export const useImpresora = () => useContext(Contexto)

const pitar = () => {
  try {
    const A = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext
    const ctx = new A(), o = ctx.createOscillator(), g = ctx.createGain()
    o.type = 'square'; o.frequency.value = 520; g.gain.value = 0.15; o.connect(g); g.connect(ctx.destination); o.start(); o.stop(ctx.currentTime + 0.6)
  } catch { /* sin sonido */ }
}

const prueba = (): DatosTicket => ({
  id: 'prueba', numero: 0, creado_en: new Date().toISOString(), nombre: 'PRUEBA DE IMPRESIÓN', telefono: null, tipo: 'retiro', entrega_nombre: 'Retiro en el local', mesa: null, direccion: null,
  medio_pago: 'efectivo', medio_pago_nombre: 'Efectivo', observaciones: 'Si ves este ticket, la impresión automática funciona.', subtotal: 0, envio: 0, descuento: 0, descuento_nombre: null, total: 0,
  items: [{ id: 'p1', nombre: 'Producto de ejemplo', variante: 'Variante', cantidad: 1, observaciones: null, subtotal: 0, categoria: 'Categoría' }],
})

export function ComanderaProvider({ negocio, negocioId, desdeInicial, puedeEscribir, children }: { negocio: string; negocioId: string; desdeInicial: string | null; puedeEscribir: boolean; children: ReactNode }) {
  const [desde, setDesde] = useState<string | null>(desdeInicial)
  const [sinConexion, setSinConexion] = useState(false)
  const [fallidos, setFallidos] = useState<DatosTicket[]>([])
  const [imprimiendo, setImprimiendo] = useState<DatosTicket | null>(null)
  const [montado, setMontado] = useState(false)
  const [cambiando, setCambiando] = useState(false)
  const [error, setError] = useState('')

  const cola = useRef<EnCola[]>([])
  const ocupado = useRef(false)
  const actual = useRef<EnCola | null>(null)
  const manejados = useRef(new Set<string>())
  const watchdog = useRef<ReturnType<typeof setTimeout> | null>(null)

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
      const r = await pendientesComandera()
      if (!r.ok) { setSinConexion(true); return }
      setSinConexion(false); setDesde(r.estado.desde)
      for (const p of r.estado.pendientes) {
        const reclamoVigente = p.reclamado_en && Date.now() - new Date(p.reclamado_en).getTime() < RECLAMO_VENCE_MS
        if (manejados.current.has(p.id) || reclamoVigente) continue
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
      if (!hecho.manual) await confirmarImpresion(hecho.p.id).catch(() => false)
      setImprimiendo(null); ocupado.current = false; void procesar()
    }
    window.addEventListener('afterprint', alTerminar)
    return () => window.removeEventListener('afterprint', alTerminar)
  }, [procesar])

  // pedidos nuevos al instante (tiempo real) y, por las dudas, cada pocos segundos; la pantalla de la PC del local queda abierta todo el día
  useEffect(() => {
    setMontado(true)
    if (!puedeEscribir) return
    const sb = createBrowserClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!)
    let activo = true, canal: ReturnType<typeof sb.channel> | null = null, lock: { release: () => Promise<void> } | null = null
    const escuchar = (intento = 1) => {
      const c = sb.channel(`comandera-${negocioId}-${intento}`)
        .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'pedidos', filter: `negocio_id=eq.${negocioId}` }, () => { void refrescar() })
        .subscribe((s) => { if (activo && (s === 'CHANNEL_ERROR' || s === 'TIMED_OUT')) { void sb.removeChannel(c); setTimeout(() => { if (activo) escuchar(intento + 1) }, Math.min(1500 * intento, 15000)) } })
      canal = c
    }
    void (async () => { const { data } = await sb.auth.getSession(); if (!activo) return; if (data.session) sb.realtime.setAuth(data.session.access_token); escuchar() })()
    // que la PC no apague la pantalla mientras esta pantalla está abierta (si el navegador lo permite)
    const pedirPantalla = async () => { try { lock = (await (navigator as unknown as { wakeLock?: { request: (t: string) => Promise<{ release: () => Promise<void> }> } }).wakeLock?.request('screen')) ?? null } catch { /* no disponible */ } }
    const alVolver = () => { if (document.visibilityState === 'visible') { void pedirPantalla(); void refrescar() } }
    document.addEventListener('visibilitychange', alVolver); void pedirPantalla()
    void refrescar()
    const t = setInterval(() => { void refrescar() }, SONDEO_MS)
    return () => { activo = false; clearInterval(t); document.removeEventListener('visibilitychange', alVolver); if (canal) void sb.removeChannel(canal); void lock?.release() }
  }, [negocioId, puedeEscribir, refrescar])

  const valor = useMemo<Impresora>(() => ({
    desde, sinConexion, fallidos, cambiando, error,
    imprimir: (p) => { cola.current.push({ p, manual: true }); void procesar() },
    probar: () => { cola.current.push({ p: prueba(), manual: true }); void procesar() },
    reintentar: (p) => { setFallidos((l) => l.filter((x) => x.id !== p.id)); manejados.current.delete(p.id); void refrescar() },
    cambiar: (activa) => {
      setCambiando(true); setError('')
      void (async () => {
        const r = await activarComandera(activa).catch(() => ({ ok: false as const, error: 'No se pudo conectar' }))
        if (!r.ok) setError(r.error ?? 'No se pudo cambiar la impresión automática')
        await refrescar(); setCambiando(false)
      })()
    },
  }), [desde, sinConexion, fallidos, cambiando, error, procesar, refrescar])

  return (
    <Contexto.Provider value={puedeEscribir ? valor : null}>
      <style>{`@media print { body > *:not(#comandera-print-area) { display: none !important; } #comandera-print-area { display: block !important; } @page { margin: 4mm; } } @media screen { #comandera-print-area { display: none; } }`}</style>
      {children}
      {montado && imprimiendo && createPortal(<div id="comandera-print-area" className="bg-white p-0 text-black"><TicketPedido negocio={negocio} p={imprimiendo} /></div>, document.body)}
    </Contexto.Provider>
  )
}

/** Franja de la pantalla de Pedidos: estado de la impresión automática, interruptor, prueba y alertas si algún ticket no se confirmó. */
export function BarraComandera({ puedeAjustes }: { puedeAjustes: boolean }) {
  const c = useImpresora()
  if (!c) return null
  const { desde } = c
  return (
    <div className="space-y-2">
      <div className="card flex flex-wrap items-center justify-between gap-3 px-4 py-3">
        <div className="min-w-0">
          <p className="flex items-center gap-2 text-sm font-semibold">
            <Printer size={15} className={desde ? 'text-rs-ok' : 'text-rs-muted'} />
            {desde ? 'Impresión automática activada' : 'Impresión automática apagada'}
            {c.sinConexion && <span className="text-xs font-normal text-rs-danger">· sin conexión, reintentando…</span>}
          </p>
          <p className="text-xs text-rs-muted">{desde ? `Imprime cada pedido que entra, desde el ${fechaHoraCorta(desde)}. Dejá esta pantalla abierta.` : 'Al activarla, imprime solo los pedidos que entren desde ese momento.'}</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <button type="button" onClick={c.probar} className="btn btn-sm" title="Imprime un ticket de ejemplo. Si sale un cuadro de impresión, abrí Chrome con --kiosk-printing y dejá la térmica como impresora predeterminada."><Printer size={13} />Imprimir prueba</button>
          {puedeAjustes && <button type="button" disabled={c.cambiando} onClick={() => c.cambiar(!desde)} className={'btn btn-sm ' + (desde ? '' : 'btn-primary')}>{c.cambiando ? <Spinner /> : <Power size={13} />}{desde ? 'Pausar' : 'Activar'}</button>}
        </div>
      </div>
      {c.error && <p role="alert" className="text-sm text-rs-danger">{c.error}</p>}
      {c.fallidos.map((p) => (
        <div key={p.id} role="alert" className="flex flex-wrap items-center justify-between gap-2 rounded-md border border-rs-danger/40 bg-rs-danger/10 px-3 py-2 text-sm text-rs-danger">
          <span className="flex items-center gap-2"><AlertTriangle size={16} />No se confirmó la impresión del pedido #{p.numero}. Revisá papel y conexión de la impresora.</span>
          <button type="button" onClick={() => c.reintentar(p)} className="btn btn-sm"><RotateCcw size={13} />Reintentar</button>
        </div>
      ))}
    </div>
  )
}
