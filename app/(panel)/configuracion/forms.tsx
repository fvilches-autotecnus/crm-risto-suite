'use client'

import {useEffect, useState, useTransition} from 'react'
import { Clock, MapPin, Pencil, Plus, Trash2 } from 'lucide-react'
import { useConfirm, useResultado, useToast } from '@/components/feedback'
import Modal from '@/components/modal'
import { useAccionFormulario } from '@/components/use-accion-formulario'
import { Spinner } from '@/components/ui'
import { agregarFechaBloqueada, alternarSede, borrarFechaBloqueada, borrarRegla, borrarUbicacion, eliminarSede, guardarAforo, guardarFuncionesNegocio, guardarRegla, guardarSede, guardarUbicacion, type ActionResult } from '../actions'
import { guardarModulos } from '../modulos-actions'

function Guardar({ pending, children = 'Guardar' }: { pending: boolean; children?: React.ReactNode }) {
  return <button disabled={pending} className="btn btn-primary">{pending && <Spinner />}{pending ? 'Guardando…' : children}</button>
}

// ---------------------------------------------------------------------------
// Aforo total por día
// ---------------------------------------------------------------------------
export function AforoForm({ aforo, puedeEditar }: { aforo: number | null; puedeEditar: boolean }) {
  const { state, pending, formProps } = useAccionFormulario(guardarAforo)
  useResultado(state, 'Aforo guardado')
  return (
    <form {...formProps} className="mt-3 flex flex-wrap items-center gap-3">
      <input name="aforo" type="number" min={1} defaultValue={aforo ?? ''} placeholder="Sin límite" disabled={!puedeEditar} aria-label="Aforo máximo" className="input w-32" />
      <span className="text-sm text-rs-muted">personas por día</span>
      {puedeEditar && <Guardar pending={pending} />}
    </form>
  )
}

// ---------------------------------------------------------------------------
// Reglas de aforo por franja horaria y ubicación
// ---------------------------------------------------------------------------
export interface ReglaEditable { id: string; sucursal_id: string | null; ubicacion: string | null; hora_desde: string | null; hora_hasta: string | null; maximo: number }

function ReglaForm({ regla, sedes, ubicaciones, puedeTodas, onDone }: { regla?: ReglaEditable; sedes: { id: string; nombre: string }[]; ubicaciones: string[]; puedeTodas: boolean; onDone: () => void }) {
  const { state, pending, formProps } = useAccionFormulario(guardarRegla)
  const toast = useToast()
  useEffect(() => { if (state?.ok) { toast({ texto: regla ? 'Regla actualizada' : 'Regla creada' }); onDone() } }, [state]) // eslint-disable-line react-hooks/exhaustive-deps
  return (
    <form {...formProps} className="grid grid-cols-2 gap-3">
      {regla && <input type="hidden" name="id" value={regla.id} />}
      {sedes.length > 0 && (
        <div className="col-span-2 sm:col-span-1">
          <label className="label" htmlFor="r_sede">Sede</label>
          <select id="r_sede" name="sucursal_id" defaultValue={regla?.sucursal_id ?? (puedeTodas ? '' : sedes[0].id)} className="input w-full">
            {puedeTodas && <option value="">Todas las sedes</option>}
            {sedes.map((x) => <option key={x.id} value={x.id}>{x.nombre}</option>)}
          </select>
        </div>
      )}
      {ubicaciones.length > 0 && (
        <div className="col-span-2 sm:col-span-1">
          <label className="label" htmlFor="r_ub">Ubicación</label>
          <select id="r_ub" name="ubicacion" defaultValue={regla?.ubicacion ?? ''} className="input w-full">
            <option value="">Todas las ubicaciones</option>
            {ubicaciones.map((u) => <option key={u} value={u}>{u}</option>)}
          </select>
        </div>
      )}
      <div><label className="label" htmlFor="r_desde">Franja desde</label><input id="r_desde" name="hora_desde" type="time" defaultValue={regla?.hora_desde?.slice(0, 5) ?? ''} className="input w-full" /></div>
      <div><label className="label" htmlFor="r_hasta">Franja hasta</label><input id="r_hasta" name="hora_hasta" type="time" defaultValue={regla?.hora_hasta?.slice(0, 5) ?? ''} className="input w-full" /></div>
      <p className="col-span-2 -mt-1 text-xs text-rs-muted">Dejá la franja vacía para que valga todo el día. La reserva entra en la franja si su hora es desde ≤ hora &lt; hasta.</p>
      <div className="col-span-2">
        <label className="label" htmlFor="r_max">Máximo de personas *</label>
        <input id="r_max" name="maximo" type="number" min={1} defaultValue={regla?.maximo ?? ''} className="input w-full" required />
      </div>
      {state && !state.ok && <p role="alert" className="col-span-2 animate-fade-in text-sm text-rs-danger">{state.error}</p>}
      <div className="col-span-2 flex justify-end gap-2">
        <button type="button" onClick={onDone} className="btn">Cancelar</button>
        <Guardar pending={pending}>{regla ? 'Guardar cambios' : 'Crear regla'}</Guardar>
      </div>
    </form>
  )
}

