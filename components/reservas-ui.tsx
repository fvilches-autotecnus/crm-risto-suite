'use client'

import { useEffect, useState, useTransition } from 'react'
import { CalendarPlus, Check, MapPin, Pencil, Phone, Plus, Trash2, Users, UserX, X } from 'lucide-react'
import { cambiarEstadoReserva, consultarAforo, eliminarReserva, guardarReserva, restaurarReserva, type ActionResult } from '@/app/(panel)/actions'
import { useToast } from '@/components/feedback'
import { FechaInput, HoraInput, TelefonoInput } from '@/components/inputs'
import MenuEstado, { PUNTO_ESTADO } from '@/components/menu-estado'
import Modal from '@/components/modal'
import { useAccionFormulario } from '@/components/use-accion-formulario'
import { EstadoVacio, Spinner } from '@/components/ui'
import { fechaCorta, fechaHoraLarga, horaCorta } from '@/lib/fechas'
import { TIPOS_RESERVA, labelEstado, labelTipo, type EstadoReserva, type Reserva } from '@/lib/reservas'
import type { ChequeoAforo } from '@/lib/aforo'

const ESTADO_CLS: Record<string, string> = {
  nueva: 'bg-rs-lav/15 text-rs-lav',
  confirmada: 'bg-rs-ok/15 text-rs-ok',
  pendiente_pago: 'bg-rs-warn/15 text-rs-warn',
  revisar_pago: 'bg-[#ffb86b]/15 text-[#ffb86b]',
  cancelada: 'bg-rs-danger/15 text-rs-danger',
  no_show: 'bg-rs-muted/20 text-rs-muted',
}

export function EstadoBadge({ estado }: { estado: string }) {
  return (
    <span className={'badge transition-colors ' + (ESTADO_CLS[estado] ?? 'bg-rs-raised text-rs-muted')}>
      <span className={'h-1.5 w-1.5 rounded-full ' + (PUNTO_ESTADO[estado] ?? 'bg-rs-muted')} />
      {labelEstado(estado)}
    </span>
  )
}

export interface OpcionesSede {
  sedes: { id: string; nombre: string }[]          // sedes a las que el usuario tiene acceso
  nombresSede: Record<string, string>              // id -> nombre de todas las sedes (para la tabla)
  sedeDefault: string | null                        // sede elegida en el selector del encabezado
  tipos: string[]                                   // tipos de reserva que ya existen en los datos
  ubicaciones: { nombre: string; sucursal_id: string | null }[]   // sucursal_id null = vale para todas las sedes; lista vacía = el negocio no usa ubicaciones
}

// ---------------------------------------------------------------------------
// Aviso en vivo de aforo dentro del formulario
// ---------------------------------------------------------------------------
function HintAforo({ detalle }: { detalle: ChequeoAforo[] }) {
  if (!detalle.length) return null
  return (
    <ul className="col-span-2 flex animate-fade-in flex-wrap gap-2" aria-label="Aforo">
      {detalle.map((c, i) => {
        const pct = c.maximo ? c.despues / c.maximo : 0
        const cls = c.excede ? 'border-rs-danger/50 bg-rs-danger/10 text-rs-danger' : pct >= 0.9 ? 'border-rs-warn/50 bg-rs-warn/10 text-rs-warn' : 'border-rs-ok/40 bg-rs-ok/10 text-rs-ok'
        return (
          <li key={i} className={'rounded-full border px-3 py-1 text-xs transition-colors ' + cls}>
            <span className="font-semibold">{c.etiqueta}</span> · {c.usado}/{c.maximo} → con esta reserva {c.despues}{c.excede ? ' (supera el aforo)' : ''}
          </li>
        )
      })}
    </ul>
  )
}

