'use client'

import {useEffect, useState, useTransition} from 'react'
import { KeyRound, Plus, ShieldCheck, Trash2, UserCog } from 'lucide-react'
import { useConfirm, useToast } from '@/components/feedback'
import Modal from '@/components/modal'
import { useAccionFormulario } from '@/components/use-accion-formulario'
import { Spinner } from '@/components/ui'
import type { ActionResult } from '@/app/(panel)/actions'
import { activarMembresia, activarUsuario, agregarMembresia, cambiarRol, crearUsuario, guardarSedesMembresia, quitarMembresia, resetearPassword } from '@/app/(panel)/admin-actions'
import { ROLES, ROLES_BAJOS, labelRol, type MembresiaUI, type UsuarioUI } from '@/lib/roles'
import type { Rol } from '@/lib/context'

interface Props {
  usuarios: UsuarioUI[]
  negocios: { id: string; nombre: string }[]
  sedesPorNegocio: Record<string, { id: string; nombre: string }[]> // sedes que quien mira puede asignar
  nombresSede: Record<string, string>                                 // id -> nombre, para mostrar
  modo: 'global' | 'negocio'          // global: superadmin ve todos los negocios; negocio: dueño/admin del negocio activo
  negocioActual: string
  esSuperadmin: boolean
  miRol: Rol | 'superadmin'
  yoId: string
}

function rolesAsignables(miRol: Props['miRol']): Rol[] {
  if (miRol === 'superadmin' || miRol === 'owner') return ROLES.map((r) => r.value)
  return ROLES_BAJOS // admin
}

function Error({ msg }: { msg: string | null }) {
  return msg ? <p role="alert" className="mt-2 text-sm text-rs-danger">{msg}</p> : null
}

function NuevoUsuario({ p, onDone }: { p: Props; onDone: () => void }) {
  const { state, pending, formProps } = useAccionFormulario(crearUsuario)
  const [esSuper, setEsSuper] = useState(false)
  const [negocioElegido, setNegocioElegido] = useState(p.modo === 'global' ? '' : p.negocioActual)
  const toast = useToast()
  useEffect(() => { if (state?.ok) { toast({ texto: 'Usuario creado' }); onDone() } }, [state]) // eslint-disable-line react-hooks/exhaustive-deps
  const roles = rolesAsignables(p.miRol)
  const sedesNegocio = p.sedesPorNegocio[negocioElegido] ?? []
  return (
    <form {...formProps} className="grid grid-cols-2 gap-3">
      <div>
        <label className="label" htmlFor="u_usuario">Usuario *</label>
        <input id="u_usuario" name="usuario" autoCapitalize="none" autoComplete="off" placeholder="ej. juan.perez" className="input w-full" required />
      </div>
      <div>
        <label className="label" htmlFor="u_nombre">Nombre *</label>
        <input id="u_nombre" name="nombre" autoComplete="off" className="input w-full" required />
      </div>
      <div className="col-span-2">
        <label className="label" htmlFor="u_password">Contraseña inicial * (mínimo 8)</label>
        <input id="u_password" name="password" type="text" autoComplete="off" minLength={8} className="input w-full font-mono" required />
        <p className="mt-1 text-xs text-rs-muted">Pasásela a la persona; puede pedir que se la cambien cuando quiera.</p>
      </div>
      {p.esSuperadmin && (
        <label className="col-span-2 flex items-center gap-2 text-sm">
          <input type="checkbox" name="es_superadmin" checked={esSuper} onChange={(e) => setEsSuper(e.target.checked)} className="h-4 w-4 accent-[#c8e62b]" />
          Es superadmin de Risto Suite (ve y administra todos los negocios)
        </label>
      )}
      {!esSuper && (
        <>
          {p.modo === 'global' ? (
            <div>
              <label className="label" htmlFor="u_negocio">Negocio *</label>
              <select id="u_negocio" name="negocio_id" className="input w-full" required defaultValue="" onChange={(e) => setNegocioElegido(e.target.value)}>
                <option value="" disabled>Elegí…</option>
                {p.negocios.map((n) => <option key={n.id} value={n.id}>{n.nombre}</option>)}
              </select>
            </div>
          ) : <input type="hidden" name="negocio_id" value={p.negocioActual} />}
          <div>
            <label className="label" htmlFor="u_rol">Rol *</label>
            <select id="u_rol" name="rol" className="input w-full" required defaultValue="staff">
              {ROLES.filter((r) => roles.includes(r.value)).map((r) => <option key={r.value} value={r.value}>{r.label}</option>)}
            </select>
          </div>
        </>
      )}
      {!esSuper && sedesNegocio.length > 0 && (
        <fieldset className="col-span-2">
          <legend className="label">Acceso a sedes</legend>
          <div className="flex flex-wrap gap-x-4 gap-y-1.5 text-sm">
            {sedesNegocio.map((x) => <label key={x.id} className="inline-flex items-center gap-2"><input type="checkbox" name="sucursal_ids" value={x.id} className="h-4 w-4 accent-[#c8e62b]" />{x.nombre}</label>)}
          </div>
          <p className="mt-1 text-xs text-rs-muted">Si no marcás ninguna, tiene acceso a todas las sedes.</p>
        </fieldset>
      )}
      {state && !state.ok && <p role="alert" className="col-span-2 text-sm text-rs-danger">{state.error}</p>}
      <div className="col-span-2 mt-1 flex justify-end gap-2">
        <button type="button" onClick={onDone} className="btn">Cancelar</button>
        <button disabled={pending} className="btn btn-primary">{pending && <Spinner />}{pending ? 'Creando…' : 'Crear usuario'}</button>
      </div>
    </form>
  )
}

