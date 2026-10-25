'use client'

import { useEffect } from 'react'

/** Botón "Imprimir" del ticket (se oculta al imprimir). Con ?auto=1 abre el diálogo de impresión solo. */
export default function BotonImprimir({ auto }: { auto: boolean }) {
  useEffect(() => { if (auto) { const t = setTimeout(() => window.print(), 400); return () => clearTimeout(t) } }, [auto])
  return <button onClick={() => window.print()} className="mx-auto mb-4 block rounded border border-black px-4 py-1.5 text-sm font-semibold print:hidden">Imprimir</button>
}