export function ReglasPanel({ reglas, sedes, nombresSede, ubicaciones, puedeTodas }: { reglas: ReglaEditable[]; sedes: { id: string; nombre: string }[]; nombresSede: Record<string, string>; ubicaciones: string[]; puedeTodas: boolean }) {
  const [nueva, setNueva] = useState(false)
  const [edit, setEdit] = useState<ReglaEditable | null>(null)
  const [pending, start] = useTransition()
  const confirmar = useConfirm()
  const toast = useToast()
  const texto = (r: ReglaEditable) => [r.sucursal_id ? nombresSede[r.sucursal_id] ?? 'otra sede' : sedes.length > 0 ? 'Todas las sedes' : null, r.ubicacion ?? (ubicaciones.length > 0 ? 'todas las ubicaciones' : null), r.hora_desde && r.hora_hasta ? `${r.hora_desde.slice(0, 5)}–${r.hora_hasta.slice(0, 5)}` : 'todo el día'].filter(Boolean).join(' · ')
  const borrar = async (r: ReglaEditable) => {
    if (!(await confirmar({ titulo: '¿Borrar esta regla de aforo?', texto: texto(r), confirmar: 'Borrar', peligro: true }))) return
    start(async () => { const x = await borrarRegla(r.id); toast(x.ok ? { texto: 'Regla borrada' } : { tipo: 'error', texto: x.error ?? 'No se pudo borrar' }) })
  }
  return (
    <div>
      <ul className="divide-y divide-rs-border/60">
        {reglas.length === 0 && <li className="py-3 text-sm text-rs-muted">Todavía no hay reglas por franja o ubicación. Sin reglas, solo rige el total por día.</li>}
        {reglas.map((r, i) => (
          <li key={r.id} className="reveal flex flex-wrap items-center justify-between gap-3 py-2.5 text-sm" style={{ ['--i' as string]: i }}>
            <span className="flex items-center gap-2">
              <Clock size={14} className="text-rs-lime" />
              <span className="font-medium">{texto(r)}</span>
              <span className="badge bg-rs-raised text-rs-lime">máx. {r.maximo}</span>
            </span>
            <span className="flex gap-1.5">
              <button onClick={() => setEdit(r)} className="btn btn-sm"><Pencil size={13} /> Editar</button>
              <button disabled={pending} onClick={() => borrar(r)} aria-label="Borrar regla" className="btn btn-sm btn-danger"><Trash2 size={13} /></button>
            </span>
          </li>
        ))}
      </ul>
      <button onClick={() => setNueva(true)} className="btn btn-sm mt-3"><Plus size={14} /> Nueva regla de aforo</button>
      {nueva && <Modal titulo="Nueva regla de aforo" onClose={() => setNueva(false)}><ReglaForm sedes={sedes} ubicaciones={ubicaciones} puedeTodas={puedeTodas} onDone={() => setNueva(false)} /></Modal>}
      {edit && <Modal titulo="Editar regla de aforo" onClose={() => setEdit(null)}><ReglaForm regla={edit} sedes={sedes} ubicaciones={ubicaciones} puedeTodas={puedeTodas} onDone={() => setEdit(null)} /></Modal>}
    </div>
  )
}

