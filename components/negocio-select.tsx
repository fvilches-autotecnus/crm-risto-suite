'use client'

import { useRouter } from 'next/navigation'
import { useEffect, useState, useTransition } from 'react'
import { cambiarNegocio } from '@/app/(panel)/actions'

// Selector de negocio (superadmin / usuarios con varios negocios). Es "controlado": muestra lo elegido al instante,
// guarda la elección en el servidor y refresca la página con los datos del negocio nuevo.
export default function NegocioSelect({ negocios, actual }: { negocios: { id: string; nombre: string }[]; actual: string }) {
  const router = useRouter()
  const [valor, setValor] = useState(actual)
  const [pending, start] = useTransition()
  useEffect(() => setValor(actual), [actual])

  return (
    <select
      value={valor}
      disabled={pending}
      aria-label="Negocio"
      onChange={(e) => {
        const id = e.target.value
        setValor(id)
        start(async () => {
          const fd = new FormData()
          fd.set('negocio_id', id)
          await cambiarNegocio(fd)
          router.refresh()
        })
      }}
      className={'h-6 max-w-[180px] rounded-full border-0 bg-rs-raised px-2.5 text-xs text-rs-lime outline-none transition ' + (pending ? 'animate-pulse opacity-70' : '')}
    >
      {negocios.map((n) => (
        <option key={n.id} value={n.id}>{n.nombre}</option>
      ))}
    </select>
  )
}
