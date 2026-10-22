'use client'

import { useState, useTransition } from 'react'
import { Check, Copy, Gift, Plus, RotateCcw, Ticket, Trash2 } from 'lucide-react'
import { cambiarEstadoVoucher, crearVoucher, eliminarVoucher } from '@/app/(panel)/modulos-actions'
import { useConfirm, useToast } from '@/components/feedback'
import Modal from '@/components/modal'
import { useAccionFormulario } from '@/components/use-accion-formulario'
import { EstadoVacio, Spinner } from '@/components/ui'
import { fechaCorta } from '@/lib/fechas'
import { labelCampana } from '@/lib/vouchers'
import { useEffect } from 'react'

export interface VoucherUI {
  id: string
  codigo: string
  nombre: string | null
  telefono: string | null
  beneficio: string | null
  campana: string | null
  estado: 'vigente' | 'usado' | 'anulado'
  vence_el: string | null
  creado_en: string
}


function VoucherForm({ prefill, onDone }: { prefill?: { cliente_id?: string; nombre?: string; telefono?: string; campana?: string }; onDone: () => void }) {
  const { state, pending, formProps } = useAccionFormulario(crearVoucher, { okTexto: 'Voucher creado' })
  const [campana, setCampana] = useState(prefill?.campana ?? 'cumpleanos')
  useEffect(() => { if (state?.ok) onDone() }, [state]) // eslint-disable-line react-hooks/exhaustive-deps
  return (
    <form {...formProps} className="grid grid-cols-2 gap-3">
      {prefill?.cliente_id && <input type="hidden" name="cliente_id" value={prefill.cliente_id} />}
      <div className="col-span-2 sm:col-span-1"><label className="label" htmlFor="v_nombre">Nombre</label><input id="v_nombre" name="nombre" defaultValue={prefill?.nombre ?? ''} className="input w-full" /></div>
      <div className="col-span-2 sm:col-span-1"><label className="label" htmlFor="v_tel">Teléfono</label><input id="v_tel" name="telefono" inputMode="tel" placeholder="5493415551234" defaultValue={prefill?.telefono ?? ''} className="input w-full" /></div>
      <div className="col-span-2"><label className="label" htmlFor="v_ben">Beneficio *</label><input id="v_ben" name="beneficio" placeholder='Ej. "1 postre de regalo"' className="input w-full" required /></div>
      <div>
        <label className="label" htmlFor="v_camp">Campaña</label>
        <select id="v_camp" name="campana" value={campana} onChange={(e) => setCampana(e.target.value)} className="input w-full">
          <option value="cumpleanos">Cumpleaños</option><option value="inactividad">Inactividad</option><option value="otra">Otra…</option>
        </select>
      </div>
      {campana === 'otra' ? <div><label className="label" htmlFor="v_otra">Nombre de la campaña</label><input id="v_otra" name="campana_otra" placeholder="Ej. Black Friday" className="input w-full" /></div> : <div />}
      <div><label className="label" htmlFor="v_cod">Código</label><input id="v_cod" name="codigo" placeholder="Se genera solo" className="input w-full font-mono uppercase" /></div>
      <div><label className="label" htmlFor="v_vence">Vence el</label><input id="v_vence" name="vence_el" type="date" className="input w-full" /></div>
      {state && !state.ok && <p role="alert" className="col-span-2 animate-fade-in text-sm text-rs-danger">{state.error}</p>}
      <div className="col-span-2 flex justify-end gap-2">
        <button type="button" onClick={onDone} className="btn">Cancelar</button>
        <button disabled={pending} className="btn btn-primary">{pending && <Spinner />}{pending ? 'Creando…' : 'Crear voucher'}</button>
      </div>
    </form>
  )
}

export function NuevoVoucherBtn({ prefill, etiqueta = 'Nuevo voucher', chico = false }: { prefill?: { cliente_id?: string; nombre?: string; telefono?: string; campana?: string }; etiqueta?: string; chico?: boolean }) {
  const [abierto, setAbierto] = useState(false)
  return (
    <>
      <button onClick={() => setAbierto(true)} className={'btn ' + (chico ? 'btn-sm' : 'btn-primary')}>{chico ? <Gift size={13} /> : <Plus size={16} />}{etiqueta}</button>
      {abierto && <Modal titulo="Nuevo voucher" onClose={() => setAbierto(false)}><VoucherForm prefill={prefill} onDone={() => setAbierto(false)} /></Modal>}
    </>
  )
}

export function BadgeVoucher({ estado, vencido }: { estado: string; vencido: boolean }) {
  const [txt, cls, dot] = vencido ? ['Vencido', 'bg-rs-warn/15 text-rs-warn', 'bg-rs-warn'] : estado === 'vigente' ? ['Vigente', 'bg-rs-ok/15 text-rs-ok', 'bg-rs-ok'] : estado === 'usado' ? ['Usado', 'bg-rs-muted/20 text-rs-muted', 'bg-rs-muted'] : ['Anulado', 'bg-rs-danger/15 text-rs-danger', 'bg-rs-danger']
  return <span className={'badge ' + cls}><span className={'h-1.5 w-1.5 rounded-full ' + dot} />{txt}</span>
}

