'use client'

import { cambiarSede } from '@/app/(panel)/actions'

// Selector de sede del encabezado. Con una sola sede de alcance no hace falta: se muestra como etiqueta.
export default function SedeSelect({ sedes, actual }: { sedes: { id: string; nombre: string }[]; actual: string | null }) {
  if (sedes.length === 1) return <span className="hidden rounded-full border border-rs-control px-2.5 py-0.5 text-xs text-rs-muted sm:inline">{sedes[0].nombre}</span>
  return (
    <form action={cambiarSede}>
      <select
        name="sede_id"
        defaultValue={actual ?? 'todas'}
        aria-label="Sede"
        onChange={(e) => e.currentTarget.form?.requestSubmit()}
        className="h-6 max-w-[170px] rounded-full border border-rs-control bg-transparent px-2.5 text-xs text-rs-text outline-none"
      >
        <option value="todas" className="bg-[#131d03]">Todas las sedes</option>
        {sedes.map((x) => <option key={x.id} value={x.id} className="bg-[#131d03]">{x.nombre}</option>)}
      </select>
    </form>
  )
}
