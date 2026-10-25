'use client'

import { useRouter } from 'next/navigation'
import { DIAS_PERIODO } from '@/lib/campanas'
import { iniciarCarga } from '@/lib/carga'

/** Selector de período (últimos N días) para pantallas con filtro por URL (?dias=). */
export default function SelectorDias({ ruta, dias, extra = {} }: { ruta: string; dias: number; extra?: Record<string, string> }) {
  const router = useRouter()
  const ir = (d: string) => {
    const p = new URLSearchParams({ ...extra, dias: d })
    iniciarCarga()
    router.push(`${ruta}?${p.toString()}`)
  }
  return (
    <label className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.05em] text-rs-muted">
      Período:
      <select value={dias} onChange={(e) => ir(e.target.value)} className="input normal-case tracking-normal">
        {DIAS_PERIODO.map((d) => <option key={d} value={d}>Últimos {d} días</option>)}
      </select>
    </label>
  )
}
