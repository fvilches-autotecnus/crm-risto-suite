'use client'

import { useState } from 'react'
import { guardarTiposSede } from '@/app/(panel)/config-sedes-actions'
import DisponibilidadTipo, { type ModoTipo } from '@/components/disponibilidad-tipo'
import { EstadoGuardado, useAutoGuardar } from '@/components/estado-guardado'
import type { TipoSedeOv } from '@/lib/config-sedes'
import { textoDias } from '@/lib/dias'
import { fechaCorta } from '@/lib/fechas'

export interface TipoBase { clave: string; etiqueta: string; activo: boolean; modo: ModoTipo; dias_semana: number[]; fechas: string[] }

const resumen = (m: ModoTipo, dias: number[], fechas: string[]) => (m === 'semana' ? `solo ${textoDias(dias) ?? 'todos los días'}` : m === 'fechas' ? `solo ${fechas.length ? [...fechas].sort().map(fechaCorta).join(', ') : 'fechas puntuales'}` : 'todos los días')

/** Tipos de reserva de UNA sede: cada tipo hereda lo del negocio o se personaliza (si la sede lo ofrece y en qué días). */
export default function ConfigTiposSede({ sedeId, base, overrides, hoy }: { sedeId: string; base: TipoBase[]; overrides: Record<string, TipoSedeOv>; hoy: string }) {
  const [filas, setFilas] = useState(() => Object.fromEntries(base.map((b) => {
    const o = overrides[b.clave]
    return [b.clave, { propio: !!o, activo: o?.activo !== false && b.activo, modo: (o?.modo ?? b.modo) as ModoTipo, dias: o?.dias_semana ?? b.dias_semana, fechas: o?.fechas ?? b.fechas }]
  })))
  const cambiar = (c: string, x: Partial<(typeof filas)[string]>) => setFilas((f) => ({ ...f, [c]: { ...f[c], ...x } }))
  // se guarda solo: al personalizar un tipo, activarlo o cambiar en qué días se ofrece
  const { estado, error } = useAutoGuardar(JSON.stringify(filas), () => {
    const ov: Record<string, TipoSedeOv> = {}
    for (const b of base) {
      const f = filas[b.clave]; if (!f.propio) continue
      ov[b.clave] = { ...(f.activo ? {} : { activo: false }), modo: f.modo, ...(f.modo === 'semana' ? { dias_semana: f.dias } : f.modo === 'fechas' ? { fechas: f.fechas } : {}) }
    }
    return guardarTiposSede(sedeId, ov)
  })
  return (
    <div className="space-y-3">
      <ul className="space-y-2">
        {base.map((b) => {
          const f = filas[b.clave]
          return (
            <li key={b.clave} className={'space-y-2 rounded-md border px-3 py-2 ' + (f.propio ? 'border-rs-lime/40 bg-rs-lime/5' : 'border-rs-border/60 bg-rs-raised/30')} data-tipo-sede={b.clave}>
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span className="font-medium">{b.etiqueta}</span>
                <label className="flex items-center gap-1.5 text-sm"><input type="checkbox" checked={f.propio} onChange={(e) => cambiar(b.clave, { propio: e.target.checked })} aria-label={`Personalizar ${b.etiqueta} para esta sede`} className="h-4 w-4 accent-[#c8e62b]" />Personalizar para esta sede</label>
              </div>
              {!f.propio ? <p className="text-xs text-rs-muted">Como el negocio: {b.activo ? 'se ofrece' : 'no se ofrece'}, {resumen(b.modo, b.dias_semana, b.fechas)}.</p> : (
                <div className="space-y-2">
                  <label className="flex items-center gap-1.5 text-sm"><input type="checkbox" checked={f.activo} onChange={(e) => cambiar(b.clave, { activo: e.target.checked })} className="h-4 w-4 accent-[#c8e62b]" />Esta sede lo ofrece</label>
                  {f.activo && <DisponibilidadTipo idBase={b.clave} etiqueta={b.etiqueta} modo={f.modo} dias={f.dias} fechas={f.fechas} hoy={hoy} onChange={(c) => cambiar(b.clave, { ...(c.modo ? { modo: c.modo } : {}), ...(c.dias ? { dias: c.dias } : {}), ...(c.fechas ? { fechas: c.fechas } : {}) })} />}
                </div>
              )}
            </li>
          )
        })}
      </ul>
      <div className="flex flex-wrap items-center gap-3"><EstadoGuardado estado={estado} error={error} /><p className="text-xs text-rs-muted">Lo que no personalices sigue a Configuración del negocio. Los nombres y el orden se cambian para todo el negocio.</p></div>
    </div>
  )
}
