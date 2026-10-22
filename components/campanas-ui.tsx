'use client'

import Link from 'next/link'
import { useEffect, useState, useTransition } from 'react'
import { Megaphone, Pencil, Plus, Send, Trash2 } from 'lucide-react'
import { cambiarEstadoEnvio, eliminarCampana, eliminarEnvio, guardarCampana, registrarEnvios } from '@/app/(panel)/campanas-actions'
import { useConfirm, useToast } from '@/components/feedback'
import { FechaInput, HoraInput } from '@/components/inputs'
import Modal from '@/components/modal'
import { useAccionFormulario } from '@/components/use-accion-formulario'
import { EstadoVacio, Spinner } from '@/components/ui'
import { ESTADOS_CAMPANA, ESTADOS_ENVIO, TIPOS_CAMPANA, labelEstadoCampana, labelEstadoEnvio, labelTipoCampana, pct, type Campana, type Envio, type ResumenCampana } from '@/lib/campanas'
import { fechaHoraLarga } from '@/lib/fechas'

// ---------------------------------------------------------------------------
// Insignias
// ---------------------------------------------------------------------------
export function BadgeCampana({ estado }: { estado: string }) {
  const [cls, dot] = estado === 'activa' ? ['bg-rs-ok/15 text-rs-ok', 'bg-rs-ok'] : estado === 'pausada' ? ['bg-rs-warn/15 text-rs-warn', 'bg-rs-warn'] : ['bg-rs-muted/20 text-rs-muted', 'bg-rs-muted']
  return <span className={'badge ' + cls}><span className={'h-1.5 w-1.5 rounded-full ' + dot} />{labelEstadoCampana(estado)}</span>
}

export function BadgeEnvio({ estado }: { estado: string }) {
  const [cls, dot] = estado === 'respondido' ? ['bg-rs-lime/15 text-rs-lime', 'bg-rs-lime'] : estado === 'leido' ? ['bg-rs-ok/15 text-rs-ok', 'bg-rs-ok'] : estado === 'entregado' ? ['bg-rs-ok/10 text-rs-ok', 'bg-rs-ok/70'] : estado === 'fallido' ? ['bg-rs-danger/15 text-rs-danger', 'bg-rs-danger'] : ['bg-rs-muted/20 text-rs-muted', 'bg-rs-muted']
  return <span className={'badge ' + cls}><span className={'h-1.5 w-1.5 rounded-full ' + dot} />{labelEstadoEnvio(estado)}</span>
}

