import { AlertTriangle, Check } from 'lucide-react'
import { avisoSenaPagada, type Reserva } from '@/lib/reservas'

type DatosAviso = Pick<Reserva, 'estado' | 'fecha' | 'hora' | 'cantidad_personas' | 'monto_sena' | 'pago'>

/**
 * Aviso chico bajo el estado: la reserva tiene una seña pagada y se canceló o se modificó (el detalle sale al pasar el mouse).
 * Con `onResolver` (quien puede escribir) trae la tilde para marcarlo como resuelto.
 */
export function MarcaSenaPagada({ r, onResolver, ocupado }: { r: DatosAviso; onResolver?: () => void; ocupado?: boolean }) {
  const a = avisoSenaPagada(r)
  if (!a) return null
  return (
    <div className="mt-1 inline-flex items-center gap-1 rounded-full bg-rs-warn/15 py-0.5 pl-2 pr-1 text-[11px] font-semibold text-rs-warn" title={a.detalle}>
      <AlertTriangle size={11} />{a.corto}
      {onResolver && <button type="button" disabled={ocupado} onClick={onResolver} title="Marcar como resuelto" aria-label="Marcar el aviso de seña como resuelto" className="ml-0.5 rounded-full p-0.5 hover:bg-rs-warn/25 disabled:opacity-50"><Check size={11} /></button>}
    </div>
  )
}

/** Recuadro con el detalle completo (dentro de Editar reserva y al cancelar). Solo avisa: no hace nada con la seña. */
export function AvisoSenaPagada({ r, onResolver, ocupado }: { r: DatosAviso; onResolver?: () => void; ocupado?: boolean }) {
  const a = avisoSenaPagada(r)
  if (!a) return null
  return (
    <div role="status" className="mb-4 flex items-start gap-2.5 rounded-rs border border-rs-warn/40 bg-rs-warn/10 px-3.5 py-2.5 text-sm">
      <AlertTriangle size={16} className="mt-0.5 shrink-0 text-rs-warn" />
      <div className="min-w-0 flex-1">
        <p className="font-semibold text-rs-warn">{a.tipo === 'cancelada' ? 'Seña pagada' : 'Reserva modificada con seña pagada'}</p>
        <p className="mt-0.5 text-rs-muted">{a.detalle}</p>
        {onResolver && <button type="button" disabled={ocupado} onClick={onResolver} className="btn btn-sm mt-2"><Check size={14} />Marcar como resuelto</button>}
      </div>
    </div>
  )
}