function Accesos({ u, p, onClose }: { u: UsuarioUI; p: Props; onClose: () => void }) {
  const [pending, start] = useTransition()
  const [error, setError] = useState<string | null>(null)
  const [nuevoNegocio, setNuevoNegocio] = useState('')
  const [nuevoRol, setNuevoRol] = useState<Rol>('staff')
  const toast = useToast()
  const confirmar = useConfirm()
  const correr = (fn: () => Promise<ActionResult>, ok = 'Cambios guardados') => start(async () => { setError(null); const r = await fn(); if (r.ok) toast({ texto: ok }); else setError(r.error ?? 'Error') })
  const permitidos = rolesAsignables(p.miRol)
  const yo = u.id === p.yoId

  const disponibles = p.negocios.filter((n) => !u.membresias.some((m) => m.negocio_id === n.id))
  return (
    <Modal titulo={`Accesos de ${u.nombre}`} onClose={onClose}>
      <p className="mb-3 text-sm text-rs-muted">@{u.usuario}{u.es_superadmin ? ' · superadmin' : ''}</p>
      <ul className="divide-y divide-rs-border/60">
        {u.membresias.length === 0 && <li className="py-3 text-sm text-rs-muted">No pertenece a ningún negocio.</li>}
        {u.membresias.map((m) => {
          const editable = !yo && (p.miRol === 'superadmin' || p.miRol === 'owner' || ROLES_BAJOS.includes(m.rol))
          return (
            <li key={m.negocio_id} className="flex flex-wrap items-center gap-2 py-2.5 text-sm">
              <span className="min-w-[120px] flex-1 font-medium">{m.negocio_nombre}{!m.activo && <span className="ml-2 text-xs text-rs-muted">(inactivo)</span>}</span>
              <select
                aria-label={`Rol en ${m.negocio_nombre}`}
                value={m.rol}
                disabled={!editable || pending}
                onChange={(e) => correr(() => cambiarRol(u.id, m.negocio_id, e.target.value as Rol))}
                className="input h-8 text-xs"
              >
                {ROLES.filter((r) => permitidos.includes(r.value) || r.value === m.rol).map((r) => <option key={r.value} value={r.value} disabled={!permitidos.includes(r.value)}>{r.label}</option>)}
              </select>
              <button disabled={!editable || pending} onClick={() => correr(() => activarMembresia(u.id, m.negocio_id, !m.activo))} className="btn btn-sm">{m.activo ? 'Desactivar' : 'Activar'}</button>
              <button
                disabled={!editable || pending}
                onClick={async () => { if (await confirmar({ titulo: `¿Quitar a ${u.nombre} de ${m.negocio_nombre}?`, texto: 'Pierde el acceso a este negocio.', confirmar: 'Quitar', peligro: true })) correr(() => quitarMembresia(u.id, m.negocio_id), 'Usuario quitado del negocio') }}
                aria-label="Quitar del negocio" className="btn btn-sm btn-danger"
              ><Trash2 size={13} /></button>
              {(p.sedesPorNegocio[m.negocio_id]?.length ?? 0) > 0 && (
                <SedesDeAcceso userId={u.id} m={m} sedes={p.sedesPorNegocio[m.negocio_id]} nombresSede={p.nombresSede} editable={editable} correr={correr} pending={pending} />
              )}
            </li>
          )
        })}
      </ul>
      {p.esSuperadmin && disponibles.length > 0 && (
        <div className="mt-4 flex flex-wrap items-end gap-2 border-t border-rs-border pt-4">
          <div className="min-w-[160px] flex-1">
            <label className="label" htmlFor="m_negocio">Agregar a otro negocio</label>
            <select id="m_negocio" value={nuevoNegocio} onChange={(e) => setNuevoNegocio(e.target.value)} className="input w-full">
              <option value="">Elegí…</option>
              {disponibles.map((n) => <option key={n.id} value={n.id}>{n.nombre}</option>)}
            </select>
          </div>
          <select aria-label="Rol" value={nuevoRol} onChange={(e) => setNuevoRol(e.target.value as Rol)} className="input">
            {ROLES.map((r) => <option key={r.value} value={r.value}>{r.label}</option>)}
          </select>
          <button disabled={!nuevoNegocio || pending} onClick={() => correr(() => agregarMembresia(u.id, nuevoNegocio, nuevoRol))} className="btn btn-primary">Agregar</button>
        </div>
      )}
      <Error msg={error} />
    </Modal>
  )
}

