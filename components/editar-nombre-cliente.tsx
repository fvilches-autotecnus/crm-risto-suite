'use client'

import { useEffect, useState } from 'react'
import { Pencil } from 'lucide-react'
import { guardarNombreCliente } from '@/app/(panel)/clientes-actions'
import Modal from '@/components/modal'
import { Spinner } from '@/components/ui'
import { useAccionFormulario } from '@/components/use-accion-formulario'

function NombreForm({ id, nombre, onDone }: { id: string; nombre: string; onDone: () => void }) {
  const { state, pending, formProps } = useAccionFormulario(guardarNombreCliente, { okTexto: 'Nombre actualizado' })
  useEffect(() => { if (state?.ok) onDone() }, [state]) // eslint-disable-line react-hooks/exhaustive-deps
  return (
    <form {...formProps} className="space-y-3" noValidate>
      <input type="hidden" name="id" value={id} />
      <div>
        <label className="label" htmlFor="cl_nombre">Nombre del cliente</label>
        <input id="cl_nombre" name="nombre" defaultValue={nombre === 'Sin nombre' ? '' : nombre} maxLength={120} autoComplete="off" placeholder="Nombre y apellido" className="input w-full" />
      </div>
      <p className="text-xs text-rs-muted">Cambia el nombre en el perfil del cliente y en todas las listas que lo muestran. Las reservas, reseñas y vouchers ya cargados conservan el nombre con el que se escribieron.</p>
      {state && !state.ok && <p role="alert" className="animate-fade-in text-sm text-rs-danger">{state.error}</p>}
      <div className="flex justify-end gap-2">
        <button type="button" onClick={onDone} className="btn">Cancelar</button>
        <button disabled={pending} className="btn btn-primary">{pending && <Spinner />}{pending ? 'Guardando…' : 'Guardar nombre'}</button>
      </div>
    </form>
  )
}

/** Lápiz para corregir el nombre de un cliente (en la ficha y en la lista). */
export default function EditarNombreCliente({ id, nombre, conTexto = false }: { id: string; nombre: string; conTexto?: boolean }) {
  const [abierto, setAbierto] = useState(false)
  return (
    <>
      <button type="button" onClick={() => setAbierto(true)} aria-label={`Editar el nombre de ${nombre}`} title="Editar nombre" className={conTexto ? 'btn btn-sm' : 'ml-1.5 inline-flex rounded-md p-1 text-rs-muted transition hover:bg-rs-raised hover:text-rs-lime'}>
        <Pencil size={conTexto ? 13 : 12} />{conTexto && 'Editar nombre'}
      </button>
      {abierto && <Modal titulo="Editar nombre" onClose={() => setAbierto(false)}><NombreForm id={id} nombre={nombre} onDone={() => setAbierto(false)} /></Modal>}
    </>
  )
}
