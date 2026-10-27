'use client'

import { useState, useTransition } from 'react'
import { guardarEstadoSede } from '@/app/(panel)/config-sedes-actions'
import { useToast } from '@/components/feedback'
import { Spinner } from '@/components/ui'
import { RESULTADOS, textoCondicion, type ReglaConfirmacion, type ResultadoConfirmacion } from '@/lib/confirmacion'

/** Cómo entran las reservas de una sede: como el negocio o con su propio resultado por defecto. Las excepciones (cantidad de personas, tipo, fechas…) se cargan en el negocio, eligiendo la sede. */
export default function ConfigConfirmacionSede({ sedeId, defectoNegocio, valor, reglas, nombreSede, tipos }: { sedeId: string; defectoNegocio: ResultadoConfirmacion; valor: ResultadoConfirmacion | null; reglas: ReglaConfirmacion[]; nombreSede: string; tipos: { value: string; label: string }[] }) {
  const toast = useToast()
  const [v, setV] = useState<string>(valor ?? '')
  const [pending, start] = useTransition()
  const corto = (r: ResultadoConfirmacion) => RESULTADOS.find((o) => o.value === r)?.corto
  const guardar = () => start(async () => { const r = await guardarEstadoSede(sedeId, v || null); toast(r.ok ? { texto: 'Confirmación de la sede guardada' } : { tipo: 'error', texto: r.error ?? 'No se pudo guardar' }) })
  return (
    <div className="space-y-3">
      <fieldset className="space-y-2">
        <legend className="label">Por defecto, una reserva de {nombreSede} que llega por el sitio o el bot…</legend>
        <label className="flex items-start gap-2 text-sm"><input type="radio" name="cfs_estado" checked={v === ''} onChange={() => setV('')} className="mt-1 h-4 w-4 accent-[#c8e62b]" /><span><span className="font-medium">Como el negocio</span><span className="block text-xs text-rs-muted">Hoy: {corto(defectoNegocio)}.</span></span></label>
        {RESULTADOS.map((o) => <label key={o.value} className="flex items-start gap-2 text-sm"><input type="radio" name="cfs_estado" checked={v === o.value} onChange={() => setV(o.value)} className="mt-1 h-4 w-4 accent-[#c8e62b]" /><span className="font-medium">{o.label}</span></label>)}
      </fieldset>
      {reglas.length > 0 && (
        <div className="rounded-md bg-rs-raised/40 p-3 text-xs text-rs-muted">
          <p className="mb-1 font-semibold text-rs-text">Excepciones que le tocan a esta sede (se cargan en la configuración del negocio):</p>
          <ul className="list-disc space-y-0.5 pl-4">{reglas.map((r) => <li key={r.uid} className={r.activo ? '' : 'line-through opacity-60'}>{textoCondicion(r, () => nombreSede, (c) => tipos.find((t) => t.value === c)?.label ?? c)} → {corto(r.resultado)}</li>)}</ul>
        </div>
      )}
      <button type="button" onClick={guardar} disabled={pending} className="btn btn-primary">{pending && <Spinner />}{pending ? 'Guardando…' : 'Guardar'}</button>
    </div>
  )
}
