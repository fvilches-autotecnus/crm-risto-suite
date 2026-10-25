'use client'

import { useRouter, useSearchParams, usePathname } from 'next/navigation'
import { ArrowDownUp } from 'lucide-react'
import { iniciarCarga } from '@/lib/carga'

export const ORDEN_ALTA = [
  { value: 'alta_desc', label: 'Alta: más recientes primero' },
  { value: 'alta_asc', label: 'Alta: más antiguas primero' },
] as const

/** Selector de orden para listados: guarda la elección en ?orden= y conserva el resto de los filtros. */
export default function OrdenSelect({ opciones = ORDEN_ALTA as unknown as { value: string; label: string }[], porDefecto = 'alta_desc' }: { opciones?: { value: string; label: string }[]; porDefecto?: string }) {
  const router = useRouter()
  const pathname = usePathname()
  const sp = useSearchParams()
  const actual = sp.get('orden') ?? porDefecto
  return (
    <label className="relative inline-block">
      <ArrowDownUp size={14} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-rs-muted" />
      <select
        aria-label="Ordenar por"
        value={opciones.some((o) => o.value === actual) ? actual : porDefecto}
        onChange={(e) => {
          const p = new URLSearchParams(window.location.search)
          e.target.value === porDefecto ? p.delete('orden') : p.set('orden', e.target.value)
          p.delete('pagina')
          iniciarCarga()
          router.push(`${pathname}?${p.toString()}`)
        }}
        className="input pl-9"
      >
        {opciones.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
      </select>
    </label>
  )
}
