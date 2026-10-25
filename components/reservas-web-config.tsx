'use client'

import { guardarReservasWeb } from '@/app/(panel)/reservas-web-actions'
import { useToast } from '@/components/feedback'
import { Spinner } from '@/components/ui'
import { useAccionFormulario } from '@/components/use-accion-formulario'
import { useEffect, useState } from 'react'
import { Copy, ExternalLink } from 'lucide-react'

export interface ConfigReservasWeb { activo: boolean; elegir_mesa: boolean; tipos: string[]; horarios: string[]; dias_adelante: number; horas_anticipacion: number; personas_min: number; personas_max: number; mensaje: string | null }

/** Configuración del sitio público de reservas (/reservar/<negocio>): qué ofrece y con qué reglas. Lo demás (ubicaciones, aforo, fechas bloqueadas, planos) sale de lo ya configurado en el CRM. */
export default function ReservasWebConfig({ config, slug, tiposDisponibles, horariosSugeridos }: { config: ConfigReservasWeb; slug: string; tiposDisponibles: { value: string; label: string }[]; horariosSugeridos: string[] }) {
  const { state, pending, formProps } = useAccionFormulario(guardarReservasWeb)
  const toast = useToast()
  const [origen, setOrigen] = useState('')
  useEffect(() => setOrigen(window.location.origin), [])
  useEffect(() => { if (state?.ok) toast({ texto: 'Configuración guardada' }) }, [state]) // eslint-disable-line react-hooks/exhaustive-deps
  const url = `${origen}/reservar/${slug}`
  const copiar = async () => { try { await navigator.clipboard.writeText(url); toast({ texto: 'Enlace copiado' }) } catch { toast({ tipo: 'error', texto: url }) } }
  return (
    <form {...formProps} className="space-y-4">
      <label className="flex items-start gap-2 text-sm"><input type="checkbox" name="activo" defaultChecked={config.activo} className="mt-0.5 h-4 w-4 accent-[#c8e62b]" /><span><span className="font-medium">Sitio de reservas activo</span><span className="block text-xs text-rs-muted">Apagado, el enlace muestra “no encontrado”. Las reservas que llegan por el sitio quedan en estado inicial (normalmente “Nueva”) marcadas “[Sitio de prueba]”.</span></span></label>
      <div className="flex flex-wrap items-center gap-2 rounded-md bg-rs-raised/50 px-3 py-2 text-sm"><span className="min-w-0 flex-1 truncate font-mono text-xs">{url}</span><button type="button" onClick={copiar} className="btn btn-sm"><Copy size={13} />Copiar</button><a href={`/reservar/${slug}`} target="_blank" rel="noopener noreferrer" className="btn btn-sm"><ExternalLink size={13} />Abrir</a></div>
      <label className="flex items-start gap-2 text-sm"><input type="checkbox" name="elegir_mesa" defaultChecked={config.elegir_mesa} className="mt-0.5 h-4 w-4 accent-[#c8e62b]" /><span><span className="font-medium">El cliente puede elegir su mesa en el plano</span><span className="block text-xs text-rs-muted">Usa el plano de Salón y mesas. Se muestran como no disponibles las mesas con reservas confirmadas, pendientes de pago o en revisión de pago. Sin esto, siempre elige un asesor.</span></span></label>
      <fieldset><legend className="label">Tipos de reserva que se ofrecen</legend>
        <div className="flex flex-wrap gap-2">{tiposDisponibles.map((t) => <label key={t.value} className="flex cursor-pointer items-center gap-1.5 rounded-full border border-rs-control px-3 py-1 text-sm has-[:checked]:border-rs-lime/60 has-[:checked]:bg-rs-lime/10"><input type="checkbox" name="tipos" value={t.value} defaultChecked={config.tipos.includes(t.value)} className="h-3.5 w-3.5 accent-[#c8e62b]" />{t.label}</label>)}</div>
        <p className="mt-1 text-xs text-rs-muted">Son los tipos que ya existen en tus reservas. Si no marcás ninguno se ofrece solo “Común”.</p>
      </fieldset>
      <div>
        <label className="label" htmlFor="rw_horarios">Horarios</label>
        <input id="rw_horarios" name="horarios" defaultValue={config.horarios.join(', ')} placeholder={horariosSugeridos.join(', ') || '13:00, 21:00'} className="input w-full" />
        <p className="mt-1 text-xs text-rs-muted">Separados por coma. Si lo dejás vacío se usan los horarios que más se usan en tus reservas{horariosSugeridos.length ? <>: <b className="text-rs-text">{horariosSugeridos.join(', ')}</b></> : ''}. La disponibilidad de cada horario sale de tus reglas de aforo y fechas bloqueadas.</p>
      </div>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <div><label className="label" htmlFor="rw_dias">Días hacia adelante</label><input id="rw_dias" name="dias_adelante" type="number" min={1} max={365} defaultValue={config.dias_adelante} className="input w-full" /></div>
        <div><label className="label" htmlFor="rw_horas">Anticipación (horas)</label><input id="rw_horas" name="horas_anticipacion" type="number" min={0} max={72} defaultValue={config.horas_anticipacion} className="input w-full" /></div>
        <div><label className="label" htmlFor="rw_pmin">Personas: mínimo</label><input id="rw_pmin" name="personas_min" type="number" min={1} max={100} defaultValue={config.personas_min} className="input w-full" /></div>
        <div><label className="label" htmlFor="rw_pmax">Personas: máximo</label><input id="rw_pmax" name="personas_max" type="number" min={1} max={200} defaultValue={config.personas_max} className="input w-full" /></div>
      </div>
      <div><label className="label" htmlFor="rw_msg">Mensaje para el cliente</label><textarea id="rw_msg" name="mensaje" rows={2} maxLength={400} defaultValue={config.mensaje ?? ''} placeholder="Ej. Las reservas se confirman por WhatsApp. Tolerancia de 15 minutos." className="input w-full" /></div>
      {state && !state.ok && <p role="alert" className="text-sm text-rs-danger">{state.error}</p>}
      <div className="flex justify-end"><button disabled={pending} className="btn btn-primary">{pending && <Spinner />}{pending ? 'Guardando…' : 'Guardar'}</button></div>
    </form>
  )
}
