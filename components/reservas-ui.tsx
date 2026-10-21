'use client'

import { useActionState, useEffect, useState, useTransition } from 'react'
import { Check, Pencil, Plus, Trash2, X, UserX } from 'lucide-react'
import { cambiarEstadoReserva, eliminarReserva, guardarReserva, type ActionResult } from '@/app/(panel)/actions'
import Modal from '@/components/modal'
import { fechaCorta, horaCorta } from '@/lib/fechas'
import { TIPOS_RESERVA, labelEstado, labelTipo, type Reserva } from '@/lib/reservas'

const ESTADO_CLS: Record<string, string> = {
  nueva: 'bg-rs-lav/15 text-rs-lav',
  confirmada: 'bg-rs-ok/15 text-rs-ok',
  cancelada: 'bg-rs-danger/15 text-rs-danger',
  no_show: 'bg-rs-muted/20 text-rs-muted',
}

export function EstadoBadge({ estado }: { estado: string }) {
  return <span className={'badge ' + (ESTADO_CLS[estado] ?? 'bg-rs-raised text-rs-muted')}>{labelEstado(estado)}</span>
}

export interface OpcionesSede {
  sedes: { id: string; nombre: string }[]          // sedes a las que el usuario tiene acceso
  nombresSede: Record<string, string>              // id -> nombre de todas las sedes (para la tabla)
  sedeDefault: string | null                        // sede elegida en el selector del encabezado
  ubicaciones: string[]                             // vacío = el negocio no usa ubicaciones
}

