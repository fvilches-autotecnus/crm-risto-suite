'use client'

import { useActionState, useTransition } from 'react'
import { Trash2 } from 'lucide-react'
import { agregarFechaBloqueada, borrarFechaBloqueada, guardarAforo, type ActionResult } from '../actions'

function Estado({ state }: { state: ActionResult | null }) {
  if (!state) return null
  return state.ok ? <span className="text-sm text-rs-ok">Guardado</span> : <span role="alert" className="text-sm text-rs-danger">{state.error}</span>
}

export function AforoForm({ aforo, puedeEditar }: { aforo: number | null; puedeEditar: boolean }) {
  const [state, action, pending] = useActionState<ActionResult | null, FormData>(guardarAforo, null)
  return (
    <form action={action} className="mt-3 flex flex-wrap items-center gap-3">
      <input name="aforo" type="number" min={1} defaultValue={aforo ?? ''} placeholder="Sin límite" disabled={!puedeEditar} aria-label="Aforo máximo" className="input w-32" />
      <span className="text-sm text-rs-muted">personas</span>
      {puedeEditar && <button disabled={pending} className="btn btn-primary">{pending ? 'Guardando…' : 'Guardar'}</button>}
      <Estado state={state} />
    </form>
  )
}

export function BloqueoForm() {
  const [state, action, pending] = useActionState<ActionResult | null, FormData>(agregarFechaBloqueada, null)
  return (
    <form action={action} className="mt-3 flex flex-wrap items-end gap-3">
      <div><label className="label" htmlFor="b_fecha">Fecha</label><input id="b_fecha" name="fecha" type="date" required className="input" /></div>
      <div><label className="label" htmlFor="b_desde">Desde</label><input id="b_desde" name="hora_desde" type="time" className="input" /></div>
      <div><label className="label" htmlFor="b_hasta">Hasta</label><input id="b_hasta" name="hora_hasta" type="time" className="input" /></div>
      <div className="min-w-[160px] flex-1"><label className="label" htmlFor="b_motivo">Motivo</label><input id="b_motivo" name="motivo" placeholder="Opcional" className="input w-full" /></div>
      <button disabled={pending} className="btn btn-primary">Bloquear</button>
      <Estado state={state} />
    </form>
  )
}

export function BorrarBloqueo({ id }: { id: string }) {
  const [pending, start] = useTransition()
  return (
    <button disabled={pending} onClick={() => confirm('¿Desbloquear esta fecha?') && start(async () => { await borrarFechaBloqueada(id) })} aria-label="Desbloquear fecha" className="btn btn-sm btn-danger">
      <Trash2 size={14} />
    </button>
  )
}
