'use client'

import { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react'
import { AlertTriangle, CheckCircle2, Info, X, XCircle } from 'lucide-react'

// ---------------------------------------------------------------------------
// Toasts: avisos breves de "listo" / "error", con acción opcional (ej. Deshacer)
// ---------------------------------------------------------------------------
type Tipo = 'ok' | 'error' | 'info'
interface ToastIn { tipo?: Tipo; texto: string; accion?: { label: string; onClick: () => void }; ms?: number }
interface ToastItem extends ToastIn { id: number }

const ToastCtx = createContext<((t: ToastIn) => void) | null>(null)
export const useToast = () => {
  const c = useContext(ToastCtx)
  if (!c) throw new Error('useToast fuera de FeedbackProvider')
  return c
}

const ICONO = { ok: CheckCircle2, error: XCircle, info: Info }
const COLOR = { ok: 'text-rs-ok', error: 'text-rs-danger', info: 'text-rs-lav' }

function ToastView({ t, cerrar }: { t: ToastItem; cerrar: () => void }) {
  const ms = t.ms ?? (t.accion ? 7000 : t.tipo === 'error' ? 6000 : 3800)
  useEffect(() => { const x = setTimeout(cerrar, ms); return () => clearTimeout(x) }, [ms, cerrar])
  const tipo = t.tipo ?? 'ok'
  const Icono = ICONO[tipo]
  return (
    <div role={tipo === 'error' ? 'alert' : 'status'} className="pointer-events-auto relative w-full max-w-sm animate-slide-in overflow-hidden rounded-rs-lg border border-rs-control bg-rs-header/95 shadow-xl shadow-black/50 backdrop-blur">
      <div className="flex items-start gap-3 px-4 py-3">
        <Icono size={18} className={'mt-0.5 shrink-0 ' + COLOR[tipo]} />
        <p className="flex-1 text-sm">{t.texto}</p>
        {t.accion && <button onClick={() => { t.accion!.onClick(); cerrar() }} className="shrink-0 rounded-md px-2 py-0.5 text-sm font-semibold text-rs-lime transition hover:bg-rs-lime/10">{t.accion.label}</button>}
        <button onClick={cerrar} aria-label="Cerrar aviso" className="shrink-0 text-rs-muted transition hover:text-rs-text"><X size={14} /></button>
      </div>
      <div className={'absolute bottom-0 left-0 h-0.5 w-full origin-left ' + (tipo === 'error' ? 'bg-rs-danger' : 'bg-rs-lime')} style={{ animation: `toast-bar ${ms}ms linear forwards` }} />
    </div>
  )
}

// ---------------------------------------------------------------------------
// Confirmaciones propias (reemplazan a window.confirm)
// ---------------------------------------------------------------------------
interface ConfirmOpts { titulo: string; texto?: string; confirmar?: string; peligro?: boolean }
const ConfirmCtx = createContext<((o: ConfirmOpts) => Promise<boolean>) | null>(null)
export const useConfirm = () => {
  const c = useContext(ConfirmCtx)
  if (!c) throw new Error('useConfirm fuera de FeedbackProvider')
  return c
}

function ConfirmView({ o, resolver }: { o: ConfirmOpts; resolver: (v: boolean) => void }) {
  const boton = useRef<HTMLButtonElement>(null)
  useEffect(() => {
    boton.current?.focus()
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && resolver(false)
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [resolver])
  return (
    <div className="fixed inset-0 z-[60] flex animate-fade-in items-center justify-center bg-black/70 p-4 backdrop-blur-sm" onMouseDown={(e) => e.target === e.currentTarget && resolver(false)}>
      <div role="alertdialog" aria-modal="true" aria-label={o.titulo} className="card w-full max-w-sm animate-scale-in border-rs-control p-5 shadow-2xl shadow-black/60">
        <div className="flex items-start gap-3">
          <span className={'mt-0.5 rounded-full p-2 ' + (o.peligro ? 'bg-rs-danger/15 text-rs-danger' : 'bg-rs-lime/15 text-rs-lime')}><AlertTriangle size={18} /></span>
          <div>
            <h2 className="text-base font-bold">{o.titulo}</h2>
            {o.texto && <p className="mt-1 text-sm text-rs-muted">{o.texto}</p>}
          </div>
        </div>
        <div className="mt-5 flex justify-end gap-2">
          <button onClick={() => resolver(false)} className="btn">Cancelar</button>
          <button ref={boton} onClick={() => resolver(true)} className={'btn ' + (o.peligro ? 'btn-danger border-rs-danger/60 bg-rs-danger/10' : 'btn-primary')}>{o.confirmar ?? 'Confirmar'}</button>
        </div>
      </div>
    </div>
  )
}

export function FeedbackProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<ToastItem[]>([])
  const seq = useRef(0)
  const toast = useCallback((t: ToastIn) => setToasts((l) => [...l.slice(-3), { ...t, id: ++seq.current }]), [])
  const quitar = useCallback((id: number) => setToasts((l) => l.filter((x) => x.id !== id)), [])

  const [pregunta, setPregunta] = useState<{ o: ConfirmOpts; res: (v: boolean) => void } | null>(null)
  const confirmar = useCallback((o: ConfirmOpts) => new Promise<boolean>((res) => setPregunta({ o, res })), [])
  const resolver = useCallback((v: boolean) => setPregunta((p) => { p?.res(v); return null }), [])

  return (
    <ToastCtx.Provider value={toast}>
      <ConfirmCtx.Provider value={confirmar}>
        {children}
        <div aria-live="polite" className="pointer-events-none fixed inset-x-0 bottom-0 z-[70] flex flex-col items-end gap-2 p-4">
          {toasts.map((t) => <ToastView key={t.id} t={t} cerrar={() => quitar(t.id)} />)}
        </div>
        {pregunta && <ConfirmView o={pregunta.o} resolver={resolver} />}
      </ConfirmCtx.Provider>
    </ToastCtx.Provider>
  )
}

/** Muestra un aviso cada vez que cambia el resultado de una acción de formulario (guardado / error). */
export function useResultado(state: { ok: boolean; error?: string } | null, okTexto: string) {
  const toast = useToast()
  useEffect(() => {
    if (!state) return
    toast(state.ok ? { texto: okTexto } : { tipo: 'error', texto: state.error ?? 'Ocurrió un error' })
  }, [state]) // eslint-disable-line react-hooks/exhaustive-deps
}
