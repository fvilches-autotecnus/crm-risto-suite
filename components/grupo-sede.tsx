'use client'

import { useState } from 'react'

/** Un grupo de ajustes que una sede puede personalizar o heredar del negocio. Sin sede (configuración del negocio) se muestra tal cual.
 *  Con sede, un casillero decide si la sede usa sus propios valores o los del negocio (los campos quedan deshabilitados y no se envían). */
export default function GrupoSede({ id, titulo, sedeId, pisado, ayuda, children }: { id: string; titulo: string; sedeId?: string | null; pisado: boolean; ayuda?: string; children: React.ReactNode }) {
  const [propio, setPropio] = useState(pisado)
  if (!sedeId) return <>{children}</>
  return (
    <fieldset className={'space-y-3 rounded-md border p-3 ' + (propio ? 'border-rs-lime/40 bg-rs-lime/5' : 'border-rs-border/60')} data-grupo-sede={id}>
      <legend className="px-1 text-sm font-semibold">{titulo}</legend>
      <label className="flex items-start gap-2 text-sm"><input type="checkbox" name={`ov_${id}`} checked={propio} onChange={(e) => setPropio(e.target.checked)} className="mt-0.5 h-4 w-4 accent-[#c8e62b]" aria-label={`Personalizar ${titulo} para esta sede`} />
        <span><span className="font-medium">Personalizar para esta sede</span><span className="block text-xs text-rs-muted">{propio ? 'Esta sede usa sus propios valores.' : 'Hereda lo del negocio: abajo ves lo que vale hoy. Marcalo para cambiarlo solo en esta sede.'}{ayuda ? ' ' + ayuda : ''}</span></span></label>
      <fieldset disabled={!propio} className={'space-y-3 ' + (propio ? '' : 'opacity-60')}>{children}</fieldset>
    </fieldset>
  )
}
