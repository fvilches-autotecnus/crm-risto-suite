'use client'

import { useState } from 'react'
import { ArrowDown, ArrowUp, Plus, Trash2 } from 'lucide-react'
import { guardarConfirmacion } from '@/app/(panel)/confirmacion-actions'
import { EstadoGuardado, useAutoGuardar } from '@/components/estado-guardado'
import { FechaInput } from '@/components/inputs'
import { RESULTADOS, estadoSegunReglas, textoCondicion, type ReglaConfirmacion, type ResultadoConfirmacion } from '@/lib/confirmacion'
import { DIAS_SEMANA } from '@/lib/dias'
import { fechaCorta } from '@/lib/fechas'

let contador = 0
const uid = () => `r${Date.now()}_${contador++}`
const vacia = (c: Partial<ReglaConfirmacion> = {}): ReglaConfirmacion => ({ uid: uid(), activo: true, sucursal_id: null, tipo_reserva: null, fecha_desde: null, fecha_hasta: null, dias_semana: [], personas_min: null, personas_max: null, resultado: 'nueva', nota: '', ...c })
const numero = (v: string): number | null => { const n = parseInt(v.replace(/\D/g, ''), 10); return Number.isFinite(n) && n > 0 ? n : null }

/** Cómo entran las reservas del sitio y del bot: confirmadas solas o en “Nuevas” a la espera de un asesor, con excepciones por cantidad de personas, tipo, fechas, días y sede. */
export default function ConfigConfirmacion({ defectoInicial, inicial, sedes, tipos, hoy }: { defectoInicial: ResultadoConfirmacion; inicial: ReglaConfirmacion[]; sedes: { id: string; nombre: string }[]; tipos: { value: string; label: string }[]; hoy: string }) {
  const [defecto, setDefecto] = useState<ResultadoConfirmacion>(defectoInicial)
  const [reglas, setReglas] = useState<ReglaConfirmacion[]>(inicial)
  const nombreSede = (id: string) => sedes.find((s) => s.id === id)?.nombre ?? 'Sede'
  const etiquetaTipo = (c: string) => tipos.find((t) => t.value === c)?.label ?? c
  const cambiar = (i: number, c: Partial<ReglaConfirmacion>) => setReglas((l) => l.map((r, k) => (k === i ? { ...r, ...c } : r)))
  const mover = (i: number, d: -1 | 1) => setReglas((l) => { const j = i + d; if (j < 0 || j >= l.length) return l; const c = [...l];[c[i], c[j]] = [c[j], c[i]]; return c })
  const opuesto: ResultadoConfirmacion = defecto === 'confirmada' ? 'nueva' : 'confirmada'
  // se guarda solo, en cuanto la regla está completa y válida (si falta algo, el aviso dice qué)
  const { estado, error } = useAutoGuardar(JSON.stringify({ defecto, reglas }), () => guardarConfirmacion(defecto, reglas.map(({ uid: _u, ...resto }) => resto)))

  // simulador: qué pasaría con una reserva de ejemplo
  const [pSede, setPSede] = useState('')
  const [pTipo, setPTipo] = useState(tipos[0]?.value ?? 'comun')
  const [pFecha, setPFecha] = useState(hoy)
  const [pPers, setPPers] = useState('2')
  const prueba = estadoSegunReglas(defecto, reglas, { sede: pSede || null, tipo: pTipo, fecha: pFecha || hoy, personas: numero(pPers) ?? 1 })

  return (
    <div className="space-y-5">
      <fieldset className="space-y-2">
        <legend className="label">Por defecto, una reserva que llega por el sitio o el bot…</legend>
        {RESULTADOS.map((o) => (
          <label key={o.value} className="flex cursor-pointer items-start gap-2 text-sm">
            <input type="radio" name="conf_defecto" checked={defecto === o.value} onChange={() => setDefecto(o.value)} className="mt-1 h-4 w-4 accent-[#c8e62b]" />
            <span><span className="font-medium">{o.label}</span><span className="block text-xs text-rs-muted">{o.value === 'confirmada' ? 'Al llegar el WhatsApp del cliente queda “Confirmada” y el bot le responde que su reserva está confirmada.' : 'Queda en “Nuevas” y el bot le avisa que un asesor se la confirma en breve.'}</span></span>
          </label>
        ))}
      </fieldset>

      <div className="space-y-2">
        <h3 className="label">Excepciones</h3>
        <p className="text-xs text-rs-muted">Casos que se salen de lo anterior: por cantidad de personas, tipo de reserva, fechas, días de la semana o sede. Se revisan <b className="text-rs-text">de arriba hacia abajo y manda la primera que coincide</b>; si ninguna coincide, vale lo de arriba. Una excepción por una fecha particular tiene que ir antes que las generales.</p>
        <div className="flex flex-wrap gap-2">
          <button type="button" className="btn btn-sm" onClick={() => setReglas((l) => [...l, vacia({ personas_min: 7, resultado: opuesto })])}><Plus size={13} />Por cantidad de personas</button>
          <button type="button" className="btn btn-sm" onClick={() => setReglas((l) => [...l, vacia({ tipo_reserva: tipos[0]?.value ?? null, resultado: opuesto })])}><Plus size={13} />Por tipo de reserva</button>
          <button type="button" className="btn btn-sm" onClick={() => setReglas((l) => [vacia({ fecha_desde: hoy, fecha_hasta: hoy, resultado: opuesto }), ...l])}><Plus size={13} />Para una fecha particular</button>
          <button type="button" className="btn btn-sm" onClick={() => setReglas((l) => [...l, vacia({ resultado: opuesto })])}><Plus size={13} />Otra</button>
        </div>
        {reglas.length === 0 && <p className="rounded-md bg-rs-raised/40 px-3 py-2 text-sm text-rs-muted">No hay excepciones: todas las reservas {RESULTADOS.find((o) => o.value === defecto)?.corto}.</p>}
        <ol className="space-y-2">
          {reglas.map((r, i) => (
            <li key={r.uid} className={'space-y-3 rounded-md border bg-rs-raised/30 p-3 ' + (r.activo ? 'border-rs-border/60' : 'border-rs-border/30 opacity-60')}>
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="text-sm"><span className="mr-2 inline-flex h-5 w-5 items-center justify-center rounded-full bg-rs-raised text-xs font-semibold text-rs-lime">{i + 1}</span><b>{textoCondicion(r, nombreSede, etiquetaTipo)}</b> → <span className={r.resultado === 'confirmada' ? 'text-rs-lime' : 'text-rs-warn'}>{RESULTADOS.find((o) => o.value === r.resultado)?.corto}</span></p>
                <div className="flex items-center gap-1.5">
                  <label className="mr-2 flex items-center gap-1.5 text-xs"><input type="checkbox" checked={r.activo} onChange={(e) => cambiar(i, { activo: e.target.checked })} className="h-3.5 w-3.5 accent-[#c8e62b]" />Activa</label>
                  <button type="button" onClick={() => mover(i, -1)} disabled={i === 0} aria-label="Subir" className="btn btn-sm"><ArrowUp size={13} /></button>
                  <button type="button" onClick={() => mover(i, 1)} disabled={i === reglas.length - 1} aria-label="Bajar" className="btn btn-sm"><ArrowDown size={13} /></button>
                  <button type="button" onClick={() => setReglas((l) => l.filter((_, k) => k !== i))} aria-label={`Quitar la excepción ${i + 1}`} className="btn btn-sm btn-danger"><Trash2 size={13} /></button>
                </div>
              </div>
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                {sedes.length > 0 && <div><label className="label" htmlFor={`cf_sede_${r.uid}`}>Sede</label><select id={`cf_sede_${r.uid}`} value={r.sucursal_id ?? ''} onChange={(e) => cambiar(i, { sucursal_id: e.target.value || null })} className="input w-full"><option value="">Todas</option>{sedes.map((s) => <option key={s.id} value={s.id}>{s.nombre}</option>)}</select></div>}
                <div><label className="label" htmlFor={`cf_tipo_${r.uid}`}>Tipo de reserva</label><select id={`cf_tipo_${r.uid}`} value={r.tipo_reserva ?? ''} onChange={(e) => cambiar(i, { tipo_reserva: e.target.value || null })} className="input w-full"><option value="">Todos</option>{tipos.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}</select></div>
                <div><label className="label" htmlFor={`cf_pmin_${r.uid}`}>Personas desde</label><input id={`cf_pmin_${r.uid}`} inputMode="numeric" value={r.personas_min ?? ''} onChange={(e) => cambiar(i, { personas_min: numero(e.target.value) })} placeholder="Cualquiera" className="input w-full" /></div>
                <div><label className="label" htmlFor={`cf_pmax_${r.uid}`}>Personas hasta</label><input id={`cf_pmax_${r.uid}`} inputMode="numeric" value={r.personas_max ?? ''} onChange={(e) => cambiar(i, { personas_max: numero(e.target.value) })} placeholder="Cualquiera" className="input w-full" /></div>
                <div><label className="label" htmlFor={`cf_fd_${r.uid}`}>Fecha desde</label><FechaInput id={`cf_fd_${r.uid}`} value={r.fecha_desde ?? ''} onChange={(v) => cambiar(i, { fecha_desde: v || null, fecha_hasta: v ? (r.fecha_hasta && r.fecha_hasta >= v ? r.fecha_hasta : v) : null })} /></div>
                <div><label className="label" htmlFor={`cf_fh_${r.uid}`}>Fecha hasta</label><FechaInput id={`cf_fh_${r.uid}`} value={r.fecha_hasta ?? ''} min={r.fecha_desde ?? undefined} onChange={(v) => cambiar(i, { fecha_hasta: v || null, fecha_desde: v ? (r.fecha_desde ?? v) : null })} /></div>
                <div className="sm:col-span-2">
                  <span className="label">Días de la semana</span>
                  <div className="flex flex-wrap gap-1.5" role="group" aria-label={`Días de la excepción ${i + 1}`}>
                    {DIAS_SEMANA.map((d) => (
                      <label key={d.n} className={'inline-flex h-8 cursor-pointer items-center rounded-full border px-3 text-xs font-medium transition ' + (r.dias_semana.includes(d.n) ? 'border-rs-lime/70 bg-rs-lime/15 font-semibold text-rs-lime' : 'border-rs-control text-rs-muted hover:border-rs-lime/40')}>
                        <input type="checkbox" className="sr-only" aria-label={d.l} checked={r.dias_semana.includes(d.n)} onChange={() => cambiar(i, { dias_semana: r.dias_semana.includes(d.n) ? r.dias_semana.filter((x) => x !== d.n) : [...r.dias_semana, d.n] })} />{d.c}
                      </label>
                    ))}
                  </div>
                </div>
              </div>
              <div className="grid gap-3 sm:grid-cols-2">
                <div><label className="label" htmlFor={`cf_res_${r.uid}`}>Entonces la reserva…</label><select id={`cf_res_${r.uid}`} value={r.resultado} onChange={(e) => cambiar(i, { resultado: e.target.value as ResultadoConfirmacion })} className="input w-full">{RESULTADOS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}</select></div>
                <div><label className="label" htmlFor={`cf_nota_${r.uid}`}>Nota (solo para tu equipo)</label><input id={`cf_nota_${r.uid}`} value={r.nota} onChange={(e) => cambiar(i, { nota: e.target.value })} maxLength={120} placeholder="Ej. Semana de Año Nuevo" className="input w-full" /></div>
              </div>
            </li>
          ))}
        </ol>
      </div>

      <div className="space-y-2 rounded-md border border-rs-border/60 p-3">
        <h3 className="label">Probar con una reserva de ejemplo</h3>
        <div className="flex flex-wrap items-end gap-3">
          {sedes.length > 0 && <div><label className="label" htmlFor="cf_p_sede">Sede</label><select id="cf_p_sede" value={pSede} onChange={(e) => setPSede(e.target.value)} className="input"><option value="">—</option>{sedes.map((s) => <option key={s.id} value={s.id}>{s.nombre}</option>)}</select></div>}
          <div><label className="label" htmlFor="cf_p_tipo">Tipo</label><select id="cf_p_tipo" value={pTipo} onChange={(e) => setPTipo(e.target.value)} className="input">{tipos.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}</select></div>
          <div><label className="label" htmlFor="cf_p_fecha">Fecha</label><FechaInput id="cf_p_fecha" value={pFecha} onChange={(v) => setPFecha(v)} className="w-40" /></div>
          <div><label className="label" htmlFor="cf_p_pers">Personas</label><input id="cf_p_pers" inputMode="numeric" value={pPers} onChange={(e) => setPPers(e.target.value)} className="input w-24" /></div>
        </div>
        <p role="status" data-testid="conf-prueba" className="text-sm">Una reserva de <b>{numero(pPers) ?? 1}</b> {numero(pPers) === 1 ? 'persona' : 'personas'}{pTipo ? <> ({etiquetaTipo(pTipo)})</> : null} el <b>{fechaCorta(pFecha || hoy)}</b>: <b className={prueba.estado === 'confirmada' ? 'text-rs-lime' : 'text-rs-warn'}>{RESULTADOS.find((o) => o.value === prueba.estado)?.corto}</b>{prueba.regla !== null ? <span className="text-rs-muted"> (por la excepción {prueba.regla + 1})</span> : <span className="text-rs-muted"> (por defecto)</span>}.</p>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <EstadoGuardado estado={estado} error={error} />
        <p className="text-xs text-rs-muted">Rige para las reservas del sitio y las que carga el bot, y cuando un cliente modifica una reserva desde su link (si el cambio cae en una excepción “en Nuevas”, la reserva vuelve a revisión). Las reservas que cargás a mano desde el panel las dejás en el estado que elijas.</p>
      </div>
    </div>
  )
}
