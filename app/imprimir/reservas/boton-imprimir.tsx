'use client'

import { useEffect } from 'react'

/** Botón "Imprimir / guardar PDF" de la hoja de reservas (se oculta al imprimir). Con ?auto=1 abre el diálogo de impresión solo. */
export default function BotonImprimir({ auto }: { auto: boolean }) {
  useEffect(() => { if (auto) { const t = setTimeout(() => window.print(), 500); return () => clearTimeout(t) } }, [auto])
  return (
    <div className="mb-4 flex flex-wrap items-center gap-3 print:hidden">
      <button onClick={() => window.print()} className="rounded border border-black bg-black px-4 py-1.5 text-sm font-semibold text-white">Imprimir / guardar como PDF</button>
      <span className="text-xs text-neutral-600">En el cuadro de impresión elegí “Guardar como PDF” para descargarla.</span>
    </div>
  )
}
