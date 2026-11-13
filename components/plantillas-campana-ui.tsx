'use client'

import { useEffect, useMemo, useState, useTransition } from 'react'
import { MessageSquareText, Pencil, Plus, Trash2 } from 'lucide-react'
import { eliminarPlantilla, guardarPlantilla } from '@/app/(panel)/campanas-ia-actions'
import { useConfirm, useToast } from '@/components/feedback'
import Modal from '@/components/modal'
import { EstadoVacio, Spinner } from '@/components/ui'
import { useAccionFormulario } from '@/components/use-accion-formulario'
import {
  ESTADOS_PLANTILLA, IDIOMAS_PLANTILLA, MAX_VARIABLE_DEFECTO, MAX_VARIABLE_TOPE, OBJETIVOS_IA, OBJETIVOS_PLANTILLA,
  labelEstadoPlantilla, labelObjetivo, plantillaUsable, posicionesDeCuerpo, type PlantillaCampana, type VariablePlantilla,
} from '@/lib/campanas-ia'

const claseEstado = (e: string) => (e === 'aprobada' ? 'bg-rs-ok/15 text-rs-ok' : e === 'pendiente' ? 'bg-rs-warn/15 text-rs-warn' : 'bg-rs-danger/15 text-rs-danger')

/**
 * Plantillas de WhatsApp (Meta) del negocio, cargadas a mano. El CRM no las envía ni las sincroniza con Meta: sirven para saber qué plantillas
 * hay por objetivo, avisar cuando falta una aprobada y decirle a la IA qué variables tiene cada una.
 */
