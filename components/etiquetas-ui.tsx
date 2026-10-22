'use client'

import { useEffect, useState, useTransition } from 'react'
import { Plus, Tag, Trash2, X } from 'lucide-react'
import { etiquetarCliente, etiquetarNumero, eliminarEtiqueta, guardarBotconversa, importarEtiquetasBotconversa, probarBotconversa, quitarEtiquetaCliente } from '@/app/(panel)/etiquetas-actions'
import { useConfirm, useToast } from '@/components/feedback'
import { TelefonoInput } from '@/components/inputs'
import Modal from '@/components/modal'
import { useAccionFormulario } from '@/components/use-accion-formulario'
import { Spinner } from '@/components/ui'

export interface EtiquetaUI { id: string; nombre: string }

export function Chip({ nombre, onQuitar, ocupado }: { nombre: string; onQuitar?: () => void; ocupado?: boolean }) {
  return (
    <span className="inline-flex items-center gap-1 rounded-full border border-rs-lime/30 bg-rs-lime/10 px-2.5 py-0.5 text-xs font-medium text-rs-lime">
      <Tag size={11} />{nombre}
      {onQuitar && <button type="button" disabled={ocupado} onClick={onQuitar} aria-label={`Quitar la etiqueta ${nombre}`} className="-mr-1 ml-0.5 rounded-full p-0.5 transition hover:bg-rs-lime/20 disabled:opacity-50">{ocupado ? <Spinner size={10} /> : <X size={11} />}</button>}
    </span>
  )
}

/** Selector de etiqueta: del catálogo y, en negocios sin BotConversa, también "Nueva etiqueta…". */
function SelectorEtiqueta({ catalogo, esBotconversa, valor, onCambio, nueva, onNueva, name = 'etiqueta_id' }: { catalogo: EtiquetaUI[]; esBotconversa: boolean; valor: string; onCambio: (v: string) => void; nueva: string; onNueva: (v: string) => void; name?: string }) {
  return (
    <div className="space-y-2">
      <select name={name} value={valor} onChange={(e) => onCambio(e.target.value)} className="input w-full" aria-label="Etiqueta">
        {catalogo.length === 0 && !esBotconversa && <option value="__nueva">Nueva etiqueta…</option>}
        {catalogo.length === 0 && esBotconversa && <option value="">No hay etiquetas importadas</option>}
        {catalogo.map((e) => <option key={e.id} value={e.id}>{e.nombre}</option>)}
        {catalogo.length > 0 && !esBotconversa && <option value="__nueva">➕ Nueva etiqueta…</option>}
      </select>
      {valor === '__nueva' && <input name="etiqueta_nueva" value={nueva} onChange={(e) => onNueva(e.target.value)} maxLength={60} placeholder="Nombre de la etiqueta (ej. Post visita)" className="input w-full" aria-label="Nombre de la etiqueta nueva" />}
      {esBotconversa && <p className="text-xs text-rs-muted">Se aplica también en BotConversa. Las etiquetas se crean allá y se importan desde Configuración.</p>}
    </div>
  )
}

// ---------------------------------------------------------------------------
// Ficha del cliente: etiquetas con "quitar" y "agregar"
// ---------------------------------------------------------------------------
export function EtiquetasCliente({ clienteId, aplicadas, catalogo, puedeEscribir, esBotconversa }: { clienteId: string; aplicadas: EtiquetaUI[]; catalogo: EtiquetaUI[]; puedeEscribir: boolean; esBotconversa: boolean }) {
  const [abierto, setAbierto] = useState(false)
  const [quitando, setQuitando] = useState<string | null>(null)
  const [, start] = useTransition()
  const toast = useToast()
  const quitar = (e: EtiquetaUI) => {
    setQuitando(e.id)
    start(async () => {
      const r = await quitarEtiquetaCliente(clienteId, e.id)
      setQuitando(null)
      toast(r.ok ? { texto: `Etiqueta “${e.nombre}” quitada` } : { tipo: 'error', texto: r.error ?? 'No se pudo quitar' })
    })
  }
  const disponibles = catalogo.filter((c) => !aplicadas.some((a) => a.id === c.id))
  return (
    <section className="card p-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="card-title">Etiquetas</h2>
        {puedeEscribir && <button type="button" onClick={() => setAbierto(true)} className="btn btn-sm"><Plus size={13} />Agregar etiqueta</button>}
      </div>
      <div className="mt-3 flex flex-wrap gap-2">
        {aplicadas.length === 0 && <span className="text-sm text-rs-muted">Sin etiquetas.</span>}
        {aplicadas.map((e) => <Chip key={e.id} nombre={e.nombre} ocupado={quitando === e.id} onQuitar={puedeEscribir ? () => quitar(e) : undefined} />)}
      </div>
      {abierto && <Modal titulo="Agregar etiqueta" onClose={() => setAbierto(false)}><AgregarAClienteForm clienteId={clienteId} disponibles={disponibles} esBotconversa={esBotconversa} onDone={() => setAbierto(false)} /></Modal>}
    </section>
  )
}

