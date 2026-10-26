'use client'

import { useState, useTransition } from 'react'
import { ArrowDown, ArrowUp, Plus, Trash2 } from 'lucide-react'
import { guardarTiposReserva } from '@/app/(panel)/config-reservas-actions'
import { useToast } from '@/components/feedback'
import { FechaInput } from '@/components/inputs'
import { DIAS_SEMANA } from '@/components/config-calendario'
import { Spinner } from '@/components/ui'
import { fechaCorta } from '@/lib/fechas'
import { claveDeTipo } from '@/lib/reservas-config'

export interface FilaTipo { clave: string; etiqueta: string; activo: boolean; usos: number; sinConfigurar?: boolean; modo: 'siempre' | 'semana' | 'fechas'; dias_semana: number[]; fechas: string[] }

/** Catálogo de tipos de reserva: nombre que se ve, activo y orden. Los tipos con reservas no se borran, se desactivan. */
export default function ConfigTiposReserva({ inicial, hoy }: { inicial: FilaTipo[]; hoy: string }) {
  const toast = useToast()
  const [filas, setFilas] = useState<FilaTipo[]>(inicial)
  const [nuevo, setNuevo] = useState('')
  const [pending, start] = useTransition()
  const cambiar = (i: number, c: Partial<FilaTipo>) => setFilas((f) => f.map((x, k) => (k === i ? { ...x, ...c } : x)))
  const mover = (i: number, d: -1 | 1) => setFilas((f) => { const j = i + d; if (j < 0 || j >= f.length) return f; const c = [...f];[c[i], c[j]] = [c[j], c[i]]; return c })
  const agregar = () => {
    const nombre = nuevo.trim(); if (!nombre) return
    let clave = claveDeTipo(nombre); const base = clave; let n = 2
    while (filas.some((f) => f.clave === clave)) clave = `${base}_${n++}`.slice(0, 40)
    setFilas([...filas, { clave, etiqueta: nombre, activo: true, usos: 0, modo: 'siempre', dias_semana: [], fechas: [] }]); setNuevo('')
  }
  const guardar = () => start(async () => {
    const r = await guardarTiposReserva(filas.map((f) => ({ clave: f.clave, etiqueta: f.etiqueta, activo: f.activo, modo: f.modo, dias_semana: f.dias_semana, fechas: f.fechas })))
    toast(r.ok ? { texto: 'Tipos de reserva guardados' } : { tipo: 'error', texto: r.error ?? 'No se pudo guardar' })
  })

  return (
    <div className="space-y-3">
      <ul className="space-y-2">
        {filas.map((f, i) => (
          <li key={f.clave} className="flex flex-wrap items-center gap-2 rounded-md border border-rs-border/60 bg-rs-raised/30 px-2.5 py-2">
            <div className="flex flex-col"><button type="button" onClick={() => mover(i, -1)} disabled={i === 0} aria-label="Subir" className="text-rs-muted hover:text-rs-lime disabled:opacity-30"><ArrowUp size={13} /></button><button type="button" onClick={() => mover(i, 1)} disabled={i === filas.length - 1} aria-label="Bajar" className="text-rs-muted hover:text-rs-lime disabled:opacity-30"><ArrowDown size={13} /></button></div>
            <input value={f.etiqueta} onChange={(e) => cambiar(i, { etiqueta: e.target.value })} maxLength={40} aria-label={`Nombre del tipo ${f.clave}`} className="input min-w-[160px] flex-1" />
            <label className="flex items-center gap-1.5 text-sm"><input type="checkbox" checked={f.activo} onChange={(e) => cambiar(i, { activo: e.target.checked })} className="h-4 w-4 accent-[#c8e62b]" />Activo</label>
            <span className="w-28 text-xs text-rs-muted">{f.sinConfigurar ? 'Sin configurar · ' : ''}{f.usos > 0 ? `${f.usos} reserva${f.usos > 1 ? 's' : ''}` : 'sin uso'}</span>
            <button type="button" onClick={() => setFilas(filas.filter((_, k) => k !== i))} aria-label={`Quitar ${f.etiqueta}`} title={f.usos > 0 ? 'Tiene reservas: al guardar queda desactivado en lugar de borrarse' : 'Quitar'} className="btn btn-sm btn-danger"><Trash2 size={13} /></button>
            <div className="basis-full space-y-2 pl-6">
              <div className="flex flex-wrap items-center gap-2">
                <label className="text-xs text-rs-muted" htmlFor={`disp_${f.clave}`}>Disponible</label>
                <select id={`disp_${f.clave}`} value={f.modo} onChange={(e) => cambiar(i, { modo: e.target.value as FilaTipo['modo'] })} className="input h-8 py-0 text-sm">
                  <option value="siempre">Todos los días</option>
                  <option value="semana">Ciertos días de la semana</option>
                  <option value="fechas">Fechas particulares</option>
                </select>
              </div>
              {f.modo === 'semana' && (
                <div className="flex flex-wrap gap-1.5" role="group" aria-label={`Días del tipo ${f.etiqueta}`}>
                  {DIAS_SEMANA.map((d) => (
                    <label key={d.n} className={'inline-flex h-8 cursor-pointer items-center rounded-full border px-3 text-xs font-medium transition ' + (f.dias_semana.includes(d.n) ? 'border-rs-lime/70 bg-rs-lime/15 font-semibold text-rs-lime' : 'border-rs-control text-rs-muted hover:border-rs-lime/40')}>
                      <input type="checkbox" className="sr-only" aria-label={d.l} checked={f.dias_semana.includes(d.n)} onChange={() => cambiar(i, { dias_semana: f.dias_semana.includes(d.n) ? f.dias_semana.filter((x) => x !== d.n) : [...f.dias_semana, d.n] })} />{d.c}
                    </label>
                  ))}
                </div>
              )}
              {f.modo === 'fechas' && (
                <div className="space-y-1.5">
                  <div className="flex flex-wrap items-center gap-1.5">
                    {[...f.fechas].sort().map((d) => (
                      <span key={d} className="inline-flex items-center gap-1 rounded-full border border-rs-lime/40 bg-rs-lime/10 px-2.5 py-1 text-xs tabular-nums">{fechaCorta(d)}<button type="button" aria-label={`Quitar el ${fechaCorta(d)}`} onClick={() => cambiar(i, { fechas: f.fechas.filter((x) => x !== d) })} className="text-rs-muted hover:text-rs-danger">×</button></span>
                    ))}
                    {f.fechas.length === 0 && <span className="text-xs text-rs-muted">Todavía no hay fechas.</span>}
                  </div>
                  <div className="flex items-center gap-2"><FechaInput id={`fecha_${f.clave}`} value="" min={hoy} onChange={(v) => { if (v && !f.fechas.includes(v)) cambiar(i, { fechas: [...f.fechas, v] }) }} className="w-40" /><span className="text-xs text-rs-muted">Elegí una fecha para sumarla</span></div>
                </div>
              )}
            </div>
          </li>
        ))}
      </ul>
      <div className="flex flex-wrap items-end gap-2">
        <div className="min-w-[200px] flex-1"><label className="label" htmlFor="tipo_nuevo">Agregar un tipo</label><input id="tipo_nuevo" value={nuevo} onChange={(e) => setNuevo(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); agregar() } }} maxLength={40} placeholder="Ej. Cena de empresa" className="input w-full" /></div>
        <button type="button" onClick={agregar} className="btn"><Plus size={14} />Agregar</button>
        <button type="button" onClick={guardar} disabled={pending} className="btn btn-primary">{pending && <Spinner />}{pending ? 'Guardando…' : 'Guardar tipos'}</button>
      </div>
      <p className="text-xs text-rs-muted">El nombre es lo que ven tu equipo y tus clientes (en el sitio de reservas y en los avisos). “Disponible” limita en qué días se ofrece cada tipo en el sitio de reservas (por ejemplo, Cena show solo viernes y sábados, o solo el 31/12). Los tipos desactivados no se ofrecen al cargar reservas ni en el sitio, pero las reservas que ya los tienen siguen mostrándose. Si el bot crea una reserva con un tipo nuevo, aparece acá como “Sin configurar” para que le pongas nombre.</p>
    </div>
  )
}
