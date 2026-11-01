'use client'

import type { ReactNode } from 'react'
import type { SlotWeb } from '@/app/reservar/[slug]/actions'
import type { TurnoPublico } from '@/lib/turnos-web'

/**
 * Los horarios de un día: sueltos, como siempre, o agrupados por turno con su título (Desayuno, Almuerzo, Cena…).
 * Un turno que ya cerró por su corte muestra su mensaje ("Sujeto a disponibilidad, por orden de llegada") en lugar de los horarios.
 * `forzarAbierto`: horarios que se siguen ofreciendo aunque su turno haya cerrado (por ejemplo, el de la reserva que se está modificando).
 */
export function HorariosAgrupados({ slots, turnos, cargando, renderSlot, forzarAbierto }: { slots: SlotWeb[]; turnos?: TurnoPublico[]; cargando?: boolean; renderSlot: (s: SlotWeb) => ReactNode; forzarAbierto?: (s: SlotWeb) => boolean }) {
  const atenuado = cargando ? 'opacity-60' : ''
  const agrupa = (turnos?.length ?? 0) > 0 && slots.some((s) => s.turno)
  if (!agrupa) return <div className={'flex flex-wrap gap-2 ' + atenuado}>{slots.map(renderSlot)}</div>
  const delTurno = (nombre: string) => slots.filter((s) => s.turno === nombre)
  const sueltos = slots.filter((s) => !s.turno || !turnos!.some((t) => t.nombre === s.turno))
  return (
    <div className={'space-y-3 ' + atenuado}>
      {turnos!.map((t) => {
        const hs = delTurno(t.nombre)
        if (hs.length === 0) return null
        const cerrado = t.cerrado && !hs.some((s) => forzarAbierto?.(s))
        return (
          <div key={t.nombre} data-turno={t.nombre}>
            <p className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-rs-muted">{t.nombre}</p>
            {cerrado
              ? <p role="status" className="rounded-md bg-rs-raised/50 px-3 py-2 text-sm text-rs-muted">{t.mensaje}</p>
              : <div className="flex flex-wrap gap-2">{hs.map(renderSlot)}</div>}
          </div>
        )
      })}
      {sueltos.length > 0 && <div className="flex flex-wrap gap-2">{sueltos.map(renderSlot)}</div>}
    </div>
  )
}
