'use client'

import { useState, useTransition } from 'react'
import { Clock, MessageCircle, Trash2 } from 'lucide-react'
import { descartarSolicitudWeb, registrarSolicitudWeb } from '@/app/(panel)/reservas-web-actions'
import { useToast } from '@/components/feedback'
import { Spinner } from '@/components/ui'
import { fechaCorta, fechaHoraLarga, horaCorta } from '@/lib/fechas'
import { labelTipo } from '@/lib/reservas'

export interface SolicitudWebUI { id: string; codigo: string; nombre: string; fecha: string; hora: string; personas: number; ubicacion: string | null; cualquier_ubicacion?: boolean; tipo_reserva: string; observaciones: string | null; mesas: string | null; creado_en: string }

/** Solicitudes del sitio de reservas que todavía NO son reservas: el cliente las armó pero no mandó el mensaje de WhatsApp.
 *  No ocupan mesa ni aforo. Si el bot no las registró solo, se registran a mano con el teléfono de quien escribió. */
export default function SolicitudesWeb({ solicitudes, puedeEscribir, etiquetasTipo = {} }: { solicitudes: SolicitudWebUI[]; puedeEscribir: boolean; etiquetasTipo?: Record<string, string> }) {
  const toast = useToast()
  const [abierta, setAbierta] = useState<string | null>(null)
  const [tel, setTel] = useState('')
  const [pending, start] = useTransition()
  if (solicitudes.length === 0) return null

  const registrar = (s: SolicitudWebUI) => start(async () => {
    const r = await registrarSolicitudWeb(s.id, tel)
    if (!r.ok) { toast({ tipo: 'error', texto: r.error ?? 'No se pudo registrar' }); return }
    setAbierta(null); setTel('')
    toast({ texto: `Reserva #${r.numero} registrada para ${s.nombre}` })
    if (r.nota) toast({ tipo: 'info', texto: r.nota })
  })
  const descartar = (s: SolicitudWebUI) => start(async () => {
    const r = await descartarSolicitudWeb(s.id)
    toast(r.ok ? { texto: `Solicitud de ${s.nombre} descartada` } : { tipo: 'error', texto: r.error ?? 'No se pudo descartar' })
  })

  return (
    <details className="card border-rs-warn/30 p-0" open>
      <summary className="flex cursor-pointer flex-wrap items-center gap-2 px-4 py-3">
        <MessageCircle size={16} className="text-rs-warn" />
        <span className="font-semibold">Solicitudes web esperando el WhatsApp ({solicitudes.length})</span>
        <span className="text-xs text-rs-muted">Todavía no son reservas: no ocupan mesa ni aforo.</span>
      </summary>
      <ul className="divide-y divide-rs-border/60 border-t border-rs-border/60">
        {solicitudes.map((s) => (
          <li key={s.id} className="space-y-2 px-4 py-3 text-sm">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <p className="font-semibold">{s.nombre} <span className="ml-1 rounded bg-rs-raised px-1.5 py-0.5 font-mono text-xs tracking-widest text-rs-lime" title="El código que viaja en su mensaje de WhatsApp">{s.codigo}</span></p>
                <p className="text-rs-muted">{fechaCorta(s.fecha)} · {horaCorta(s.hora)} · {s.personas} personas{s.ubicacion ? ` · ${s.ubicacion}` : s.cualquier_ubicacion ? ' · cualquier ubicación' : ''} · {labelTipo(s.tipo_reserva, etiquetasTipo)}{s.mesas ? ` · pidió mesa ${s.mesas}` : ' · mesa a elección del local'}</p>
                {s.observaciones && <p className="text-rs-muted/90">{s.observaciones}</p>}
                <p className="mt-0.5 inline-flex items-center gap-1 text-xs text-rs-muted/70"><Clock size={11} />Armada {fechaHoraLarga(s.creado_en)}</p>
              </div>
              {puedeEscribir && abierta !== s.id && (
                <div className="flex gap-1.5">
                  <button disabled={pending} onClick={() => { setAbierta(s.id); setTel('') }} className="btn btn-sm">Registrar con su teléfono</button>
                  <button disabled={pending} onClick={() => descartar(s)} aria-label="Descartar solicitud" title="Descartar" className="btn btn-sm btn-danger"><Trash2 size={14} /></button>
                </div>
              )}
            </div>
            {puedeEscribir && abierta === s.id && (
              <form onSubmit={(e) => { e.preventDefault(); registrar(s) }} className="flex flex-wrap items-end gap-2 rounded-md bg-rs-raised/50 p-3">
                <div className="min-w-[200px] flex-1">
                  <label className="label" htmlFor={`sw_tel_${s.id}`}>Teléfono con el que escribió</label>
                  <input id={`sw_tel_${s.id}`} type="tel" inputMode="tel" autoFocus value={tel} onChange={(e) => setTel(e.target.value)} placeholder="Ej. 341 6582156" className="input w-full" required />
                </div>
                <button disabled={pending} className="btn btn-primary">{pending && <Spinner />}Registrar reserva</button>
                <button type="button" disabled={pending} onClick={() => setAbierta(null)} className="btn">Cancelar</button>
              </form>
            )}
          </li>
        ))}
      </ul>
    </details>
  )
}