function SedesDeAcceso({ userId, m, sedes, nombresSede, editable, correr, pending }: { userId: string; m: MembresiaUI; sedes: { id: string; nombre: string }[]; nombresSede: Record<string, string>; editable: boolean; correr: (fn: () => Promise<ActionResult>) => void; pending: boolean }) {
  const [sel, setSel] = useState<string[]>(m.sucursal_ids)
  const igual = sel.length === m.sucursal_ids.length && sel.every((x) => m.sucursal_ids.includes(x))
  return (
    <div className="mt-1 w-full rounded-rs bg-rs-raised/50 px-3 py-2">
      <div className="mb-1 text-xs text-rs-muted">Acceso a sedes — {m.sucursal_ids.length === 0 ? 'todas' : m.sucursal_ids.map((id) => nombresSede[id] ?? '—').join(', ')}</div>
      <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5 text-sm">
        {sedes.map((x) => (
          <label key={x.id} className="inline-flex items-center gap-2">
            <input type="checkbox" disabled={!editable || pending} checked={sel.includes(x.id)} onChange={(e) => setSel(e.target.checked ? [...sel, x.id] : sel.filter((i) => i !== x.id))} className="h-4 w-4 accent-[#c8e62b]" />{x.nombre}
          </label>
        ))}
        {editable && <button disabled={igual || pending} onClick={() => correr(() => guardarSedesMembresia(userId, m.negocio_id, sel))} className="btn btn-sm btn-primary">Guardar sedes</button>}
      </div>
      <p className="mt-1 text-[11px] text-rs-muted">Ninguna marcada = todas las sedes.</p>
    </div>
  )
}

function Password({ u, onClose }: { u: UsuarioUI; onClose: () => void }) {
  const toast = useToast()
  const [pass, setPass] = useState('')
  const [pending, start] = useTransition()
  const [error, setError] = useState<string | null>(null)
  const [ok, setOk] = useState(false)
  return (
    <Modal titulo={`Nueva contraseña para ${u.nombre}`} onClose={onClose}>
      <label className="label" htmlFor="np">Contraseña nueva (mínimo 8)</label>
      <input id="np" value={pass} onChange={(e) => setPass(e.target.value)} autoComplete="off" className="input w-full font-mono" />
      <p className="mt-1 text-xs text-rs-muted">Se aplica ya: la persona entra con esta clave la próxima vez.</p>
      <Error msg={error} />
      {ok && <p className="mt-2 text-sm text-rs-ok">Contraseña cambiada.</p>}
      <div className="mt-4 flex justify-end gap-2">
        <button onClick={onClose} className="btn">Cerrar</button>
        <button disabled={pending || pass.length < 8} onClick={() => start(async () => { setError(null); setOk(false); const r = await resetearPassword(u.id, pass); r.ok ? (setOk(true), setPass(''), toast({ texto: `Contraseña de ${u.nombre} cambiada` })) : setError(r.error ?? 'Error') })} className="btn btn-primary">{pending && <Spinner />}Cambiar contraseña</button>
      </div>
    </Modal>
  )
}

