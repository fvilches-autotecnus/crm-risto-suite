'use client'

import { useAccionFormulario } from '@/components/use-accion-formulario'
import { useResultado } from '@/components/feedback'
import { Spinner } from '@/components/ui'
import { guardarNotasCliente, type ActionResult } from '../../actions'

export default function NotasCliente({ id, notas, puedeEscribir }: { id: string; notas: string; puedeEscribir: boolean }) {
  const { state, pending, formProps } = useAccionFormulario(guardarNotasCliente)
  useResultado(state, 'Notas guardadas')
  return (
    <form {...formProps} className="card p-5">
      <input type="hidden" name="id" value={id} />
      <label className="label" htmlFor="notas">Notas del cliente (alergias, preferencias, ocasiones)</label>
      <textarea id="notas" name="notas" rows={3} defaultValue={notas} disabled={!puedeEscribir} className="input w-full" />
      <div className="mt-3 flex items-center gap-3">
        {puedeEscribir && <button disabled={pending} className="btn btn-primary">{pending && <Spinner />}{pending ? 'Guardando…' : 'Guardar notas'}</button>}
      </div>
    </form>
  )
}