export function ListaVouchers({ vouchers, hoy, puedeEscribir, puedeEliminar }: { vouchers: VoucherUI[]; hoy: string; puedeEscribir: boolean; puedeEliminar: boolean }) {
  const [pending, start] = useTransition()
  const confirmar = useConfirm()
  const toast = useToast()
  const copiar = async (c: string) => { try { await navigator.clipboard.writeText(c); toast({ texto: `Código ${c} copiado` }) } catch { toast({ tipo: 'error', texto: 'No se pudo copiar' }) } }
  const cambiar = (v: VoucherUI, estado: VoucherUI['estado']) => start(async () => {
    const r = await cambiarEstadoVoucher(v.id, estado)
    toast(r.ok ? { texto: estado === 'usado' ? `Voucher ${v.codigo} marcado como usado` : 'Voucher actualizado', accion: { label: 'Deshacer', onClick: () => { void cambiarEstadoVoucher(v.id, v.estado) } } } : { tipo: 'error', texto: r.error ?? 'Error' })
  })
  const borrar = async (v: VoucherUI) => {
    if (!(await confirmar({ titulo: `¿Eliminar el voucher ${v.codigo}?`, texto: 'Se borra para siempre. Si solo querés invalidarlo, anulalo.', confirmar: 'Eliminar', peligro: true }))) return
    start(async () => { const r = await eliminarVoucher(v.id); toast(r.ok ? { texto: 'Voucher eliminado' } : { tipo: 'error', texto: r.error ?? 'Error' }) })
  }

  if (vouchers.length === 0) return <div className="card"><EstadoVacio icono={<Ticket size={26} />} titulo="No hay vouchers para mostrar" texto="Creá uno con “Nuevo voucher” o desde la pestaña Cumpleaños." /></div>

  const acciones = (v: VoucherUI) => puedeEscribir && (
    <div className="flex justify-end gap-1.5">
      {v.estado === 'vigente' && <button disabled={pending} onClick={() => cambiar(v, 'usado')} className="btn btn-sm text-rs-ok hover:bg-rs-ok/10"><Check size={13} /> Usado</button>}
      {v.estado !== 'vigente' && <button disabled={pending} onClick={() => cambiar(v, 'vigente')} className="btn btn-sm"><RotateCcw size={13} /> Reactivar</button>}
      {v.estado === 'vigente' && <button disabled={pending} onClick={() => cambiar(v, 'anulado')} className="btn btn-sm btn-danger">Anular</button>}
      {puedeEliminar && <button disabled={pending} onClick={() => borrar(v)} aria-label="Eliminar voucher" className="btn btn-sm btn-danger"><Trash2 size={13} /></button>}
    </div>
  )
  const vencido = (v: VoucherUI) => v.estado === 'vigente' && !!v.vence_el && v.vence_el < hoy

  return (
    <>
      <div className="card hidden overflow-x-auto md:block">
        <table className="w-full min-w-[860px]">
          <thead className="border-b border-rs-border"><tr><th className="th">Código</th><th className="th">Nombre</th><th className="th">Teléfono</th><th className="th">Beneficio</th><th className="th">Campaña</th><th className="th">Vence</th><th className="th">Estado</th>{puedeEscribir && <th className="th text-right">Acciones</th>}</tr></thead>
          <tbody>
            {vouchers.map((v, i) => (
              <tr key={v.id} className="reveal border-b border-rs-border/60 transition-colors last:border-0 hover:bg-rs-raised/50" style={{ ['--i' as string]: Math.min(i, 12) }}>
                <td className="td"><button onClick={() => copiar(v.codigo)} title="Copiar código" className="group inline-flex items-center gap-2 font-mono text-sm font-semibold text-rs-lime"><span>{v.codigo}</span><Copy size={12} className="opacity-0 transition group-hover:opacity-100" /></button></td>
                <td className="td font-medium">{v.nombre ?? '—'}</td>
                <td className="td text-rs-muted">{v.telefono ?? '—'}</td>
                <td className="td max-w-[180px] truncate text-rs-muted" title={v.beneficio ?? ''}>{v.beneficio ?? '—'}</td>
                <td className="td text-rs-muted">{labelCampana(v.campana)}</td>
                <td className="td text-rs-muted">{v.vence_el ? fechaCorta(v.vence_el) : 'Sin vencimiento'}</td>
                <td className="td"><BadgeVoucher estado={v.estado} vencido={vencido(v)} /></td>
                {puedeEscribir && <td className="td">{acciones(v)}</td>}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <ul className="space-y-3 md:hidden">
        {vouchers.map((v, i) => (
          <li key={v.id} className="reveal card p-4" style={{ ['--i' as string]: Math.min(i, 8) }}>
            <div className="flex items-start justify-between gap-3">
              <button onClick={() => copiar(v.codigo)} className="inline-flex items-center gap-2 font-mono font-semibold text-rs-lime">{v.codigo}<Copy size={12} /></button>
              <BadgeVoucher estado={v.estado} vencido={vencido(v)} />
            </div>
            <p className="mt-2 text-sm">{v.nombre ?? 'Sin nombre'}{v.telefono ? <span className="text-rs-muted"> · {v.telefono}</span> : null}</p>
            <p className="mt-1 text-sm text-rs-muted">{v.beneficio ?? '—'} · {labelCampana(v.campana)}{v.vence_el ? ` · vence ${fechaCorta(v.vence_el)}` : ''}</p>
            {puedeEscribir && <div className="mt-3 border-t border-rs-border/60 pt-3">{acciones(v)}</div>}
          </li>
        ))}
      </ul>
    </>
  )
}
