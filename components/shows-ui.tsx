'use client'

import { useEffect, useMemo, useState, useTransition } from 'react'
import { Clapperboard, Copy, ExternalLink, Eye, EyeOff, ImageIcon, Link2, MapPin, Pencil, Plus, Trash2 } from 'lucide-react'
import { alternarShow, descartarImagenShow, eliminarShow, guardarShow, subirImagenShow } from '@/app/(panel)/shows-actions'
import { useConfirm, useToast } from '@/components/feedback'
import { FechaInput, HoraInput } from '@/components/inputs'
import Modal from '@/components/modal'
import { EstadoVacio, Spinner } from '@/components/ui'
import { useAccionFormulario } from '@/components/use-accion-formulario'
import { CampoImagen, useCampoImagen } from '@/components/campo-imagen'
import { urlImagen } from '@/lib/carta'
import { fechaLarga, horaCorta } from '@/lib/fechas'
import { MODALIDADES, enlaceReservaShow, modalidadDe, type ModalidadShow, type Show } from '@/lib/shows'

interface Props { shows: Show[]; ubicaciones: { id: string; nombre: string }[]; slug: string; negocio: string; hoy: string; puedeEscribir: boolean; puedeEliminar: boolean }
type Dialogo = { show?: Show }

export default function ShowsAdmin({ shows, ubicaciones, slug, negocio, hoy, puedeEscribir, puedeEliminar }: Props) {
  const toast = useToast()
  const confirmar = useConfirm()
  const [pend, start] = useTransition()
  const [ver, setVer] = useState<'proximos' | 'pasados'>('proximos')
  const [modal, setModal] = useState<Dialogo | null>(null)
  const nombreUbic = useMemo(() => new Map(ubicaciones.map((u) => [u.id, u.nombre])), [ubicaciones])
  const proximos = useMemo(() => shows.filter((s) => s.fecha >= hoy).sort((a, b) => a.fecha.localeCompare(b.fecha) || (a.hora ?? '').localeCompare(b.hora ?? '')), [shows, hoy])
  const pasados = useMemo(() => shows.filter((s) => s.fecha < hoy).sort((a, b) => b.fecha.localeCompare(a.fecha)), [shows, hoy])
  const lista = ver === 'proximos' ? proximos : pasados
  const base = typeof window !== 'undefined' ? window.location.origin : ''

  const copiar = async (texto: string, ok: string) => { try { await navigator.clipboard.writeText(texto); toast({ texto: ok }) } catch { toast({ tipo: 'error', texto: 'No se pudo copiar: ' + texto }) } }
  const ejecutar = (fn: () => Promise<{ ok: boolean; error?: string }>, okTexto?: string) =>
    start(async () => { const r = await fn(); if (!r.ok) toast({ tipo: 'error', texto: r.error ?? 'Ocurrió un error' }); else if (okTexto) toast({ texto: okTexto }) })
  const borrar = async (s: Show) => {
    if (!(await confirmar({ titulo: `¿Eliminar "${s.titulo}"?`, texto: 'Se borra de la cartelera para siempre (y su imagen). Las reservas que ya entraron no se tocan.', confirmar: 'Eliminar', peligro: true }))) return
    ejecutar(() => eliminarShow(s.id), 'Show eliminado')
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div className="animate-fade-up">
          <h1 className="flex items-center gap-2 text-xl font-bold sm:text-2xl"><Clapperboard className="text-rs-lime" size={22} />Shows</h1>
          <p className="text-sm text-rs-muted">Cartelera de shows y eventos de {negocio}, con imagen, fecha y cómo reservar</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <a href={`/shows/${slug}`} target="_blank" rel="noopener noreferrer" className="btn"><ExternalLink size={14} />Ver cartelera pública</a>
          <button type="button" onClick={() => copiar(`${base}/shows/${slug}`, 'Enlace de la cartelera copiado')} className="btn"><Copy size={14} />Copiar enlace</button>
          {puedeEscribir && <button type="button" onClick={() => setModal({})} className="btn btn-primary"><Plus size={14} />Nuevo show</button>}
        </div>
      </div>

      <div className="flex flex-wrap gap-2">
        <button type="button" onClick={() => setVer('proximos')} className={'btn btn-sm ' + (ver === 'proximos' ? 'btn-primary' : '')}>Próximos <span className="opacity-70">{proximos.length}</span></button>
        <button type="button" onClick={() => setVer('pasados')} className={'btn btn-sm ' + (ver === 'pasados' ? 'btn-primary' : '')}>Pasados <span className="opacity-70">{pasados.length}</span></button>
      </div>

      {lista.length === 0 ? (
        <div className="card"><EstadoVacio icono={<Clapperboard size={26} />} titulo={ver === 'proximos' ? 'No hay shows programados' : 'Todavía no hay shows pasados'} texto={ver === 'proximos' ? 'Cargá el primero con “Nuevo show”: aparece en la cartelera pública apenas lo guardás.' : 'Cuando pase la fecha de un show, queda acá.'} /></div>
      ) : (
        <ul className="space-y-3">
          {lista.map((s) => {
            const img = urlImagen(s.imagen_path), ubic = s.ubicacion_id ? nombreUbic.get(s.ubicacion_id) ?? null : null
            return (
              <li key={s.id} data-show={s.titulo} className={'card flex gap-3 p-3 ' + (s.visible ? '' : 'opacity-60')}>
                <div className="h-20 w-32 shrink-0 overflow-hidden rounded-md bg-rs-raised sm:h-24 sm:w-40">
                  {img ? /* eslint-disable-next-line @next/next/no-img-element */ <img src={img} alt={s.titulo} loading="lazy" className="h-full w-full object-cover" /> : <div className="grid h-full w-full place-items-center text-rs-muted"><ImageIcon size={22} /></div>}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                    <h2 className="font-semibold">{s.titulo}</h2>
                    {!s.visible && <span className="badge bg-rs-warn/15 text-rs-warn">Oculto</span>}
                  </div>
                  <p className="text-sm text-rs-muted">{fechaLarga(s.fecha)}{s.hora ? ` · ${horaCorta(s.hora)} hs` : ''}</p>
                  <div className="mt-1.5 flex flex-wrap gap-1.5 text-xs">
                    <span className="badge bg-rs-raised text-rs-text"><MapPin size={11} className="mr-1 inline" />{ubic ?? 'Todo el local'}</span>
                    <span className="badge bg-rs-lime/15 text-rs-lime">{modalidadDe(s.modalidad).label}</span>
                  </div>
                  {puedeEscribir && (
                    <div className="mt-2 flex flex-wrap items-center gap-1.5">
                      <button type="button" disabled={pend} onClick={() => ejecutar(() => alternarShow(s.id))} aria-label={s.visible ? 'Ocultar de la cartelera' : 'Mostrar en la cartelera'} title={s.visible ? 'Ocultar de la cartelera pública' : 'Mostrar en la cartelera pública'} className="btn btn-sm w-8 px-0">{s.visible ? <Eye size={13} /> : <EyeOff size={13} />}</button>
                      <button type="button" onClick={() => setModal({ show: s })} aria-label="Editar show" className="btn btn-sm w-8 px-0"><Pencil size={13} /></button>
                      {s.modalidad === 'reserva' && <button type="button" onClick={() => copiar(base + enlaceReservaShow(slug, s, ubic), 'Enlace de reserva del show copiado')} className="btn btn-sm"><Link2 size={13} />Enlace de reserva</button>}
                      {puedeEliminar && <button type="button" disabled={pend} onClick={() => borrar(s)} aria-label="Eliminar show" className="btn btn-sm btn-danger w-8 px-0"><Trash2 size={13} /></button>}
                    </div>
                  )}
                </div>
              </li>
            )
          })}
        </ul>
      )}

      {modal && <ModalShow show={modal.show} ubicaciones={ubicaciones} onClose={() => setModal(null)} />}
    </div>
  )
}

