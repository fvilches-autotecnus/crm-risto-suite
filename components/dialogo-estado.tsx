'use client'

import { numeroVisible } from '@/lib/reservas'
import { useState } from 'react'
import { MessageCircle } from 'lucide-react'
import Modal from '@/components/modal'
import { Spinner } from '@/components/ui'
import { fechaCorta, horaCorta } from '@/lib/fechas'
import { formatoMonto, labelEstado, type EstadoReserva, type Reserva } from '@/lib/reservas'

export interface DatosCambio { notificar: boolean; monto?: number; motivo?: string }

const TEXTOS: Partial<Record<EstadoReserva, { titulo: (n: number) => string; aviso: (r: Reserva, monto: number | null) => string; verbo: string }>> = {
  confirmada: { titulo: (n) => `Confirmar reserva #${n}`, verbo: 'Confirmar', aviso: () => 'Se le manda la confirmación de su reserva.' },
  pendiente_pago: { titulo: (n) => `Pendiente de pago · reserva #${n}`, verbo: 'Pasar a pendiente de pago', aviso: (_r, m) => `Se le avisa que tiene que pagar${m ? ' ' + formatoMonto(m) : ''} para asegurar la reserva.` },
  no_show: { titulo: (n) => `No-show · reserva #${n}`, verbo: 'Marcar no-show', aviso: () => 'Se le avisa que no se presentó a su reserva.' },
  cancelada: { titulo: (n) => `Cancelar reserva #${n}`, verbo: 'Cancelar reserva', aviso: () => 'Se le avisa la cancelación (con el motivo, si lo escribís).' },
}

/**
 * Diálogo al cambiar el estado de una reserva a confirmada, pendiente de pago, no-show o cancelada.
 * Pide lo que haga falta (monto / motivo) y, si el negocio tiene el aviso por WhatsApp, deja elegir si se le avisa al cliente.
 */
export default function DialogoCambioEstado({ r, estado, aviso, ocupado, onClose, onConfirmar }: {
  r: Reserva
  estado: EstadoReserva
  aviso: { disponible: boolean; estados: string[] }
  ocupado: boolean
  onClose: () => void
  onConfirmar: (d: DatosCambio) => void
}) {
  const [monto, setMonto] = useState(r.monto_sena ? String(r.monto_sena) : '')
  const [motivo, setMotivo] = useState('')
  const [error, setError] = useState('')
  const t = TEXTOS[estado]!
  const manual = r.es_manual === true   // las que se cargan a mano desde el CRM no se avisan: el cliente ya habló con una persona
  const avisable = !manual && aviso.disponible && !!r.cliente_telefono && aviso.estados.includes(estado)
  const nota = !aviso.disponible ? null : manual ? 'Es una reserva cargada a mano: no se le avisa al cliente por WhatsApp.' : !r.cliente_telefono ? 'No hay teléfono del cliente: no se le puede avisar por WhatsApp.' : !aviso.estados.includes(estado) ? `El aviso por WhatsApp de “${labelEstado(estado)}” no está habilitado para este local.` : null
  const montoNum = Number(monto.replace(',', '.'))

  const enviar = (notificar: boolean) => {
    if (estado === 'pendiente_pago' && (!Number.isFinite(montoNum) || montoNum <= 0)) { setError('Ingresá el valor de la seña o del pago (mayor a 0)'); return }
    onConfirmar({ notificar, ...(estado === 'pendiente_pago' ? { monto: montoNum } : {}), ...(estado === 'cancelada' ? { motivo } : {}) })
  }

  return (
    <Modal titulo={t.titulo(numeroVisible(r))} onClose={onClose}>
      <form onSubmit={(e) => { e.preventDefault(); if (!avisable) enviar(false) }} noValidate>
        <div className="rounded-rs border border-rs-border bg-rs-raised/40 px-3.5 py-2.5 text-sm">
          <p className="font-semibold">{r.cliente_nombre ?? 'Sin nombre'}</p>
          <p className="text-xs text-rs-muted">{r.cantidad_personas ? `${r.cantidad_personas} personas · ` : ''}{fechaCorta(r.fecha)}{r.hora ? ` · ${horaCorta(r.hora)}` : ''}{r.cliente_telefono ? ` · ${r.cliente_telefono}` : ''}</p>
        </div>

        {estado === 'pendiente_pago' && (
          <div className="mt-4">
            <label className="label" htmlFor="monto_pago">Valor de la seña o del pago que tiene que hacer *</label>
            <div className="relative">
              <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-rs-muted">$</span>
              <input id="monto_pago" autoFocus type="number" inputMode="decimal" step="any" value={monto} onChange={(e) => { setMonto(e.target.value); setError('') }} placeholder="Ej. 5000" className="input w-full pl-7 tabular-nums" />
            </div>
            <p className="mt-1.5 text-xs text-rs-muted">Queda guardado en la reserva.</p>
          </div>
        )}
        {estado === 'cancelada' && (
          <div className="mt-4">
            <label className="label" htmlFor="motivo">Motivo (opcional)</label>
            <textarea id="motivo" autoFocus rows={3} value={motivo} onChange={(e) => setMotivo(e.target.value)} className="input w-full" />
          </div>
        )}

        {avisable && (
          <div className="mt-4 flex items-start gap-3 rounded-rs-lg border border-rs-lime/30 bg-rs-lime/5 px-3.5 py-3">
            <MessageCircle size={18} className="mt-0.5 shrink-0 text-rs-lime" />
            <div className="text-sm">
              <p className="font-semibold">¿Avisamos al cliente por WhatsApp?</p>
              <p className="mt-0.5 text-rs-muted">{t.aviso(r, estado === 'pendiente_pago' && montoNum > 0 ? montoNum : r.monto_sena)}</p>
            </div>
          </div>
        )}
        {nota && <p className="mt-3 text-xs text-rs-muted">{nota}</p>}
        {error && <p role="alert" className="mt-3 animate-fade-in text-sm text-rs-danger">{error}</p>}

        <div className="mt-5 flex flex-wrap justify-end gap-2">
          <button type="button" onClick={onClose} className="btn">Volver</button>
          {avisable ? (
            <>
              <button type="button" disabled={ocupado} onClick={() => enviar(false)} className={'btn ' + (estado === 'cancelada' ? 'btn-danger' : '')}>{t.verbo} sin avisar</button>
              <button type="button" disabled={ocupado} onClick={() => enviar(true)} className={'btn ' + (estado === 'cancelada' ? 'btn-danger' : 'btn-primary')}>{ocupado && <Spinner />}{t.verbo} y avisar</button>
            </>
          ) : (
            <button type="submit" disabled={ocupado} className={'btn ' + (estado === 'cancelada' ? 'btn-danger' : 'btn-primary')}>{ocupado && <Spinner />}{t.verbo}</button>
          )}
        </div>
      </form>
    </Modal>
  )
}
