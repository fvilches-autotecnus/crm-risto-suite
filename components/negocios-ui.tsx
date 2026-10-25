'use client'

import {useEffect, useState} from 'react'
import { useRouter } from 'next/navigation'
import { Pencil, Plus } from 'lucide-react'
import { useToast } from '@/components/feedback'
import { TelefonoInput } from '@/components/inputs'
import Modal from '@/components/modal'
import ModulosPicker from '@/components/modulos-picker'
import { MODULOS, resolverModulos, type ModulosActivos } from '@/lib/modulos'
import { fechaHoraLarga } from '@/lib/fechas'
import { useAccionFormulario } from '@/components/use-accion-formulario'
import { Spinner } from '@/components/ui'
import type { ActionResult } from '@/app/(panel)/actions'
import { actualizarNegocio, crearNegocio } from '@/app/(panel)/admin-actions'
import { cambiarNegocio } from '@/app/(panel)/actions'

export interface NegocioAdmin {
  id: string
  nombre: string
  slug: string
  whatsapp_nro: string | null
  aforo_maximo_reservas: number | null
  activo: boolean
  apagado_bot: boolean
  modulos: ModulosActivos
  usuarios: number
  sedes: number
  creado_en: string
}

const slugify = (s: string) => s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 48)

function Form({ n, onDone }: { n?: NegocioAdmin; onDone: () => void }) {
  const { state, pending, formProps } = useAccionFormulario(n ? actualizarNegocio : crearNegocio)
  const toast = useToast()
  const [nombre, setNombre] = useState(n?.nombre ?? '')
  const [slug, setSlug] = useState(n?.slug ?? '')
  const [slugManual, setSlugManual] = useState(false)
  useEffect(() => { if (state?.ok) { toast({ texto: n ? 'Negocio actualizado' : 'Negocio creado' }); onDone() } }, [state]) // eslint-disable-line react-hooks/exhaustive-deps
  return (
    <form {...formProps} className="grid grid-cols-2 gap-3">
      {n && <input type="hidden" name="id" value={n.id} />}
      <div className="col-span-2">
        <label className="label" htmlFor="n_nombre">Nombre *</label>
        <input id="n_nombre" name="nombre" value={nombre} onChange={(e) => { setNombre(e.target.value); if (!n && !slugManual) setSlug(slugify(e.target.value)) }} className="input w-full" required />
      </div>
      <div className="col-span-2">
        <label className="label" htmlFor="n_slug">Identificador {n ? '(no se puede cambiar)' : '*'}</label>
        <input id="n_slug" name="slug" value={slug} onChange={(e) => { setSlug(e.target.value); setSlugManual(true) }} disabled={!!n} className="input w-full font-mono" required={!n} />
      </div>
      <div className="col-span-2">
        <TelefonoInput name="whatsapp_nro" label="WhatsApp del negocio" defaultValue={n?.whatsapp_nro ?? ''} />
      </div>
      <div className="col-span-2 sm:col-span-1">
        <label className="label" htmlFor="n_aforo">Aforo máximo por día</label>
        <input id="n_aforo" name="aforo" type="number" min={1} placeholder="Sin límite" defaultValue={n?.aforo_maximo_reservas ?? ''} className="input w-full" />
      </div>
      <label className="col-span-2 flex items-start gap-2 text-sm">
        <input type="checkbox" name="apagado_bot" defaultChecked={n?.apagado_bot ?? false} className="mt-0.5 h-4 w-4 accent-[#c8e62b]" />
        <span><span className="font-medium">Botón de apagado del bot</span><span className="block text-xs text-rs-muted">Permite a dueños, administradores y encargados apagar el bot de WhatsApp.</span></span>
      </label>
      {n && (
        <label className="col-span-2 flex items-center gap-2 text-sm">
          <input type="checkbox" name="activo" defaultChecked={n.activo} className="h-4 w-4 accent-[#c8e62b]" /> Negocio activo (si se desmarca, sus usuarios no lo ven)
        </label>
      )}
      <details open={!n} className="col-span-2 rounded-md border border-rs-border p-3">
        <summary className="cursor-pointer text-sm font-semibold">Módulos del negocio <span className="font-normal text-rs-muted">· {MODULOS.filter((m) => (n?.modulos ?? resolverModulos(null))[m.clave]).length} de {MODULOS.length} encendidos</span></summary>
        <div className="mt-3"><ModulosPicker valores={n?.modulos ?? resolverModulos(null)} /></div>
      </details>
      {state && !state.ok && <p role="alert" className="col-span-2 text-sm text-rs-danger">{state.error}</p>}
      <div className="col-span-2 mt-1 flex justify-end gap-2">
        <button type="button" onClick={onDone} className="btn">Cancelar</button>
        <button disabled={pending} className="btn btn-primary">{pending && <Spinner />}{pending ? 'Guardando…' : n ? 'Guardar cambios' : 'Crear negocio'}</button>
      </div>
    </form>
  )
}

