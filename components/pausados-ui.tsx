'use client'

import { ThOrden, type OrdenTabla } from '@/components/th-orden'
import { useEffect, useState, useTransition } from 'react'
import { PauseCircle, Play } from 'lucide-react'
import { pausarChatManual, reactivarChat, reactivarTodos, volverAPausar } from '@/app/(panel)/pausados-actions'
import { TelefonoInput } from '@/components/inputs'
import { useAccionFormulario } from '@/components/use-accion-formulario'
import { useConfirm, useToast } from '@/components/feedback'
import { EstadoVacio, Spinner } from '@/components/ui'
import { fechaHoraLarga } from '@/lib/fechas'
import { dentroDe, hace, labelMotivoPausa, motivoValido } from '@/lib/pausas'

export interface PausadoUI {
  id: string
  telefono: string
  nombre: string | null          // nombre del cliente en el CRM o, si no, el de WhatsApp
  motivo_pausa: string | null
  pausado_en: string | null
  reactivar_en: string | null     // null = indefinida (se reactiva a mano)
  sede: string | null
}

function BadgeMotivo({ motivo }: { motivo: string | null }) {
  const m = motivoValido(motivo)
  const cls = m === 'reserva' ? 'bg-rs-lav/15 text-rs-lav' : m === 'consulta' ? 'bg-rs-warn/15 text-rs-warn' : 'bg-rs-muted/20 text-rs-muted'
  return <span className={'badge ' + cls}>{labelMotivoPausa(motivo)}</span>
}

