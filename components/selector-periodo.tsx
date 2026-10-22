'use client'

import { useRouter } from 'next/navigation'

const OPCIONES = [7, 14, 30, 90, 180]

// Filtro de período: va en una fila sobre los gráficos y aplica a todo lo que está debajo.
export default function SelectorPeriodo({ dias }: { dias: number }) {
  const router = useRouter()
  return (
    <label className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.05em] text-rs-muted">
      Período:
      <select value={dias} onChange={(e) => router.push(`/metricas?dias=${e.target.value}`)} className="input normal-case tracking-normal">
        {OPCIONES.map((d) => <option key={d} value={d}>Últimos {d} días</option>)}
      </select>
    </label>
  )
}