function ReservaForm({ reserva, fechaDefault, onDone, op }: { reserva?: Reserva; fechaDefault?: string; onDone: () => void; op: OpcionesSede }) {
  const toast = useToast()
  const { state, pending, formProps } = useAccionFormulario(guardarReserva)
  const formRef = formProps.ref

  const [sedeElegida, setSedeElegida] = useState<string>(reserva?.sucursal_id ?? op.sedeDefault ?? (op.sedes.length === 1 ? op.sedes[0].id : ''))
  const [fecha, setFecha] = useState(reserva ? reserva.fecha ?? '' : fechaDefault ?? '')
  const [hora, setHora] = useState(reserva?.hora?.slice(0, 5) ?? '')
  const [personas, setPersonas] = useState(String(reserva?.cantidad_personas ?? 2))
  const [ubic, setUbic] = useState(reserva?.ubicacion ?? '')
  const [detalle, setDetalle] = useState<ChequeoAforo[]>([])

  // las ubicaciones de la sede elegida + las que valen para todas las sedes
  // tipos: los de siempre + los que ya existen en los datos (y el de la reserva que se edita)
  const tiposForm = [...new Set([...TIPOS_RESERVA.map((t) => t.value as string), ...op.tipos, ...(reserva?.tipo_reserva ? [reserva.tipo_reserva] : [])])]
  const ubicacionesSede = [...new Set(op.ubicaciones.filter((u) => !u.sucursal_id || u.sucursal_id === sedeElegida).map((u) => u.nombre))]
  useEffect(() => { if (ubic && !ubicacionesSede.includes(ubic)) setUbic('') }, [sedeElegida]) // eslint-disable-line react-hooks/exhaustive-deps

  // cada cambio de datos relevantes: se consulta el aforo (con pausa para no consultar en cada tecla) y se anula "guardar igual"
  useEffect(() => {
    const n = Number(personas)
    if (!fecha || !(n > 0)) { setDetalle([]); return }
    let vigente = true
    const t = setTimeout(async () => {
      const r = await consultarAforo({ sucursal_id: sedeElegida || null, ubicacion: ubic || null, fecha, hora: hora || null, personas: n, excluirId: reserva?.id })
      if (vigente) setDetalle(r.detalle ?? [])
    }, 350)
    return () => { vigente = false; clearTimeout(t) }
  }, [sedeElegida, ubic, fecha, hora, personas, reserva?.id])

  useEffect(() => {
    if (state?.ok) { toast({ texto: reserva ? `Reserva #${reserva.numero} actualizada` : 'Reserva creada' }); onDone() }
  }, [state]) // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <form {...formProps} className="grid grid-cols-2 gap-3">
      {reserva && <input type="hidden" name="id" value={reserva.id} />}
      <input type="hidden" name="forzar" defaultValue="" />
      <div className="col-span-2">
        <label className="label" htmlFor="cliente_nombre">Nombre del titular *</label>
        <input id="cliente_nombre" name="cliente_nombre" defaultValue={reserva?.cliente_nombre ?? ''} className="input w-full" required />
      </div>
      <div className="col-span-2">
        <TelefonoInput name="cliente_telefono" label="Teléfono (WhatsApp)" defaultValue={reserva?.cliente_telefono ?? ''} />
      </div>
      <div>
        <label className="label" htmlFor="fecha">Fecha</label>
        <FechaInput id="fecha" name="fecha" value={fecha} onChange={setFecha} />
      </div>
      <div>
        <label className="label" htmlFor="hora">Hora</label>
        <HoraInput id="hora" name="hora" value={hora} onChange={setHora} />
      </div>
      {op.sedes.length > 0 && (
        <div>
          <label className="label" htmlFor="sucursal_id">Sede *</label>
          <select id="sucursal_id" name="sucursal_id" value={sedeElegida} onChange={(e) => setSedeElegida(e.target.value)} className="input w-full" required>
            <option value="" disabled>Elegí…</option>
            {op.sedes.map((x) => <option key={x.id} value={x.id}>{x.nombre}</option>)}
          </select>
        </div>
      )}
      {ubicacionesSede.length > 0 && (
        <div>
          <label className="label" htmlFor="ubicacion">Ubicación</label>
          <select id="ubicacion" name="ubicacion" value={ubic} onChange={(e) => setUbic(e.target.value)} className="input w-full">
            <option value="">Sin definir</option>
            {ubicacionesSede.map((u) => <option key={u} value={u}>{u}</option>)}
          </select>
        </div>
      )}
      <div>
        <label className="label" htmlFor="cantidad_personas">Personas *</label>
        <input id="cantidad_personas" name="cantidad_personas" type="number" min={1} value={personas} onChange={(e) => setPersonas(e.target.value)} className="input w-full" required />
      </div>
      <div>
        <label className="label" htmlFor="tipo_reserva">Tipo</label>
        <select id="tipo_reserva" name="tipo_reserva" defaultValue={reserva?.tipo_reserva ?? 'comun'} className="input w-full">
          {tiposForm.map((t) => <option key={t} value={t}>{labelTipo(t)}</option>)}
        </select>
      </div>
      <HintAforo detalle={detalle} />
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
      {state && !state.ok && (
        <div role="alert" className="col-span-2 animate-fade-in rounded-rs border border-rs-danger/40 bg-rs-danger/10 px-3 py-2 text-sm text-rs-danger">
          <p>{state.error}</p>
          {state.aforo && (
            <button type="button" disabled={pending} onClick={() => { const f = formRef.current; if (!f) return; (f.elements.namedItem('forzar') as HTMLInputElement).value = '1'; f.requestSubmit() }} className="btn btn-sm btn-danger mt-2">
              Guardar igual de todos modos
            </button>
          )}
        </div>
      )}
      <div className="col-span-2 mt-1 flex justify-end gap-2">
        <button type="button" onClick={onDone} className="btn">Cancelar</button>
        <button type="submit" disabled={pending} className="btn btn-primary">{pending && <Spinner />}{pending ? 'Guardando…' : reserva ? 'Guardar cambios' : 'Crear reserva'}</button>
      </div>
    </form>
  )
}

