'use client'

import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { Check, ChevronDown } from 'lucide-react'
import { ESTADOS, labelEstado, type EstadoReserva } from '@/lib/reservas'

export const PUNTO_ESTADO: Record<string, string> = {
  nueva: 'bg-rs-lav', confirmada: 'bg-rs-ok', pendiente_pago: 'bg-rs-warn', revisar_pago: 'bg-[#ffb86b]', no_show: 'bg-rs-muted', cancelada: 'bg-rs-danger',
}

/** Menú para cambiar el estado de una reserva a cualquiera de los estados disponibles. */
export default function MenuEstado({ actual, onElegir, deshabilitado }: { actual: EstadoReserva; onElegir: (e: EstadoReserva) => void; deshabilitado?: boolean }) {
  const [abierto, setAbierto] = useState(false)
  const [pos, setPos] = useState<{ top: number; left: number } | null>(null)
  const boton = useRef<HTMLButtonElement>(null)
  const caja = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!abierto) return
    const colocar = () => {
      const r = boton.current?.getBoundingClientRect(); if (!r) return
      const alto = 6 * 36 + 12, ancho = 200
      const abajo = r.bottom + 4 + alto <= window.innerHeight
      setPos({ top: abajo ? r.bottom + 4 : Math.max(8, r.top - alto - 4), left: Math.min(Math.max(8, r.right - ancho), window.innerWidth - ancho - 8) })
    }
    colocar()
    const cerrar = (e: MouseEvent) => { const t = e.target as Node; if (!caja.current?.contains(t) && !boton.current?.contains(t)) setAbierto(false) }
    const tecla = (e: KeyboardEvent) => e.key === 'Escape' && setAbierto(false)
    document.addEventListener('mousedown', cerrar); window.addEventListener('keydown', tecla); window.addEventListener('resize', colocar); window.addEventListener('scroll', colocar, true)
    return () => { document.removeEventListener('mousedown', cerrar); window.removeEventListener('keydown', tecla); window.removeEventListener('resize', colocar); window.removeEventListener('scroll', colocar, true) }
  }, [abierto])

  return (
    <>
      <button ref={boton} type="button" disabled={deshabilitado} onClick={() => setAbierto((a) => !a)} aria-haspopup="menu" aria-expanded={abierto} title="Cambiar estado" className="btn btn-sm">
        Estado <ChevronDown size={12} className={'transition-transform ' + (abierto ? 'rotate-180' : '')} />
      </button>
      {abierto && pos && createPortal(
        <div ref={caja} role="menu" className="fixed z-[80] w-[200px] animate-scale-in rounded-rs-lg border border-rs-control bg-rs-header p-1.5 shadow-2xl shadow-black/70" style={{ top: pos.top, left: pos.left }}>
          {ESTADOS.map((e) => (
            <button key={e.value} role="menuitem" type="button" onClick={() => { setAbierto(false); if (e.value !== actual) onElegir(e.value) }} className="flex w-full items-center gap-2.5 rounded-md px-2.5 py-2 text-left text-sm transition hover:bg-rs-raised">
              <span className={'h-2 w-2 rounded-full ' + PUNTO_ESTADO[e.value]} />
              <span className="flex-1">{labelEstado(e.value)}</span>
              {e.value === actual && <Check size={14} className="text-rs-lime" />}
            </button>
          ))}
        </div>,
        document.body,
      )}
    </>
  )
}
