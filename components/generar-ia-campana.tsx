'use client'

import { useEffect, useMemo, useState, useTransition } from 'react'
import { AlertTriangle, Check, Copy, Sparkles, X } from 'lucide-react'
import { cargarContextoIA, generarTextoCampana } from '@/app/(panel)/campanas-ia-actions'
import { useToast } from '@/components/feedback'
import Modal from '@/components/modal'
import { Spinner } from '@/components/ui'
import {
  OBJETIVOS_IA, TONOS_IA, labelObjetivo, objetivoDeTipo, plantillaUsable, segmentoSugerido,
  type ContextoIA, type ObjetivoIA, type ResultadoIA, type Segmento, type TonoIA, type VarianteIA,
} from '@/lib/campanas-ia'

export interface UsoIA { mensaje: string; plantilla_id: string | null; variables: Record<string, string> | null }

/**
 * Botón "Generar con IA" del formulario de campañas. Dos usos:
 *  · Ideas de mensaje: 3 textos completos para inspirarse o pedirle a Meta una plantilla nueva.
 *  · Variables de una plantilla aprobada: la IA solo escribe lo que va en las variables de texto libre; el texto de la plantilla no se toca.
 * No aparece si la función todavía no está habilitada (o el usuario no puede editar campañas).
 */
export default function GenerarIACampana({ tipo, plantillaId, variables, onUsar, onQuitarPlantilla }: {
  tipo: string
  plantillaId: string | null
  variables: Record<string, string> | null
  onUsar: (u: UsoIA) => void
  onQuitarPlantilla: () => void
}) {
  const [ctx, setCtx] = useState<ContextoIA | null>(null)
  const [abierto, setAbierto] = useState(false)
  useEffect(() => { let vivo = true; cargarContextoIA().then((c) => { if (vivo) setCtx(c) }).catch(() => { if (vivo) setCtx(null) }); return () => { vivo = false } }, [])
  if (!ctx?.disponible) return null
  const vinculada = plantillaId ? ctx.plantillas.find((p) => p.id === plantillaId) : null
  return (
    <div className="col-span-2 space-y-2">
      <div className="flex flex-wrap items-center gap-2">
        <button type="button" onClick={() => setAbierto(true)} className="btn btn-sm"><Sparkles size={14} />Generar con IA</button>
        <span className="text-xs text-rs-muted">Ideas de mensaje o el texto de las variables de una plantilla</span>
      </div>
      {vinculada && (
        <div className="flex flex-wrap items-center gap-2 rounded-md border border-rs-border bg-rs-raised/40 px-3 py-2 text-xs">
          <span className="text-rs-muted">Plantilla de Meta:</span><span className="font-semibold">{vinculada.nombre}</span><span className="text-rs-muted">({vinculada.idioma})</span>
          {variables && Object.keys(variables).length > 0 && <span className="text-rs-muted">· {Object.entries(variables).map(([k, v]) => `{{${k}}} = ${v}`).join(' · ')}</span>}
          <button type="button" onClick={onQuitarPlantilla} className="ml-auto inline-flex items-center gap-1 text-rs-muted hover:text-rs-danger"><X size={12} />Quitar</button>
        </div>
      )}
      {abierto && (
        <Modal titulo="Generar con IA" ancho="max-w-2xl" onClose={() => setAbierto(false)}>
          <PanelIA ctx={ctx} tipo={tipo} plantillaInicial={plantillaId} onUsar={(u) => { onUsar(u); setAbierto(false) }} />
        </Modal>
      )}
    </div>
  )
}

