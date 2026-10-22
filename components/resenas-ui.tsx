'use client'

import { useEffect, useState, useTransition } from 'react'
import Link from 'next/link'
import { Pencil, Plus, Star, Trash2 } from 'lucide-react'
import { eliminarResena, guardarResena } from '@/app/(panel)/modulos-actions'
import { useConfirm, useToast } from '@/components/feedback'
import { FechaInput, TelefonoInput } from '@/components/inputs'
import Modal from '@/components/modal'
import { useAccionFormulario } from '@/components/use-accion-formulario'
import { EstadoVacio, Spinner } from '@/components/ui'
import { fechaCorta, fechaHoraLarga } from '@/lib/fechas'
import { labelOrigen } from '@/lib/resenas'

export interface ResenaUI {
  id: string
  nombre: string
  telefono: string | null
  puntaje: number
  comentario: string | null
  origen: string
  fecha: string
  creado_en: string
  cliente_id: string | null
  sucursal_id: string | null
}

export function Estrellas({ n, tam = 14 }: { n: number; tam?: number }) {
  return (
    <span className="inline-flex items-center gap-0.5" role="img" aria-label={`${n} de 5 estrellas`}>
      {[1, 2, 3, 4, 5].map((i) => <Star key={i} size={tam} className={i <= n ? 'fill-rs-lime text-rs-lime' : 'text-rs-control'} />)}
    </span>
  )
}

function SelectorEstrellas({ valor, onChange }: { valor: number; onChange: (n: number) => void }) {
  const [hover, setHover] = useState(0)
  return (
    <div className="flex items-center gap-1" role="radiogroup" aria-label="Puntaje" onPointerLeave={() => setHover(0)}>
      {[1, 2, 3, 4, 5].map((i) => (
        <button key={i} type="button" role="radio" aria-checked={valor === i} aria-label={`${i} estrella${i > 1 ? 's' : ''}`} onClick={() => onChange(i)} onPointerEnter={() => setHover(i)} className="rounded p-0.5 transition-transform hover:scale-125 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rs-lime/50">
          <Star size={26} className={'transition-colors ' + (i <= (hover || valor) ? 'fill-rs-lime text-rs-lime' : 'text-rs-control')} />
        </button>
      ))}
      <span className="ml-2 text-sm text-rs-muted">{valor ? `${valor} / 5` : 'Elegí el puntaje'}</span>
    </div>
  )
}

function ResenaForm({ resena, prefill, sedes, hoy, onDone }: { resena?: ResenaUI; prefill?: { cliente_id?: string; nombre?: string; telefono?: string }; sedes: { id: string; nombre: string }[]; hoy: string; onDone: () => void }) {
  const { state, pending, formProps } = useAccionFormulario(guardarResena, { okTexto: resena ? 'Reseña actualizada' : 'Reseña cargada' })
  const [puntaje, setPuntaje] = useState(resena?.puntaje ?? 0)
  useEffect(() => { if (state?.ok) onDone() }, [state]) // eslint-disable-line react-hooks/exhaustive-deps
  return (
    <form {...formProps} className="grid grid-cols-2 gap-3">
      {resena && <input type="hidden" name="id" value={resena.id} />}
      {prefill?.cliente_id && <input type="hidden" name="cliente_id" value={prefill.cliente_id} />}
      <input type="hidden" name="puntaje" value={puntaje || ''} />
      <div className="col-span-2"><label className="label" htmlFor="rs_nombre">Nombre *</label><input id="rs_nombre" name="nombre" defaultValue={resena?.nombre ?? prefill?.nombre ?? ''} className="input w-full" required /></div>
      <div className="col-span-2"><TelefonoInput name="telefono" label="Teléfono *" required defaultValue={resena?.telefono ?? prefill?.telefono ?? ''} /></div>
      <div className="col-span-2"><span className="label">Puntaje *</span><SelectorEstrellas valor={puntaje} onChange={setPuntaje} /></div>
      <div className="col-span-2"><label className="label" htmlFor="rs_com">Comentario</label><textarea id="rs_com" name="comentario" rows={3} defaultValue={resena?.comentario ?? ''} className="input w-full" /></div>
      <div>
        <label className="label" htmlFor="rs_origen">Origen</label>
        <select id="rs_origen" name="origen" defaultValue={resena?.origen ?? 'google'} className="input w-full">
          <option value="google">Google</option><option value="encuesta">Encuesta</option><option value="manual">Manual</option><option value="otro">Otro</option>
        </select>
      </div>
      <div><label className="label" htmlFor="rs_fecha">Fecha de la reseña</label><FechaInput id="rs_fecha" name="fecha" defaultValue={resena?.fecha ?? hoy} max={hoy} /></div>
      {sedes.length > 0 && (
        <div className="col-span-2">
          <label className="label" htmlFor="rs_sede">Sede *</label>
          <select id="rs_sede" name="sucursal_id" defaultValue={resena?.sucursal_id ?? (sedes.length === 1 ? sedes[0].id : '')} className="input w-full" required>
            <option value="" disabled>Elegí…</option>
            {sedes.map((x) => <option key={x.id} value={x.id}>{x.nombre}</option>)}
          </select>
        </div>
      )}
      {state && !state.ok && <p role="alert" className="col-span-2 animate-fade-in text-sm text-rs-danger">{state.error}</p>}
      <div className="col-span-2 flex justify-end gap-2">
        <button type="button" onClick={onDone} className="btn">Cancelar</button>
        <button disabled={pending} className="btn btn-primary">{pending && <Spinner />}{pending ? 'Guardando…' : resena ? 'Guardar cambios' : 'Cargar reseña'}</button>
      </div>
    </form>
  )
}

