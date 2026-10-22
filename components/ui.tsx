'use client'

import { useEffect, useRef, useState } from 'react'
import { Loader2 } from 'lucide-react'

export function Spinner({ size = 14 }: { size?: number }) {
  return <Loader2 size={size} className="animate-spin" aria-hidden />
}

/** Número que "cuenta" desde 0 hasta su valor al aparecer (respeta prefers-reduced-motion). */
export function Contador({ valor, ms = 700 }: { valor: number; ms?: number }) {
  const [v, setV] = useState(0)
  const previo = useRef(0)
  useEffect(() => {
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) { setV(valor); return }
    const desde = previo.current, t0 = performance.now()
    let raf = 0
    const paso = (t: number) => {
      const p = Math.min(1, (t - t0) / ms)
      setV(Math.round(desde + (valor - desde) * (1 - Math.pow(1 - p, 3))))
      if (p < 1) raf = requestAnimationFrame(paso)
      else previo.current = valor
    }
    raf = requestAnimationFrame(paso)
    return () => cancelAnimationFrame(raf)
  }, [valor, ms])
  return <>{v}</>
}

/** Barra de progreso que se llena con animación. */
export function Barra({ pct, className = '' }: { pct: number; className?: string }) {
  const [w, setW] = useState(0)
  useEffect(() => { const t = setTimeout(() => setW(Math.min(100, Math.max(0, pct))), 60); return () => clearTimeout(t) }, [pct])
  return (
    <div className="h-2 overflow-hidden rounded-full bg-rs-raised">
      <div className={'h-full rounded-full transition-[width] duration-700 ease-out ' + className} style={{ width: `${w}%` }} />
    </div>
  )
}

export function EstadoVacio({ icono, titulo, texto, children }: { icono: React.ReactNode; titulo: string; texto?: string; children?: React.ReactNode }) {
  return (
    <div className="flex animate-fade-up flex-col items-center px-6 py-12 text-center">
      <div className="mb-4 rounded-full bg-rs-raised p-4 text-rs-lime">{icono}</div>
      <p className="font-semibold">{titulo}</p>
      {texto && <p className="mt-1 max-w-sm text-sm text-rs-muted">{texto}</p>}
      {children && <div className="mt-4">{children}</div>}
    </div>
  )
}
