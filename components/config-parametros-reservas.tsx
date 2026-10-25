'use client'

import { useEffect, useState } from 'react'
import { Plus, X } from 'lucide-react'
import { guardarParametrosReservas } from '@/app/(panel)/config-reservas-actions'
import { useToast } from '@/components/feedback'
import { Spinner } from '@/components/ui'
import { useAccionFormulario } from '@/components/use-accion-formulario'
import { ESTADOS_BLOQUEO, type ConfigReservas } from '@/lib/reservas-config'

/** Alerta de aforo, turnos del plano y estados que bloquean una mesa en el sitio de reservas. */
export default function ConfigParametrosReservas({ config, usaMesas }: { config: ConfigReservas; usaMesas: boolean }) {
  const { state, pending, formProps } = useAccionFormulario(guardarParametrosReservas)
  const toast = useToast()
  const [turnos, setTurnos] = useState(config.turnos)
  useEffect(() => { if (state?.ok) toast({ texto: 'Parámetros guardados' }) }, [state]) // eslint-disable-line react-hooks/exhaustive-deps
  return (
    <form {...formProps} className="space-y-4">
      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label className="label" htmlFor="pr_alerta">Alertar cuando el aforo llegue al (%)</label>
          <input id="pr_alerta" name="alerta_aforo_pct" type="number" min={50} max={100} defaultValue={config.alerta_aforo_pct} className="input w-full" />
          <p className="mt-1 text-xs text-rs-muted">Cambia el color de las barras de aforo y genera una alerta en el dashboard y al cargar una reserva.</p>
        </div>
      </div>
      {usaMesas && (
        <fieldset>
          <legend className="label">Turnos del plano de mesas</legend>
          <div className="space-y-2">
            {turnos.map((t, i) => (
              <div key={i} className="flex flex-wrap items-center gap-2">
                <input name="turno_nombre" defaultValue={t.nombre} maxLength={20} placeholder="Nombre (ej. Cena)" aria-label={`Nombre del turno ${i + 1}`} className="input w-44" />
                <input name="turno_hora" type="time" defaultValue={t.hora} aria-label={`Hora del turno ${i + 1}`} className="input w-32" />
                <button type="button" onClick={() => setTurnos(turnos.filter((_, k) => k !== i))} aria-label="Quitar turno" className="btn btn-sm btn-danger"><X size={13} /></button>
              </div>
            ))}
            {turnos.length < 6 && <button type="button" onClick={() => setTurnos([...turnos, { nombre: '', hora: '' }])} className="btn btn-sm"><Plus size={13} />Agregar turno</button>}
          </div>
          <p className="mt-1 text-xs text-rs-muted">Son los botones rápidos de Salón y mesas (por ejemplo “Cena” muestra el plano a las 21:00).</p>
        </fieldset>
      )}
      <fieldset>
        <legend className="label">Estados que bloquean una mesa en el sitio de reservas</legend>
        <div className="grid gap-2 sm:grid-cols-2">
          {ESTADOS_BLOQUEO.map((e) => (
            <label key={e.value} className="flex items-start gap-2 rounded-md border border-rs-border/60 px-3 py-2 text-sm has-[:checked]:border-rs-lime/50 has-[:checked]:bg-rs-lime/5">
              <input type="checkbox" name="estados_bloquean" value={e.value} defaultChecked={config.estados_bloquean.includes(e.value)} className="mt-0.5 h-4 w-4 accent-[#c8e62b]" />
              <span><span className="font-medium">{e.label}</span><span className="block text-xs text-rs-muted">{e.ayuda}</span></span>
            </label>
          ))}
        </div>
        <p className="mt-1 text-xs text-rs-muted">Una reserva en esos estados deja la mesa “Reservada” para los demás clientes que usan el sitio. Lo habitual es dejar solo Confirmada, Pendiente de pago y Revisar pago.</p>
      </fieldset>
      {state && !state.ok && <p role="alert" className="text-sm text-rs-danger">{state.error}</p>}
      <div className="flex justify-end"><button disabled={pending} className="btn btn-primary">{pending && <Spinner />}{pending ? 'Guardando…' : 'Guardar'}</button></div>
    </form>
  )
}