// ---------------------------------------------------------------------------
// Alta / edición de campañas
// ---------------------------------------------------------------------------
function CampanaForm({ campana, onDone }: { campana?: Campana; onDone: () => void }) {
  const { state, pending, formProps } = useAccionFormulario(guardarCampana, { okTexto: campana ? 'Campaña actualizada' : 'Campaña creada' })
  const tipoConocido = !campana || TIPOS_CAMPANA.some((t) => t.value === campana.tipo)
  const [tipo, setTipo] = useState(campana ? (tipoConocido ? campana.tipo : 'otro_texto') : 'promocion')
  useEffect(() => { if (state?.ok) onDone() }, [state]) // eslint-disable-line react-hooks/exhaustive-deps
  return (
    <form {...formProps} className="grid grid-cols-2 gap-3" noValidate>
      {campana && <input type="hidden" name="id" value={campana.id} />}
      <div className="col-span-2"><label className="label" htmlFor="c_nombre">Nombre de la campaña *</label><input id="c_nombre" name="nombre" defaultValue={campana?.nombre ?? ''} placeholder="Ej. Cumpleaños de octubre" maxLength={120} className="input w-full" required /></div>
      <div>
        <label className="label" htmlFor="c_tipo">Tipo</label>
        <select id="c_tipo" name="tipo" value={tipo} onChange={(e) => setTipo(e.target.value)} className="input w-full">
          {TIPOS_CAMPANA.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
          <option value="otro_texto">Otro tipo…</option>
        </select>
      </div>
      <div>
        <label className="label" htmlFor="c_estado">Estado</label>
        <select id="c_estado" name="estado" defaultValue={campana?.estado ?? 'activa'} className="input w-full">
          {ESTADOS_CAMPANA.map((e) => <option key={e.value} value={e.value}>{e.label}</option>)}
        </select>
      </div>
      {tipo === 'otro_texto' && <div className="col-span-2"><label className="label" htmlFor="c_tipo_otro">Nombre del tipo</label><input id="c_tipo_otro" name="tipo_otro" defaultValue={!tipoConocido ? campana?.tipo.replace(/_/g, ' ') : ''} placeholder="Ej. reactivación" className="input w-full" /></div>}
      <div><label className="label" htmlFor="c_ini">Desde</label><FechaInput id="c_ini" name="fecha_inicio" defaultValue={campana?.fecha_inicio ?? ''} /></div>
      <div><label className="label" htmlFor="c_fin">Hasta</label><FechaInput id="c_fin" name="fecha_fin" defaultValue={campana?.fecha_fin ?? ''} /></div>
      <div className="col-span-2"><label className="label" htmlFor="c_msg">Mensaje</label><textarea id="c_msg" name="mensaje" rows={3} defaultValue={campana?.mensaje ?? ''} placeholder="Texto o plantilla que se envía (opcional)" className="input w-full" /></div>
      {state && !state.ok && <p role="alert" className="col-span-2 animate-fade-in text-sm text-rs-danger">{state.error}</p>}
      <div className="col-span-2 flex justify-end gap-2">
        <button type="button" onClick={onDone} className="btn">Cancelar</button>
        <button disabled={pending} className="btn btn-primary">{pending && <Spinner />}{pending ? 'Guardando…' : campana ? 'Guardar cambios' : 'Crear campaña'}</button>
      </div>
    </form>
  )
}

export function NuevaCampanaBtn() {
  const [abierto, setAbierto] = useState(false)
  return (
    <>
      <button onClick={() => setAbierto(true)} className="btn btn-primary"><Plus size={16} />Nueva campaña</button>
      {abierto && <Modal titulo="Nueva campaña" onClose={() => setAbierto(false)}><CampanaForm onDone={() => setAbierto(false)} /></Modal>}
    </>
  )
}

export function EditarCampanaBtn({ campana, etiqueta = false }: { campana: Campana; etiqueta?: boolean }) {
  const [abierto, setAbierto] = useState(false)
  return (
    <>
      <button onClick={() => setAbierto(true)} aria-label="Editar campaña" className="btn btn-sm"><Pencil size={13} />{etiqueta && 'Editar'}</button>
      {abierto && <Modal titulo="Editar campaña" onClose={() => setAbierto(false)}><CampanaForm campana={campana} onDone={() => setAbierto(false)} /></Modal>}
    </>
  )
}

export function EliminarCampanaBtn({ campana, volverA, etiqueta = false }: { campana: Campana; volverA?: string; etiqueta?: boolean }) {
  const [pending, start] = useTransition()
  const confirmar = useConfirm()
  const toast = useToast()
  const borrar = async () => {
    if (!(await confirmar({ titulo: `¿Eliminar la campaña “${campana.nombre}”?`, texto: 'Se borra también todo su historial de envíos. Si solo querés dejar de usarla, pasala a Finalizada.', confirmar: 'Eliminar', peligro: true }))) return
    start(async () => {
      const r = await eliminarCampana(campana.id)
      toast(r.ok ? { texto: 'Campaña eliminada' } : { tipo: 'error', texto: r.error ?? 'Error' })
      if (r.ok && volverA) window.location.assign(volverA)
    })
  }
  return <button disabled={pending} onClick={borrar} aria-label="Eliminar campaña" className="btn btn-sm btn-danger"><Trash2 size={13} />{etiqueta && 'Eliminar'}</button>
}

// ---------------------------------------------------------------------------
// Registrar envíos (carga manual)
// ---------------------------------------------------------------------------
function EnviosForm({ campanaId, onDone }: { campanaId: string; onDone: () => void }) {
  const { state, pending, formProps } = useAccionFormulario(registrarEnvios, { okTexto: 'Envíos registrados' })
  const [cantidad, setCantidad] = useState('1')
  const varios = Number(cantidad) > 1
  useEffect(() => { if (state?.ok) onDone() }, [state]) // eslint-disable-line react-hooks/exhaustive-deps
  return (
    <form {...formProps} className="grid grid-cols-2 gap-3" noValidate>
      <input type="hidden" name="campana_id" value={campanaId} />
      <div>
        <label className="label" htmlFor="e_cant">Cantidad de mensajes</label>
        <input id="e_cant" name="cantidad" type="number" min={1} max={5000} value={cantidad} onChange={(e) => setCantidad(e.target.value)} className="input w-full" />
      </div>
      <div>
        <label className="label" htmlFor="e_estado">Estado</label>
        <select id="e_estado" name="estado" defaultValue="enviado" className="input w-full">{ESTADOS_ENVIO.map((e) => <option key={e.value} value={e.value}>{e.label}</option>)}</select>
      </div>
      {varios
        ? <p className="col-span-2 rounded-rs border border-rs-border bg-rs-raised/40 px-3 py-2 text-xs text-rs-muted">Se cargan {Number(cantidad)} envíos sin destinatario, solo para llevar la cuenta. Para guardar a quién se le mandó, cargalos de a uno.</p>
        : <>
            <div><label className="label" htmlFor="e_nombre">Nombre</label><input id="e_nombre" name="nombre" placeholder="Opcional" className="input w-full" /></div>
            <div><label className="label" htmlFor="e_tel">Teléfono</label><input id="e_tel" name="telefono" inputMode="tel" placeholder="Ej. 5493415550000" className="input w-full" /></div>
          </>}
      <div><label className="label" htmlFor="e_fecha">Fecha del envío</label><FechaInput id="e_fecha" name="fecha" /></div>
      <div><label className="label" htmlFor="e_hora">Hora</label><HoraInput id="e_hora" name="hora" defaultValue="12:00" /></div>
      <div className="col-span-2"><label className="label" htmlFor="e_det">Detalle</label><input id="e_det" name="detalle" placeholder="Opcional (ej. motivo del fallo)" className="input w-full" /></div>
      <p className="col-span-2 -mt-1 text-xs text-rs-muted">Si no completás la fecha, se usa el momento actual.</p>
      {state && !state.ok && <p role="alert" className="col-span-2 animate-fade-in text-sm text-rs-danger">{state.error}</p>}
      <div className="col-span-2 flex justify-end gap-2">
        <button type="button" onClick={onDone} className="btn">Cancelar</button>
        <button disabled={pending} className="btn btn-primary">{pending && <Spinner />}{pending ? 'Registrando…' : varios ? `Registrar ${Number(cantidad)} envíos` : 'Registrar envío'}</button>
      </div>
    </form>
  )
}

export function RegistrarEnviosBtn({ campanaId, chico = false }: { campanaId: string; chico?: boolean }) {
  const [abierto, setAbierto] = useState(false)
  return (
    <>
      <button onClick={() => setAbierto(true)} className={'btn ' + (chico ? 'btn-sm' : 'btn-primary')}><Send size={chico ? 13 : 15} />Registrar envíos</button>
      {abierto && <Modal titulo="Registrar envíos" onClose={() => setAbierto(false)}><EnviosForm campanaId={campanaId} onDone={() => setAbierto(false)} /></Modal>}
    </>
  )
}

// ---------------------------------------------------------------------------
// Lista de campañas (con sus totales del período)
// ---------------------------------------------------------------------------
export function ListaCampanas({ campanas, resumen, editable, puedeEliminar, dias }: { campanas: Campana[]; resumen: Record<string, ResumenCampana>; editable: boolean; puedeEliminar: boolean; dias: number }) {
  if (campanas.length === 0) {
    return <div className="card"><EstadoVacio icono={<Megaphone size={26} />} titulo="Todavía no hay campañas" texto={editable ? 'Creá la primera con “Nueva campaña”. Después vas a poder registrar los mensajes enviados y ver cuántos se entregaron y respondieron.' : 'Cuando la automatización empiece a enviar mensajes, las campañas van a aparecer acá.'} /></div>
  }
  const r = (c: Campana) => resumen[c.id] ?? { campana_id: c.id, enviados: 0, entregados: 0, leidos: 0, respondidos: 0, fallidos: 0, ultimo_envio: null }
  const acciones = (c: Campana) => editable && (
    <div className="flex justify-end gap-1.5">
      <EditarCampanaBtn campana={c} />
      {puedeEliminar && <EliminarCampanaBtn campana={c} />}
    </div>
  )
  return (
    <>
      <div className="card hidden overflow-x-auto md:block">
        <table className="w-full min-w-[900px]">
          <thead className="border-b border-rs-border"><tr><th className="th">Campaña</th><th className="th">Tipo</th><th className="th">Estado</th><th className="th text-right">Enviados ({dias} d)</th><th className="th text-right">Entregados</th><th className="th text-right">Respondieron</th><th className="th text-right">Fallidos</th><th className="th">Último envío</th>{editable && <th className="th text-right">Acciones</th>}</tr></thead>
          <tbody>
            {campanas.map((c, i) => {
              const x = r(c)
              return (
                <tr key={c.id} className="reveal border-b border-rs-border/60 transition-colors last:border-0 hover:bg-rs-raised/50" style={{ ['--i' as string]: Math.min(i, 12) }}>
                  <td className="td"><Link href={`/campanas/${c.id}`} className="font-semibold text-rs-lime hover:underline">{c.nombre}</Link></td>
                  <td className="td text-rs-muted">{labelTipoCampana(c.tipo)}</td>
                  <td className="td"><BadgeCampana estado={c.estado} /></td>
                  <td className="td text-right font-semibold tabular-nums">{x.enviados}</td>
                  <td className="td text-right tabular-nums">{x.entregados}<span className="ml-1 text-xs text-rs-muted">{x.enviados ? `${pct(x.entregados, x.enviados)}%` : ''}</span></td>
                  <td className="td text-right tabular-nums">{x.respondidos}<span className="ml-1 text-xs text-rs-muted">{x.enviados ? `${pct(x.respondidos, x.enviados)}%` : ''}</span></td>
                  <td className={'td text-right tabular-nums ' + (x.fallidos ? 'text-rs-danger' : 'text-rs-muted')}>{x.fallidos}</td>
                  <td className="td whitespace-nowrap text-xs text-rs-muted">{x.ultimo_envio ? fechaHoraLarga(x.ultimo_envio) : 'Sin envíos'}</td>
                  {editable && <td className="td">{acciones(c)}</td>}
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
      <ul className="space-y-3 md:hidden">
        {campanas.map((c, i) => {
          const x = r(c)
          return (
            <li key={c.id} className="reveal card p-4" style={{ ['--i' as string]: Math.min(i, 8) }}>
              <div className="flex items-start justify-between gap-3">
                <Link href={`/campanas/${c.id}`} className="font-semibold text-rs-lime">{c.nombre}</Link>
                <BadgeCampana estado={c.estado} />
              </div>
              <p className="mt-1 text-xs text-rs-muted">{labelTipoCampana(c.tipo)} · {x.ultimo_envio ? `último envío ${fechaHoraLarga(x.ultimo_envio)}` : 'sin envíos'}</p>
              <dl className="mt-3 grid grid-cols-4 gap-2 text-center">
                {[['Enviados', x.enviados], ['Entregados', x.entregados], ['Respondieron', x.respondidos], ['Fallidos', x.fallidos]].map(([l, n]) => <div key={l as string}><dd className="text-lg font-bold tabular-nums">{n}</dd><dt className="text-[10px] uppercase tracking-wide text-rs-muted">{l}</dt></div>)}
              </dl>
              {editable && <div className="mt-3 border-t border-rs-border/60 pt-3">{acciones(c)}</div>}
            </li>
          )
        })}
      </ul>
    </>
  )
}

// ---------------------------------------------------------------------------
// Lista de envíos de una campaña
// ---------------------------------------------------------------------------
export function ListaEnvios({ envios, editable, puedeEliminar }: { envios: Envio[]; editable: boolean; puedeEliminar: boolean }) {
  const [pending, start] = useTransition()
  const confirmar = useConfirm()
  const toast = useToast()
  const cambiar = (e: Envio, estado: string) => start(async () => {
    const r = await cambiarEstadoEnvio(e.id, estado)
    if (!r.ok) toast({ tipo: 'error', texto: r.error ?? 'Error' })
  })
  const borrar = async (e: Envio) => {
    if (!(await confirmar({ titulo: '¿Eliminar este envío?', texto: 'Se borra del historial y deja de contar en los totales.', confirmar: 'Eliminar', peligro: true }))) return
    start(async () => { const r = await eliminarEnvio(e.id); toast(r.ok ? { texto: 'Envío eliminado' } : { tipo: 'error', texto: r.error ?? 'Error' }) })
  }
  if (envios.length === 0) return <div className="card"><EstadoVacio icono={<Send size={26} />} titulo="No hay envíos para mostrar" texto="Probá con otro período o estado." /></div>
  const estadoCtl = (e: Envio) => editable
    ? <select aria-label="Estado del envío" disabled={pending} value={e.estado} onChange={(ev) => cambiar(e, ev.target.value)} className="input h-8 py-0 text-xs">{ESTADOS_ENVIO.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}</select>
    : <BadgeEnvio estado={e.estado} />
  return (
    <>
      <div className="card hidden overflow-x-auto md:block">
        <table className="w-full min-w-[760px]">
          <thead className="border-b border-rs-border"><tr><th className="th">Enviado</th><th className="th">Nombre</th><th className="th">Teléfono</th><th className="th">Estado</th><th className="th">Detalle</th>{puedeEliminar && <th className="th text-right">Acciones</th>}</tr></thead>
          <tbody>
            {envios.map((e, i) => (
              <tr key={e.id} className="reveal border-b border-rs-border/60 last:border-0 hover:bg-rs-raised/50" style={{ ['--i' as string]: Math.min(i, 12) }}>
                <td className="td whitespace-nowrap text-xs text-rs-muted">{fechaHoraLarga(e.enviado_en)}</td>
                <td className="td font-medium">{e.nombre ?? '—'}</td>
                <td className="td text-rs-muted">{e.telefono ?? '—'}</td>
                <td className="td">{estadoCtl(e)}</td>
                <td className="td max-w-[220px] truncate text-rs-muted" title={e.detalle ?? ''}>{e.detalle ?? '—'}</td>
                {puedeEliminar && <td className="td text-right"><button disabled={pending} onClick={() => borrar(e)} aria-label="Eliminar envío" className="btn btn-sm btn-danger"><Trash2 size={13} /></button></td>}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <ul className="space-y-3 md:hidden">
        {envios.map((e, i) => (
          <li key={e.id} className="reveal card p-4" style={{ ['--i' as string]: Math.min(i, 8) }}>
            <div className="flex items-start justify-between gap-3"><span className="font-medium">{e.nombre ?? 'Sin nombre'}</span>{estadoCtl(e)}</div>
            <p className="mt-1 text-sm text-rs-muted">{e.telefono ?? 'Sin teléfono'} · {fechaHoraLarga(e.enviado_en)}</p>
            {e.detalle && <p className="mt-1 text-xs text-rs-muted">{e.detalle}</p>}
            {puedeEliminar && <div className="mt-3 border-t border-rs-border/60 pt-3 text-right"><button disabled={pending} onClick={() => borrar(e)} className="btn btn-sm btn-danger"><Trash2 size={13} />Eliminar</button></div>}
          </li>
        ))}
      </ul>
    </>
  )
}

