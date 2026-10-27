'use client'

import { useState, useTransition } from 'react'
import { ArrowDown, ArrowUp, Plus, Trash2 } from 'lucide-react'
import { guardarTiposReserva } from '@/app/(panel)/config-reservas-actions'
import { useToast } from '@/components/feedback'
import DisponibilidadTipo from '@/components/disponibilidad-tipo'
import { Spinner } from '@/components/ui'
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
            <div className="basis-full pl-6"><DisponibilidadTipo idBase={f.clave} etiqueta={f.etiqueta} modo={f.modo} dias={f.dias_semana} fechas={f.fechas} hoy={hoy} onChange={(c) => cambiar(i, { ...(c.modo ? { modo: c.modo } : {}), ...(c.dias ? { dias_semana: c.dias } : {}), ...(c.fechas ? { fechas: c.fechas } : {}) })} /></div>
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
