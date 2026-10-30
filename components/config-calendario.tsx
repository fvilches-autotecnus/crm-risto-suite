'use client'

import { useState, useTransition } from 'react'
import { Plus, Trash2 } from 'lucide-react'
import { agregarDiaExtra, guardarDiasApertura, quitarDiaExtra } from '@/app/(panel)/calendario-actions'
import { useToast } from '@/components/feedback'
import { EstadoGuardado, useAutoGuardar } from '@/components/estado-guardado'
import { FechaInput } from '@/components/inputs'
import { Spinner } from '@/components/ui'
import { fechaCorta } from '@/lib/fechas'

import { DIAS_SEMANA } from '@/lib/dias'
export { DIAS_SEMANA }

export interface AmbitoApertura { id: string | null; nombre: string; dias: number[] | null }   // id null = todo el negocio; dias null = sin regla
export interface DiaExtraUI { id: string; fecha: string; motivo: string | null; sucursal_id: string | null }

function Ambito({ a, esSede }: { a: AmbitoApertura; esSede: boolean }) {
  const [dias, setDias] = useState<number[]>(a.dias ?? DIAS_SEMANA.map((d) => d.n))
  const alternar = (n: number) => setDias((d) => (d.includes(n) ? d.filter((x) => x !== n) : [...d, n]))
  const conRegla = dias.length < 7   // con los 7 días marcados no hay regla: abre todos los días (o, en una sede, usa los del negocio)
  // se guarda solo al marcar o desmarcar un día (con los 7 marcados se borra la regla)
  const { estado, error } = useAutoGuardar(JSON.stringify([...dias].sort()), () => guardarDiasApertura(a.id, dias.length === 7 ? null : dias), { activo: dias.length > 0 })
  return (
    <li className="space-y-2 rounded-md border border-rs-border/60 bg-rs-raised/30 p-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <span className="font-semibold">{a.nombre}</span>
        <span className="text-xs text-rs-muted">{dias.length === 0 ? 'Elegí al menos un día' : conRegla ? 'Abre solo los días marcados' : esSede ? 'Usa los días del negocio' : 'Abre todos los días'}</span>
      </div>
      <div className="flex flex-wrap gap-2" role="group" aria-label={`Días que abre ${a.nombre}`}>
        {DIAS_SEMANA.map((d) => (
          <label key={d.n} className={'inline-flex h-9 cursor-pointer items-center rounded-full border px-3.5 text-sm font-medium transition ' + (dias.includes(d.n) ? 'border-rs-lime/70 bg-rs-lime/15 font-semibold text-rs-lime' : 'border-rs-control text-rs-muted hover:border-rs-lime/40 hover:text-rs-text')}>
            <input type="checkbox" className="sr-only" checked={dias.includes(d.n)} onChange={() => alternar(d.n)} aria-label={d.l} />{d.c}
          </label>
        ))}
      </div>
      <div className="flex flex-wrap items-center gap-3">
        {conRegla && <button type="button" onClick={() => setDias(DIAS_SEMANA.map((d) => d.n))} className="btn btn-sm">{esSede ? 'Usar los días del negocio' : 'Abre todos los días'}</button>}
        <EstadoGuardado estado={dias.length === 0 ? 'error' : estado} error={dias.length === 0 ? 'Elegí al menos un día de la semana' : error} />
      </div>
    </li>
  )
}

/** Días que abre el negocio / cada sede (según la semana) y los días especiales que abre aunque no sea su día habitual. */
export default function ConfigCalendario({ ambitos, extras, sedes, hoy, puedeAdministrar }: { ambitos: AmbitoApertura[]; extras: DiaExtraUI[]; sedes: { id: string; nombre: string }[]; hoy: string; puedeAdministrar: boolean }) {
  const toast = useToast()
  const [fecha, setFecha] = useState('')
  const [motivo, setMotivo] = useState('')
  const [sede, setSede] = useState('')
  const [pending, start] = useTransition()
  const nombreSede = (id: string | null) => (id ? sedes.find((s) => s.id === id)?.nombre ?? 'Sede' : 'Todo el negocio')
  const agregar = () => start(async () => {
    const r = await agregarDiaExtra(sede || null, fecha, motivo)
    if (!r.ok) { toast({ tipo: 'error', texto: r.error ?? 'No se pudo agregar' }); return }
    toast({ texto: 'Día agregado al calendario' }); setFecha(''); setMotivo('')
  })
  const quitar = (e: DiaExtraUI) => start(async () => { const r = await quitarDiaExtra(e.id); toast(r.ok ? { texto: `Se quitó el ${fechaCorta(e.fecha)}` } : { tipo: 'error', texto: r.error ?? 'No se pudo quitar' }) })
  return (
    <div className="space-y-5">
      {puedeAdministrar && (
        <div className="space-y-2">
          <h3 className="label">Días que abre habitualmente</h3>
          <ul className="space-y-2">{ambitos.map((a) => <Ambito key={a.id ?? 'negocio'} a={a} esSede={!!a.id} />)}</ul>
          <p className="text-xs text-rs-muted">En los días que no abre, el sitio de reservas los muestra cerrados (no se pueden elegir) y el bot no los ofrece. Una sede con sus propios días ignora los del negocio.</p>
        </div>
      )}
      <div className="space-y-2">
        <h3 className="label">Días especiales que abre</h3>
        <p className="text-xs text-rs-muted">Para una semana especial: agregá el día puntual que abre aunque no sea uno de sus días habituales. Para <b className="text-rs-text">cerrar</b> un día puntual, usá “Fechas bloqueadas”.</p>
        <div className="flex flex-wrap items-end gap-3">
          {sedes.length > 0 && <div><label className="label" htmlFor="dx_sede">Sede</label><select id="dx_sede" value={sede} onChange={(e) => setSede(e.target.value)} className="input"><option value="">Todo el negocio</option>{sedes.map((s) => <option key={s.id} value={s.id}>{s.nombre}</option>)}</select></div>}
          <div><label className="label" htmlFor="dx_fecha">Fecha</label><FechaInput id="dx_fecha" value={fecha} min={hoy} onChange={setFecha} className="w-40" /></div>
          <div className="min-w-[160px] flex-1"><label className="label" htmlFor="dx_motivo">Motivo</label><input id="dx_motivo" value={motivo} onChange={(e) => setMotivo(e.target.value)} maxLength={120} placeholder="Opcional (ej. Semana del aniversario)" className="input w-full" /></div>
          <button type="button" disabled={pending || !fecha} onClick={agregar} className="btn btn-primary">{pending ? <Spinner /> : <Plus size={14} />}Agregar día</button>
        </div>
        {extras.length === 0 ? <p className="text-sm text-rs-muted">No hay días especiales cargados.</p> : (
          <ul className="divide-y divide-rs-border/60 rounded-md border border-rs-border/60">
            {extras.map((e) => (
              <li key={e.id} className="flex flex-wrap items-center justify-between gap-2 px-3 py-2 text-sm">
                <span><b className="tabular-nums">{fechaCorta(e.fecha)}</b> · {nombreSede(e.sucursal_id)}{e.motivo ? <span className="text-rs-muted"> · {e.motivo}</span> : null}{e.fecha < hoy ? <span className="ml-2 text-xs text-rs-muted">(pasó)</span> : null}</span>
                <button type="button" disabled={pending} onClick={() => quitar(e)} aria-label={`Quitar el ${fechaCorta(e.fecha)}`} className="btn btn-sm btn-danger"><Trash2 size={13} /></button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  )
}
