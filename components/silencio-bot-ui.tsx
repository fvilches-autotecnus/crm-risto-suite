'use client'

import { useState, useTransition } from 'react'
import { BellOff, Play } from 'lucide-react'
import { cambiarSilencioBot, guardarFlujosSilencio, listarFlujosBotconversa } from '@/app/(panel)/silencio-actions'
import { useConfirm, useToast } from '@/components/feedback'
import { Spinner } from '@/components/ui'
import { useAccionFormulario } from '@/components/use-accion-formulario'
import { fechaHoraLarga } from '@/lib/fechas'
import { CLAVES_FLUJO, OPCIONES_SILENCIO, TITULO_FLUJO, type ClaveFlujo, type EstadoSilencio, type FlujosSilencio } from '@/lib/silencio'

/** Ficha del cliente: silenciar al bot de BotConversa por un rato (o para siempre) y reactivarlo. Solo muestra las acciones cuyo flujo está configurado. */
export function SilencioBot({ clienteId, estado, flujos }: { clienteId: string; estado: EstadoSilencio; flujos: FlujosSilencio }) {
  const [pending, start] = useTransition()
  const [quien, setQuien] = useState<ClaveFlujo | null>(null)
  const toast = useToast()
  const confirmar = useConfirm()
  const hay = OPCIONES_SILENCIO.filter((o) => flujos[o.clave])
  if (hay.length === 0) return null

  const ejecutar = async (clave: ClaveFlujo, etiqueta: string) => {
    if (clave === 'silenciar_indef' && !(await confirmar({ titulo: '¿Silenciar al bot indefinidamente?', texto: 'El bot no le va a responder a este cliente hasta que lo reactives desde acá.', confirmar: 'Silenciar' }))) return
    setQuien(clave)
    start(async () => {
      const r = await cambiarSilencioBot(clienteId, clave)
      setQuien(null)
      toast(r.ok ? { texto: clave === 'reactivar' ? 'El bot vuelve a atender a este cliente' : `Bot silenciado: ${etiqueta.toLowerCase()}` } : { tipo: 'error', texto: r.error ?? 'No se pudo cambiar' })
    })
  }

  return (
    <section className="card space-y-3 p-5">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="card-title">Bot de WhatsApp</h2>
        {estado.silenciado
          ? <span className="badge bg-rs-warn/15 text-rs-warn"><BellOff size={11} className="mr-1 inline" />Silenciado {estado.hasta ? `hasta el ${fechaHoraLarga(estado.hasta)}` : 'indefinidamente'}</span>
          : <span className="badge bg-rs-ok/15 text-rs-ok">Atendiendo</span>}
      </div>
      <p className="text-sm text-rs-muted">{estado.silenciado ? 'El bot no le responde a este cliente. Para que vuelva antes, reactivalo.' : 'Si una persona del equipo está hablando con este cliente, podés silenciar al bot para que no se meta.'}</p>
      <div className="flex flex-wrap gap-2">
        {hay.filter((o) => o.clave !== 'reactivar').map((o) => (
          <button key={o.clave} type="button" disabled={pending} onClick={() => ejecutar(o.clave, o.etiqueta)} className="btn btn-sm">
            {pending && quien === o.clave ? <Spinner size={12} /> : <BellOff size={13} />}Silenciar {o.etiqueta.toLowerCase()}
          </button>
        ))}
        {flujos.reactivar && (
          <button type="button" disabled={pending} onClick={() => ejecutar('reactivar', 'Reactivar')} className={'btn btn-sm ' + (estado.silenciado ? 'btn-primary' : '')}>
            {pending && quien === 'reactivar' ? <Spinner size={12} /> : <Play size={13} />}Reactivar al bot
          </button>
        )}
      </div>
    </section>
  )
}

/** Configuración (superadmin): qué flujo de BotConversa hace cada una de las cuatro acciones. */
export function FlujosSilencioForm({ flujos, tieneClave }: { flujos: FlujosSilencio; tieneClave: boolean }) {
  const { state, pending, formProps } = useAccionFormulario(guardarFlujosSilencio, { okTexto: 'Flujos de silencio guardados' })
  const [lista, setLista] = useState<{ id: number; name: string }[] | null>(null)
  const [cargando, setCargando] = useState(false)
  const toast = useToast()
  const traer = async () => {
    setCargando(true)
    const r = await listarFlujosBotconversa()
    setCargando(false)
    if (r.ok) setLista(r.flujos); else toast({ tipo: 'error', texto: r.error })
  }
  return (
    <form {...formProps} className="mt-4 space-y-3 border-t border-rs-border pt-4" noValidate>
      <h3 className="text-sm font-semibold">Flujos para silenciar al bot</h3>
      <p className="text-xs text-rs-muted">Desde la ficha del cliente, el equipo puede silenciar al bot o reactivarlo. Cada acción dispara un flujo de BotConversa (el que cuenta el tiempo y pausa o reactiva). Elegí el de cada una; las que dejes vacías no se ofrecen.</p>
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
      {state && !state.ok && <p role="alert" className="animate-fade-in text-sm text-rs-danger">{state.error}</p>}
      <div className="flex flex-wrap items-center gap-2">
        <button disabled={pending} className="btn btn-primary">{pending && <Spinner />}{pending ? 'Guardando…' : 'Guardar flujos'}</button>
        {tieneClave && !lista && <button type="button" onClick={traer} disabled={cargando} className="btn">{cargando && <Spinner />}{cargando ? 'Trayendo…' : 'Elegir de mis flujos de BotConversa'}</button>}
      </div>
    </form>
  )
}