// ---------------------------------------------------------------------------
// Fechas bloqueadas
// ---------------------------------------------------------------------------
export function BloqueoForm({ sedes = [], puedeTodas = true }: { sedes?: { id: string; nombre: string }[]; puedeTodas?: boolean }) {
  const { state, pending, formProps } = useAccionFormulario(agregarFechaBloqueada, { reiniciar: true })
  useResultado(state, 'Fecha bloqueada')
  return (
    <form {...formProps} className="mt-3 flex flex-wrap items-end gap-3">
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
      <Guardar pending={pending}>Bloquear</Guardar>
    </form>
  )
}

export function BorrarBloqueo({ id }: { id: string }) {
  const [pending, start] = useTransition()
  const confirmar = useConfirm()
  const toast = useToast()
  return (
    <button
      disabled={pending}
      onClick={async () => {
        if (!(await confirmar({ titulo: '¿Desbloquear esta fecha?', texto: 'Vuelve a aceptar reservas ese día.', confirmar: 'Desbloquear', peligro: true }))) return
        start(async () => { const r = await borrarFechaBloqueada(id); toast(r.ok ? { texto: 'Fecha desbloqueada' } : { tipo: 'error', texto: r.error ?? 'No se pudo desbloquear' }) })
      }}
      aria-label="Desbloquear fecha" className="btn btn-sm btn-danger"
    >
      <Trash2 size={14} />
    </button>
  )
}

// ---------------------------------------------------------------------------
// Funciones del negocio (superadmin)
// ---------------------------------------------------------------------------
export function ModulosForm({ modulos }: { modulos: { metricas: boolean; cumpleanos: boolean; vouchers: boolean } }) {
  const { state, pending, formProps } = useAccionFormulario(guardarModulos)
  useResultado(state, 'Módulos guardados')
  const fila = (name: string, titulo: string, texto: string, on: boolean) => (
    <label className="flex cursor-pointer items-start gap-3 text-sm">
      <input type="checkbox" name={name} defaultChecked={on} className="mt-0.5 h-4 w-4 accent-[#c8e62b]" />
      <span><span className="font-medium">{titulo}</span><span className="block text-rs-muted">{texto}</span></span>
    </label>
  )
  return (
    <form {...formProps} className="mt-4 space-y-3 border-t border-rs-border pt-4">
      <h3 className="text-sm font-semibold">Pestañas habilitadas</h3>
      {fila('cumpleanos', 'Cumpleaños', 'Lista de próximos cumpleaños de clientes y regalo pendiente.', modulos.cumpleanos)}
      {fila('vouchers', 'Vouchers', 'Códigos de beneficio y su estado de uso.', modulos.vouchers)}
      {fila('metricas', 'Métricas', 'Gráficos de reservas, horarios y clientes recurrentes.', modulos.metricas)}
      <Guardar pending={pending} />
    </form>
  )
}

export function FuncionesForm({ apagadoBot }: { apagadoBot: boolean }) {
  const { state, pending, formProps } = useAccionFormulario(guardarFuncionesNegocio)
  useResultado(state, 'Funciones guardadas')
  return (
    <form {...formProps} className="mt-3 space-y-3">
      <label className="flex cursor-pointer items-start gap-3 text-sm">
        <input type="checkbox" name="apagado_bot" defaultChecked={apagadoBot} className="mt-0.5 h-4 w-4 accent-[#c8e62b]" />
        <span>
          <span className="font-medium">Botón de apagado del bot</span>
          <span className="block text-rs-muted">Muestra el botón para apagar y encender el bot de WhatsApp a dueños, administradores y encargados. Si se deshabilita, el bot queda siempre encendido.</span>
        </span>
      </label>
      <Guardar pending={pending} />
    </form>
  )
}

// ---------------------------------------------------------------------------
// Sedes y ubicaciones
// ---------------------------------------------------------------------------
export interface SedeEditable { id: string; nombre: string; whatsapp_nro: string | null; aforo_maximo_reservas: number | null; activa: boolean; direccion: string | null; telefono: string | null; maps_url: string | null }