export function NuevaReservaBtn({ fechaDefault, op }: { fechaDefault?: string; op: OpcionesSede }) {
  const [abierto, setAbierto] = useState(false)

  // atajo de teclado: "N" abre una reserva nueva (si no se está escribiendo en un campo)
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement | null
      if (e.key.toLowerCase() !== 'n' || e.ctrlKey || e.metaKey || e.altKey) return
      if (t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.tagName === 'SELECT' || t.isContentEditable)) return
      e.preventDefault(); setAbierto(true)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  return (
    <>
      <button onClick={() => setAbierto(true)} className="btn btn-primary" title="Atajo: N"><Plus size={16} /> Nueva Reserva<kbd className="ml-1 hidden rounded bg-black/15 px-1.5 text-[10px] font-semibold sm:inline">N</kbd></button>
      {abierto && (
        <Modal titulo="Nueva reserva" onClose={() => setAbierto(false)}>
          <ReservaForm fechaDefault={fechaDefault} onDone={() => setAbierto(false)} op={op} />
        </Modal>
      )}
    </>
  )
}

export function ReservasTabla({ reservas, puedeEscribir, vacio = 'No se encontraron reservas.', op }: { reservas: Reserva[]; puedeEscribir: boolean; vacio?: string; op: OpcionesSede }) {
  const toast = useToast()
  const [editando, setEditando] = useState<Reserva | null>(null)
  const [cancelando, setCancelando] = useState<Reserva | null>(null)
  const [motivo, setMotivo] = useState('')
  const [pending, start] = useTransition()
  const [ocupada, setOcupada] = useState<string | null>(null)
  const mostrarSede = Object.keys(op.nombresSede).length > 0
  const mostrarUbicacion = op.ubicaciones.length > 0 || reservas.some((r) => r.ubicacion)

  const correr = (id: string, fn: () => Promise<ActionResult>, ok?: () => void) =>
    start(async () => {
      setOcupada(id)
      const r = await fn()
      setOcupada(null)
      r.ok ? ok?.() : toast({ tipo: 'error', texto: r.error ?? 'Ocurrió un error' })
    })

  const cambiarEstado = (r: Reserva, estado: EstadoReserva, motivoCancel?: string) =>
    correr(r.id, () => cambiarEstadoReserva(r.id, estado, motivoCancel), () =>
      toast({
        texto: `Reserva #${r.numero}: ${labelEstado(estado).toLowerCase()}`,
        accion: { label: 'Deshacer', onClick: () => { void cambiarEstadoReserva(r.id, r.estado) } },
      }))

  const eliminar = (r: Reserva) =>
    correr(r.id, () => eliminarReserva(r.id), () =>
      toast({ texto: `Reserva #${r.numero} eliminada`, accion: { label: 'Deshacer', onClick: () => { void restaurarReserva(r.id) } } }))

  const acciones = (r: Reserva) => (
    <div className="flex justify-end gap-1.5">
      {r.estado !== 'confirmada' && <button disabled={pending} onClick={() => cambiarEstado(r, 'confirmada')} title="Confirmar" aria-label="Confirmar" className="btn btn-sm text-rs-ok hover:bg-rs-ok/10"><Check size={14} /></button>}
      {r.estado !== 'cancelada' && <button disabled={pending} onClick={() => { setMotivo(''); setCancelando(r) }} title="Cancelar" aria-label="Cancelar" className="btn btn-sm btn-danger"><X size={14} /></button>}
      <MenuEstado actual={r.estado} deshabilitado={pending} onElegir={(e) => (e === 'cancelada' ? (setMotivo(''), setCancelando(r)) : cambiarEstado(r, e))} />
      <button onClick={() => setEditando(r)} title="Editar" aria-label="Editar" className="btn btn-sm"><Pencil size={14} /></button>
      <button disabled={pending} onClick={() => eliminar(r)} title="Eliminar" aria-label="Eliminar" className="btn btn-sm btn-danger"><Trash2 size={14} /></button>
    </div>
  )

  const nota = (r: Reserva) => (r.estado === 'cancelada' && r.motivo_cancelacion ? `Motivo: ${r.motivo_cancelacion}` : r.observaciones)

  if (reservas.length === 0) {
    return (
      <div className="card">
        <EstadoVacio icono={<CalendarPlus size={26} />} titulo={vacio} texto="Cuando se cargue una reserva (a mano o por el bot) aparece acá.">
          {puedeEscribir && <p className="text-xs text-rs-muted">Tip: apretá <kbd className="rounded bg-rs-raised px-1.5 py-0.5 font-semibold text-rs-text">N</kbd> para crear una.</p>}
        </EstadoVacio>
      </div>
    )
  }

  return (
    <>
      {/* Escritorio: tabla */}
      <div className="card hidden overflow-x-auto md:block">
        <table className="w-full min-w-[980px]">
          <thead className="sticky top-0 border-b border-rs-border bg-rs-card">
            <tr>
              <th className="th">#</th><th className="th">Nombre</th><th className="th">Tel</th>{mostrarSede && <th className="th">Sede</th>}<th className="th">Fecha</th><th className="th">Hora</th>
              <th className="th">Personas</th><th className="th">Tipo</th>{mostrarUbicacion && <th className="th">Ubicación</th>}<th className="th">Observaciones</th><th className="th">Estado</th><th className="th">Alta</th>
              {puedeEscribir && <th className="th text-right">Acciones</th>}
            </tr>
          </thead>
          <tbody>
            {reservas.map((r, i) => (
              <tr key={r.id} className={'reveal group border-b border-rs-border/60 transition-colors last:border-0 hover:bg-rs-raised/50 ' + (ocupada === r.id ? 'opacity-60' : '')} style={{ ['--i' as string]: Math.min(i, 12) }}>
                <td className="td font-semibold text-rs-lime">#{r.numero}</td>
                <td className="td font-medium">{r.cliente_nombre ?? '—'}</td>
                <td className="td text-rs-muted">{r.cliente_telefono ?? '—'}</td>
                {mostrarSede && <td className="td text-rs-muted">{r.sucursal_id ? op.nombresSede[r.sucursal_id] ?? '—' : '—'}</td>}
                <td className="td">{fechaCorta(r.fecha)}</td>
                <td className="td">{horaCorta(r.hora)}</td>
                <td className="td">{r.cantidad_personas ?? '—'}</td>
                <td className="td text-rs-muted">{labelTipo(r.tipo_reserva)}</td>
                {mostrarUbicacion && <td className="td text-rs-muted">{r.ubicacion ?? '—'}</td>}
                <td className="td max-w-[150px] truncate text-rs-muted" title={nota(r) ?? ''}>{nota(r) ?? '—'}</td>
                <td className="td"><EstadoBadge estado={r.estado} /></td>
                <td className="td whitespace-nowrap text-xs text-rs-muted">{fechaHoraLarga(r.creado_en)}</td>
                {puedeEscribir && <td className="td">{acciones(r)}</td>}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Celular: tarjetas */}
      <ul className="space-y-3 md:hidden">
        {reservas.map((r, i) => (
          <li key={r.id} className={'reveal card p-4 transition-opacity ' + (ocupada === r.id ? 'opacity-60' : '')} style={{ ['--i' as string]: Math.min(i, 8) }}>
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="font-semibold"><span className="text-rs-lime">#{r.numero}</span> {r.cliente_nombre ?? '—'}</p>
                <p className="mt-0.5 text-sm text-rs-muted">{fechaCorta(r.fecha)} · {horaCorta(r.hora)}</p>
                <p className="text-[11px] text-rs-muted/70">Alta {fechaHoraLarga(r.creado_en)}</p>
              </div>
              <EstadoBadge estado={r.estado} />
            </div>
            <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-sm text-rs-muted">
              <span className="inline-flex items-center gap-1.5"><Users size={13} />{r.cantidad_personas ?? '—'} personas</span>
              {r.cliente_telefono && <span className="inline-flex items-center gap-1.5"><Phone size={13} />{r.cliente_telefono}</span>}
              {mostrarSede && r.sucursal_id && <span className="inline-flex items-center gap-1.5"><MapPin size={13} />{op.nombresSede[r.sucursal_id] ?? '—'}{r.ubicacion ? ` · ${r.ubicacion}` : ''}</span>}
              {(!mostrarSede || !r.sucursal_id) && r.ubicacion && <span className="inline-flex items-center gap-1.5"><MapPin size={13} />{r.ubicacion}</span>}
              <span>{labelTipo(r.tipo_reserva)}</span>
            </div>
            {nota(r) && <p className="mt-2 text-sm text-rs-muted/90">{nota(r)}</p>}
            {puedeEscribir && <div className="mt-3 border-t border-rs-border/60 pt-3">{acciones(r)}</div>}
          </li>
        ))}
      </ul>

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
            <button disabled={pending} onClick={() => { const r = cancelando; setCancelando(null); cambiarEstado(r, 'cancelada', motivo) }} className="btn btn-danger">Cancelar reserva</button>
          </div>
        </Modal>
      )}
    </>
  )
}
