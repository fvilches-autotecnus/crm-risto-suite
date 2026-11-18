'use client'

import { useState, useTransition } from 'react'
import { AlertTriangle, RefreshCw, Sparkles } from 'lucide-react'
import { Spinner } from '@/components/ui'
import { fechaHoraCorta } from '@/lib/fechas'
import { fichaDeCliente, type FichaResultado } from '@/app/(panel)/ia-ficha-actions'
import type { FichaIA } from '@/lib/ia-ficha'
import { useZona } from '@/components/zona'

/**
 * Ficha del cliente con IA: un resumen corto y qué tener en cuenta para recibirlo. Arranca con la última guardada (no cuesta);
 * "Actualizar" la rearma solo si los datos del cliente cambiaron (y gasta un lugar del tope diario del negocio).
 */
export default function FichaClienteIA({ clienteId, inicial }: { clienteId: string; inicial: { ficha: FichaIA; generado: string } | null }) {
  const zona = useZona()
  const [ficha, setFicha] = useState<{ ficha: FichaIA; generado: string } | null>(inicial)
  const [aviso, setAviso] = useState('')
  const [error, setError] = useState('')
  const [pend, ir] = useTransition()

  const pedir = () => {
    setError(''); setAviso('')
    ir(async () => {
      let r: FichaResultado
      try { r = await fichaDeCliente(clienteId) } catch { r = { ok: false, error: 'No se pudo armar la ficha. Probá de nuevo.' } }
      if (!r.ok) { setError(r.error); return }
      setFicha({ ficha: r.ficha, generado: r.generado })
      if (r.reutilizada) setAviso('El cliente no tiene datos nuevos desde la última vez: la ficha sigue vigente.')
    })
  }

  return (
    <section className="card p-5" aria-labelledby="h-ficha-ia">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 id="h-ficha-ia" className="card-title flex items-center gap-2"><Sparkles size={15} className="text-rs-lime" />Ficha con IA</h2>
        <button type="button" onClick={pedir} disabled={pend} className="btn btn-sm">{pend ? <Spinner /> : ficha ? <RefreshCw size={13} /> : <Sparkles size={13} />}{pend ? 'Armando la ficha…' : ficha ? 'Actualizar' : 'Armar ficha'}</button>
      </div>
      {error && <p role="alert" className="mt-3 rounded-md border border-rs-danger/40 bg-rs-danger/10 px-3 py-2 text-sm text-rs-danger">{error}</p>}
      {!ficha && !error && <p className="mt-2 text-sm text-rs-muted">Un resumen de cómo es este cliente y qué conviene tener en cuenta al recibirlo, armado con sus reservas, pedidos, reseñas y notas.</p>}
      {ficha && (
        <div className="mt-3 space-y-3 text-sm" data-testid="ficha-ia">
          <p className="text-[15px] leading-relaxed">{ficha.ficha.resumen}</p>
          {ficha.ficha.claves.length > 0 && <ul className="list-disc space-y-1.5 pl-5 marker:text-rs-lime">{ficha.ficha.claves.map((c, i) => <li key={i}>{c}</li>)}</ul>}
          {ficha.ficha.alertas.length > 0 && (
            <div className="rounded-rs border border-rs-warn/40 bg-rs-warn/10 px-3 py-2">
              <p className="flex items-center gap-1.5 text-xs font-semibold text-rs-warn"><AlertTriangle size={13} />A tener en cuenta</p>
              <ul className="mt-1 list-disc space-y-1 pl-5">{ficha.ficha.alertas.map((a, i) => <li key={i}>{a}</li>)}</ul>
            </div>
          )}
          {aviso && <p className="text-xs text-rs-muted" role="status">{aviso}</p>}
          <p className="border-t border-rs-border/60 pt-3 text-xs text-rs-muted">Generado con IA · {fechaHoraCorta(ficha.generado, zona)}. Puede equivocarse: ante una duda, confirmá con el cliente.</p>
        </div>
      )}
    </section>
  )
}
