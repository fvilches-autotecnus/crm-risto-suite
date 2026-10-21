'use client'

import { cambiarNegocio } from '@/app/(panel)/actions'

export default function NegocioSelect({ negocios, actual }: { negocios: { id: string; nombre: string }[]; actual: string }) {
  return (
    <form action={cambiarNegocio}>
      <select
        name="negocio_id"
        defaultValue={actual}
        aria-label="Negocio"
        onChange={(e) => e.currentTarget.form?.requestSubmit()}
        className="h-6 max-w-[180px] rounded-full border-0 bg-rs-raised px-2.5 text-xs text-rs-lime outline-none"
      >
        {negocios.map((n) => (
          <option key={n.id} value={n.id}>{n.nombre}</option>
        ))}
      </select>
    </form>
  )
}
