'use client'

import { useTransition } from 'react'
import { CheckCircle2, RotateCcw } from 'lucide-react'
import { useToast } from '@/components/feedback'
import { Spinner } from '@/components/ui'
import { marcarConsulta } from '../actions'

export default function ConsultaAcciones({ id, estado }: { id: string; estado: string }) {
  const [pending, start] = useTransition()
  const nuevo = estado === 'resuelta' ? 'pendiente' : 'resuelta'
  const toast = useToast()
  return (
    <div className="mt-3">
      <button disabled={pending} onClick={() => start(async () => { const r = await marcarConsulta(id, nuevo); toast(r.ok ? { texto: nuevo === 'resuelta' ? 'Consulta marcada como resuelta' : 'Consulta vuelta a pendiente', accion: { label: 'Deshacer', onClick: () => { void marcarConsulta(id, estado as 'pendiente' | 'resuelta') } } } : { tipo: 'error', texto: r.error ?? 'No se pudo actualizar' }) })} className="btn btn-sm">
        {pending ? <Spinner /> : nuevo === 'resuelta' ? <CheckCircle2 size={13} /> : <RotateCcw size={13} />}{nuevo === 'resuelta' ? 'Marcar como resuelta' : 'Volver a pendiente'}
      </button>
    </div>
  )
}