/** Lista de chats que el bot dejó pausados, con el botón para devolverle el chat al bot. */
export function ListaPausados({ chats, ahora, hayVarias, orden }: { chats: PausadoUI[]; ahora: number; hayVarias: boolean; orden?: OrdenTabla }) {
  const Th = ({ campo, primero, className, children }: { campo: string; primero?: 'asc' | 'desc'; className?: string; children: React.ReactNode }) => orden
    ? <ThOrden ruta={orden.ruta} params={orden.params} campo={campo} orden={orden.actual} primero={primero} className={className}>{children}</ThOrden>
    : <th className={('th ' + (className ?? '')).trim()}>{children}</th>
  const [pending, start] = useTransition()
  const [quien, setQuien] = useState<string | null>(null)
  const toast = useToast()
  const reactivar = (c: PausadoUI) => {
    setQuien(c.id)
    start(async () => {
      const r = await reactivarChat(c.id)
      setQuien(null)
      toast(r.ok
        ? { texto: `El bot vuelve a atender a ${c.nombre ?? c.telefono}`, accion: { label: 'Deshacer', onClick: () => { void volverAPausar(c.id, c.motivo_pausa, c.pausado_en) } } }
        : { tipo: 'error', texto: r.error ?? 'No se pudo reactivar el chat' })
    })
  }
  const boton = (c: PausadoUI) => (
    <button disabled={pending} onClick={() => reactivar(c)} className="btn btn-sm btn-primary">
      {pending && quien === c.id ? <Spinner size={12} /> : <Play size={13} />}Reactivar
    </button>
  )

  if (chats.length === 0) return <div className="card"><EstadoVacio icono={<PauseCircle size={26} />} titulo="No hay chats pausados" texto="Cuando el bot derive un chat a una persona (consulta o solicitud de reserva) va a aparecer acá hasta que lo reactives." /></div>

  return (
    <>
      <div className="card hidden overflow-x-auto md:block">
        <table className="w-full min-w-[820px]">
          <thead className="border-b border-rs-border"><tr><Th campo="cliente">Cliente</Th><Th campo="telefono">Teléfono</Th>{hayVarias && <Th campo="sede">Sede</Th>}<Th campo="motivo">Motivo</Th><Th campo="pausado" primero="desc">Pausado</Th><Th campo="reactiva">Se reactiva</Th><th className="th text-right">Acción</th></tr></thead>
          <tbody>
            {chats.map((c, i) => (
              <tr key={c.id} className="reveal border-b border-rs-border/60 transition-colors last:border-0 hover:bg-rs-raised/50" style={{ ['--i' as string]: Math.min(i, 12) }}>
                <td className="td font-medium">{c.nombre ?? 'Sin nombre'}</td>
                <td className="td text-rs-muted">{c.telefono}</td>
                {hayVarias && <td className="td text-rs-muted">{c.sede ?? '—'}</td>}
                <td className="td"><BadgeMotivo motivo={c.motivo_pausa} /></td>
                <td className="td whitespace-nowrap text-sm"><span title={c.pausado_en ? fechaHoraLarga(c.pausado_en) : ''}>{hace(c.pausado_en, ahora)}</span>{c.pausado_en && <span className="ml-2 text-xs text-rs-muted">{fechaHoraLarga(c.pausado_en)}</span>}</td>
                <td className="td whitespace-nowrap text-sm">{c.reactivar_en ? <span className="text-rs-ok" title={fechaHoraLarga(c.reactivar_en)}>{dentroDe(c.reactivar_en, ahora)}</span> : <span className="text-rs-muted">A mano</span>}</td>
                <td className="td text-right">{boton(c)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <ul className="space-y-3 md:hidden">
        {chats.map((c, i) => (
          <li key={c.id} className="reveal card p-4" style={{ ['--i' as string]: Math.min(i, 8) }}>
            <div className="flex items-start justify-between gap-3"><span className="font-medium">{c.nombre ?? 'Sin nombre'}</span><BadgeMotivo motivo={c.motivo_pausa} /></div>
            <p className="mt-1 text-sm text-rs-muted">{c.telefono}{hayVarias && c.sede ? ` · ${c.sede}` : ''}</p>
            <p className="mt-1 text-xs text-rs-muted">Pausado {hace(c.pausado_en, ahora)}{c.pausado_en ? ` · ${fechaHoraLarga(c.pausado_en)}` : ''}</p>
            <p className="mt-0.5 text-xs">{c.reactivar_en ? <span className="text-rs-ok">Se reactiva {dentroDe(c.reactivar_en, ahora)}</span> : <span className="text-rs-muted">Se reactiva a mano</span>}</p>
            <div className="mt-3 border-t border-rs-border/60 pt-3 text-right">{boton(c)}</div>
          </li>
        ))}
      </ul>
    </>
  )
}

/** "Reactivar todos" (o todos los de un motivo): pide confirmación porque el bot vuelve a contestar en todos esos chats a la vez. */
export function ReactivarTodosBtn({ total, motivo, etiquetaMotivo }: { total: number; motivo?: string; etiquetaMotivo?: string }) {
  const [pending, start] = useTransition()
  const confirmar = useConfirm()
  const toast = useToast()
  if (total === 0) return null
  const que = etiquetaMotivo ? `los ${total} chats de “${etiquetaMotivo}”` : `los ${total} chats pausados`
  const ir = async () => {
    if (!(await confirmar({ titulo: `¿Reactivar ${que}?`, texto: 'El bot vuelve a responder en esos chats. Si algún cliente todavía está esperando a una persona, conviene atenderlo antes.', confirmar: 'Reactivar' }))) return
    start(async () => {
      const r = await reactivarTodos(motivo)
      toast(r.ok ? { texto: `${r.cantidad ?? 0} chat${r.cantidad === 1 ? '' : 's'} reactivado${r.cantidad === 1 ? '' : 's'}` } : { tipo: 'error', texto: r.error ?? 'No se pudieron reactivar' })
    })
  }
  return <button disabled={pending} onClick={ir} className="btn">{pending ? <Spinner size={13} /> : <Play size={14} />}Reactivar {etiquetaMotivo ? `“${etiquetaMotivo}”` : 'todos'} ({total})</button>
}


/**
 * "Pausar un chat": se escribe solo el número y el bot deja de responderle (aunque todavía no le haya escrito nunca).
 * Dura lo que dura la pausa automática de "otro motivo" (o hasta reactivarlo a mano si está en "indefinida").
 */
export function PausarChatForm({ duracion, sedes }: { duracion: string; sedes: { id: string; nombre: string }[] }) {
  const [abierto, setAbierto] = useState(false)
  const [version, setVersion] = useState(0)   // cambiarla vacía el teléfono (es un campo con estado propio)
  const toast = useToast()
  const { state, pending, formProps } = useAccionFormulario(pausarChatManual)
  useEffect(() => {
    if (state?.ok) { setVersion((v) => v + 1); setAbierto(false); toast({ texto: 'Listo: el bot ya no le responde a ese número' }) }
  }, [state]) // eslint-disable-line react-hooks/exhaustive-deps

  if (!abierto) return <button type="button" onClick={() => setAbierto(true)} className="btn"><PauseCircle size={14} />Pausar un chat</button>
  return (
    <form {...formProps} className="card w-full space-y-3 p-4 sm:max-w-xl">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h2 className="text-sm font-semibold">Pausar un chat</h2>
          <p className="text-xs text-rs-muted">Escribí el número y el bot deja de responderle. Pausa: <span className="text-rs-text">{duracion}</span> (se cambia en «Otro motivo»).</p>
        </div>
        <button type="button" onClick={() => setAbierto(false)} className="btn btn-sm">Cancelar</button>
      </div>
      <TelefonoInput key={version} name="telefono" label="Teléfono" required />
      {sedes.length === 1 && <input type="hidden" name="sede" value={sedes[0].id} />}
      {sedes.length > 1 && (
        <div>
          <label className="label" htmlFor="pausar_sede">Sede</label>
          <select id="pausar_sede" name="sede" className="input w-full" defaultValue="">
            <option value="">Sin sede</option>
            {sedes.map((x) => <option key={x.id} value={x.id}>{x.nombre}</option>)}
          </select>
        </div>
      )}
      {state && !state.ok && <p className="text-sm text-rs-danger" role="alert">{state.error}</p>}
      <div className="text-right"><button type="submit" disabled={pending} className="btn btn-primary">{pending ? <Spinner size={13} /> : <PauseCircle size={14} />}Pausar chat</button></div>
    </form>
  )
}
