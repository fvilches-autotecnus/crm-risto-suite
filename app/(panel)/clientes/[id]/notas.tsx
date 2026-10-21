'use client'

import { useActionState } from 'react'
import { guardarNotasCliente, type ActionResult } from '../../actions'

export default function NotasCliente({ id, notas, puedeEscribir }: { id: string; notas: string; puedeEscribir: boolean }) {
  const [state, action, pending] = useActionState<ActionResult | null, FormData>(guardarNotasCliente, null)
  return (
    <form action={action} className="card p-5">
      <input type="hidden" name="id" value={id} />
      <label className="label" htmlFor="notas">Notas del cliente (alergias, preferencias, ocasiones)</label>
      <textarea id="notas" name="notas" rows={3} defaultValue={notas} disabled={!puedeEscribir} className="input w-full" />
      <div className="mt-3 flex items-center gap-3">
        {puedeEscribir && <button disabled={pending} className="btn btn-primary">{pending ? 'Guardando…' : 'Guardar notas'}</button>}
        {state?.ok && <span className="text-sm text-rs-ok">Guardado</span>}
        {state && !state.ok && <span role="alert" className="text-sm text-rs-danger">{state.error}</span>}
      </div>
    </form>
  )
}
