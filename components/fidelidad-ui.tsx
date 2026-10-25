'use client'

import { useEffect, useState, useTransition } from 'react'
import { Gift, Pencil, Plus, Power, Send, Settings, Trash2 } from 'lucide-react'
import {
  alternarReglaFidelidad, eliminarReglaFidelidad, emitirPremiosAhora, guardarConfigFidelidad, guardarReglaFidelidad,
} from '@/app/(panel)/fidelidad-actions'
import { useConfirm, useToast } from '@/components/feedback'
import { FechaInput } from '@/components/inputs'
import Modal from '@/components/modal'
import { EstadoVacio, Spinner } from '@/components/ui'
import { useAccionFormulario } from '@/components/use-accion-formulario'
import { CRITERIOS, textoRegla, type ConfigFidelidad, type ReglaFidelidad } from '@/lib/fidelidad'

function useCerrarAlGuardar(state: { ok: boolean } | null, texto: string, onDone: () => void) {
  const toast = useToast()
  useEffect(() => { if (state?.ok) { toast({ texto }); onDone() } }, [state]) // eslint-disable-line react-hooks/exhaustive-deps
}

function Acciones({ pending, texto, onCancel }: { pending: boolean; texto: string; onCancel: () => void }) {
  return (
    <div className="mt-2 flex justify-end gap-2">
      <button type="button" onClick={onCancel} className="btn">Cancelar</button>
      <button disabled={pending} className="btn btn-primary">{pending && <Spinner />}{pending ? 'Guardando…' : texto}</button>
    </div>
  )
}

function FormConfig({ config, hoy, onDone }: { config: ConfigFidelidad; hoy: string; onDone: () => void }) {
  const { state, pending, formProps } = useAccionFormulario(guardarConfigFidelidad)
  useCerrarAlGuardar(state, 'Programa guardado', onDone)
  return (
    <form {...formProps} className="space-y-4">
      <label className="flex items-start gap-2 text-sm"><input type="checkbox" name="activo" defaultChecked={config.activo} className="mt-0.5 h-4 w-4 accent-[#c8e62b]" /><span><span className="font-medium">Programa de fidelización activo</span><span className="block text-xs text-rs-muted">Con el programa apagado no se cuentan visitas ni se emiten premios.</span></span></label>
      <fieldset className="space-y-2">
        <legend className="label">¿Qué cuenta como visita?</legend>
        {CRITERIOS.map((c) => (
          <label key={c.value} className="flex cursor-pointer items-start gap-2 rounded-md border border-rs-control p-2.5 text-sm has-[:checked]:border-rs-lime/60 has-[:checked]:bg-rs-lime/5">
            <input type="radio" name="criterio" value={c.value} defaultChecked={config.criterio === c.value} className="mt-0.5 h-4 w-4 accent-[#c8e62b]" />
            <span><span className="font-medium">{c.titulo}</span><span className="block text-xs text-rs-muted">{c.texto}</span></span>
          </label>
        ))}
        <p className="text-xs text-rs-muted">Un mismo día cuenta una sola visita, aunque tenga varias reservas.</p>
      </fieldset>
      <div>
        <label className="label" htmlFor="f_desde">Contar visitas desde</label>
        <FechaInput id="f_desde" name="contar_desde" defaultValue={config.contar_desde || hoy} />
        <p className="mt-1 text-xs text-rs-muted">Las visitas anteriores a esta fecha no suman para los premios (se siguen viendo en el total). Dejá la fecha de hoy para empezar de cero, o poné una anterior para premiar también a quienes ya venían: ojo, en ese caso los clientes que ya cumplan una regla reciben su premio de golpe.</p>
      </div>
      {state && !state.ok && <p role="alert" className="text-sm text-rs-danger">{state.error}</p>}
      <Acciones pending={pending} texto="Guardar" onCancel={onDone} />
    </form>
  )
}