function ModalShow({ show, ubicaciones, onClose }: { show?: Show; ubicaciones: { id: string; nombre: string }[]; onClose: () => void }) {
  const toast = useToast()
  const { state, pending, formProps } = useAccionFormulario(guardarShow)
  const campo = useCampoImagen({ inicial: show?.imagen_path, subir: subirImagenShow, descartar: descartarImagenShow, palabra: 'imagen', lado: 1400 })
  const [modalidad, setModalidad] = useState<ModalidadShow>(show?.modalidad ?? 'reserva')

  const cerrar = () => { campo.descartarPendientes(); onClose() }
  useEffect(() => { if (state?.ok) { campo.guardado.current = true; toast({ texto: show ? 'Show guardado' : 'Show creado' }); onClose() } }, [state]) // eslint-disable-line react-hooks/exhaustive-deps

  const m = modalidadDe(modalidad)

  return (
    <Modal titulo={show ? 'Editar show' : 'Nuevo show'} onClose={cerrar} ancho="max-w-2xl">
      <form {...formProps} className="grid grid-cols-2 gap-3">
        {show && <input type="hidden" name="id" value={show.id} />}
        <div className="col-span-2"><label className="label" htmlFor="s_titulo">Nombre del show *</label><input id="s_titulo" name="titulo" defaultValue={show?.titulo ?? ''} maxLength={100} className="input w-full" required /></div>
        <div className="col-span-2 sm:col-span-1"><label className="label" htmlFor="s_fecha">Fecha *</label><FechaInput id="s_fecha" name="fecha" defaultValue={show?.fecha ?? ''} required /></div>
        <div className="col-span-2 sm:col-span-1"><label className="label" htmlFor="s_hora">Hora (opcional)</label><HoraInput id="s_hora" name="hora" defaultValue={show?.hora?.slice(0, 5) ?? ''} /></div>
        <div className="col-span-2">
          <label className="label" htmlFor="s_ubic">Dónde es</label>
          <select id="s_ubic" name="ubicacion_id" defaultValue={show?.ubicacion_id ?? ''} className="input w-full">
            <option value="">Todo el local</option>
            {ubicaciones.map((u) => <option key={u.id} value={u.id}>{u.nombre}</option>)}
          </select>
        </div>
        <div className="col-span-2"><label className="label" htmlFor="s_desc">Descripción</label><textarea id="s_desc" name="descripcion" defaultValue={show?.descripcion ?? ''} maxLength={1000} rows={4} placeholder="Artista, repertorio, qué incluye, valor de las entradas…" className="input w-full" /></div>

        <div className="col-span-2">
          <CampoImagen campo={campo} etiqueta="Imagen" vista="apaisada" ayuda="Opcional. Se ve apaisada (16:9): un afiche vertical se recorta." />
        </div>

        <div className="col-span-2">
          <span className="label">¿Cómo se reserva o se entra?</span>
          <div className="space-y-1.5">
            {MODALIDADES.map((x) => (
              <label key={x.clave} className="flex cursor-pointer items-start gap-2 rounded-md border border-rs-control px-3 py-2 text-sm has-[:checked]:border-rs-lime/60 has-[:checked]:bg-rs-lime/10">
                <input type="radio" name="modalidad" value={x.clave} checked={modalidad === x.clave} onChange={() => setModalidad(x.clave)} className="mt-0.5 h-4 w-4 accent-[#c8e62b]" />
                <span><span className="font-medium">{x.label}</span><span className="block text-xs text-rs-muted">{x.ayuda}</span></span>
              </label>
            ))}
          </div>
        </div>
        <div className="col-span-2">
          <label className="label" htmlFor="s_enlace">{modalidad === 'derivada' ? 'WhatsApp o sitio de la producción *' : modalidad === 'entradas' ? 'Enlace de venta de entradas *' : 'Enlace de venta de entradas (opcional)'}</label>
          <input id="s_enlace" name="enlace" defaultValue={show?.enlace ?? ''} maxLength={500} placeholder={modalidad === 'derivada' ? 'Ej. 5493415551234 o https://…' : 'Ej. https://www.entradas.com/mi-show'} className="input w-full" />
          <p className="mt-1 text-xs text-rs-muted">{modalidad === 'reserva' ? 'Si lo completás, además del botón “Reservar mesa” se ve “Comprar entradas”.' : `El botón “${m.boton}” de la cartelera lleva acá.`}</p>
        </div>
        <label className="col-span-2 flex items-center gap-2 text-sm"><input type="checkbox" name="visible" defaultChecked={show?.visible ?? true} className="h-4 w-4 accent-[#c8e62b]" />Visible en la cartelera pública</label>
        {state && !state.ok && <p role="alert" className="col-span-2 text-sm text-rs-danger">{state.error}</p>}
        <div className="col-span-2 mt-2 flex justify-end gap-2">
          <button type="button" onClick={cerrar} className="btn">Cancelar</button>
          <button disabled={pending || campo.subiendo} className="btn btn-primary">{pending && <Spinner />}{pending ? 'Guardando…' : show ? 'Guardar' : 'Crear show'}</button>
        </div>
      </form>
    </Modal>
  )
}
