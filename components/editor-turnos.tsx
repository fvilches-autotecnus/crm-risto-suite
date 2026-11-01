'use client'

import { useEffect, useRef, useState } from 'react'
import { ArrowDown, ArrowUp, Plus, Trash2 } from 'lucide-react'
import { DIAS_SEMANA } from '@/lib/dias'
import { MAX_TURNOS, MENSAJE_CORTE_DEFECTO, type TurnoWeb } from '@/lib/turnos-web'

interface Borrador { nombre: string; horas: string; dias: number[]; corteTipo: '' | 'horas' | 'hora'; corteHoras: string; corteHora: string; mensaje: string }

const desdeTurno = (t: TurnoWeb): Borrador => ({
  nombre: t.nombre, horas: t.horas.join(', '), dias: t.dias ?? [],
  corteTipo: t.corte?.tipo ?? '', corteHoras: t.corte?.tipo === 'horas' ? String(t.corte.horas).replace('.', ',') : '1', corteHora: t.corte?.tipo === 'hora' ? t.corte.hora : '18:00', mensaje: t.mensaje ?? '',
})
// un turno recién agregado y todavía vacío no se manda (así el guardado automático no marca error mientras se lo completa)
const aJson = (bs: Borrador[]) => JSON.stringify(bs.filter((b) => b.nombre.trim() !== '' || b.horas.trim() !== '').map((b) => ({
  nombre: b.nombre, horas: b.horas, dias: b.dias,
  corte: b.corteTipo === 'horas' ? { tipo: 'horas', horas: b.corteHoras.replace(',', '.') } : b.corteTipo === 'hora' ? { tipo: 'hora', hora: b.corteHora } : null,
  mensaje: b.mensaje,
})))

/**
 * Editor de turnos del sitio de reservas (Desayuno, Almuerzo, Cena…): cada uno con sus horarios, los días en que rige,
 * un corte propio opcional y el mensaje que se ve cuando ya cerró. Manda todo en un campo oculto (`name`) como JSON.
 */
