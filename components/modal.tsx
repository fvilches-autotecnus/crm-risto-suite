'use client'

import { useEffect } from 'react'
import { X } from 'lucide-react'

export default function Modal({ titulo, onClose, children, ancho = 'max-w-lg' }: { titulo: string; onClose: () => void; children: React.ReactNode; ancho?: string }) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose()
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])
  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/70 p-4 sm:items-center" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div role="dialog" aria-modal="true" aria-label={titulo} className={'card my-4 w-full border-rs-control p-5 ' + ancho}>
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-base font-bold">{titulo}</h2>
          <button onClick={onClose} aria-label="Cerrar" className="text-rs-muted hover:text-rs-text"><X size={18} /></button>
        </div>
        {children}
      </div>
    </div>
  )
}
