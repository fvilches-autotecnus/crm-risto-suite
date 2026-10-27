'use client'

import { FechaInput } from '@/components/inputs'
import { DIAS_SEMANA } from '@/lib/dias'
import { fechaCorta } from '@/lib/fechas'

export type ModoTipo = 'siempre' | 'semana' | 'fechas'

/** En qué días se ofrece un tipo de reserva: todos, ciertos días de la semana o fechas particulares. */
export default function DisponibilidadTipo({ idBase, etiqueta, modo, dias, fechas, hoy, deshabilitado, onChange }: { idBase: string; etiqueta: string; modo: ModoTipo; dias: number[]; fechas: string[]; hoy: string; deshabilitado?: boolean; onChange: (c: { modo?: ModoTipo; dias?: number[]; fechas?: string[] }) => void }) {
  return (
    <div className="space-y-2">
      <div className="flex flex-wrap items-center gap-2">
        <label className="text-xs text-rs-muted" htmlFor={`disp_${idBase}`}>Disponible</label>
        <select id={`disp_${idBase}`} value={modo} disabled={deshabilitado} onChange={(e) => onChange({ modo: e.target.value as ModoTipo })} className="input h-8 py-0 text-sm">
          <option value="siempre">Todos los días</option>
          <option value="semana">Ciertos días de la semana</option>
          <option value="fechas">Fechas particulares</option>
        </select>
      </div>
      {modo === 'semana' && (
        <div className="flex flex-wrap gap-1.5" role="group" aria-label={`Días del tipo ${etiqueta}`}>
          {DIAS_SEMANA.map((d) => (
            <label key={d.n} className={'inline-flex h-8 cursor-pointer items-center rounded-full border px-3 text-xs font-medium transition ' + (dias.includes(d.n) ? 'border-rs-lime/70 bg-rs-lime/15 font-semibold text-rs-lime' : 'border-rs-control text-rs-muted hover:border-rs-lime/40')}>
              <input type="checkbox" className="sr-only" aria-label={d.l} disabled={deshabilitado} checked={dias.includes(d.n)} onChange={() => onChange({ dias: dias.includes(d.n) ? dias.filter((x) => x !== d.n) : [...dias, d.n] })} />{d.c}
            </label>
          ))}
        </div>
      )}
      {modo === 'fechas' && (
        <div className="space-y-1.5">
          <div className="flex flex-wrap items-center gap-1.5">
            {[...fechas].sort().map((d) => (
              <span key={d} className="inline-flex items-center gap-1 rounded-full border border-rs-lime/40 bg-rs-lime/10 px-2.5 py-1 text-xs tabular-nums">{fechaCorta(d)}<button type="button" disabled={deshabilitado} aria-label={`Quitar el ${fechaCorta(d)}`} onClick={() => onChange({ fechas: fechas.filter((x) => x !== d) })} className="text-rs-muted hover:text-rs-danger">×</button></span>
            ))}
            {fechas.length === 0 && <span className="text-xs text-rs-muted">Todavía no hay fechas.</span>}
          </div>
          {!deshabilitado && <div className="flex items-center gap-2"><FechaInput id={`fecha_${idBase}`} value="" min={hoy} onChange={(v) => { if (v && !fechas.includes(v)) onChange({ fechas: [...fechas, v] }) }} className="w-40" /><span className="text-xs text-rs-muted">Elegí una fecha para sumarla</span></div>}
        </div>
      )}
    </div>
  )
}