export default function GestionUsuarios(p: Props) {
  const [nuevo, setNuevo] = useState(false)
  const [accesos, setAccesos] = useState<string | null>(null)
  const [clave, setClave] = useState<string | null>(null)
  const [pending, start] = useTransition()
  const [error, setError] = useState<string | null>(null)
  const uAccesos = p.usuarios.find((u) => u.id === accesos)
  const uClave = p.usuarios.find((u) => u.id === clave)
  const puedeCrear = p.miRol === 'superadmin' || p.miRol === 'owner' || p.miRol === 'admin'

  return (
    <div>
      <div className="mb-3 flex items-center justify-between gap-3">
        <span className="text-xs text-rs-muted">{p.usuarios.length} usuario{p.usuarios.length === 1 ? '' : 's'}</span>
        {puedeCrear && <button onClick={() => setNuevo(true)} className="btn btn-primary"><Plus size={16} /> Nuevo usuario</button>}
      </div>
      {error && <p role="alert" className="mb-3 text-sm text-rs-danger">{error}</p>}
      <div className="card overflow-x-auto">
        <table className="w-full min-w-[640px]">
          <thead className="border-b border-rs-border"><tr><th className="th">Usuario</th><th className="th">Accesos</th><th className="th">Estado</th><th className="th text-right">Acciones</th></tr></thead>
          <tbody>
            {p.usuarios.length === 0 && <tr><td colSpan={4} className="td py-8 text-center text-rs-muted">Todavía no hay usuarios.</td></tr>}
            {p.usuarios.map((u) => (
              <tr key={u.id} className="border-b border-rs-border/60 last:border-0 hover:bg-rs-raised/40">
                <td className="td"><div className="font-medium">{u.nombre} {u.es_superadmin && <ShieldCheck size={14} className="ml-1 inline text-rs-lime" aria-label="Superadmin" />}</div><div className="text-xs text-rs-muted">@{u.usuario}</div></td>
                <td className="td">
                  <div className="flex flex-wrap gap-1.5">
                    {u.es_superadmin && u.membresias.length === 0 && <span className="badge bg-rs-lime/15 text-rs-lime">Todos los negocios</span>}
                    {u.membresias.map((m) => <span key={m.negocio_id} className={'badge ' + (m.activo ? 'bg-rs-raised text-rs-text' : 'bg-rs-raised text-rs-muted line-through')}>{p.modo === 'global' ? `${m.negocio_nombre} · ` : ''}{labelRol(m.rol)}{m.sucursal_ids.length > 0 ? ` · ${m.sucursal_ids.map((id) => p.nombresSede[id] ?? '—').join(', ')}` : ''}</span>)}
                  </div>
                </td>
                <td className="td">{u.activo ? <span className="badge bg-rs-ok/15 text-rs-ok">Activo</span> : <span className="badge bg-rs-danger/15 text-rs-danger">Desactivado</span>}</td>
                <td className="td">
                  <div className="flex justify-end gap-1.5">
                    <button onClick={() => setAccesos(u.id)} className="btn btn-sm"><UserCog size={13} /> Accesos</button>
                    {(p.esSuperadmin || !u.es_superadmin) && <button onClick={() => setClave(u.id)} className="btn btn-sm"><KeyRound size={13} /> Contraseña</button>}
                    {p.esSuperadmin && u.id !== p.yoId && (
                      <button disabled={pending} onClick={() => start(async () => { setError(null); const r = await activarUsuario(u.id, !u.activo); if (!r.ok) setError(r.error ?? 'Error') })} className={'btn btn-sm ' + (u.activo ? 'btn-danger' : '')}>{u.activo ? 'Desactivar' : 'Activar'}</button>
                    )}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {nuevo && <Modal titulo="Nuevo usuario" onClose={() => setNuevo(false)}><NuevoUsuario p={p} onDone={() => setNuevo(false)} /></Modal>}
      {uAccesos && <Accesos u={uAccesos} p={p} onClose={() => setAccesos(null)} />}
      {uClave && <Password u={uClave} onClose={() => setClave(null)} />}
    </div>
  )
}