export default function EditorTurnos({ name, inicial, ayudaHeredar }: { name: string; inicial: TurnoWeb[]; ayudaHeredar?: string }) {
  const [turnos, setTurnos] = useState<Borrador[]>(() => inicial.map(desdeTurno))
  const oculto = useRef<HTMLInputElement>(null)
  const json = aJson(turnos)
  const primera = useRef(true)
  // avisa al formulario (guardado automático) de que el campo oculto cambió; en el próximo ciclo, para no pisar lo que se está escribiendo
  useEffect(() => { if (primera.current) { primera.current = false; return } const t = setTimeout(() => oculto.current?.dispatchEvent(new Event('input', { bubbles: true })), 0); return () => clearTimeout(t) }, [json])

  const cambiar = (i: number, c: Partial<Borrador>) => setTurnos((ts) => ts.map((t, k) => (k === i ? { ...t, ...c } : t)))
  const mover = (i: number, d: number) => setTurnos((ts) => { const j = i + d; if (j < 0 || j >= ts.length) return ts; const n = [...ts]; [n[i], n[j]] = [n[j], n[i]]; return n })
  const agregar = () => setTurnos((ts) => [...ts, { nombre: '', horas: '', dias: [], corteTipo: '', corteHoras: '1', corteHora: '18:00', mensaje: '' }])

  return (
    <div className="mt-3 space-y-3 rounded-md border border-rs-border/60 bg-rs-raised/30 p-3" data-editor-turnos>
      <input ref={oculto} type="hidden" name={name} value={json} readOnly />
      <div>
        <p className="text-sm font-semibold">Turnos (opcional)</p>
        <p className="mt-0.5 text-xs text-rs-muted">Armá los turnos con sus horarios y el sitio los muestra separados, cada uno con su título (por ejemplo, Desayuno 08:00, 09:00 · Almuerzo 12:00, 13:00 · Cena 20:00, 21:00). Si cargás turnos, <b className="text-rs-text">se usan en lugar de la lista de horarios de arriba</b>. {ayudaHeredar}</p>
      </div>
      {turnos.map((t, i) => (
        <div key={i} className="space-y-2 rounded-md border border-rs-border/60 bg-rs-card/60 p-3" data-turno-editor={i}>
          <div className="grid gap-2 sm:grid-cols-[1fr_2fr]">
            <div><label className="label" htmlFor={`${name}_n_${i}`}>Nombre del turno</label><input id={`${name}_n_${i}`} value={t.nombre} onChange={(e) => cambiar(i, { nombre: e.target.value })} maxLength={30} placeholder="Ej. Cena" className="input w-full" /></div>
            <div><label className="label" htmlFor={`${name}_h_${i}`}>Horarios (separados por coma)</label><input id={`${name}_h_${i}`} value={t.horas} onChange={(e) => cambiar(i, { horas: e.target.value })} placeholder="20:00, 20:30, 21:00" className="input w-full" /></div>
          </div>
          <fieldset>
            <legend className="label">Días en que rige</legend>
            <div className="flex flex-wrap gap-1.5">
              {DIAS_SEMANA.map((d) => (
                <label key={d.n} className="inline-flex h-8 cursor-pointer items-center rounded-full border border-rs-control px-3 text-xs font-medium text-rs-muted transition hover:border-rs-lime/40 has-[:checked]:border-rs-lime/70 has-[:checked]:bg-rs-lime/15 has-[:checked]:font-semibold has-[:checked]:text-rs-lime">
                  <input type="checkbox" checked={t.dias.includes(d.n)} onChange={(e) => cambiar(i, { dias: e.target.checked ? [...t.dias, d.n].sort() : t.dias.filter((x) => x !== d.n) })} className="sr-only" aria-label={`${d.l} (${t.nombre || 'turno'})`} />{d.c}
                </label>
              ))}
            </div>
            <p className="mt-1 text-xs text-rs-muted">Sin marcar ninguno, el turno rige todos los días.</p>
          </fieldset>
          <div className="grid gap-2 sm:grid-cols-2">
            <div>
              <label className="label" htmlFor={`${name}_c_${i}`}>Cuándo se cierran las reservas del turno</label>
              <select id={`${name}_c_${i}`} value={t.corteTipo} onChange={(e) => cambiar(i, { corteTipo: e.target.value as Borrador['corteTipo'] })} className="input w-full">
                <option value="">Sin corte propio (cada horario usa la anticipación general)</option>
                <option value="horas">Unas horas antes del primer horario del turno</option>
                <option value="hora">A una hora fija del mismo día</option>
              </select>
            </div>
            {t.corteTipo === 'horas' && (
              <div><label className="label" htmlFor={`${name}_ch_${i}`}>Horas antes del primer horario</label>
                <div className="flex items-center gap-2"><input id={`${name}_ch_${i}`} value={t.corteHoras} onChange={(e) => cambiar(i, { corteHoras: e.target.value })} inputMode="decimal" className="input w-24" /><span className="text-xs text-rs-muted">Con 1: si el primer horario es 20:00, el turno entero cierra a las 19:00.</span></div></div>
            )}
            {t.corteTipo === 'hora' && (
              <div><label className="label" htmlFor={`${name}_cf_${i}`}>Hora de corte</label>
                <div className="flex items-center gap-2"><input id={`${name}_cf_${i}`} value={t.corteHora} onChange={(e) => cambiar(i, { corteHora: e.target.value })} placeholder="18:00" className="input w-24" /><span className="text-xs text-rs-muted">Ese día, a esa hora, el turno entero deja de recibir reservas.</span></div></div>
            )}
          </div>
          {t.corteTipo !== '' && (
            <div><label className="label" htmlFor={`${name}_m_${i}`}>Mensaje cuando el turno ya cerró</label><input id={`${name}_m_${i}`} value={t.mensaje} onChange={(e) => cambiar(i, { mensaje: e.target.value })} maxLength={120} placeholder={MENSAJE_CORTE_DEFECTO} className="input w-full" /></div>
          )}
          <div className="flex flex-wrap justify-end gap-1.5">
            <button type="button" onClick={() => mover(i, -1)} disabled={i === 0} aria-label="Subir el turno" className="btn btn-sm"><ArrowUp size={13} /></button>
            <button type="button" onClick={() => mover(i, 1)} disabled={i === turnos.length - 1} aria-label="Bajar el turno" className="btn btn-sm"><ArrowDown size={13} /></button>
            <button type="button" onClick={() => setTurnos((ts) => ts.filter((_, k) => k !== i))} aria-label="Quitar el turno" className="btn btn-sm btn-danger"><Trash2 size={13} /> Quitar</button>
          </div>
        </div>
      ))}
      {turnos.length < MAX_TURNOS && <button type="button" onClick={agregar} className="btn btn-sm"><Plus size={14} /> Agregar turno</button>}
    </div>
  )
}