export default function PlantillasCampana({ plantillas, puedeAdministrar }: { plantillas: PlantillaCampana[]; puedeAdministrar: boolean }) {
  const [editando, setEditando] = useState<PlantillaCampana | 'nueva' | null>(null)
  const [pending, start] = useTransition()
  const confirmar = useConfirm()
  const toast = useToast()

  const borrar = async (p: PlantillaCampana) => {
    if (!(await confirmar({ titulo: `¿Eliminar la plantilla “${p.nombre}”?`, texto: 'Solo se borra del CRM (no de Meta). Las campañas que la usan quedan sin plantilla vinculada.', confirmar: 'Eliminar', peligro: true }))) return
    start(async () => { const r = await eliminarPlantilla(p.id); toast(r.ok ? { texto: 'Plantilla eliminada' } : { tipo: 'error', texto: r.error ?? 'Error' }) })
  }

  return (
    <section className="card space-y-4 p-4 sm:p-5" aria-labelledby="plantillas-titulo">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 id="plantillas-titulo" className="flex items-center gap-2 text-base font-semibold"><MessageSquareText size={18} className="text-rs-lime" />Plantillas de WhatsApp</h2>
          <p className="mt-0.5 max-w-2xl text-xs text-rs-muted">Los mensajes de campaña salen como plantilla aprobada de Meta. Cargá acá las que tiene el negocio (con su texto y qué lleva cada variable) para que la IA sepa qué escribir y avise cuando falta una aprobada.</p>
        </div>
        {puedeAdministrar && <button onClick={() => setEditando('nueva')} className="btn btn-sm btn-primary"><Plus size={14} />Nueva plantilla</button>}
      </div>

      <ul className="flex flex-wrap gap-2" aria-label="Cobertura por objetivo">
        {OBJETIVOS_IA.map((o) => {
          const n = plantillas.filter((p) => plantillaUsable(p) && p.objetivo === o.value).length
          return <li key={o.value} className={'badge ' + (n ? 'bg-rs-ok/15 text-rs-ok' : 'bg-rs-warn/15 text-rs-warn')}>{o.label}: {n ? `${n} aprobada${n === 1 ? '' : 's'}` : 'sin plantilla aprobada'}</li>
        })}
      </ul>

      {plantillas.length === 0 ? (
        <EstadoVacio icono={<MessageSquareText size={24} />} titulo="Todavía no cargaste plantillas" texto={puedeAdministrar ? 'Cargá las plantillas aprobadas por Meta que usa este negocio. Podés usar “Generar con IA” igual para tener ideas de mensaje.' : 'Un dueño o administrador puede cargar las plantillas del negocio.'} />
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[640px]">
            <thead className="border-b border-rs-border"><tr><th className="th">Plantilla</th><th className="th">Objetivo</th><th className="th">Estado</th><th className="th">Variables</th>{puedeAdministrar && <th className="th text-right">Acciones</th>}</tr></thead>
            <tbody>
              {plantillas.map((p) => {
                const texto = p.variables.filter((v) => v.tipo === 'texto').length
                return (
                  <tr key={p.id} className={'border-b border-rs-border/60 last:border-0 ' + (p.activa ? '' : 'opacity-60')}>
                    <td className="td"><span className="font-medium">{p.nombre}</span> <span className="text-xs text-rs-muted">({p.idioma}){p.activa ? '' : ' · inactiva'}</span>{p.cuerpo && <div className="mt-0.5 line-clamp-1 max-w-md text-xs text-rs-muted">{p.cuerpo}</div>}</td>
                    <td className="td">{labelObjetivo(p.objetivo)}</td>
                    <td className="td"><span className={'badge ' + claseEstado(p.estado)}>{labelEstadoPlantilla(p.estado)}</span></td>
                    <td className="td text-sm text-rs-muted">{p.variables.length === 0 ? 'Sin variables' : `${p.variables.length - texto} dato${p.variables.length - texto === 1 ? '' : 's'} · ${texto} de texto libre`}</td>
                    {puedeAdministrar && <td className="td"><div className="flex justify-end gap-1.5"><button onClick={() => setEditando(p)} aria-label="Editar plantilla" className="btn btn-sm"><Pencil size={13} /></button><button disabled={pending} onClick={() => borrar(p)} aria-label="Eliminar plantilla" className="btn btn-sm btn-danger"><Trash2 size={13} /></button></div></td>}
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}

      {editando && <Modal titulo={editando === 'nueva' ? 'Nueva plantilla' : 'Editar plantilla'} ancho="max-w-2xl" onClose={() => setEditando(null)}><PlantillaForm plantilla={editando === 'nueva' ? undefined : editando} onDone={() => setEditando(null)} /></Modal>}
    </section>
  )
}

type Ajuste = { nombre: string; tipo: 'dato' | 'texto'; ejemplo: string; max: number }

function PlantillaForm({ plantilla, onDone }: { plantilla?: PlantillaCampana; onDone: () => void }) {
  const { state, pending, formProps } = useAccionFormulario(guardarPlantilla, { okTexto: plantilla ? 'Plantilla actualizada' : 'Plantilla cargada' })
  const [cuerpo, setCuerpo] = useState(plantilla?.cuerpo ?? '')
  const [ajustes, setAjustes] = useState<Record<number, Ajuste>>(() => Object.fromEntries((plantilla?.variables ?? []).map((v) => [v.pos, { nombre: v.nombre, tipo: v.tipo, ejemplo: v.ejemplo, max: v.max }])))
  useEffect(() => { if (state?.ok) onDone() }, [state]) // eslint-disable-line react-hooks/exhaustive-deps

  // las variables salen del texto: {{1}}, {{2}}…
  const posiciones = useMemo(() => posicionesDeCuerpo(cuerpo), [cuerpo])
  const ajuste = (n: number): Ajuste => ajustes[n] ?? { nombre: n === 1 ? 'nombre' : `variable ${n}`, tipo: 'dato', ejemplo: n === 1 ? 'Facu' : '', max: MAX_VARIABLE_DEFECTO }
  const poner = (n: number, cambio: Partial<Ajuste>) => setAjustes((a) => ({ ...a, [n]: { ...ajuste(n), ...cambio } }))
  const variables: VariablePlantilla[] = posiciones.map((n) => ({ pos: n, ...ajuste(n) }))
  const consecutivas = posiciones.every((n, i) => n === i + 1)

  return (
    <form {...formProps} className="grid grid-cols-2 gap-3" noValidate>
      {plantilla && <input type="hidden" name="id" value={plantilla.id} />}
      <input type="hidden" name="variables" value={JSON.stringify(variables)} />
      <div className="col-span-2 sm:col-span-1"><label className="label" htmlFor="pl_nombre">Nombre en Meta *</label><input id="pl_nombre" name="nombre" defaultValue={plantilla?.nombre ?? ''} placeholder="cosme_sushi_libre" maxLength={120} autoCapitalize="none" className="input w-full" required /></div>
      <div className="col-span-2 sm:col-span-1"><label className="label" htmlFor="pl_idioma">Idioma</label><select id="pl_idioma" name="idioma" defaultValue={plantilla?.idioma ?? 'es'} className="input w-full">{IDIOMAS_PLANTILLA.map((i) => <option key={i} value={i}>{i}</option>)}</select></div>
      <p className="col-span-2 -mt-1 text-xs text-rs-muted">El nombre va exactamente como figura en Meta: minúsculas, números y guion bajo.</p>
      <div><label className="label" htmlFor="pl_obj">Objetivo</label><select id="pl_obj" name="objetivo" defaultValue={plantilla?.objetivo ?? 'promocion'} className="input w-full">{OBJETIVOS_PLANTILLA.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}</select></div>
      <div><label className="label" htmlFor="pl_estado">Estado en Meta</label><select id="pl_estado" name="estado" defaultValue={plantilla?.estado ?? 'aprobada'} className="input w-full">{ESTADOS_PLANTILLA.map((e) => <option key={e.value} value={e.value}>{e.label}</option>)}</select></div>
      <div className="col-span-2">
        <label className="label" htmlFor="pl_cuerpo">Texto de la plantilla</label>
        <textarea id="pl_cuerpo" name="cuerpo" rows={5} maxLength={1024} value={cuerpo} onChange={(e) => setCuerpo(e.target.value)} placeholder={'Hola {{1}}! Este martes tenemos {{2}}. Reservá por acá y te esperamos.'} className="input w-full" />
        <p className="mt-1 text-xs text-rs-muted">Copiá el texto tal cual está en Meta, con {'{{1}}'}, {'{{2}}'}… donde van las variables.</p>
      </div>
      {posiciones.length > 0 && (
        <div className="col-span-2 space-y-2">
          <span className="label">Variables</span>
          {!consecutivas && <p role="alert" className="text-xs text-rs-danger">Las variables tienen que ser {'{{1}}'}, {'{{2}}'}, {'{{3}}'}… en orden y sin saltear números.</p>}
          {posiciones.map((n) => {
            const a = ajuste(n)
            return (
              <div key={n} className="grid grid-cols-[3rem_1fr_7.5rem] items-end gap-2 rounded-md border border-rs-border p-2 sm:grid-cols-[3rem_1fr_7.5rem_1fr_5rem]">
                <span className="pb-2 text-sm font-semibold text-rs-lime">{`{{${n}}}`}</span>
                <div><label className="label" htmlFor={`pv_n${n}`}>Qué es</label><input id={`pv_n${n}`} value={a.nombre} maxLength={40} onChange={(e) => poner(n, { nombre: e.target.value })} className="input w-full" /></div>
                <div><label className="label" htmlFor={`pv_t${n}`}>Lo completa</label><select id={`pv_t${n}`} value={a.tipo} onChange={(e) => poner(n, { tipo: e.target.value as 'dato' | 'texto' })} className="input w-full"><option value="dato">El sistema (dato)</option><option value="texto">La IA (texto libre)</option></select></div>
                <div className="col-span-3 sm:col-span-1"><label className="label" htmlFor={`pv_e${n}`}>Ejemplo</label><input id={`pv_e${n}`} value={a.ejemplo} maxLength={200} onChange={(e) => poner(n, { ejemplo: e.target.value })} placeholder="Como figura en Meta" className="input w-full" /></div>
                {a.tipo === 'texto' && <div className="col-span-3 sm:col-span-1"><label className="label" htmlFor={`pv_m${n}`}>Máx. letras</label><input id={`pv_m${n}`} type="number" min={5} max={MAX_VARIABLE_TOPE} value={a.max} onChange={(e) => poner(n, { max: Math.min(MAX_VARIABLE_TOPE, Math.max(5, Number(e.target.value) || MAX_VARIABLE_DEFECTO)) })} className="input w-full" /></div>}
              </div>
            )
          })}
          <p className="text-xs text-rs-muted">“Dato” = lo completa el flujo de envío (nombre, fecha, código…). “Texto libre” = lo que puede proponer la IA. Meta no admite saltos de línea ni muchos espacios dentro de una variable.</p>
        </div>
      )}
      <label className="col-span-2 flex items-center gap-2 text-sm"><input type="checkbox" name="activa" defaultChecked={plantilla?.activa ?? true} /> Activa (se puede elegir en las campañas)</label>
      {state && !state.ok && <p role="alert" className="col-span-2 animate-fade-in text-sm text-rs-danger">{state.error}</p>}
      <div className="col-span-2 flex justify-end gap-2">
        <button type="button" onClick={onDone} className="btn">Cancelar</button>
        <button disabled={pending || !consecutivas} className="btn btn-primary">{pending && <Spinner />}{pending ? 'Guardando…' : plantilla ? 'Guardar cambios' : 'Cargar plantilla'}</button>
      </div>
    </form>
  )
}
