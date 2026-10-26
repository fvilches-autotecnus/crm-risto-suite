'use client'

import { useEffect, useState, useTransition } from 'react'
import { CalendarPlus, Check, Columns3, MapPin, MessageSquareText, Pencil, Phone, Plus, Trash2, Users, UserX, X, UserCheck } from 'lucide-react'
import { marcarLlego } from '@/app/(panel)/fidelidad-actions'
import { cambiarEstadoReserva, consultarAforo, eliminarReserva, guardarReserva, mesasDeReserva, restaurarEstadoReserva, restaurarReserva, type ActionResult } from '@/app/(panel)/actions'
import { useToast } from '@/components/feedback'
import { FechaInput, HoraInput, NombreApellidoInput, TelefonoInput } from '@/components/inputs'
import DialogoCambioEstado, { type DatosCambio } from '@/components/dialogo-estado'
import MenuEstado, { PUNTO_ESTADO } from '@/components/menu-estado'
import Modal from '@/components/modal'
import { useAccionFormulario } from '@/components/use-accion-formulario'
import PlanoElegir from '@/components/plano-elegir'
import { EstadoVacio, Spinner } from '@/components/ui'
import { fechaCorta, fechaHoraLarga, horaCorta } from '@/lib/fechas'
import { TIPOS_RESERVA, esEstadoAviso, numeroVisible, formatoMonto, labelEstado, labelTipo, type EstadoReserva, type Reserva } from '@/lib/reservas'
import type { ChequeoAforo } from '@/lib/aforo'
import { COLUMNAS_COOKIE, COLUMNAS_DEFECTO, COLUMNAS_OPCIONALES, type ColumnaClave } from '@/lib/columnas-reservas'

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
  tipos: string[]                                   // tipos de reserva del catálogo + los que ya existen en los datos
  tiposEtiquetas: Record<string, string>           // clave -> nombre que configuró el negocio
  tiposActivos: string[]                            // los que se ofrecen al cargar una reserva
  alertaAforo: number                               // % del aforo a partir del cual se avisa
  conPlano: boolean                                 // el negocio tiene Salón y mesas con al menos un plano: se puede elegir mesa al cargar una reserva
  ubicaciones: { nombre: string; sucursal_id: string | null }[]   // sucursal_id null = vale para todas las sedes; lista vacía = el negocio no usa ubicaciones
  aviso: { disponible: boolean; estados: string[]; porSede: Record<string, { disponible: boolean; estados: string[] }> }   // aviso al cliente por WhatsApp: del negocio y, si la sede tiene los suyos, por sede
}