function FormRegla({ regla, onDone }: { regla?: ReglaFidelidad; onDone: () => void }) {
  const { state, pending, formProps } = useAccionFormulario(guardarReglaFidelidad)
  useCerrarAlGuardar(state, regla ? 'Regla guardada' : 'Regla creada', onDone)
  const [tipo, setTipo] = useState(regla?.repetir ? 'cada' : 'unica')
  return (
    <form {...formProps} className="space-y-3">
      {regla && <input type="hidden" name="id" value={regla.id} />}
      <div><label className="label" htmlFor="r_nombre">Nombre de la regla *</label><input id="r_nombre" name="nombre" defaultValue={regla?.nombre ?? ''} maxLength={60} placeholder="Ej. Postre de regalo" className="input w-full" required /></div>
      <fieldset className="space-y-2">
        <legend className="label">¿Cuándo se entrega?</legend>
        {[['unica', 'Una sola vez', 'Al llegar a la visita número N (ej. a la 5.ª).'], ['cada', 'Cada N visitas', 'Se repite: a la 5.ª, la 10.ª, la 15.ª…']].map(([v, t, d]) => (
          <label key={v} className="flex cursor-pointer items-start gap-2 rounded-md border border-rs-control p-2.5 text-sm has-[:checked]:border-rs-lime/60 has-[:checked]:bg-rs-lime/5">
            <input type="radio" name="tipo" value={v} checked={tipo === v} onChange={() => setTipo(v)} className="mt-0.5 h-4 w-4 accent-[#c8e62b]" />
            <span><span className="font-medium">{t}</span><span className="block text-xs text-rs-muted">{d}</span></span>
          </label>
        ))}
      </fieldset>
      <div className="grid grid-cols-2 gap-3">
        <div><label className="label" htmlFor="r_visitas">{tipo === 'cada' ? 'Cada cuántas visitas *' : 'En qué visita *'}</label><input id="r_visitas" name="visitas" type="number" min={2} max={200} defaultValue={regla?.visitas ?? 5} className="input w-full" required /></div>
        <div><label className="label" htmlFor="r_vence">Vence a los (días)</label><input id="r_vence" name="vence_dias" type="number" min={1} max={3650} defaultValue={regla?.vence_dias ?? ''} placeholder="No vence" className="input w-full" /></div>
      </div>
      <div><label className="label" htmlFor="r_ben">Premio *</label><input id="r_ben" name="beneficio" defaultValue={regla?.beneficio ?? ''} maxLength={120} placeholder="Ej. 1 postre de regalo · 20% OFF (tope $5.000)" className="input w-full" required /></div>
      <label className="flex items-center gap-2 text-sm"><input type="checkbox" name="activa" defaultChecked={regla?.activa ?? true} className="h-4 w-4 accent-[#c8e62b]" />Regla activa</label>
      {state && !state.ok && <p role="alert" className="text-sm text-rs-danger">{state.error}</p>}
      <Acciones pending={pending} texto={regla ? 'Guardar' : 'Crear regla'} onCancel={onDone} />
    </form>
  )
}

/** Botones del encabezado: ajustes del programa y emisión inmediata de los premios que ya corresponden. */
export function BotonesFidelidad({ config, hoy, porEmitir, puedeAdministrar, puedeEmitir }: { config: ConfigFidelidad; hoy: string; porEmitir: number; puedeAdministrar: boolean; puedeEmitir: boolean }) {
  const toast = useToast()
  const confirmar = useConfirm()
  const [abierto, setAbierto] = useState(false)
  const [pend, start] = useTransition()
  const emitir = async () => {
    if (!(await confirmar({ titulo: `¿Emitir ${porEmitir} premio${porEmitir === 1 ? '' : 's'} ahora?`, texto: 'Se crea el voucher de cada cliente que ya cumplió una regla. Después se les avisa por WhatsApp.', confirmar: 'Emitir' }))) return
    start(async () => { const r = await emitirPremiosAhora(); toast(r.ok ? { texto: `${r.cantidad ?? 0} premio${r.cantidad === 1 ? '' : 's'} emitido${r.cantidad === 1 ? '' : 's'}` } : { tipo: 'error', texto: r.error ?? 'Error' }) })
  }
  return (
    <>
      <div className="flex flex-wrap items-center gap-2">
        {puedeEmitir && config.activo && <button type="button" disabled={pend || porEmitir === 0} onClick={emitir} className="btn" title={porEmitir === 0 ? 'No hay premios pendientes de emitir' : undefined}>{pend ? <Spinner /> : <Send size={14} />}Emitir premios{porEmitir > 0 ? ` (${porEmitir})` : ''}</button>}
        {puedeAdministrar && <button type="button" onClick={() => setAbierto(true)} className="btn"><Settings size={14} />Ajustes</button>}
      </div>
      {abierto && <Modal titulo="Programa de fidelización" onClose={() => setAbierto(false)} ancho="max-w-xl"><FormConfig config={config} hoy={hoy} onDone={() => setAbierto(false)} /></Modal>}
    </>
  )
}

