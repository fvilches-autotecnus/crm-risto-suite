'use client'

import { useRouter } from 'next/navigation'

const OPCIONES = [7, 14, 30, 90, 180]
const AGRUPAR = [{ v: 'auto', l: 'Automático' }, { v: 'dia', l: 'Por día' }, { v: 'semana', l: 'Por semana' }, { v: 'mes', l: 'Por mes' }]

// Filtros de Métricas: van en una fila sobre los gráficos y aplican a todo lo que está debajo.
export default function SelectorPeriodo({ dias, agrupar }: { dias: number; agrupar: string }) {
  const router = useRouter()
  const ir = (c: Record<string, string>) => {
    const p = new URLSearchParams({ dias: String(dias), ...(agrupar !== 'auto' ? { agrupar } : {}), ...c })
    for (const [k, v] of [...p.entries()]) if (!v) p.delete(k)
    router.push(`/metricas?${p.toString()}`)
  }
  return (
    <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
      <label className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.05em] text-rs-muted">
        Período:
        <select value={dias} onChange={(e) => ir({ dias: e.target.value })} className="input normal-case tracking-normal">
          {OPCIONES.map((d) => <option key={d} value={d}>Últimos {d} días</option>)}
        </select>
      </label>
      <label className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.05em] text-rs-muted">
        Evolución:
        <select value={agrupar} onChange={(e) => ir({ agrupar: e.target.value === 'auto' ? '' : e.target.value })} className="input normal-case tracking-normal">
          {AGRUPAR.map((a) => <option key={a.v} value={a.v}>{a.l}</option>)}
        </select>
      </label>
    </div>
  )
}