function AgregarAClienteForm({ clienteId, disponibles, esBotconversa, onDone }: { clienteId: string; disponibles: EtiquetaUI[]; esBotconversa: boolean; onDone: () => void }) {
  const [valor, setValor] = useState(disponibles[0]?.id ?? (esBotconversa ? '' : '__nueva'))
  const [nueva, setNueva] = useState('')
  const [error, setError] = useState('')
  const [pending, start] = useTransition()
  const toast = useToast()
  const enviar = (ev: React.FormEvent) => {
    ev.preventDefault()
    setError('')
    if (!valor) { setError('Elegí una etiqueta'); return }
    if (valor === '__nueva' && !nueva.trim()) { setError('Escribí el nombre de la etiqueta'); return }
    start(async () => {
      const r = await etiquetarCliente(clienteId, valor === '__nueva' ? null : valor, valor === '__nueva' ? nueva : undefined)
      if (r.ok) { toast({ texto: 'Etiqueta agregada' }); onDone() } else setError(r.error ?? 'No se pudo agregar la etiqueta')
    })
  }
  return (
    <form onSubmit={enviar} className="space-y-3" noValidate>
      <SelectorEtiqueta catalogo={disponibles} esBotconversa={esBotconversa} valor={valor} onCambio={setValor} nueva={nueva} onNueva={setNueva} />
      {error && <p role="alert" className="animate-fade-in text-sm text-rs-danger">{error}</p>}
      <div className="flex justify-end gap-2">
        <button type="button" onClick={onDone} className="btn">Cancelar</button>
        <button disabled={pending} className="btn btn-primary">{pending && <Spinner />}{pending ? 'Agregando…' : 'Agregar'}</button>
      </div>
    </form>
  )
}

// ---------------------------------------------------------------------------
// Lista de clientes: "Etiquetar un número"
// ---------------------------------------------------------------------------
function NumeroForm({ catalogo, esBotconversa, onDone }: { catalogo: EtiquetaUI[]; esBotconversa: boolean; onDone: () => void }) {
  const { state, pending, formProps } = useAccionFormulario(etiquetarNumero, { okTexto: 'Etiqueta aplicada' })
  const [valor, setValor] = useState(catalogo[0]?.id ?? (esBotconversa ? '' : '__nueva'))
  const [nueva, setNueva] = useState('')
  useEffect(() => { if (state?.ok) onDone() }, [state]) // eslint-disable-line react-hooks/exhaustive-deps
  return (
    <form {...formProps} className="space-y-3" noValidate>
      <TelefonoInput name="telefono" label="Teléfono" />
      <div><label className="label" htmlFor="en_nombre">Nombre (si el número es nuevo)</label><input id="en_nombre" name="nombre" placeholder="Opcional" className="input w-full" /></div>
      <div><label className="label">Etiqueta</label><SelectorEtiqueta catalogo={catalogo} esBotconversa={esBotconversa} valor={valor} onCambio={setValor} nueva={nueva} onNueva={setNueva} /></div>
      {state && !state.ok && <p role="alert" className="animate-fade-in text-sm text-rs-danger">{state.error}</p>}
      <div className="flex justify-end gap-2">
        <button type="button" onClick={onDone} className="btn">Cancelar</button>
        <button disabled={pending} className="btn btn-primary">{pending && <Spinner />}{pending ? 'Aplicando…' : 'Aplicar etiqueta'}</button>
      </div>
    </form>
  )
}

export function EtiquetarNumeroBtn({ catalogo, esBotconversa }: { catalogo: EtiquetaUI[]; esBotconversa: boolean }) {
  const [abierto, setAbierto] = useState(false)
  return (
    <>
      <button type="button" onClick={() => setAbierto(true)} className="btn"><Tag size={14} />Etiquetar un número</button>
      {abierto && <Modal titulo="Etiquetar un número" onClose={() => setAbierto(false)}><NumeroForm catalogo={catalogo} esBotconversa={esBotconversa} onDone={() => setAbierto(false)} /></Modal>}
    </>
  )
}

// ---------------------------------------------------------------------------
// Configuración: catálogo de etiquetas
// ---------------------------------------------------------------------------
export interface EtiquetaConfig { id: string; nombre: string; total: number; vinculada: boolean }

