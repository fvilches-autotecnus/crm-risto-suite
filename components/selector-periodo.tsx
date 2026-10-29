'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { FechaInput } from '@/components/inputs'
import { iniciarCarga } from '@/lib/carga'

const OPCIONES = [7, 14, 30, 90, 180]
const AGRUPAR = [{ v: 'auto', l: 'Automático' }, { v: 'dia', l: 'Por día' }, { v: 'semana', l: 'Por semana' }, { v: 'mes', l: 'Por mes' }]
const sumarDias = (iso: string, d: number) => new Date(new Date(iso + 'T12:00:00Z').getTime() + d * 86400000).toISOString().slice(0, 10)

// Filtros de Métricas: van en una fila sobre los gráficos y aplican a todo lo que está debajo. El período son los últimos N días o un rango de fechas.
export default function SelectorPeriodo({ dias, agrupar, seccion, desde, hasta, hoy }: { dias: number; agrupar: string; seccion?: string; desde?: string; hasta?: string; hoy: string }) {
  const router = useRouter()
  const [rango, setRango] = useState(!!desde)   // ¿está elegido "Rango de fechas"? (aunque todavía no se haya aplicado)
  const [d1, setD1] = useState(desde ?? sumarDias(hoy, -29))
  const [d2, setD2] = useState(hasta ?? hoy)
  const [error, setError] = useState<string | null>(null)
  const ir = (c: Record<string, string>) => {
    const p = new URLSearchParams({ ...(seccion ? { seccion } : {}), ...(agrupar !== 'auto' ? { agrupar } : {}), ...c })
    for (const [k, v] of [...p.entries()]) if (!v) p.delete(k)
    iniciarCarga()
    router.push(`/metricas?${p.toString()}`)
  }
  // lo que define el período hoy en la dirección (para no perderlo al cambiar otra cosa)
  const periodoActual: Record<string, string> = desde && hasta ? { desde, hasta } : { dias: String(dias) }
  const aplicarRango = () => {
    if (!d1 || !d2) { setError('Elegí las dos fechas.'); return }
    if (d1 > d2) { setError('La fecha de inicio no puede ser posterior a la final.'); return }
    if (d2 > hoy) { setError('La fecha final no puede ser futura.'); return }
    if ((Date.parse(d2) - Date.parse(d1)) / 86400000 > 365) { setError('El rango puede ser de hasta un año.'); return }
    setError(null); ir({ desde: d1, hasta: d2 })
  }
  return (
    <div className="flex flex-wrap items-end gap-x-4 gap-y-2">
      <label className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.05em] text-rs-muted">
        Período:
        <select value={rango ? 'rango' : dias} onChange={(e) => { if (e.target.value === 'rango') { setRango(true); return } setRango(false); setError(null); ir({ dias: e.target.value }) }} className="input normal-case tracking-normal">
          {OPCIONES.map((d) => <option key={d} value={d}>Últimos {d} días</option>)}
          <option value="rango">Rango de fechas…</option>
        </select>
      </label>
      {rango && (
        <div className="flex flex-wrap items-end gap-2" role="group" aria-label="Rango de fechas">
          <div><label className="label" htmlFor="mt_desde">Desde</label><FechaInput id="mt_desde" value={d1} max={hoy} onChange={(v) => { if (v) setD1(v) }} className="w-36" /></div>
          <div><label className="label" htmlFor="mt_hasta">Hasta</label><FechaInput id="mt_hasta" value={d2} max={hoy} onChange={(v) => { if (v) setD2(v) }} className="w-36" /></div>
          <button type="button" onClick={aplicarRango} className="btn btn-primary">Aplicar</button>
          {error && <p role="alert" className="basis-full text-xs text-rs-danger">{error}</p>}
        </div>
      )}
      <label className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.05em] text-rs-muted">
        Evolución:
        <select value={agrupar} onChange={(e) => ir({ ...periodoActual, agrupar: e.target.value === 'auto' ? '' : e.target.value })} className="input normal-case tracking-normal">
          {AGRUPAR.map((a) => <option key={a.v} value={a.v}>{a.l}</option>)}
        </select>
      </label>
    </div>
  )
}
