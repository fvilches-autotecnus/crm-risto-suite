'use client'

import { useEffect, useState, useTransition } from 'react'
import { Cake, Pencil, Plus, X } from 'lucide-react'
import { guardarCumple, quitarCumple } from '@/app/(panel)/modulos-actions'
import { useConfirm, useToast } from '@/components/feedback'
import { TelefonoInput } from '@/components/inputs'
import Modal from '@/components/modal'
import { useAccionFormulario } from '@/components/use-accion-formulario'
import { Spinner } from '@/components/ui'

const MESES = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre']

function CumpleForm({ cliente, onDone }: { cliente?: { id: string; nombre: string; dia: number | null; mes: number | null; anio?: number | null }; onDone: () => void }) {
  const { state, pending, formProps } = useAccionFormulario(guardarCumple, { okTexto: 'Cumpleaños guardado' })
  useEffect(() => { if (state?.ok) onDone() }, [state]) // eslint-disable-line react-hooks/exhaustive-deps
  return (
    <form {...formProps} className="grid grid-cols-2 gap-3">
      {cliente ? <input type="hidden" name="cliente_id" value={cliente.id} /> : (
        <>
          <div className="col-span-2"><label className="label" htmlFor="c_nombre">Nombre *</label><input id="c_nombre" name="nombre" className="input w-full" required /></div>
          <div className="col-span-2"><TelefonoInput name="telefono" label="Teléfono *" required /></div>
        </>
      )}
      <div><label className="label" htmlFor="c_dia">Día *</label><input id="c_dia" name="dia" type="number" min={1} max={31} defaultValue={cliente?.dia ?? ''} className="input w-full" required /></div>
      <div>
        <label className="label" htmlFor="c_mes">Mes *</label>
        <select id="c_mes" name="mes" defaultValue={cliente?.mes ?? ''} className="input w-full" required>
          <option value="" disabled>Elegí…</option>
          {MESES.map((m, i) => <option key={m} value={i + 1}>{m}</option>)}
        </select>
      </div>
      <div className="col-span-2"><label className="label" htmlFor="c_anio">Año de nacimiento <span className="font-normal normal-case text-rs-muted">(opcional, para mostrar la edad)</span></label><input id="c_anio" name="anio" type="number" inputMode="numeric" min={1900} max={new Date().getFullYear()} placeholder="Ej. 1990" defaultValue={cliente?.anio ?? ''} className="input w-full" /></div>
      {!cliente && <p className="col-span-2 -mt-1 text-xs text-rs-muted">Si el teléfono ya es de un cliente, se le carga el cumpleaños; si no, se crea el cliente con este nombre.</p>}
      {state && !state.ok && <p role="alert" className="col-span-2 animate-fade-in text-sm text-rs-danger">{state.error}</p>}
      <div className="col-span-2 flex justify-end gap-2">
        <button type="button" onClick={onDone} className="btn">Cancelar</button>
        <button disabled={pending} className="btn btn-primary">{pending && <Spinner />}Guardar</button>
      </div>
    </form>
  )
}

export function AgregarCumpleBtn() {
  const [abierto, setAbierto] = useState(false)
  return (
    <>
      <button onClick={() => setAbierto(true)} className="btn btn-primary"><Plus size={16} /> Agregar cumpleaños</button>
      {abierto && <Modal titulo="Agregar cumpleaños" onClose={() => setAbierto(false)}><CumpleForm onDone={() => setAbierto(false)} /></Modal>}
    </>
  )
}

export function EditarCumple({ cliente, soloIcono = false }: { cliente: { id: string; nombre: string; dia: number | null; mes: number | null; anio?: number | null }; soloIcono?: boolean }) {
  const [abierto, setAbierto] = useState(false)
  const [pending, start] = useTransition()
  const confirmar = useConfirm()
  const toast = useToast()
  return (
    <>
      <button onClick={() => setAbierto(true)} className="btn btn-sm" aria-label={`Editar cumpleaños de ${cliente.nombre}`}>{cliente.dia ? <Pencil size={13} /> : <Cake size={13} />}{soloIcono ? '' : cliente.dia ? 'Editar' : 'Cargar cumpleaños'}</button>
      {cliente.dia && !soloIcono && (
        <button
          disabled={pending}
          onClick={async () => { if (await confirmar({ titulo: `¿Quitar el cumpleaños de ${cliente.nombre}?`, confirmar: 'Quitar', peligro: true })) start(async () => { const r = await quitarCumple(cliente.id); toast(r.ok ? { texto: 'Cumpleaños quitado' } : { tipo: 'error', texto: r.error ?? 'Error' }) }) }}
          aria-label="Quitar cumpleaños" className="btn btn-sm btn-danger"
        ><X size={13} /></button>
      )}
      {abierto && <Modal titulo={`Cumpleaños de ${cliente.nombre}`} onClose={() => setAbierto(false)}><CumpleForm cliente={cliente} onDone={() => setAbierto(false)} /></Modal>}
    </>
  )
}