/** Cambia el negocio activo y abre Configuración en la sección de sedes. */
function IrASedes({ id }: { id: string }) {
  const router = useRouter()
  return (
    <form action={async (fd) => { await cambiarNegocio(fd); router.push('/configuracion#sedes') }}>
      <input type="hidden" name="negocio_id" value={id} />
      <button className="btn btn-sm">Sedes</button>
    </form>
  )
}

export default function GestionNegocios({ negocios }: { negocios: NegocioAdmin[] }) {
  const [nuevo, setNuevo] = useState(false)
  const [editando, setEditando] = useState<NegocioAdmin | null>(null)
  return (
    <div>
      <div className="mb-3 flex items-center justify-between gap-3">
        <span className="text-xs text-rs-muted">{negocios.length} negocio{negocios.length === 1 ? '' : 's'}</span>
        <button onClick={() => setNuevo(true)} className="btn btn-primary"><Plus size={16} /> Nuevo negocio</button>
      </div>
      <div className="card overflow-x-auto">
        <table className="w-full min-w-[640px]">
          <thead className="border-b border-rs-border"><tr><th className="th">Negocio</th><th className="th">Módulos</th><th className="th">WhatsApp</th><th className="th">Aforo</th><th className="th">Usuarios</th><th className="th">Sedes</th><th className="th">Botón bot</th><th className="th">Estado</th><th className="th">Alta</th><th className="th text-right">Acciones</th></tr></thead>
          <tbody>
            {negocios.map((n) => (
              <tr key={n.id} className="border-b border-rs-border/60 last:border-0 hover:bg-rs-raised/40">
                <td className="td"><div className="font-medium">{n.nombre}</div><div className="font-mono text-xs text-rs-muted">{n.slug}</div></td>
                <td className="td"><div className="flex flex-wrap gap-1">{MODULOS.filter((m) => m.grupo === 'Operación' && n.modulos[m.clave]).map((m) => <span key={m.clave} className="badge bg-rs-lime/15 text-rs-lime">{m.titulo}</span>)}<span className="text-xs text-rs-muted">{MODULOS.filter((m) => m.grupo !== 'Operación' && n.modulos[m.clave]).length} más</span></div></td>
                <td className="td text-rs-muted">{n.whatsapp_nro ?? '—'}</td>
                <td className="td">{n.aforo_maximo_reservas ?? '—'}</td>
                <td className="td">{n.usuarios}</td>
                <td className="td">{n.sedes || <span className="text-rs-muted">—</span>}</td>
                <td className="td">{n.apagado_bot ? <span className="badge bg-rs-lime/15 text-rs-lime">Habilitado</span> : <span className="text-rs-muted">—</span>}</td>
                <td className="td">{n.activo ? <span className="badge bg-rs-ok/15 text-rs-ok">Activo</span> : <span className="badge bg-rs-danger/15 text-rs-danger">Inactivo</span>}</td>
                <td className="td whitespace-nowrap text-xs text-rs-muted">{fechaHoraLarga(n.creado_en)}</td>
                <td className="td"><div className="flex justify-end gap-1.5"><button onClick={() => setEditando(n)} className="btn btn-sm"><Pencil size={13} /> Editar</button><IrASedes id={n.id} /></div></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {nuevo && <Modal titulo="Nuevo negocio" onClose={() => setNuevo(false)}><Form onDone={() => setNuevo(false)} /></Modal>}
      {editando && <Modal titulo={`Editar ${editando.nombre}`} onClose={() => setEditando(null)}><Form n={editando} onDone={() => setEditando(null)} /></Modal>}
    </div>
  )
}