function PanelIA({ ctx, tipo, plantillaInicial, onUsar }: { ctx: ContextoIA; tipo: string; plantillaInicial: string | null; onUsar: (u: UsoIA) => void }) {
  const toast = useToast()
  const [objetivo, setObjetivo] = useState<ObjetivoIA>(objetivoDeTipo(tipo))
  const [modo, setModo] = useState<'ideas' | 'plantilla'>(plantillaInicial ? 'plantilla' : 'ideas')
  const [plantillaSel, setPlantillaSel] = useState(plantillaInicial ?? '')
  const [tono, setTono] = useState<TonoIA>('cercano')
  const [seg, setSeg] = useState<Segmento>(segmentoSugerido(objetivoDeTipo(tipo)))
  const [detalle, setDetalle] = useState('')
  const [resultado, setResultado] = useState<ResultadoIA | null>(null)
  const [pending, start] = useTransition()

  const usables = useMemo(() => ctx.plantillas.filter(plantillaUsable), [ctx.plantillas])
  const delObjetivo = usables.filter((p) => p.objetivo === objetivo)
  const enRevision = ctx.plantillas.filter((p) => p.activa && p.estado === 'pendiente' && p.objetivo === objetivo)
  // plantillas con algo para escribir: texto cargado y al menos una variable de texto libre (las del objetivo elegido primero)
  const conTexto = usables.filter((p) => p.cuerpo && p.variables.some((v) => v.tipo === 'texto')).sort((a, b) => Number(b.objetivo === objetivo) - Number(a.objetivo === objetivo) || a.nombre.localeCompare(b.nombre))
  const plantilla = conTexto.find((p) => p.id === plantillaSel) ?? null

  const cambiarObjetivo = (o: ObjetivoIA) => { setObjetivo(o); setSeg(segmentoSugerido(o)); setResultado(null); setPlantillaSel(''); if (modo === 'plantilla') setModo('ideas') }
  const generar = () => {
    setResultado(null)
    start(async () => {
      const r = await generarTextoCampana({ modo, objetivo, tono, detalle, segmento: seg, plantillaId: modo === 'plantilla' ? plantilla?.id : undefined })
      setResultado(r)
    })
  }
  const copiar = async (t: string) => { try { await navigator.clipboard.writeText(t); toast({ texto: 'Texto copiado' }) } catch { toast({ tipo: 'error', texto: 'No se pudo copiar' }) } }
  const usar = (v: VarianteIA) => {
    if (modo === 'plantilla' && plantilla) onUsar({ mensaje: v.vista ?? '', plantilla_id: plantilla.id, variables: v.variables ?? null })
    else onUsar({ mensaje: v.texto ?? '', plantilla_id: null, variables: null })
    toast({ texto: 'Texto cargado en la campaña: revisalo y editalo antes de guardar' })
  }
  const puedeGenerar = !pending && (modo === 'ideas' || !!plantilla)

  return (
    <div className="space-y-4">
      <div>
        <span className="label">Objetivo</span>
        <div className="flex flex-wrap gap-2" role="group" aria-label="Objetivo del mensaje">
          {OBJETIVOS_IA.map((o) => <button key={o.value} type="button" onClick={() => cambiarObjetivo(o.value)} title={o.ayuda} aria-pressed={objetivo === o.value} className={'btn btn-sm ' + (objetivo === o.value ? 'btn-primary' : '')}>{o.label}</button>)}
        </div>
      </div>

      {delObjetivo.length === 0 && (
        <div role="status" className="flex gap-2 rounded-md border border-rs-warn/40 bg-rs-warn/10 px-3 py-2 text-sm text-rs-warn">
          <AlertTriangle size={16} className="mt-0.5 shrink-0" />
          <p>Este negocio no tiene ninguna plantilla <strong>aprobada</strong> de «{labelObjetivo(objetivo)}»{enRevision.length ? ` (hay ${enRevision.length} en revisión)` : ''}. Podés generar ideas, pero para enviarlas hay que pedirle a Meta una plantilla nueva y esperar su aprobación.</p>
        </div>
      )}

      <div>
        <span className="label">Qué querés generar</span>
        <div className="grid gap-2 sm:grid-cols-2" role="radiogroup">
          <button type="button" role="radio" aria-checked={modo === 'ideas'} onClick={() => { setModo('ideas'); setResultado(null) }} className={'rounded-md border px-3 py-2 text-left text-sm ' + (modo === 'ideas' ? 'border-rs-lime bg-rs-lime/10' : 'border-rs-border hover:bg-rs-raised/50')}>
            <span className="font-semibold">Ideas de mensaje</span><span className="block text-xs text-rs-muted">3 textos completos para inspirarte o pedir una plantilla nueva</span>
          </button>
          <button type="button" role="radio" aria-checked={modo === 'plantilla'} disabled={conTexto.length === 0} onClick={() => { setModo('plantilla'); setResultado(null); if (!plantillaSel && conTexto[0]) setPlantillaSel(conTexto[0].id) }} className={'rounded-md border px-3 py-2 text-left text-sm disabled:cursor-not-allowed disabled:opacity-50 ' + (modo === 'plantilla' ? 'border-rs-lime bg-rs-lime/10' : 'border-rs-border hover:bg-rs-raised/50')}>
            <span className="font-semibold">Variables de una plantilla</span><span className="block text-xs text-rs-muted">{conTexto.length === 0 ? 'No hay plantillas aprobadas con variables de texto libre' : 'La IA escribe solo lo que va en las variables; el texto de la plantilla no se toca'}</span>
          </button>
        </div>
      </div>

      {modo === 'plantilla' && (
        <div>
          <label className="label" htmlFor="ia_plantilla">Plantilla</label>
          <select id="ia_plantilla" value={plantilla?.id ?? ''} onChange={(e) => { setPlantillaSel(e.target.value); setResultado(null) }} className="input w-full">
            {conTexto.map((p) => <option key={p.id} value={p.id}>{p.nombre} ({p.idioma}) · {labelObjetivo(p.objetivo)}</option>)}
          </select>
          {plantilla?.cuerpo && <p className="mt-2 whitespace-pre-line rounded-md bg-rs-raised/50 p-3 text-xs text-rs-muted">{plantilla.cuerpo}</p>}
          {plantilla && <p className="mt-1 text-xs text-rs-muted">La IA escribe: {plantilla.variables.filter((v) => v.tipo === 'texto').map((v) => `{{${v.pos}}} ${v.nombre} (hasta ${v.max} caracteres)`).join(' · ')}. El resto lo completa el flujo de envío.</p>}
        </div>
      )}

      <div className="grid gap-3 sm:grid-cols-2">
        <div>
          <label className="label" htmlFor="ia_tono">Tono</label>
          <select id="ia_tono" value={tono} onChange={(e) => setTono(e.target.value as TonoIA)} className="input w-full">{TONOS_IA.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}</select>
        </div>
        <div>
          <label className="label" htmlFor="ia_seg">Destinatarios</label>
          <select id="ia_seg" value={seg.tipo} onChange={(e) => {
            const t = e.target.value
            setSeg(t === 'inactivos' ? { tipo: 'inactivos', desde: 30, hasta: 365 } : t === 'cumple' ? { tipo: 'cumple', dias: 30 } : t === 'etiqueta' ? { tipo: 'etiqueta', id: ctx.etiquetas[0]?.id ?? '' } : { tipo: 'todos' })
          }} className="input w-full">
            <option value="todos">Todos los clientes</option>
            <option value="inactivos">Clientes que no vienen hace un tiempo</option>
            <option value="cumple">Cumpleañeros próximos</option>
            {ctx.etiquetas.length > 0 && <option value="etiqueta">Clientes con una etiqueta</option>}
          </select>
        </div>
        {seg.tipo === 'inactivos' && (
          <div className="flex items-end gap-2 sm:col-span-2">
            <div><label className="label" htmlFor="ia_desde">Última reserva hace entre</label><input id="ia_desde" type="number" min={1} max={1500} value={seg.desde} onChange={(e) => setSeg({ ...seg, desde: Number(e.target.value) || 1 })} className="input w-24" /></div>
            <div><label className="label" htmlFor="ia_hasta">y</label><input id="ia_hasta" type="number" min={1} max={1500} value={seg.hasta} onChange={(e) => setSeg({ ...seg, hasta: Number(e.target.value) || 1 })} className="input w-24" /></div>
            <span className="pb-2 text-sm text-rs-muted">días</span>
          </div>
        )}
        {seg.tipo === 'cumple' && (
          <div className="flex items-end gap-2 sm:col-span-2">
            <div><label className="label" htmlFor="ia_dias">Cumplen años en los próximos</label><input id="ia_dias" type="number" min={0} max={90} value={seg.dias} onChange={(e) => setSeg({ ...seg, dias: Number(e.target.value) || 0 })} className="input w-24" /></div>
            <span className="pb-2 text-sm text-rs-muted">días</span>
          </div>
        )}
        {seg.tipo === 'etiqueta' && (
          <div className="sm:col-span-2"><label className="label" htmlFor="ia_etq">Etiqueta</label>
            <select id="ia_etq" value={seg.id} onChange={(e) => setSeg({ tipo: 'etiqueta', id: e.target.value })} className="input w-full">{ctx.etiquetas.map((e) => <option key={e.id} value={e.id}>{e.nombre}</option>)}</select>
          </div>
        )}
      </div>

      <div>
        <label className="label" htmlFor="ia_detalle">Datos de la oferta o la ocasión</label>
        <textarea id="ia_detalle" rows={3} maxLength={700} value={detalle} onChange={(e) => setDetalle(e.target.value)} placeholder="Ej. 2x1 en sushi libre los martes hasta el 30/11, reservando por WhatsApp. La IA no inventa precios ni fechas: escribí acá lo que quieras que diga." className="input w-full" />
      </div>

      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-xs text-rs-muted">A la IA solo van el objetivo, el tono, lo que escribas acá y cuántos clientes tiene el segmento: nunca nombres ni teléfonos.</p>
        <button type="button" disabled={!puedeGenerar} onClick={generar} className="btn btn-primary">{pending ? <Spinner /> : <Sparkles size={14} />}{pending ? 'Generando…' : resultado?.ok ? 'Generar otras' : 'Generar'}</button>
      </div>

      {resultado && !resultado.ok && <p role="alert" className="animate-fade-in text-sm text-rs-danger">{resultado.error}</p>}
      {resultado?.ok && (
        <div className="space-y-3 animate-fade-in">
          <p className="text-xs text-rs-muted">Destinatarios: {resultado.segmento.descripcion} · <strong className="text-rs-text">{resultado.segmento.cantidad}</strong> cliente{resultado.segmento.cantidad === 1 ? '' : 's'} · te quedan {resultado.restantes} generaciones hoy</p>
          {resultado.variantes.map((v, i) => (
            <div key={i} className="rounded-md border border-rs-border p-3">
              <div className="mb-1 flex items-center justify-between gap-2"><span className="text-xs font-semibold uppercase tracking-wide text-rs-muted">{v.titulo}</span></div>
              <p className="whitespace-pre-line text-sm">{modo === 'plantilla' ? v.vista : v.texto}</p>
              {modo === 'plantilla' && v.variables && <p className="mt-1 text-xs text-rs-muted">{Object.entries(v.variables).map(([k, t]) => `{{${k}}} = ${t}`).join(' · ')}</p>}
              <div className="mt-2 flex justify-end gap-2">
                {modo === 'ideas' && <button type="button" onClick={() => copiar(v.texto ?? '')} className="btn btn-sm"><Copy size={13} />Copiar</button>}
                <button type="button" onClick={() => usar(v)} className="btn btn-sm btn-primary"><Check size={13} />Usar este</button>
              </div>
            </div>
          ))}
          {modo === 'ideas' && <p className="text-xs text-rs-muted">Las ideas no se pueden enviar tal cual: los mensajes de campaña salen como plantilla aprobada de Meta. Si una te gusta, usala como base para pedir una plantilla nueva (los {'{{1}}'} son las variables).</p>}
        </div>
      )}
    </div>
  )
}