/** Reglas del programa (qué se premia y cuándo). */
export function ReglasPanel({ reglas, puedeAdministrar }: { reglas: ReglaFidelidad[]; puedeAdministrar: boolean }) {
  const toast = useToast()
  const confirmar = useConfirm()
  const [pend, start] = useTransition()
  const [modal, setModal] = useState<{ regla?: ReglaFidelidad } | null>(null)
  const ejecutar = (fn: () => Promise<{ ok: boolean; error?: string }>, okTexto?: string) => start(async () => { const r = await fn(); if (!r.ok) toast({ tipo: 'error', texto: r.error ?? 'Error' }); else if (okTexto) toast({ texto: okTexto }) })
  const borrar = async (r: ReglaFidelidad) => { if (await confirmar({ titulo: `¿Borrar la regla "${r.nombre}"?`, texto: 'Si ya entregó premios no se puede borrar: desactivala.', confirmar: 'Borrar', peligro: true })) ejecutar(() => eliminarReglaFidelidad(r.id), 'Regla borrada') }
  return (
    <section className="card p-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="card-title">Reglas de premios</h2>
        {puedeAdministrar && <button type="button" onClick={() => setModal({})} className="btn btn-sm"><Plus size={13} />Nueva regla</button>}
      </div>
      {reglas.length === 0 ? (
        <EstadoVacio icono={<Gift size={26} />} titulo="Todavía no hay reglas" texto="Creá la primera: por ejemplo “a la 5.ª visita, un postre de regalo” o “cada 10 visitas, 20% OFF”." />
      ) : (
        <ul className="mt-3 divide-y divide-rs-border/60">
          {reglas.map((r) => (
            <li key={r.id} className={'flex flex-wrap items-center justify-between gap-3 py-3 ' + (r.activa ? '' : 'opacity-55')}>
              <div className="min-w-0">
                <p className="font-semibold">{r.nombre} {!r.activa && <span className="badge ml-1 bg-rs-raised text-rs-muted">Desactivada</span>}</p>
                <p className="text-sm text-rs-muted"><span className="text-rs-lime">{textoRegla(r)}</span> · {r.beneficio} · {r.vence_dias ? `vence a los ${r.vence_dias} días` : 'sin vencimiento'}</p>
              </div>
              {puedeAdministrar && (
                <div className="flex items-center gap-1.5">
                  <button type="button" disabled={pend} onClick={() => ejecutar(() => alternarReglaFidelidad(r.id))} aria-label={r.activa ? 'Desactivar regla' : 'Activar regla'} title={r.activa ? 'Desactivar' : 'Activar'} className="btn btn-sm w-8 px-0"><Power size={13} /></button>
                  <button type="button" onClick={() => setModal({ regla: r })} aria-label="Editar regla" className="btn btn-sm w-8 px-0"><Pencil size={13} /></button>
                  <button type="button" disabled={pend} onClick={() => borrar(r)} aria-label="Borrar regla" className="btn btn-sm btn-danger w-8 px-0"><Trash2 size={13} /></button>
                </div>
              )}
            </li>
          ))}
        </ul>
      )}
      {modal && <Modal titulo={modal.regla ? 'Editar regla' : 'Nueva regla'} onClose={() => setModal(null)}><FormRegla regla={modal.regla} onDone={() => setModal(null)} /></Modal>}
    </section>
  )
}
