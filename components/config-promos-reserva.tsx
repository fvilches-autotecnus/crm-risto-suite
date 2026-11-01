'use client'

import { useState } from 'react'
import { ArrowDown, ArrowUp, Plus, Trash2 } from 'lucide-react'
import { guardarPromosReserva, type PromoEntrada } from '@/app/(panel)/promos-actions'
import { EstadoGuardado, useAutoGuardar } from '@/components/estado-guardado'

export interface TipoConPromos { clave: string; etiqueta: string; descripcion: string; promos: PromoEntrada[] }

/**
 * Descripción de cada tipo de reserva y sus promos (nombre, qué incluye y precio por persona o por reserva).
 * Si un tipo tiene promos activas, el cliente tiene que elegir una al reservar desde el sitio. Se guarda solo.
 */
export default function ConfigPromosReserva({ inicial }: { inicial: TipoConPromos[] }) {
  const [tipos, setTipos] = useState<TipoConPromos[]>(inicial)
  const cambiarTipo = (i: number, c: Partial<TipoConPromos>) => setTipos((ts) => ts.map((t, k) => (k === i ? { ...t, ...c } : t)))
  const cambiarPromo = (i: number, j: number, c: Partial<PromoEntrada>) => cambiarTipo(i, { promos: tipos[i].promos.map((p, k) => (k === j ? { ...p, ...c } : p)) })
  const mover = (i: number, j: number, d: -1 | 1) => { const ps = [...tipos[i].promos]; const k = j + d; if (k < 0 || k >= ps.length) return; [ps[j], ps[k]] = [ps[k], ps[j]]; cambiarTipo(i, { promos: ps }) }
  const agregar = (i: number) => cambiarTipo(i, { promos: [...tipos[i].promos, { id: crypto.randomUUID(), nombre: '', descripcion: '', precio: '', modo_precio: 'persona', activa: true }] })
  // un tipo cuyo nombre de promo todavía está vacío no se manda (así el guardado automático no marca error mientras se lo completa)
  const { estado, error } = useAutoGuardar(JSON.stringify(tipos), () => guardarPromosReserva(tipos.map((t) => ({ clave: t.clave, descripcion: t.descripcion, promos: t.promos.filter((p) => p.nombre.trim() !== '') }))))

  return (
    <div className="mt-5 space-y-3 border-t border-rs-border pt-4" data-config-promos>
      <div>
        <h3 className="text-sm font-semibold">Descripción y promos de cada tipo</h3>
        <p className="mt-0.5 text-xs text-rs-muted">Contale al cliente qué incluye cada tipo de reserva. Si un tipo tiene <b className="text-rs-text">promos activas</b>, el cliente tiene que <b className="text-rs-text">elegir una</b> al reservar desde el sitio (por ejemplo, Cumpleaños: Promo 1 a $15.000 por persona, Promo 2 a $22.000 por persona). Queda anotada en la reserva con el precio de ese momento. Un tipo sin promos se reserva como siempre.</p>
      </div>
      {tipos.map((t, i) => (
        <details key={t.clave} className="rounded-md border border-rs-border/60 bg-rs-raised/30 px-3 py-2" open={t.promos.length > 0 || t.descripcion !== ''} data-tipo-promos={t.clave}>
          <summary className="flex cursor-pointer flex-wrap items-center justify-between gap-2 text-sm font-medium">
            <span>{t.etiqueta}</span>
            <span className="text-xs font-normal text-rs-muted">{t.promos.filter((p) => p.activa && p.nombre.trim()).length > 0 ? `${t.promos.filter((p) => p.activa && p.nombre.trim()).length} promo${t.promos.filter((p) => p.activa && p.nombre.trim()).length === 1 ? '' : 's'} activa${t.promos.filter((p) => p.activa && p.nombre.trim()).length === 1 ? '' : 's'}` : 'sin promos'}</span>
          </summary>
          <div className="mt-3 space-y-3">
            <div><label className="label" htmlFor={`pd_${t.clave}`}>Descripción del tipo (la ve el cliente al elegirlo)</label>
              <textarea id={`pd_${t.clave}`} value={t.descripcion} onChange={(e) => cambiarTipo(i, { descripcion: e.target.value })} maxLength={400} rows={2} placeholder="Ej. Celebrá tu cumpleaños con nosotros: incluye brindis y torta." className="input w-full" /></div>
            {t.promos.map((p, j) => (
              <div key={p.id} className="space-y-2 rounded-md border border-rs-border/60 bg-rs-card/60 p-3" data-promo={j}>
                <div className="grid gap-2 sm:grid-cols-[2fr_1fr_1fr]">
                  <div><label className="label" htmlFor={`pn_${p.id}`}>Nombre de la promo</label><input id={`pn_${p.id}`} value={p.nombre} onChange={(e) => cambiarPromo(i, j, { nombre: e.target.value })} maxLength={60} placeholder="Ej. Promo 1" className="input w-full" /></div>
                  <div><label className="label" htmlFor={`pp_${p.id}`}>Precio ($)</label><input id={`pp_${p.id}`} value={p.precio} onChange={(e) => cambiarPromo(i, j, { precio: e.target.value })} inputMode="decimal" placeholder="Sin precio" className="input w-full" /></div>
                  <div><label className="label" htmlFor={`pm_${p.id}`}>El precio es</label>
                    <select id={`pm_${p.id}`} value={p.modo_precio} onChange={(e) => cambiarPromo(i, j, { modo_precio: e.target.value as PromoEntrada['modo_precio'] })} className="input w-full"><option value="persona">Por persona</option><option value="reserva">Por reserva</option></select></div>
                </div>
                <div><label className="label" htmlFor={`pi_${p.id}`}>Qué incluye</label><textarea id={`pi_${p.id}`} value={p.descripcion} onChange={(e) => cambiarPromo(i, j, { descripcion: e.target.value })} maxLength={400} rows={2} placeholder="Ej. Una picada para compartir y dos tragos por persona." className="input w-full" /></div>
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <label className="flex items-center gap-1.5 text-sm"><input type="checkbox" checked={p.activa} onChange={(e) => cambiarPromo(i, j, { activa: e.target.checked })} className="h-4 w-4 accent-[#c8e62b]" />Se ofrece</label>
                  <div className="flex gap-1.5">
                    <button type="button" onClick={() => mover(i, j, -1)} disabled={j === 0} aria-label="Subir la promo" className="btn btn-sm"><ArrowUp size={13} /></button>
                    <button type="button" onClick={() => mover(i, j, 1)} disabled={j === t.promos.length - 1} aria-label="Bajar la promo" className="btn btn-sm"><ArrowDown size={13} /></button>
                    <button type="button" onClick={() => cambiarTipo(i, { promos: t.promos.filter((_, k) => k !== j) })} aria-label={`Quitar ${p.nombre || 'la promo'}`} className="btn btn-sm btn-danger"><Trash2 size={13} /> Quitar</button>
                  </div>
                </div>
              </div>
            ))}
            {t.promos.length < 12 && <button type="button" onClick={() => agregar(i)} className="btn btn-sm"><Plus size={14} /> Agregar promo</button>}
          </div>
        </details>
      ))}
      <EstadoGuardado estado={estado} error={error} />
    </div>
  )
}