// ---------------------------------------------------------------------------
// Aviso en vivo de aforo dentro del formulario
// ---------------------------------------------------------------------------
function HintAforo({ detalle, alerta }: { detalle: ChequeoAforo[]; alerta: number }) {
  if (!detalle.length) return null
  return (
    <ul className="col-span-2 flex animate-fade-in flex-wrap gap-2" aria-label="Aforo">
      {detalle.map((c, i) => {
        const pct = c.maximo ? c.despues / c.maximo : 0
        const cls = c.excede ? 'border-rs-danger/50 bg-rs-danger/10 text-rs-danger' : pct >= alerta / 100 ? 'border-rs-warn/50 bg-rs-warn/10 text-rs-warn' : 'border-rs-ok/40 bg-rs-ok/10 text-rs-ok'
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
  const [mesas, setMesas] = useState<string[]>([])   // mesas elegidas en el plano
  const [mesasIniciales, setMesasIniciales] = useState<string[]>([])   // las que ya tenía la reserva (al editar)
  useEffect(() => { if (reserva?.id && op.conPlano) void mesasDeReserva(reserva.id).then((ids) => { setMesasIniciales(ids); setMesas(ids) }) }, [reserva?.id]) // eslint-disable-line react-hooks/exhaustive-deps
  const mesasCambiaron = [...mesas].sort().join() !== [...mesasIniciales].sort().join()

  // las ubicaciones de la sede elegida + las que valen para todas las sedes
  // tipos: los de siempre + los que ya existen en los datos (y el de la reserva que se edita)
  const tiposForm = [...new Set([...(op.tiposActivos.length ? op.tiposActivos : TIPOS_RESERVA.map((t) => t.value as string)), ...(reserva?.tipo_reserva ? [reserva.tipo_reserva] : [])])]
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
    if (state?.ok) { toast({ texto: reserva ? `Reserva #${numeroVisible(reserva)} actualizada` : 'Reserva creada' }); if (state.nota) toast({ tipo: 'info', texto: state.nota, ms: 9000 }); onDone() }
  }, [state]) // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <form {...formProps} className="grid grid-cols-2 gap-3">
      {reserva && <input type="hidden" name="id" value={reserva.id} />}
      <input type="hidden" name="forzar" defaultValue="" />
      <div className="col-span-2">
        <NombreApellidoInput id="cliente_nombre" name="cliente_nombre" defaultValue={reserva?.cliente_nombre ?? ''} labelNombre="Nombre del titular" nombreRequerido />
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
          {tiposForm.map((t) => <option key={t} value={t}>{labelTipo(t, op.tiposEtiquetas)}</option>)}
        </select>
      </div>
      <HintAforo detalle={detalle} alerta={op.alertaAforo} />
      {op.conPlano && (
        <>
          <input type="hidden" name="mesas" value={JSON.stringify(mesas)} />
          {reserva && <input type="hidden" name="mesas_cambiaron" value={mesasCambiaron ? '1' : ''} />}
          <PlanoElegir fecha={fecha} hora={hora} personas={Number(personas)} sede={sedeElegida} ubicacion={ubic} value={mesas} onChange={setMesas} excluirReserva={reserva?.id} />
        </>
      )}
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

/** Elegir qué columnas se ven en la tabla (el número, el cliente, el estado y las acciones son fijas). Se recuerda en una cookie. */
function SelectorColumnas({ activas, onChange, hayUbicacion, haySede }: { activas: ColumnaClave[]; onChange: (c: ColumnaClave[]) => void; hayUbicacion: boolean; haySede: boolean }) {
  const [abierto, setAbierto] = useState(false)
  const disponibles = COLUMNAS_OPCIONALES.filter((c) => (c.clave !== 'ubicacion' || hayUbicacion) && (c.clave !== 'sede' || haySede))
  const alternar = (c: ColumnaClave) => {
    const nuevas = activas.includes(c) ? activas.filter((x) => x !== c) : COLUMNAS_OPCIONALES.map((x) => x.clave).filter((x) => x === c || activas.includes(x))
    onChange(nuevas)
    document.cookie = `${COLUMNAS_COOKIE}=${nuevas.join(',')}; path=/; max-age=31536000; samesite=lax`
  }
  return (
    <div className="relative">
      <button type="button" onClick={() => setAbierto((a) => !a)} aria-expanded={abierto} className="btn btn-sm"><Columns3 size={14} />Columnas</button>
      {abierto && (
        <>
          <div className="fixed inset-0 z-30" onClick={() => setAbierto(false)} aria-hidden />
          <div role="dialog" aria-label="Columnas de la tabla" className="absolute right-0 top-9 z-40 w-64 rounded-rs-lg border border-rs-control bg-rs-header p-3 shadow-2xl shadow-black/60">
            <p className="mb-1 text-[11px] font-bold uppercase tracking-wide text-rs-muted">Columnas que se ven</p>
            <p className="mb-2 text-xs text-rs-muted">Siempre se ven el número, el cliente, el estado y las acciones.</p>
            <ul className="space-y-1">{disponibles.map((c) => <li key={c.clave}><label className="flex cursor-pointer items-center gap-2 rounded px-1.5 py-1 text-sm hover:bg-rs-raised"><input type="checkbox" checked={activas.includes(c.clave)} onChange={() => alternar(c.clave)} className="h-4 w-4 accent-[#c8e62b]" />{c.etiqueta}</label></li>)}</ul>
            <button type="button" onClick={() => { onChange(COLUMNAS_DEFECTO); document.cookie = `${COLUMNAS_COOKIE}=; path=/; max-age=0` }} className="mt-2 text-xs text-rs-muted underline-offset-2 hover:text-rs-lime hover:underline">Volver a las de siempre</button>
          </div>
        </>
      )}
    </div>
  )
}

export function ReservasTabla({ reservas, puedeEscribir, vacio = 'No se encontraron reservas.', op, asistencia = false, mesas = {}, columnas = COLUMNAS_DEFECTO }: { reservas: Reserva[]; puedeEscribir: boolean; vacio?: string; asistencia?: boolean; mesas?: Record<string, string>; op: OpcionesSede; columnas?: ColumnaClave[] }) {
  const toast = useToast()
  const [cols, setCols] = useState<ColumnaClave[]>(columnas)
  const ver = (c: ColumnaClave) => cols.includes(c)
  const [editando, setEditando] = useState<Reserva | null>(null)
  const [cambio, setCambio] = useState<{ r: Reserva; estado: EstadoReserva } | null>(null)
  const [pending, start] = useTransition()
  const [ocupada, setOcupada] = useState<string | null>(null)
  const mostrarSede = Object.keys(op.nombresSede).length > 0
  const mostrarUbicacion = op.ubicaciones.length > 0 || reservas.some((r) => r.ubicacion)

  const correr = (id: string, fn: () => Promise<ActionResult>, ok?: (res: ActionResult) => void) =>
    start(async () => {
      setOcupada(id)
      const r = await fn()
      setOcupada(null)
      r.ok ? ok?.(r) : toast({ tipo: 'error', texto: r.error ?? 'Ocurrió un error' })
    })

  const cambiarEstado = (r: Reserva, estado: EstadoReserva, d: Partial<DatosCambio> = {}) =>
    correr(r.id, () => cambiarEstadoReserva(r.id, estado, d.motivo, d.monto, d.notificar), (res) => {
      toast({
        texto: `Reserva #${numeroVisible(r)}: ${labelEstado(estado).toLowerCase()}${estado === 'pendiente_pago' && d.monto ? ` · ${formatoMonto(d.monto)}` : ''}${res.aviso === 'enviado' ? ' · cliente avisado' : ''}`,
        accion: { label: 'Deshacer', onClick: () => { void restaurarEstadoReserva(r.id, r.estado, r.monto_sena) } },
      })
      if (res.aviso === 'fallo') toast({ tipo: 'error', texto: `El estado se cambió, pero no se pudo avisar al cliente de la reserva #${numeroVisible(r)}.` })
      if (res.aviso === 'no_disponible') toast({ tipo: 'info', texto: 'El estado se cambió. Este negocio no tiene el aviso por WhatsApp habilitado para este estado.' })
    })

  // Confirmada, pendiente de pago, no-show y cancelada abren un diálogo cuando hay algo que pedir (monto, motivo)
  // o algo que elegir (avisar o no al cliente). Nueva y revisar pago cambian directo.
  // el aviso se rige por la configuración de la sede de la reserva (si tiene la suya) y si no por la del negocio
  const avisoDe = (r: Reserva) => (r.sucursal_id && op.aviso.porSede[r.sucursal_id]) || op.aviso
  const puedeAvisar = (r: Reserva, estado: EstadoReserva) => avisoDe(r).disponible && !!r.cliente_telefono && esEstadoAviso(estado) && avisoDe(r).estados.includes(estado)
  const pedirCambio = (r: Reserva, estado: EstadoReserva) => {
    if (estado === 'pendiente_pago' || estado === 'cancelada' || puedeAvisar(r, estado)) setCambio({ r, estado })
    else cambiarEstado(r, estado)
  }

  const eliminar = (r: Reserva) =>
    correr(r.id, () => eliminarReserva(r.id), () =>
      toast({ texto: `Reserva #${numeroVisible(r)} eliminada`, accion: { label: 'Deshacer', onClick: () => { void restaurarReserva(r.id) } } }))

  const llego = (r: Reserva) => correr(r.id, () => marcarLlego(r.id, !r.asistio_en), () => toast({ texto: r.asistio_en ? `Reserva #${numeroVisible(r)}: se quitó “Llegó”` : `Reserva #${numeroVisible(r)}: llegó` }))

  const acciones = (r: Reserva) => (
    <div className="flex justify-end gap-1.5">
      {asistencia && r.estado === 'confirmada' && <button disabled={pending} onClick={() => llego(r)} title={r.asistio_en ? 'Llegó (tocá para quitarlo)' : 'Marcar que llegó'} aria-pressed={!!r.asistio_en} className={'btn btn-sm ' + (r.asistio_en ? 'border-rs-ok/50 bg-rs-ok/10 text-rs-ok' : '')}><UserCheck size={14} />{r.asistio_en ? 'Llegó' : 'Llegó'}</button>}
      {r.estado !== 'confirmada' && <button disabled={pending} onClick={() => pedirCambio(r, 'confirmada')} title="Confirmar" aria-label="Confirmar" className="btn btn-sm text-rs-ok hover:bg-rs-ok/10"><Check size={14} /></button>}
      {r.estado !== 'cancelada' && <button disabled={pending} onClick={() => pedirCambio(r, 'cancelada')} title="Cancelar" aria-label="Cancelar" className="btn btn-sm btn-danger"><X size={14} /></button>}
      <MenuEstado actual={r.estado} deshabilitado={pending} onElegir={(e) => pedirCambio(r, e)} />
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
      <div className="hidden justify-end md:flex"><SelectorColumnas activas={cols} onChange={setCols} hayUbicacion={mostrarUbicacion} haySede={mostrarSede} /></div>
      <div className="card hidden overflow-x-auto md:block">
        <table className="w-full">
          <thead className="sticky top-0 border-b border-rs-border bg-rs-card">
            <tr>
              <th className="th">#</th><th className="th">Nombre</th>{ver('telefono') && <th className="th">Tel</th>}{mostrarSede && ver('sede') && <th className="th">Sede</th>}{ver('fecha') && <th className="th">Fecha</th>}{ver('hora') && <th className="th">Hora</th>}
              {ver('personas') && <th className="th">Personas</th>}{ver('tipo') && <th className="th">Tipo</th>}{mostrarUbicacion && ver('ubicacion') && <th className="th">Ubicación</th>}{ver('observaciones') && <th className="th">Observaciones</th>}<th className="th">Estado</th>{ver('alta') && <th className="th">Alta</th>}
              {puedeEscribir && <th className="th text-right">Acciones</th>}
            </tr>
          </thead>
          <tbody>
            {reservas.map((r, i) => (
              <tr key={r.id} className={'reveal group border-b border-rs-border/60 transition-colors last:border-0 hover:bg-rs-raised/50 ' + (ocupada === r.id ? 'opacity-60' : '')} style={{ ['--i' as string]: Math.min(i, 12) }}>
                <td className="td font-semibold text-rs-lime">#{numeroVisible(r)}</td>
                <td className="td"><span className="font-medium">{r.cliente_nombre ?? '—'}</span>{!ver('observaciones') && nota(r) && <span className="mt-0.5 flex max-w-[260px] items-center gap-1 truncate text-[11px] italic leading-tight text-rs-muted/70" title={nota(r) ?? ''}><MessageSquareText size={10} className="shrink-0" /><span className="truncate">{nota(r)}</span></span>}</td>
                {ver('telefono') && <td className="td text-rs-muted">{r.cliente_telefono ?? '—'}</td>}
                {mostrarSede && ver('sede') && <td className="td text-rs-muted">{r.sucursal_id ? op.nombresSede[r.sucursal_id] ?? '—' : '—'}</td>}
                {ver('fecha') && <td className="td">{fechaCorta(r.fecha)}</td>}
                {ver('hora') && <td className="td">{horaCorta(r.hora)}</td>}
                {ver('personas') && <td className="td">{r.cantidad_personas ?? '—'}{mesas[r.id] && <a href={`/mesas?fecha=${r.fecha ?? ''}`} className="ml-2 whitespace-nowrap rounded-full bg-rs-lav/15 px-2 py-0.5 text-xs font-semibold text-rs-lav" title="Ver en el plano del salón">Mesa {mesas[r.id]}</a>}</td>}
                {ver('tipo') && <td className="td text-rs-muted">{labelTipo(r.tipo_reserva, op.tiposEtiquetas)}</td>}
                {mostrarUbicacion && ver('ubicacion') && <td className="td text-rs-muted">{r.ubicacion ?? '—'}</td>}
                {ver('observaciones') && <td className="td max-w-[200px] truncate text-rs-muted" title={nota(r) ?? ''}>{nota(r) ?? '—'}</td>}
                <td className="td"><EstadoBadge estado={r.estado} />{r.monto_sena ? <div className="mt-1 text-xs tabular-nums text-rs-muted">{r.estado === 'pendiente_pago' ? 'A pagar' : 'Seña'} {formatoMonto(r.monto_sena)}</div> : null}</td>
                {ver('alta') && <td className="td whitespace-nowrap text-xs text-rs-muted">{fechaHoraLarga(r.creado_en)}</td>}
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
                <p className="font-semibold"><span className="text-rs-lime">#{numeroVisible(r)}</span> {r.cliente_nombre ?? '—'}</p>
                <p className="mt-0.5 text-sm text-rs-muted">{fechaCorta(r.fecha)} · {horaCorta(r.hora)}</p>
                <p className="text-[11px] text-rs-muted/70">Alta {fechaHoraLarga(r.creado_en)}</p>
              </div>
              <div className="text-right"><EstadoBadge estado={r.estado} />{r.monto_sena ? <div className="mt-1 text-xs tabular-nums text-rs-muted">{r.estado === 'pendiente_pago' ? 'A pagar' : 'Seña'} {formatoMonto(r.monto_sena)}</div> : null}</div>
            </div>
            <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-sm text-rs-muted">
              <span className="inline-flex items-center gap-1.5"><Users size={13} />{r.cantidad_personas ?? '—'} personas</span>
              {r.cliente_telefono && <span className="inline-flex items-center gap-1.5"><Phone size={13} />{r.cliente_telefono}</span>}
              {mostrarSede && r.sucursal_id && <span className="inline-flex items-center gap-1.5"><MapPin size={13} />{op.nombresSede[r.sucursal_id] ?? '—'}{r.ubicacion ? ` · ${r.ubicacion}` : ''}</span>}
              {(!mostrarSede || !r.sucursal_id) && r.ubicacion && <span className="inline-flex items-center gap-1.5"><MapPin size={13} />{r.ubicacion}</span>}
              <span>{labelTipo(r.tipo_reserva, op.tiposEtiquetas)}</span>
              {mesas[r.id] && <a href={`/mesas?fecha=${r.fecha ?? ''}`} className="font-semibold text-rs-lav">Mesa {mesas[r.id]}</a>}
            </div>
            {nota(r) && <p className="mt-2 flex items-start gap-1 text-xs italic text-rs-muted/70"><MessageSquareText size={11} className="mt-0.5 shrink-0" />{nota(r)}</p>}
            {puedeEscribir && <div className="mt-3 border-t border-rs-border/60 pt-3">{acciones(r)}</div>}
          </li>
        ))}
      </ul>

      {editando && (
        <Modal titulo={`Editar reserva #${numeroVisible(editando)}`} onClose={() => setEditando(null)}>
          <ReservaForm reserva={editando} onDone={() => setEditando(null)} op={op} />
        </Modal>
      )}
      {cambio && (
        <DialogoCambioEstado
          r={cambio.r} estado={cambio.estado} aviso={avisoDe(cambio.r)} ocupado={pending}
          onClose={() => setCambio(null)}
          onConfirmar={(d) => { const c = cambio; setCambio(null); cambiarEstado(c.r, c.estado, d) }}
        />
      )}
    </>
  )
}
