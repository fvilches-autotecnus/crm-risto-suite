import { AlertTriangle } from 'lucide-react'
import { avisoSenaPagada, type Reserva } from '@/lib/reservas'

type DatosAviso = Pick<Reserva, 'estado' | 'fecha' | 'hora' | 'cantidad_personas' | 'monto_sena' | 'pago'>

/** Aviso chico bajo el estado: la reserva tiene una seña pagada y se canceló o se modificó (el detalle sale al pasar el mouse). */
export function MarcaSenaPagada({ r }: { r: DatosAviso }) {
  const a = avisoSenaPagada(r)
  if (!a) return null
  return <div className="mt-1 inline-flex items-center gap-1 rounded-full bg-rs-warn/15 px-2 py-0.5 text-[11px] font-semibold text-rs-warn" title={a.detalle}><AlertTriangle size={11} />{a.corto}</div>
}

/** Recuadro con el detalle completo (dentro de Editar reserva y al cancelar). Solo avisa: no hace nada con la seña. */
export function AvisoSenaPagada({ r }: { r: DatosAviso }) {
  const a = avisoSenaPagada(r)
  if (!a) return null
  return (
    <div role="status" className="mb-4 flex items-start gap-2.5 rounded-rs border border-rs-warn/40 bg-rs-warn/10 px-3.5 py-2.5 text-sm">
      <AlertTriangle size={16} className="mt-0.5 shrink-0 text-rs-warn" />
      <div><p className="font-semibold text-rs-warn">{a.tipo === 'cancelada' ? 'Seña pagada' : 'Reserva modificada con seña pagada'}</p><p className="mt-0.5 text-rs-muted">{a.detalle}</p></div>
    </div>
  )
}
