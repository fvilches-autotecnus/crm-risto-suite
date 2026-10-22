'use client'

import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { X } from 'lucide-react'

/**
 * Diálogo modal. Se dibuja en <body> (portal) para que ninguna tabla, tarjeta ni contenedor con
 * overflow/transform lo recorte, y se centra con scroll propio cuando es más alto que la pantalla.
 */
export default function Modal({ titulo, onClose, children, ancho = 'max-w-lg' }: { titulo: string; onClose: () => void; children: React.ReactNode; ancho?: string }) {
  const caja = useRef<HTMLDivElement>(null)
  const [montado, setMontado] = useState(false)
  useEffect(() => setMontado(true), [])

  useEffect(() => {
    if (!montado) return
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose()
    window.addEventListener('keydown', onKey)
    // evita que la página de fondo se desplace mientras el diálogo está abierto
    const previo = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    // foco en el primer campo (o en el diálogo) para poder escribir/usar teclado enseguida
    const t = setTimeout(() => {
      // solo si el foco todavía no está dentro del diálogo (no le pisamos un campo que la persona ya eligió)
      if (caja.current && document.activeElement !== caja.current && caja.current.contains(document.activeElement)) return
      ;(caja.current?.querySelector<HTMLElement>('input:not([type=hidden]):not([disabled]), select, textarea') ?? caja.current)?.focus()
    }, 30)
    return () => { window.removeEventListener('keydown', onKey); document.body.style.overflow = previo; clearTimeout(t) }
  }, [onClose, montado])

  if (!montado) return null
  return createPortal(
    <div className="fixed inset-0 z-50 animate-fade-in overflow-y-auto bg-black/70 backdrop-blur-sm" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      {/* min-h-full + items-center: se centra si entra, y si es más alto que la pantalla se puede desplazar completo (sin cortar el borde superior) */}
      <div className="flex min-h-full items-start justify-center p-4 sm:items-center" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
        <div ref={caja} tabIndex={-1} role="dialog" aria-modal="true" aria-label={titulo} className={'card my-4 w-full animate-scale-in border-rs-control p-5 shadow-2xl shadow-black/60 outline-none ' + ancho}>
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-base font-bold">{titulo}</h2>
            <button onClick={onClose} aria-label="Cerrar" className="rounded-md p-1 text-rs-muted transition hover:rotate-90 hover:bg-rs-raised hover:text-rs-text"><X size={18} /></button>
          </div>
          {children}
        </div>
      </div>
    </div>,
    document.body,
  )
}
