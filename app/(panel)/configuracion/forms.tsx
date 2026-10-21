'use client'

import { useActionState, useEffect, useState, useTransition } from 'react'
import { Pencil, Plus, Trash2 } from 'lucide-react'
import Modal from '@/components/modal'
import { agregarFechaBloqueada, alternarSede, borrarFechaBloqueada, borrarUbicacion, eliminarSede, guardarAforo, guardarFuncionesNegocio, guardarSede, guardarUbicacion, type ActionResult } from '../actions'

function Estado({ state }: { state: ActionResult | null }) {
  if (!state) return null
  return state.ok ? <span className="text-sm text-rs-ok">Guardado</span> : <span role="alert" className="text-sm text-rs-danger">{state.error}</span>
}

export function AforoForm({ aforo, puedeEditar }: { aforo: number | null; puedeEditar: boolean }) {
  const [state, action, pending] = useActionState<ActionResult | null, FormData>(guardarAforo, null)
  return (
    <form action={action} className="mt-3 flex flex-wrap items-center gap-3">
      <input name="aforo" type="number" min={1} defaultValue={aforo ?? ''} placeholder="Sin límite" disabled={!puedeEditar} aria-label="Aforo máximo" className="input w-32" />
      <span className="text-sm text-rs-muted">personas</span>
      {puedeEditar && <button disabled={pending} className="btn btn-primary">{pending ? 'Guardando…' : 'Guardar'}</button>}
      <Estado state={state} />
    </form>
  )
}

export function BloqueoForm({ sedes = [], puedeTodas = true }: { sedes?: { id: string; nombre: string }[]; puedeTodas?: boolean }) {
  const [state, action, pending] = useActionState<ActionResult | null, FormData>(agregarFechaBloqueada, null)
  return (
    <form action={action} className="mt-3 flex flex-wrap items-end gap-3">
      {sedes.length > 0 && (
        <div><label className="label" htmlFor="b_sede">Sede</label>
          <select id="b_sede" name="sucursal_id" className="input" defaultValue={puedeTodas ? '' : sedes[0].id}>
            {puedeTodas && <option value="">Todas las sedes</option>}
            {sedes.map((x) => <option key={x.id} value={x.id}>{x.nombre}</option>)}
          </select></div>
      )}
      <div><label className="label" htmlFor="b_fecha">Fecha</label><input id="b_fecha" name="fecha" type="date" required className="input" /></div>
      <div><label className="label" htmlFor="b_desde">Desde</label><input id="b_desde" name="hora_desde" type="time" className="input" /></div>
      <div><label className="label" htmlFor="b_hasta">Hasta</label><input id="b_hasta" name="hora_hasta" type="time" className="input" /></div>
      <div className="min-w-[160px] flex-1"><label className="label" htmlFor="b_motivo">Motivo</label><input id="b_motivo" name="motivo" placeholder="Opcional" className="input w-full" /></div>
      <button disabled={pending} className="btn btn-primary">Bloquear</button>
      <Estado state={state} />
    </form>
  )
}

export function BorrarBloqueo({ id }: { id: string }) {
  const [pending, start] = useTransition()
  return (
    <button disabled={pending} onClick={() => confirm('¿Desbloquear esta fecha?') && start(async () => { await borrarFechaBloqueada(id) })} aria-label="Desbloquear fecha" className="btn btn-sm btn-danger">
      <Trash2 size={14} />
    </button>
  )
}

export function FuncionesForm({ apagadoBot }: { apagadoBot: boolean }) {
  const [state, action, pending] = useActionState<ActionResult | null, FormData>(guardarFuncionesNegocio, null)
  return (
    <form action={action} className="mt-3 space-y-3">
      <label className="flex cursor-pointer items-start gap-3 text-sm">
        <input type="checkbox" name="apagado_bot" defaultChecked={apagadoBot} className="mt-0.5 h-4 w-4 accent-[#c8e62b]" />
        <span>
          <span className="font-medium">Botón de apagado del bot</span>
          <span className="block text-rs-muted">Muestra el botón para apagar y encender el bot de WhatsApp a dueños, administradores y encargados. Si se deshabilita, el bot queda siempre encendido.</span>
        </span>
      </label>
      <div className="flex items-center gap-3">
        <button disabled={pending} className="btn btn-primary">{pending ? 'Guardando…' : 'Guardar'}</button>
        <Estado state={state} />
      </div>
    </form>
  )
}

// ---------------------------------------------------------------------------
// Sedes y ubicaciones
// ---------------------------------------------------------------------------
export interface SedeEditable { id: string; nombre: string; whatsapp_nro: string | null; aforo_maximo_reservas: number | null; activa: boolean }

function SedeForm({ sede, onDone }: { sede?: SedeEditable; onDone: () => void }) {
  const [state, action, pending] = useActionState<ActionResult | null, FormData>(guardarSede, null)
  useEffect(() => { if (state?.ok) onDone() }, [state, onDone])
  return (
    <form action={action} className="grid grid-cols-2 gap-3">
      {sede && <input type="hidden" name="id" value={sede.id} />}
      <div className="col-span-2"><label className="label" htmlFor="s_nombre">Nombre de la sede *</label><input id="s_nombre" name="nombre" defaultValue={sede?.nombre ?? ''} className="input w-full" required /></div>
      <div><label className="label" htmlFor="s_wa">WhatsApp de la sede</label><input id="s_wa" name="whatsapp_nro" inputMode="tel" placeholder="5493415551234" defaultValue={sede?.whatsapp_nro ?? ''} className="input w-full" /></div>
      <div><label className="label" htmlFor="s_aforo">Aforo máximo por día</label><input id="s_aforo" name="aforo" type="number" min={1} placeholder="Usa el del negocio" defaultValue={sede?.aforo_maximo_reservas ?? ''} className="input w-full" /></div>
      <p className="col-span-2 text-xs text-rs-muted">Varias sedes pueden compartir el mismo WhatsApp: en ese caso el bot pregunta de qué sede es la reserva.</p>
      {state && !state.ok && <p role="alert" className="col-span-2 text-sm text-rs-danger">{state.error}</p>}
      <div className="col-span-2 flex justify-end gap-2">
        <button type="button" onClick={onDone} className="btn">Cancelar</button>
        <button disabled={pending} className="btn btn-primary">{pending ? 'Guardando…' : sede ? 'Guardar' : 'Crear sede'}</button>
      </div>
    </form>
  )
}

