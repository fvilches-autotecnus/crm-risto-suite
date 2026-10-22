'use client'

import { useTransition } from 'react'
import { CheckCircle2, RotateCcw } from 'lucide-react'
import { useToast } from '@/components/feedback'
import { Spinner } from '@/components/ui'
import { cambiarTipoConsulta } from '../modulos-actions'
import { marcarConsulta } from '../actions'

export default function ConsultaAcciones({ id, estado, tipo }: { id: string; estado: string; tipo: string }) {
  const [pending, start] = useTransition()
  const nuevo = estado === 'resuelta' ? 'pendiente' : 'resuelta'
  const toast = useToast()
  return (
    <div className="flex flex-wrap items-center justify-end gap-1.5">
      <select
        aria-label="Tipo"
        value={tipo}
        disabled={pending}
        onChange={(e) => start(async () => { const r = await cambiarTipoConsulta(id, e.target.value as 'consulta' | 'reclamo'); toast(r.ok ? { texto: 'Tipo actualizado' } : { tipo: 'error', texto: r.error ?? 'Error' }) })}
        className="input h-7 px-2 text-xs"
      >
        <option value="consulta">Consulta</option>
        <option value="reclamo">Reclamo</option>
      </select>
      <button
        disabled={pending}
        onClick={() => start(async () => { const r = await marcarConsulta(id, nuevo); toast(r.ok ? { texto: nuevo === 'resuelta' ? 'Marcada como resuelta' : 'Vuelta a pendiente', accion: { label: 'Deshacer', onClick: () => { void marcarConsulta(id, estado as 'pendiente' | 'resuelta') } } } : { tipo: 'error', texto: r.error ?? 'No se pudo actualizar' }) })}
        className="btn btn-sm"
      >
        {pending ? <Spinner /> : nuevo === 'resuelta' ? <CheckCircle2 size={13} /> : <RotateCcw size={13} />}{nuevo === 'resuelta' ? 'Resolver' : 'Reabrir'}
      </button>
    </div>
  )
}
