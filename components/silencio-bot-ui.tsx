'use client'

import { useState, useTransition } from 'react'
import { BellOff, Play } from 'lucide-react'
import { cambiarSilencioBot, guardarBotconversaSede, guardarFlujosSilencio, listarFlujosBotconversa, probarBotconversaSede } from '@/app/(panel)/silencio-actions'
import { useConfirm, useToast } from '@/components/feedback'
import { Spinner } from '@/components/ui'
import { useAccionFormulario } from '@/components/use-accion-formulario'
import { fechaHoraLarga } from '@/lib/fechas'
import { CLAVES_FLUJO, OPCIONES_SILENCIO, TITULO_FLUJO, type ClaveFlujo, type EstadoSilencio, type FlujosSilencio } from '@/lib/silencio'

/** Una cuenta de BotConversa con la que se puede silenciar al cliente: la de una sede (sucursalId) o la del negocio (null). */
export interface CuentaSilencio { sucursalId: string | null; nombre: string; estado: EstadoSilencio; flujos: FlujosSilencio }

function Estado({ estado }: { estado: EstadoSilencio }) {
  return estado.silenciado
    ? <span className="badge bg-rs-warn/15 text-rs-warn"><BellOff size={11} className="mr-1 inline" />Silenciado {estado.hasta ? `hasta el ${fechaHoraLarga(estado.hasta)}` : 'indefinidamente'}</span>
    : <span className="badge bg-rs-ok/15 text-rs-ok">Atendiendo</span>
}

/** Ficha del cliente: silenciar al bot de BotConversa por un rato (o para siempre) y reactivarlo, en la cuenta de cada sede. Solo ofrece las acciones cuyo flujo está configurado. */
export function SilencioBot({ clienteId, cuentas }: { clienteId: string; cuentas: CuentaSilencio[] }) {
  const [pending, start] = useTransition()
  const [quien, setQuien] = useState<string | null>(null)
  const toast = useToast()
  const confirmar = useConfirm()
  const visibles = cuentas.filter((c) => OPCIONES_SILENCIO.some((o) => c.flujos[o.clave]))
  if (visibles.length === 0) return null
  const conNombre = visibles.length > 1

  const ejecutar = async (c: CuentaSilencio, clave: ClaveFlujo, etiqueta: string) => {
    if (clave === 'silenciar_indef' && !(await confirmar({ titulo: '¿Silenciar al bot indefinidamente?', texto: `El bot no le va a responder a este cliente${conNombre ? ` en ${c.nombre}` : ''} hasta que lo reactives desde acá.`, confirmar: 'Silenciar' }))) return
    setQuien(`${c.sucursalId ?? 'negocio'}:${clave}`)
    start(async () => {
      const r = await cambiarSilencioBot(clienteId, clave, c.sucursalId)
      setQuien(null)
      toast(r.ok ? { texto: clave === 'reactivar' ? `El bot vuelve a atender a este cliente${conNombre ? ` en ${c.nombre}` : ''}` : `Bot silenciado${conNombre ? ` en ${c.nombre}` : ''}: ${etiqueta.toLowerCase()}` } : { tipo: 'error', texto: r.error ?? 'No se pudo cambiar' })
    })
  }

  return (
    <section className="card space-y-4 p-5">
      <h2 className="card-title">Bot de WhatsApp</h2>
      {visibles.map((c) => (
        <div key={c.sucursalId ?? 'negocio'} className="space-y-2" data-cuenta={c.sucursalId ?? 'negocio'}>
          <div className="flex flex-wrap items-center justify-between gap-2">
            {conNombre ? <h3 className="text-sm font-semibold">{c.nombre}</h3> : <span />}
            <Estado estado={c.estado} />
          </div>
          <p className="text-sm text-rs-muted">{c.estado.silenciado ? 'El bot no le responde a este cliente. Para que vuelva antes, reactivalo.' : 'Si una persona del equipo está hablando con este cliente, podés silenciar al bot para que no se meta.'}</p>
          <div className="flex flex-wrap gap-2">
            {OPCIONES_SILENCIO.filter((o) => o.clave !== 'reactivar' && c.flujos[o.clave]).map((o) => (
              <button key={o.clave} type="button" disabled={pending} onClick={() => ejecutar(c, o.clave, o.etiqueta)} className="btn btn-sm">
                {pending && quien === `${c.sucursalId ?? 'negocio'}:${o.clave}` ? <Spinner size={12} /> : <BellOff size={13} />}Silenciar {o.etiqueta.toLowerCase()}
              </button>
            ))}
            {c.flujos.reactivar && (
              <button type="button" disabled={pending} onClick={() => ejecutar(c, 'reactivar', 'Reactivar')} className={'btn btn-sm ' + (c.estado.silenciado ? 'btn-primary' : '')}>
                {pending && quien === `${c.sucursalId ?? 'negocio'}:reactivar` ? <Spinner size={12} /> : <Play size={13} />}Reactivar al bot
              </button>
            )}
          </div>
        </div>
      ))}
    </section>
  )
}