export function SedesPanel({ sedes, puedeCrear }: { sedes: SedeEditable[]; puedeCrear: boolean }) {
  const [nueva, setNueva] = useState(false)
  const [edit, setEdit] = useState<SedeEditable | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [pending, start] = useTransition()
  const correr = (fn: () => Promise<ActionResult>) => start(async () => { setError(null); const r = await fn(); if (!r.ok) setError(r.error ?? 'Error') })
  return (
    <div>
      <ul className="divide-y divide-rs-border/60">
        {sedes.map((x) => (
          <li key={x.id} className="flex flex-wrap items-center justify-between gap-3 py-2.5 text-sm">
            <span className={x.activa ? '' : 'opacity-60'}>
              <span className="font-medium">{x.nombre}</span>
              {!x.activa && <span className="ml-2 badge bg-rs-raised text-rs-muted">Desactivada</span>}
              <span className="text-rs-muted"> · WhatsApp {x.whatsapp_nro ?? 'sin cargar'} · aforo {x.aforo_maximo_reservas ?? 'del negocio'}</span>
            </span>
            <span className="flex gap-1.5">
              <button onClick={() => setEdit(x)} className="btn btn-sm"><Pencil size={13} /> Editar</button>
              <button disabled={pending} onClick={() => correr(() => alternarSede(x.id, !x.activa))} className="btn btn-sm">{x.activa ? 'Desactivar' : 'Reactivar'}</button>
              <button disabled={pending} onClick={() => confirm(`¿Eliminar la sede ${x.nombre}? Solo se puede si no tiene reservas.`) && correr(() => eliminarSede(x.id))} aria-label={`Eliminar ${x.nombre}`} className="btn btn-sm btn-danger"><Trash2 size={13} /></button>
            </span>
          </li>
        ))}
      </ul>
      {error && <p role="alert" className="mt-2 text-sm text-rs-danger">{error}</p>}
      {puedeCrear && <button onClick={() => setNueva(true)} className="btn btn-sm mt-3"><Plus size={14} /> Nueva sede</button>}
      <p className="mt-2 text-xs text-rs-muted">Desactivar oculta la sede de selectores y formularios pero conserva sus reservas. Eliminar solo funciona en sedes sin reservas.</p>
      {nueva && <Modal titulo="Nueva sede" onClose={() => setNueva(false)}><SedeForm onDone={() => setNueva(false)} /></Modal>}
      {edit && <Modal titulo={`Editar ${edit.nombre}`} onClose={() => setEdit(null)}><SedeForm sede={edit} onDone={() => setEdit(null)} /></Modal>}
    </div>
  )
}

export function UbicacionesPanel({ ubicaciones, sedes, puedeTodas }: { ubicaciones: { id: string; nombre: string; sucursal_id: string | null }[]; sedes: { id: string; nombre: string }[]; puedeTodas: boolean }) {
  const [state, action, pending] = useActionState<ActionResult | null, FormData>(guardarUbicacion, null)
  const [borrando, start] = useTransition()
  const nombreSede = (id: string | null) => (id ? sedes.find((x) => x.id === id)?.nombre ?? 'otra sede' : null)
  return (
    <div>
      <ul className="flex flex-wrap gap-2">
        {ubicaciones.length === 0 && <li className="text-sm text-rs-muted">Sin ubicaciones: el formulario de reservas no las pide.</li>}
        {ubicaciones.map((u) => (
          <li key={u.id} className="inline-flex items-center gap-2 rounded-full bg-rs-raised px-3 py-1 text-sm">
            {u.nombre}{sedes.length > 0 && <span className="text-xs text-rs-muted">· {nombreSede(u.sucursal_id) ?? 'todas las sedes'}</span>}
            <button disabled={borrando} onClick={() => confirm(`¿Quitar la ubicación ${u.nombre}?`) && start(async () => { await borrarUbicacion(u.id) })} aria-label={`Quitar ${u.nombre}`} className="text-rs-muted hover:text-rs-danger">×</button>
          </li>
        ))}
      </ul>
      <form action={action} className="mt-3 flex flex-wrap items-center gap-2">
        <input name="nombre" placeholder="Ej. TERRAZA" aria-label="Nueva ubicación" className="input" required />
        {sedes.length > 0 && (
          <select name="sucursal_id" aria-label="Sede de la ubicación" className="input" defaultValue={puedeTodas ? '' : sedes[0].id}>
            {puedeTodas && <option value="">Todas las sedes</option>}
            {sedes.map((x) => <option key={x.id} value={x.id}>{x.nombre}</option>)}
          </select>
        )}
        <button disabled={pending} className="btn">Agregar</button>
        <Estado state={state} />
      </form>
    </div>
  )
}