export function NuevaResenaBtn({ sedes, hoy, prefill, chico = false }: { sedes: { id: string; nombre: string }[]; hoy: string; prefill?: { cliente_id?: string; nombre?: string; telefono?: string }; chico?: boolean }) {
  const [abierto, setAbierto] = useState(false)
  return (
    <>
      <button onClick={() => setAbierto(true)} className={'btn ' + (chico ? 'btn-sm' : 'btn-primary')}><Plus size={chico ? 13 : 16} /> Agregar reseña</button>
      {abierto && <Modal titulo="Agregar reseña" onClose={() => setAbierto(false)}><ResenaForm sedes={sedes} hoy={hoy} prefill={prefill} onDone={() => setAbierto(false)} /></Modal>}
    </>
  )
}

export function ListaResenas({ resenas, sedes, nombresSede, hoy, puedeEscribir, puedeEliminar, mostrarCliente = true }: { resenas: ResenaUI[]; sedes: { id: string; nombre: string }[]; nombresSede: Record<string, string>; hoy: string; puedeEscribir: boolean; puedeEliminar: boolean; mostrarCliente?: boolean }) {
  const [edit, setEdit] = useState<ResenaUI | null>(null)
  const [pending, start] = useTransition()
  const confirmar = useConfirm()
  const toast = useToast()
  const mostrarSede = Object.keys(nombresSede).length > 0
  const borrar = async (r: ResenaUI) => {
    if (!(await confirmar({ titulo: `¿Eliminar la reseña de ${r.nombre}?`, texto: 'Se borra para siempre.', confirmar: 'Eliminar', peligro: true }))) return
    start(async () => { const x = await eliminarResena(r.id); toast(x.ok ? { texto: 'Reseña eliminada' } : { tipo: 'error', texto: x.error ?? 'Error' }) })
  }
  const acciones = (r: ResenaUI) => puedeEscribir && (
    <div className="flex justify-end gap-1.5">
      <button onClick={() => setEdit(r)} aria-label="Editar reseña" className="btn btn-sm"><Pencil size={13} /></button>
      {puedeEliminar && <button disabled={pending} onClick={() => borrar(r)} aria-label="Eliminar reseña" className="btn btn-sm btn-danger"><Trash2 size={13} /></button>}
    </div>
  )
  const nombre = (r: ResenaUI) => (r.cliente_id && mostrarCliente ? <Link href={`/clientes/${r.cliente_id}`} className="font-medium transition-colors hover:text-rs-lime">{r.nombre}</Link> : <span className="font-medium">{r.nombre}</span>)

  if (resenas.length === 0) return <div className="card"><EstadoVacio icono={<Star size={26} />} titulo="No hay reseñas para mostrar" texto="Cargá las que consigas (Google, encuestas) con “Agregar reseña”." /></div>
  return (
    <>
      <div className="card hidden overflow-x-auto md:block">
        <table className="w-full min-w-[820px]">
          <thead className="border-b border-rs-border"><tr><th className="th">Alta</th><th className="th">Fecha</th><th className="th">Cliente</th>{mostrarSede && <th className="th">Sede</th>}<th className="th">Puntaje</th><th className="th">Comentario</th><th className="th">Origen</th>{puedeEscribir && <th className="th text-right">Acciones</th>}</tr></thead>
          <tbody>
            {resenas.map((r, i) => (
              <tr key={r.id} className="reveal border-b border-rs-border/60 align-top transition-colors last:border-0 hover:bg-rs-raised/50" style={{ ['--i' as string]: Math.min(i, 12) }}>
                <td className="td whitespace-nowrap text-xs text-rs-muted">{fechaHoraLarga(r.creado_en)}</td>
                <td className="td whitespace-nowrap">{fechaCorta(r.fecha)}</td>
                <td className="td">{nombre(r)}<div className="text-xs text-rs-muted">{r.telefono}</div></td>
                {mostrarSede && <td className="td text-rs-muted">{r.sucursal_id ? nombresSede[r.sucursal_id] ?? '—' : '—'}</td>}
                <td className="td"><Estrellas n={r.puntaje} /></td>
                <td className="td max-w-[320px] whitespace-pre-wrap text-rs-muted">{r.comentario ?? '—'}</td>
                <td className="td"><span className="badge bg-rs-raised text-rs-text">{labelOrigen(r.origen)}</span></td>
                {puedeEscribir && <td className="td">{acciones(r)}</td>}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <ul className="space-y-3 md:hidden">
        {resenas.map((r, i) => (
          <li key={r.id} className="reveal card p-4" style={{ ['--i' as string]: Math.min(i, 8) }}>
            <div className="flex items-start justify-between gap-3"><div>{nombre(r)}<div className="text-xs text-rs-muted">{fechaCorta(r.fecha)} · {labelOrigen(r.origen)}{mostrarSede && r.sucursal_id ? ` · ${nombresSede[r.sucursal_id] ?? ''}` : ''}</div></div><Estrellas n={r.puntaje} /></div>
            {r.comentario && <p className="mt-2 whitespace-pre-wrap text-sm text-rs-muted">{r.comentario}</p>}
            <p className="mt-2 text-[11px] text-rs-muted/70">Alta {fechaHoraLarga(r.creado_en)}</p>
            {puedeEscribir && <div className="mt-3 border-t border-rs-border/60 pt-3">{acciones(r)}</div>}
          </li>
        ))}
      </ul>
      {edit && <Modal titulo="Editar reseña" onClose={() => setEdit(null)}><ResenaForm resena={edit} sedes={sedes} hoy={hoy} onDone={() => setEdit(null)} /></Modal>}
    </>
  )
}