/** Los cuatro campos de flujo (uno por acción): un select si ya se trajo la lista de BotConversa, y si no el id a mano. */
function CamposFlujos({ flujos, lista }: { flujos: FlujosSilencio; lista: { id: number; name: string }[] | null }) {
  return (
    <div className="grid gap-3 sm:grid-cols-2">
      {CLAVES_FLUJO.map((c) => (
        <label key={c} className="block text-sm"><span className="mb-1 block text-xs text-rs-muted">{TITULO_FLUJO[c]}</span>
          {lista ? (
            <select name={`flujo_${c}`} defaultValue={flujos[c] ? String(flujos[c]) : ''} className="input w-full">
              <option value="">Sin configurar</option>
              {flujos[c] && !lista.some((f) => f.id === flujos[c]) && <option value={String(flujos[c])}>Flujo #{flujos[c]} (no está en BotConversa)</option>}
              {lista.map((f) => <option key={f.id} value={String(f.id)}>{f.name} (#{f.id})</option>)}
            </select>
          ) : (
            <input name={`flujo_${c}`} inputMode="numeric" defaultValue={flujos[c] ? String(flujos[c]) : ''} placeholder="Id del flujo" className="input w-full" />
          )}
        </label>
      ))}
    </div>
  )
}

/** Trae la lista de flujos de una cuenta de BotConversa (la de la sede o la del negocio). */
function useListaFlujos(sucursalId: string | null) {
  const [lista, setLista] = useState<{ id: number; name: string }[] | null>(null)
  const [cargando, setCargando] = useState(false)
  const toast = useToast()
  const traer = async () => {
    setCargando(true)
    const r = await listarFlujosBotconversa(sucursalId)
    setCargando(false)
    if (r.ok) setLista(r.flujos); else toast({ tipo: 'error', texto: r.error })
  }
  return { lista, cargando, traer }
}

/** Configuración (superadmin): qué flujo de la cuenta de BotConversa del negocio hace cada una de las cuatro acciones. */
export function FlujosSilencioForm({ flujos, tieneClave }: { flujos: FlujosSilencio; tieneClave: boolean }) {
  const { state, pending, formProps } = useAccionFormulario(guardarFlujosSilencio, { okTexto: 'Flujos de silencio guardados' })
  const { lista, cargando, traer } = useListaFlujos(null)
  return (
    <form {...formProps} className="mt-4 space-y-3 border-t border-rs-border pt-4" noValidate>
      <h3 className="text-sm font-semibold">Flujos para silenciar al bot (cuenta del negocio)</h3>
      <p className="text-xs text-rs-muted">Desde la ficha del cliente, el equipo puede silenciar al bot o reactivarlo. Cada acción dispara un flujo de BotConversa (el que cuenta el tiempo y pausa o reactiva). Elegí el de cada una; las que dejes vacías no se ofrecen.</p>
      <CamposFlujos flujos={flujos} lista={lista} />
      {state && !state.ok && <p role="alert" className="animate-fade-in text-sm text-rs-danger">{state.error}</p>}
      <div className="flex flex-wrap items-center gap-2">
        <button disabled={pending} className="btn btn-primary">{pending && <Spinner />}{pending ? 'Guardando…' : 'Guardar flujos'}</button>
        {tieneClave && !lista && <button type="button" onClick={traer} disabled={cargando} className="btn">{cargando && <Spinner />}{cargando ? 'Trayendo…' : 'Elegir de mis flujos de BotConversa'}</button>}
      </div>
    </form>
  )
}

export interface SedeBC { id: string; nombre: string; activo: boolean; tieneClave: boolean; flujos: FlujosSilencio }

/** Configuración (superadmin): una sede puede tener SU cuenta de BotConversa (clave de API y flujos propios). */
export function BotconversaSedesForm({ sedes }: { sedes: SedeBC[] }) {
  if (sedes.length === 0) return null
  return (
    <div className="mt-4 space-y-3 border-t border-rs-border pt-4">
      <h3 className="text-sm font-semibold">BotConversa por sede</h3>
      <p className="text-xs text-rs-muted">Si una sede tiene su propia cuenta de BotConversa, cargá acá su clave de API y sus cuatro flujos. En la ficha del cliente se elige con qué sede silenciar al bot.</p>
      <div className="space-y-2">{sedes.map((s) => <SedeForm key={s.id} sede={s} />)}</div>
    </div>
  )
}

function SedeForm({ sede }: { sede: SedeBC }) {
  const { state, pending, formProps } = useAccionFormulario(guardarBotconversaSede, { okTexto: `BotConversa de ${sede.nombre} guardado` })
  const { lista, cargando, traer } = useListaFlujos(sede.id)
  const [probando, setProbando] = useState(false)
  const toast = useToast()
  const probar = async () => {
    setProbando(true)
    const r = await probarBotconversaSede(sede.id)
    setProbando(false)
    toast(r.ok ? { texto: `Conexión correcta: BotConversa de ${sede.nombre} tiene ${r.cantidad ?? 0} etiquetas` } : { tipo: 'error', texto: r.error ?? 'No se pudo conectar' })
  }
  return (
    <details className="rounded-rs-lg border border-rs-control" open={sede.activo}>
      <summary className="flex cursor-pointer flex-wrap items-center justify-between gap-2 px-3 py-2 text-sm font-medium">
        <span>{sede.nombre}</span>
        <span className={'badge ' + (sede.activo ? 'bg-rs-ok/15 text-rs-ok' : 'bg-rs-muted/20 text-rs-muted')}>{sede.activo ? 'Cuenta propia activa' : 'Sin cuenta propia'}</span>
      </summary>
      <form {...formProps} className="space-y-3 border-t border-rs-border p-3" noValidate>
        <input type="hidden" name="sucursal_id" value={sede.id} />
        <label className="flex cursor-pointer items-start gap-3 text-sm">
          <input type="checkbox" name="activo" defaultChecked={sede.activo} className="mt-0.5 h-4 w-4 accent-[#c8e62b]" />
          <span><span className="font-medium">Esta sede tiene su propia cuenta de BotConversa</span><span className="block text-rs-muted">Los flujos de silencio de esta sede se mandan con su clave.</span></span>
        </label>
        <label className="block text-sm"><span className="mb-1 block text-xs text-rs-muted">Clave de la API de {sede.nombre} (header API-KEY)</span>
          <input name="clave" type="password" autoComplete="new-password" placeholder={sede.tieneClave ? '•••••••• (cargada; dejala vacía para conservarla)' : 'Pegá la clave de la API de BotConversa'} className="input w-full sm:max-w-md" />
        </label>
        {sede.tieneClave && <label className="flex cursor-pointer items-center gap-3 text-sm text-rs-muted"><input type="checkbox" name="quitar_clave" className="h-4 w-4 accent-[#c8e62b]" /> Quitar la clave guardada</label>}
        <CamposFlujos flujos={sede.flujos} lista={lista} />
        {state && !state.ok && <p role="alert" className="animate-fade-in text-sm text-rs-danger">{state.error}</p>}
        <div className="flex flex-wrap items-center gap-2">
          <button disabled={pending} className="btn btn-primary">{pending && <Spinner />}{pending ? 'Guardando…' : 'Guardar'}</button>
          {sede.tieneClave && !lista && <button type="button" onClick={traer} disabled={cargando} className="btn">{cargando && <Spinner />}{cargando ? 'Trayendo…' : 'Elegir de mis flujos de BotConversa'}</button>}
          {sede.tieneClave && <button type="button" onClick={probar} disabled={probando} className="btn">{probando && <Spinner />}{probando ? 'Probando…' : 'Probar conexión'}</button>}
        </div>
      </form>
    </details>
  )
}