function SedeForm({ sede, onDone }: { sede?: SedeEditable; onDone: () => void }) {
  const { state, pending, formProps } = useAccionFormulario(guardarSede)
  const toast = useToast()
  useEffect(() => { if (state?.ok) { toast({ texto: sede ? 'Sede guardada' : 'Sede creada' }); onDone() } }, [state]) // eslint-disable-line react-hooks/exhaustive-deps
  return (
    <form {...formProps} className="grid grid-cols-2 gap-3">
      {sede && <input type="hidden" name="id" value={sede.id} />}
      <div className="col-span-2"><label className="label" htmlFor="s_nombre">Nombre de la sede *</label><input id="s_nombre" name="nombre" defaultValue={sede?.nombre ?? ''} className="input w-full" required /></div>
      <div><label className="label" htmlFor="s_wa">WhatsApp de la sede</label><input id="s_wa" name="whatsapp_nro" inputMode="tel" placeholder="5493415551234" defaultValue={sede?.whatsapp_nro ?? ''} className="input w-full" /></div>
      <div><label className="label" htmlFor="s_aforo">Aforo total por día</label><input id="s_aforo" name="aforo" type="number" min={1} placeholder="Usa el del negocio" defaultValue={sede?.aforo_maximo_reservas ?? ''} className="input w-full" /></div>
      <p className="col-span-2 -mt-1 text-xs text-rs-muted">Varias sedes pueden compartir el mismo WhatsApp: en ese caso el bot pregunta de qué sede es la reserva.</p>
      <div className="col-span-2"><label className="label" htmlFor="s_dir">Dirección</label><input id="s_dir" name="direccion" placeholder="Calle y número, localidad" defaultValue={sede?.direccion ?? ''} className="input w-full" /></div>
      <div><label className="label" htmlFor="s_tel">Teléfono de contacto</label><input id="s_tel" name="telefono" inputMode="tel" defaultValue={sede?.telefono ?? ''} className="input w-full" /></div>
      <div><label className="label" htmlFor="s_maps">Link de Google Maps</label><input id="s_maps" name="maps_url" type="url" placeholder="https://maps.app.goo.gl/…" defaultValue={sede?.maps_url ?? ''} className="input w-full" /></div>
      <p className="col-span-2 -mt-1 text-xs text-rs-muted">La dirección, el teléfono y el link quedan guardados; por ahora el bot no los usa.</p>
      {state && !state.ok && <p role="alert" className="col-span-2 animate-fade-in text-sm text-rs-danger">{state.error}</p>}
      <div className="col-span-2 flex justify-end gap-2">
        <button type="button" onClick={onDone} className="btn">Cancelar</button>
        <Guardar pending={pending}>{sede ? 'Guardar' : 'Crear sede'}</Guardar>
      </div>
    </form>
  )
}