export function EtiquetasConfig({ etiquetas, puedeAdministrar, esBotconversa }: { etiquetas: EtiquetaConfig[]; puedeAdministrar: boolean; esBotconversa: boolean }) {
  const [pending, start] = useTransition()
  const [importando, setImportando] = useState(false)
  const confirmar = useConfirm()
  const toast = useToast()
  const borrar = async (e: EtiquetaConfig) => {
    if (!(await confirmar({ titulo: `¿Eliminar la etiqueta “${e.nombre}”?`, texto: `Se le saca a los ${e.total} clientes que la tienen en el CRM.${esBotconversa ? ' En BotConversa no se borra: eso se hace allá.' : ''}`, confirmar: 'Eliminar', peligro: true }))) return
    start(async () => { const r = await eliminarEtiqueta(e.id); toast(r.ok ? { texto: 'Etiqueta eliminada' } : { tipo: 'error', texto: r.error ?? 'Error' }) })
  }
  const importar = async () => {
    setImportando(true)
    const r = await importarEtiquetasBotconversa()
    setImportando(false)
    toast(r.ok ? { texto: r.cantidad ? `Se importaron o vincularon ${r.cantidad} etiquetas de BotConversa` : 'Las etiquetas ya estaban al día' } : { tipo: 'error', texto: r.error ?? 'No se pudo importar' })
  }
  return (
    <div className="mt-3">
      {esBotconversa && puedeAdministrar && <button onClick={importar} disabled={importando} className="btn btn-sm mb-3">{importando ? <Spinner size={12} /> : <Tag size={13} />}Importar etiquetas de BotConversa</button>}
      {etiquetas.length === 0 ? (
        <p className="text-sm text-rs-muted">{esBotconversa ? 'Todavía no hay etiquetas. Importalas desde BotConversa.' : 'Todavía no hay etiquetas. Se crean al etiquetar un cliente.'}</p>
      ) : (
        <ul className="divide-y divide-rs-border/60">
          {etiquetas.map((e) => (
            <li key={e.id} className="flex flex-wrap items-center justify-between gap-2 py-2 text-sm">
              <span className="flex items-center gap-2"><Chip nombre={e.nombre} />{esBotconversa && !e.vinculada && <span className="text-xs text-rs-warn">sin vincular con BotConversa</span>}</span>
              <span className="flex items-center gap-3"><span className="tabular-nums text-rs-muted">{e.total} cliente{e.total === 1 ? '' : 's'}</span>{puedeAdministrar && <button disabled={pending} onClick={() => borrar(e)} aria-label={`Eliminar la etiqueta ${e.nombre}`} className="btn btn-sm btn-danger"><Trash2 size={13} /></button>}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

// ---------------------------------------------------------------------------
// Configuración (superadmin): integración con BotConversa
// ---------------------------------------------------------------------------
export function BotconversaForm({ activo, tieneClave }: { activo: boolean; tieneClave: boolean }) {
  const { state, pending, formProps } = useAccionFormulario(guardarBotconversa, { okTexto: 'Integración con BotConversa guardada' })
  const [probando, setProbando] = useState(false)
  const toast = useToast()
  const probar = async () => {
    setProbando(true)
    const r = await probarBotconversa()
    setProbando(false)
    toast(r.ok ? { texto: `Conexión correcta: BotConversa tiene ${r.cantidad ?? 0} etiquetas` } : { tipo: 'error', texto: r.error ?? 'No se pudo conectar' })
  }
  return (
    <form {...formProps} className="mt-4 space-y-3 border-t border-rs-border pt-4" noValidate>
      <h3 className="text-sm font-semibold">Integración con BotConversa</h3>
      <label className="flex cursor-pointer items-start gap-3 text-sm">
        <input type="checkbox" name="activo" defaultChecked={activo} className="mt-0.5 h-4 w-4 accent-[#c8e62b]" />
        <span><span className="font-medium">Este negocio usa BotConversa</span><span className="block text-rs-muted">Al etiquetar un cliente, la etiqueta también se aplica en BotConversa (por su API). Las etiquetas se crean en BotConversa y se importan al CRM.</span></span>
      </label>
      <label className="block text-sm"><span className="mb-1 block text-xs text-rs-muted">Clave de la API (header API-KEY)</span>
        <input name="clave" type="password" autoComplete="new-password" placeholder={tieneClave ? '•••••••• (cargada; dejala vacía para conservarla)' : 'Pegá la clave de la API de BotConversa'} className="input w-full sm:max-w-md" />
      </label>
      {tieneClave && <label className="flex cursor-pointer items-center gap-3 text-sm text-rs-muted"><input type="checkbox" name="quitar_clave" className="h-4 w-4 accent-[#c8e62b]" /> Quitar la clave guardada</label>}
      {state && !state.ok && <p role="alert" className="animate-fade-in text-sm text-rs-danger">{state.error}</p>}
      <div className="flex flex-wrap items-center gap-2">
        <button disabled={pending} className="btn btn-primary">{pending && <Spinner />}{pending ? 'Guardando…' : 'Guardar'}</button>
        {tieneClave && <button type="button" onClick={probar} disabled={probando} className="btn">{probando && <Spinner />}{probando ? 'Probando…' : 'Probar conexión'}</button>}
      </div>
    </form>
  )
}
