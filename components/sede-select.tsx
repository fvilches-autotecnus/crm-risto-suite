'use client'

import { useRouter } from 'next/navigation'
import { useEffect, useState, useTransition } from 'react'
import { cambiarSede } from '@/app/(panel)/actions'

// Selector de sede del encabezado. Con una sola sede de alcance no hace falta: se muestra como etiqueta.
export default function SedeSelect({ sedes, actual }: { sedes: { id: string; nombre: string }[]; actual: string | null }) {
  const router = useRouter()
  const [valor, setValor] = useState(actual ?? 'todas')
  const [pending, start] = useTransition()
  useEffect(() => setValor(actual ?? 'todas'), [actual])

  if (sedes.length === 1) return <span className="rounded-full border border-rs-control px-2.5 py-0.5 text-xs text-rs-muted">{sedes[0].nombre}</span>
  return (
    <select
      value={valor}
      disabled={pending}
      aria-label="Sede"
      onChange={(e) => {
        const id = e.target.value
        setValor(id)
        start(async () => {
          const fd = new FormData()
          fd.set('sede_id', id)
          await cambiarSede(fd)
          router.refresh()
        })
      }}
      className={'h-6 max-w-[170px] rounded-full border border-rs-control bg-transparent px-2.5 text-xs text-rs-text outline-none transition ' + (pending ? 'animate-pulse opacity-70' : '')}
    >
      <option value="todas" className="bg-[#131d03]">Todas las sedes</option>
      {sedes.map((x) => <option key={x.id} value={x.id} className="bg-[#131d03]">{x.nombre}</option>)}
    </select>
  )
}