export function SedesPanel({ sedes, puedeCrear }: { sedes: SedeEditable[]; puedeCrear: boolean }) {
  const [nueva, setNueva] = useState(false)
  const [edit, setEdit] = useState<SedeEditable | null>(null)
  const [pending, start] = useTransition()
  const confirmar = useConfirm()
  const toast = useToast()
  const correr = (fn: () => Promise<ActionResult>, ok: string) => start(async () => { const r = await fn(); toast(r.ok ? { texto: ok } : { tipo: 'error', texto: r.error ?? 'Ocurrió un error' }) })
  return (
    <div>
      <ul className="divide-y divide-rs-border/60">
        {sedes.map((x, i) => (
          <li key={x.id} className="reveal flex flex-wrap items-center justify-between gap-3 py-3 text-sm" style={{ ['--i' as string]: i }}>
            <span className={'flex items-start gap-3 ' + (x.activa ? '' : 'opacity-60')}>
              <span className="mt-0.5 rounded-full bg-rs-raised p-1.5 text-rs-lime"><MapPin size={14} /></span>
              <span>
                <span className="font-medium">{x.nombre}</span>
                {!x.activa && <span className="ml-2 badge bg-rs-raised text-rs-muted">Desactivada</span>}
                <span className="block text-xs text-rs-muted">WhatsApp {x.whatsapp_nro ?? 'sin cargar'} · aforo {x.aforo_maximo_reservas ?? 'del negocio'}{x.direccion ? ` · ${x.direccion}` : ''}</span>
              </span>
            </span>
            <span className="flex gap-1.5">
              <button onClick={() => setEdit(x)} className="btn btn-sm"><Pencil size={13} /> Editar</button>
              <button disabled={pending} onClick={() => correr(() => alternarSede(x.id, !x.activa), x.activa ? 'Sede desactivada' : 'Sede reactivada')} className="btn btn-sm">{x.activa ? 'Desactivar' : 'Reactivar'}</button>
              <button
                disabled={pending}
                onClick={async () => { if (await confirmar({ titulo: `¿Eliminar la sede ${x.nombre}?`, texto: 'Solo se puede si no tiene reservas. Si las tiene, desactivala.', confirmar: 'Eliminar', peligro: true })) correr(() => eliminarSede(x.id), 'Sede eliminada') }}
                aria-label={`Eliminar ${x.nombre}`} className="btn btn-sm btn-danger"
              ><Trash2 size={13} /></button>
            </span>
          </li>
        ))}
      </ul>
      {puedeCrear && <button onClick={() => setNueva(true)} className="btn btn-sm mt-3"><Plus size={14} /> Nueva sede</button>}
      <p className="mt-2 text-xs text-rs-muted">Desactivar oculta la sede de selectores y formularios pero conserva sus reservas. Eliminar solo funciona en sedes sin reservas.</p>
      {nueva && <Modal titulo="Nueva sede" onClose={() => setNueva(false)}><SedeForm onDone={() => setNueva(false)} /></Modal>}
      {edit && <Modal titulo={`Editar ${edit.nombre}`} onClose={() => setEdit(null)}><SedeForm sede={edit} onDone={() => setEdit(null)} /></Modal>}
    </div>
  )
}

export function UbicacionesPanel({ ubicaciones, sedes, puedeTodas }: { ubicaciones: { id: string; nombre: string; sucursal_id: string | null }[]; sedes: { id: string; nombre: string }[]; puedeTodas: boolean }) {
  const { state, pending, formProps } = useAccionFormulario(guardarUbicacion, { reiniciar: true })
  useResultado(state, 'Ubicación agregada')
  const [borrando, start] = useTransition()
  const confirmar = useConfirm()
  const toast = useToast()
  const nombreSede = (id: string | null) => (id ? sedes.find((x) => x.id === id)?.nombre ?? 'otra sede' : null)
  return (
    <div>
      <ul className="flex flex-wrap gap-2">
        {ubicaciones.length === 0 && <li className="text-sm text-rs-muted">Sin ubicaciones: el formulario de reservas no las pide.</li>}
        {ubicaciones.map((u, i) => (
          <li key={u.id} className="reveal inline-flex items-center gap-2 rounded-full bg-rs-raised px-3 py-1 text-sm" style={{ ['--i' as string]: i }}>
            {u.nombre}{sedes.length > 0 && <span className="text-xs text-rs-muted">· {nombreSede(u.sucursal_id) ?? 'todas las sedes'}</span>}
            <button
              disabled={borrando}
              onClick={async () => { if (await confirmar({ titulo: `¿Quitar la ubicación ${u.nombre}?`, confirmar: 'Quitar', peligro: true })) start(async () => { const r = await borrarUbicacion(u.id); toast(r.ok ? { texto: 'Ubicación quitada' } : { tipo: 'error', texto: r.error ?? 'Error' }) }) }}
              aria-label={`Quitar ${u.nombre}`} className="text-rs-muted transition hover:text-rs-danger"
            >×</button>
          </li>
        ))}
      </ul>
      <form {...formProps} className="mt-3 flex flex-wrap items-center gap-2">
        <input name="nombre" placeholder="Ej. TERRAZA" aria-label="Nueva ubicación" className="input" required />
        {sedes.length > 0 && (
          <select name="sucursal_id" aria-label="Sede de la ubicación" className="input" defaultValue={puedeTodas ? '' : sedes[0].id}>
            {puedeTodas && <option value="">Todas las sedes</option>}
            {sedes.map((x) => <option key={x.id} value={x.id}>{x.nombre}</option>)}
          </select>
        )}
        <button disabled={pending} className="btn">{pending && <Spinner />}Agregar</button>
      </form>
    </div>
  )
}
