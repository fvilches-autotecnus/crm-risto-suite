'use client'

import { useTransition } from 'react'
import { marcarConsulta } from '../actions'

export default function ConsultaAcciones({ id, estado }: { id: string; estado: string }) {
  const [pending, start] = useTransition()
  const nuevo = estado === 'resuelta' ? 'pendiente' : 'resuelta'
  return (
    <div className="mt-3">
      <button disabled={pending} onClick={() => start(async () => { await marcarConsulta(id, nuevo) })} className="btn btn-sm">
        {nuevo === 'resuelta' ? 'Marcar como resuelta' : 'Volver a pendiente'}
      </button>
    </div>
  )
}
