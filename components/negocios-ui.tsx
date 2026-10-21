'use client'

import { useActionState, useEffect, useState } from 'react'
import { Pencil, Plus } from 'lucide-react'
import Modal from '@/components/modal'
import type { ActionResult } from '@/app/(panel)/actions'
import { actualizarNegocio, crearNegocio, generarSecretoWebhook } from '@/app/(panel)/admin-actions'

export interface NegocioAdmin {
  id: string
  nombre: string
  slug: string
  whatsapp_nro: string | null
  aforo_maximo_reservas: number | null
  activo: boolean
  apagado_bot: boolean
  estado_inicial: 'nueva' | 'confirmada'
  tiene_secreto: boolean
  usuarios: number
}

const slugify = (s: string) => s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 48)

function Form({ n, onDone }: { n?: NegocioAdmin; onDone: () => void }) {
  const [state, action, pending] = useActionState<ActionResult | null, FormData>(n ? actualizarNegocio : crearNegocio, null)
  const [nombre, setNombre] = useState(n?.nombre ?? '')
  const [slug, setSlug] = useState(n?.slug ?? '')
  const [slugManual, setSlugManual] = useState(false)
  useEffect(() => { if (state?.ok) onDone() }, [state, onDone])
  return (
    <form action={action} className="grid grid-cols-2 gap-3">
      {n && <input type="hidden" name="id" value={n.id} />}
      <div className="col-span-2">
        <label className="label" htmlFor="n_nombre">Nombre *</label>
        <input id="n_nombre" name="nombre" value={nombre} onChange={(e) => { setNombre(e.target.value); if (!n && !slugManual) setSlug(slugify(e.target.value)) }} className="input w-full" required />
      </div>
      <div className="col-span-2">
        <label className="label" htmlFor="n_slug">Identificador {n ? '(no se puede cambiar)' : '*'}</label>
        <input id="n_slug" name="slug" value={slug} onChange={(e) => { setSlug(e.target.value); setSlugManual(true) }} disabled={!!n} className="input w-full font-mono" required={!n} />
      </div>
      <div>
        <label className="label" htmlFor="n_wa">WhatsApp del negocio</label>
        <input id="n_wa" name="whatsapp_nro" inputMode="tel" placeholder="5493415551234" defaultValue={n?.whatsapp_nro ?? ''} className="input w-full" />
      </div>
      <div>
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
      {n && (
        <div className="col-span-2">
          <label className="label" htmlFor="n_estado">Estado de las reservas que llegan por el bot</label>
          <select id="n_estado" name="estado_inicial" defaultValue={n.estado_inicial} className="input w-full">
            <option value="nueva">Nueva (hay que confirmarla desde el panel)</option>
            <option value="confirmada">Confirmada (el bot ya la confirma)</option>
          </select>
        </div>
      )}
      {state && !state.ok && <p role="alert" className="col-span-2 text-sm text-rs-danger">{state.error}</p>}
      <div className="col-span-2 mt-1 flex justify-end gap-2">
        <button type="button" onClick={onDone} className="btn">Cancelar</button>
        <button disabled={pending} className="btn btn-primary">{pending ? 'Guardando…' : n ? 'Guardar cambios' : 'Crear negocio'}</button>
      </div>
    </form>
  )
}

function WebhookBox({ n }: { n: NegocioAdmin }) {
  const [secret, setSecret] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [pending, setPending] = useState(false)
  const url = `${typeof window !== 'undefined' ? window.location.origin : ''}/api/webhooks/reservas/${n.slug}`
  const generar = async () => {
    if (n.tiene_secreto && !confirm('Ya hay un secreto. Si generás uno nuevo, el anterior deja de funcionar y hay que actualizar el bot. ¿Continuar?')) return
    setPending(true); setError(null)
    const r = await generarSecretoWebhook(n.id)
    setPending(false)
    r.ok ? setSecret(r.secret ?? null) : setError(r.error ?? 'Error')
  }
  return (
    <div className="mt-5 border-t border-rs-border pt-4 text-sm">
      <h3 className="card-title">Webhook de reservas (BotConversa / n8n)</h3>
      <p className="mt-1 text-xs text-rs-muted">El bot envía un POST a esta URL, con el secreto en el header <code>X-Webhook-Secret</code>, para crear reservas en este negocio.</p>
      <div className="mt-2 break-all rounded-rs bg-rs-input px-3 py-2 font-mono text-xs">{url}</div>
      <div className="mt-2 flex flex-wrap items-center gap-2">
        <button type="button" disabled={pending} onClick={generar} className="btn btn-sm">{n.tiene_secreto || secret ? 'Generar secreto nuevo' : 'Generar secreto'}</button>
        <span className="text-xs text-rs-muted">{secret ? '' : n.tiene_secreto ? 'Ya tiene un secreto activo (no se puede volver a ver).' : 'Todavía no tiene secreto: el webhook rechaza todo.'}</span>
      </div>
      {secret && (
        <div className="mt-2 rounded-rs border border-rs-lime/40 bg-rs-lime/10 p-3">
          <div className="text-xs text-rs-lime">Copialo ahora: no se vuelve a mostrar.</div>
          <div className="mt-1 break-all font-mono text-xs">{secret}</div>
          <button type="button" onClick={() => navigator.clipboard?.writeText(secret)} className="btn btn-sm mt-2">Copiar</button>
        </div>
      )}
      {error && <p role="alert" className="mt-2 text-sm text-rs-danger">{error}</p>}
    </div>
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
          <thead className="border-b border-rs-border"><tr><th className="th">Negocio</th><th className="th">WhatsApp</th><th className="th">Aforo</th><th className="th">Usuarios</th><th className="th">Botón bot</th><th className="th">Estado</th><th className="th text-right">Acciones</th></tr></thead>
          <tbody>
            {negocios.map((n) => (
              <tr key={n.id} className="border-b border-rs-border/60 last:border-0 hover:bg-rs-raised/40">
                <td className="td"><div className="font-medium">{n.nombre}</div><div className="font-mono text-xs text-rs-muted">{n.slug}</div></td>
                <td className="td text-rs-muted">{n.whatsapp_nro ?? '—'}</td>
                <td className="td">{n.aforo_maximo_reservas ?? '—'}</td>
                <td className="td">{n.usuarios}</td>
                <td className="td">{n.apagado_bot ? <span className="badge bg-rs-lime/15 text-rs-lime">Habilitado</span> : <span className="text-rs-muted">—</span>}</td>
                <td className="td">{n.activo ? <span className="badge bg-rs-ok/15 text-rs-ok">Activo</span> : <span className="badge bg-rs-danger/15 text-rs-danger">Inactivo</span>}</td>
                <td className="td"><div className="flex justify-end"><button onClick={() => setEditando(n)} className="btn btn-sm"><Pencil size={13} /> Editar</button></div></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {nuevo && <Modal titulo="Nuevo negocio" onClose={() => setNuevo(false)}><Form onDone={() => setNuevo(false)} /></Modal>}
      {editando && <Modal titulo={`Editar ${editando.nombre}`} onClose={() => setEditando(null)}><Form n={editando} onDone={() => setEditando(null)} /><WebhookBox n={editando} /></Modal>}
    </div>
  )
}