function ReservaForm({ reserva, fechaDefault, onDone, op }: { reserva?: Reserva; fechaDefault?: string; onDone: () => void; op: OpcionesSede }) {
  const [state, action, pending] = useActionState<ActionResult | null, FormData>(guardarReserva, null)
  useEffect(() => {
    if (state?.ok) onDone()
  }, [state, onDone])

  return (
    <form action={action} className="grid grid-cols-2 gap-3">
      {reserva && <input type="hidden" name="id" value={reserva.id} />}
      <div className="col-span-2">
        <label className="label" htmlFor="cliente_nombre">Nombre del titular *</label>
        <input id="cliente_nombre" name="cliente_nombre" defaultValue={reserva?.cliente_nombre ?? ''} className="input w-full" required />
      </div>
      <div className="col-span-2">
        <label className="label" htmlFor="cliente_telefono">Teléfono (WhatsApp)</label>
        <input id="cliente_telefono" name="cliente_telefono" inputMode="tel" placeholder="5493415551234" defaultValue={reserva?.cliente_telefono ?? ''} className="input w-full" />
      </div>
      <div>
        <label className="label" htmlFor="fecha">Fecha</label>
        <input id="fecha" name="fecha" type="date" defaultValue={reserva ? reserva.fecha ?? '' : fechaDefault} className="input w-full" />
      </div>
      <div>
        <label className="label" htmlFor="hora">Hora</label>
        <input id="hora" name="hora" type="time" defaultValue={reserva?.hora?.slice(0, 5) ?? ''} className="input w-full" />
      </div>
      {op.sedes.length > 0 && (
        <div>
          <label className="label" htmlFor="sucursal_id">Sede *</label>
          <select id="sucursal_id" name="sucursal_id" defaultValue={reserva?.sucursal_id ?? op.sedeDefault ?? (op.sedes.length === 1 ? op.sedes[0].id : '')} className="input w-full" required>
            <option value="" disabled>Elegí…</option>
            {op.sedes.map((x) => <option key={x.id} value={x.id}>{x.nombre}</option>)}
          </select>
        </div>
      )}
      {op.ubicaciones.length > 0 && (
        <div>
          <label className="label" htmlFor="ubicacion">Ubicación</label>
          <select id="ubicacion" name="ubicacion" defaultValue={reserva?.ubicacion ?? ''} className="input w-full">
            <option value="">Sin definir</option>
            {op.ubicaciones.map((u) => <option key={u} value={u}>{u}</option>)}
          </select>
        </div>
      )}
      <div>
        <label className="label" htmlFor="cantidad_personas">Personas *</label>
        <input id="cantidad_personas" name="cantidad_personas" type="number" min={1} defaultValue={reserva?.cantidad_personas ?? 2} className="input w-full" required />
      </div>
      <div>
        <label className="label" htmlFor="tipo_reserva">Tipo</label>
        <select id="tipo_reserva" name="tipo_reserva" defaultValue={reserva?.tipo_reserva ?? 'comun'} className="input w-full">
          {TIPOS_RESERVA.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
        </select>
      </div>
      <div>
        <label className="label" htmlFor="cumpleanos_dia">Cumpleaños: día</label>
        <input id="cumpleanos_dia" name="cumpleanos_dia" type="number" min={1} max={31} defaultValue={reserva?.cumpleanos_dia ?? ''} className="input w-full" />
      </div>
      <div>
        <label className="label" htmlFor="cumpleanos_mes">Cumpleaños: mes</label>
        <input id="cumpleanos_mes" name="cumpleanos_mes" type="number" min={1} max={12} defaultValue={reserva?.cumpleanos_mes ?? ''} className="input w-full" />
      </div>
      <div className="col-span-2">
        <label className="label" htmlFor="observaciones">Observaciones</label>
        <textarea id="observaciones" name="observaciones" rows={3} defaultValue={reserva?.observaciones ?? ''} className="input w-full" />
      </div>
      {state && !state.ok && <p role="alert" className="col-span-2 text-sm text-rs-danger">{state.error}</p>}
      <div className="col-span-2 mt-1 flex justify-end gap-2">
        <button type="button" onClick={onDone} className="btn">Cancelar</button>
        <button type="submit" disabled={pending} className="btn btn-primary">{pending ? 'Guardando…' : reserva ? 'Guardar cambios' : 'Crear reserva'}</button>
      </div>
    </form>
  )
}

export function NuevaReservaBtn({ fechaDefault, op }: { fechaDefault?: string; op: OpcionesSede }) {
  const [abierto, setAbierto] = useState(false)
  return (
    <>
      <button onClick={() => setAbierto(true)} className="btn btn-primary"><Plus size={16} /> Nueva Reserva</button>
      {abierto && (
        <Modal titulo="Nueva reserva" onClose={() => setAbierto(false)}>
          <ReservaForm fechaDefault={fechaDefault} onDone={() => setAbierto(false)} op={op} />
        </Modal>
      )}
    </>
  )
}

export function ReservasTabla({ reservas, puedeEscribir, vacio = 'No se encontraron reservas.', op }: { reservas: Reserva[]; puedeEscribir: boolean; vacio?: string; op: OpcionesSede }) {
  const mostrarSede = Object.keys(op.nombresSede).length > 0
  const mostrarUbicacion = op.ubicaciones.length > 0 || reservas.some((r) => r.ubicacion)
  const [editando, setEditando] = useState<Reserva | null>(null)
  const [cancelando, setCancelando] = useState<Reserva | null>(null)
  const [motivo, setMotivo] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [pending, start] = useTransition()

  const correr = (fn: () => Promise<ActionResult>, despues?: () => void) =>
    start(async () => {
      setError(null)
      const r = await fn()
      if (!r.ok) setError(r.error ?? 'Ocurrió un error')
      else despues?.()
    })

  return (
    <>
      {error && <p role="alert" className="mb-3 rounded-rs border border-rs-danger/40 bg-rs-danger/10 px-3 py-2 text-sm text-rs-danger">{error}</p>}
      <div className="card overflow-x-auto">
        <table className="w-full min-w-[980px]">
          <thead className="border-b border-rs-border">
            <tr>
              <th className="th">#</th><th className="th">Nombre</th><th className="th">Tel</th>{mostrarSede && <th className="th">Sede</th>}<th className="th">Fecha</th><th className="th">Hora</th>
              <th className="th">Personas</th><th className="th">Tipo</th>{mostrarUbicacion && <th className="th">Ubicación</th>}<th className="th">Observaciones</th><th className="th">Estado</th>
              {puedeEscribir && <th className="th text-right">Acciones</th>}
            </tr>
          </thead>
          <tbody>
            {reservas.length === 0 && (
              <tr><td colSpan={12} className="td py-10 text-center text-rs-muted">{vacio}</td></tr>
            )}
            {reservas.map((r) => (
              <tr key={r.id} className="border-b border-rs-border/60 last:border-0 hover:bg-rs-raised/40">
                <td className="td font-semibold text-rs-lime">#{r.numero}</td>
                <td className="td font-medium">{r.cliente_nombre ?? '—'}</td>
                <td className="td text-rs-muted">{r.cliente_telefono ?? '—'}</td>
                {mostrarSede && <td className="td text-rs-muted">{r.sucursal_id ? op.nombresSede[r.sucursal_id] ?? '—' : '—'}</td>}
                <td className="td">{fechaCorta(r.fecha)}</td>
                <td className="td">{horaCorta(r.hora)}</td>
                <td className="td">{r.cantidad_personas ?? '—'}</td>
                <td className="td text-rs-muted">{labelTipo(r.tipo_reserva)}</td>
                {mostrarUbicacion && <td className="td text-rs-muted">{r.ubicacion ?? '—'}</td>}
                <td className="td max-w-[150px] truncate text-rs-muted" title={r.observaciones ?? r.motivo_cancelacion ?? ''}>
                  {r.estado === 'cancelada' && r.motivo_cancelacion ? `Motivo: ${r.motivo_cancelacion}` : r.observaciones ?? '—'}
                </td>
                <td className="td"><EstadoBadge estado={r.estado} /></td>
                {puedeEscribir && (
                  <td className="td">
                    <div className="flex justify-end gap-1.5">
                      {r.estado !== 'confirmada' && (
                        <button disabled={pending} onClick={() => correr(() => cambiarEstadoReserva(r.id, 'confirmada'))} title="Confirmar" aria-label="Confirmar" className="btn btn-sm text-rs-ok"><Check size={14} /></button>
                      )}
                      {r.estado !== 'cancelada' && (
                        <button disabled={pending} onClick={() => { setMotivo(''); setCancelando(r) }} title="Cancelar" aria-label="Cancelar" className="btn btn-sm btn-danger"><X size={14} /></button>
                      )}
                      {r.estado === 'confirmada' && (
                        <button disabled={pending} onClick={() => correr(() => cambiarEstadoReserva(r.id, 'no_show'))} title="Marcar no-show" aria-label="Marcar no-show" className="btn btn-sm"><UserX size={14} /></button>
                      )}
                      <button onClick={() => setEditando(r)} title="Editar" aria-label="Editar" className="btn btn-sm"><Pencil size={14} /></button>
                      <button
                        disabled={pending}
                        onClick={() => confirm(`¿Eliminar la reserva #${r.numero}?`) && correr(() => eliminarReserva(r.id))}
                        title="Eliminar" aria-label="Eliminar" className="btn btn-sm btn-danger"
                      ><Trash2 size={14} /></button>
                    </div>
                  </td>
                )}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {editando && (
        <Modal titulo={`Editar reserva #${editando.numero}`} onClose={() => setEditando(null)}>
          <ReservaForm reserva={editando} onDone={() => setEditando(null)} op={op} />
        </Modal>
      )}
      {cancelando && (
        <Modal titulo={`Cancelar reserva #${cancelando.numero}`} onClose={() => setCancelando(null)}>
          <label className="label" htmlFor="motivo">Motivo (opcional)</label>
          <textarea id="motivo" rows={3} value={motivo} onChange={(e) => setMotivo(e.target.value)} className="input w-full" />
          <div className="mt-4 flex justify-end gap-2">
            <button onClick={() => setCancelando(null)} className="btn">Volver</button>
            <button disabled={pending} onClick={() => correr(() => cambiarEstadoReserva(cancelando.id, 'cancelada', motivo), () => setCancelando(null))} className="btn btn-danger">Cancelar reserva</button>
          </div>
        </Modal>
      )}
    </>
  )
}

