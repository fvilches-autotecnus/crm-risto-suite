'use client'

import { useEffect, useState, useTransition } from 'react'
import { ExternalLink, Plus, Trash2 } from 'lucide-react'
import { borrarSitioWeb, guardarSitioWeb } from '@/app/(panel)/sitios-web-actions'
import { useConfirm, useToast } from '@/components/feedback'
import MarcaCampos from '@/components/marca-campos'
import { Spinner } from '@/components/ui'
import { useAccionFormulario } from '@/components/use-accion-formulario'
import type { Marca } from '@/lib/marca'

export interface SitioWebCfg { id: string; alias: string; nombre: string; titulo: string | null; subtitulo: string | null; sedes: string[]; marca: Partial<Marca>; activo: boolean }
interface SedeLista { id: string; nombre: string }

/** Sitios de reservas que agrupan las sedes que el negocio elija (cada uno con su dirección, textos y marca). */
export default function SitiosWeb({ sitios, sedes }: { sitios: SitioWebCfg[]; sedes: SedeLista[] }) {
  const [origen, setOrigen] = useState('')
  useEffect(() => setOrigen(window.location.origin), [])
  return (
    <section id="sitios-agrupados" className="mt-6 space-y-3 border-t border-rs-border pt-4">
      <div>
        <h3 className="font-bold">Sitios que agrupan sedes</h3>
        <p className="text-xs text-rs-muted">Una dirección propia que muestra <b className="text-rs-text">solo las sedes que elijas</b> (por ejemplo, “Nenina Norte” con dos de tus tres sedes), con su propio título y marca. Sigue valiendo el sitio del negocio (todas las sedes) y la dirección propia de cada sede.</p>
      </div>
      {sitios.map((s) => <FormSitio key={s.id + s.alias} sitio={s} sedes={sedes} origen={origen} />)}
      <details className="rounded-md border border-dashed border-rs-control px-3 py-2">
        <summary className="flex cursor-pointer items-center gap-1.5 text-sm font-medium"><Plus size={14} />Nuevo sitio con varias sedes</summary>
        <div className="mt-3"><FormSitio sitio={null} sedes={sedes} origen={origen} /></div>
      </details>
    </section>
  )
}

function FormSitio({ sitio, sedes, origen }: { sitio: SitioWebCfg | null; sedes: SedeLista[]; origen: string }) {
  const { state, pending, formProps } = useAccionFormulario(guardarSitioWeb, { reiniciar: !sitio, okTexto: sitio ? 'Sitio guardado' : 'Sitio creado' })
  const confirmar = useConfirm()
  const toast = useToast()
  const [borrando, startBorrar] = useTransition()
  const [alias, setAlias] = useState(sitio?.alias ?? '')
  const enlace = `${origen}/reservar/${sitio?.alias ?? ''}`
  useEffect(() => { if (state?.ok && !sitio) setAlias('') }, [state]) // eslint-disable-line react-hooks/exhaustive-deps
  const cuerpo = (
    <form {...formProps} className="space-y-3">
      {sitio && <input type="hidden" name="id" value={sitio.id} />}
      <div className="grid gap-3 sm:grid-cols-2">
        <div><label className="label" htmlFor={`sw_nombre_${sitio?.id ?? 'nuevo'}`}>Nombre (para reconocerlo acá)</label><input id={`sw_nombre_${sitio?.id ?? 'nuevo'}`} name="nombre" defaultValue={sitio?.nombre ?? ''} maxLength={60} placeholder="ej. Nenina Norte" className="input w-full" required /></div>
        <div><label className="label" htmlFor={`sw_alias_${sitio?.id ?? 'nuevo'}`}>Dirección del sitio</label>
          <div className="flex items-center gap-1"><span className="font-mono text-xs text-rs-muted">/reservar/</span><input id={`sw_alias_${sitio?.id ?? 'nuevo'}`} name="alias" value={alias} onChange={(e) => setAlias(e.target.value)} placeholder="ej. nenina-norte" maxLength={60} autoCapitalize="none" autoCorrect="off" spellCheck={false} className="input min-w-0 flex-1 font-mono" required /></div></div>
      </div>
      <fieldset className="space-y-1.5">
        <legend className="label">Sedes que muestra</legend>
        <div className="flex flex-wrap gap-2">
          {sedes.map((x) => (
            <label key={x.id} className="inline-flex cursor-pointer items-center gap-2 rounded-full border border-rs-control px-3 py-1.5 text-sm has-[:checked]:border-rs-lime/70 has-[:checked]:bg-rs-lime/10">
              <input type="checkbox" name="sedes" value={x.id} defaultChecked={sitio?.sedes.includes(x.id) ?? false} className="h-4 w-4 accent-[#c8e62b]" />{x.nombre}
            </label>
          ))}
        </div>
        <p className="text-xs text-rs-muted">Con una sola sede el cliente no elige sede; con varias, elige entre las que marques acá. Una sede que no se ofrece en el sitio (o sin WhatsApp) no aparece aunque esté marcada.</p>
      </fieldset>
      <div className="grid gap-3 sm:grid-cols-2">
        <div><label className="label" htmlFor={`sw_titulo_${sitio?.id ?? 'nuevo'}`}>Título de la página</label><input id={`sw_titulo_${sitio?.id ?? 'nuevo'}`} name="titulo" defaultValue={sitio?.titulo ?? ''} maxLength={80} placeholder="Por defecto: el del negocio" className="input w-full" /></div>
        <div><label className="label" htmlFor={`sw_sub_${sitio?.id ?? 'nuevo'}`}>Subtítulo</label><input id={`sw_sub_${sitio?.id ?? 'nuevo'}`} name="subtitulo" defaultValue={sitio?.subtitulo ?? ''} maxLength={160} placeholder="Por defecto: el del negocio" className="input w-full" /></div>
      </div>
      <fieldset className="space-y-3 rounded-rs-lg border border-rs-border p-3">
        <legend className="px-1 text-xs font-semibold uppercase tracking-[0.05em] text-rs-muted">Marca de este sitio (opcional)</legend>
        <p className="text-xs text-rs-muted">Si la dejás vacía usa la marca del negocio.</p>
        <MarcaCampos marca={sitio?.marca} prefijo={`sw_${sitio?.id ?? 'nuevo'}`} />
      </fieldset>
      <label className="flex items-center gap-2 text-sm"><input type="checkbox" name="activo" defaultChecked={sitio?.activo ?? true} className="h-4 w-4 accent-[#c8e62b]" />Sitio activo (apagado, la dirección muestra “no encontrado”)</label>
      {state && !state.ok && <p role="alert" className="text-sm text-rs-danger">{state.error}</p>}
      <div className="flex flex-wrap items-center justify-between gap-2">
        {sitio ? (
          <button type="button" disabled={borrando} className="btn btn-danger" onClick={async () => {
            if (!(await confirmar({ titulo: `¿Borrar el sitio “${sitio.nombre}”?`, texto: `La dirección /reservar/${sitio.alias} dejará de funcionar. Las sedes y sus reservas no se tocan.`, confirmar: 'Borrar', peligro: true }))) return
            startBorrar(async () => { const r = await borrarSitioWeb(sitio.id); toast(r.ok ? { texto: 'Sitio borrado' } : { tipo: 'error', texto: r.error ?? 'No se pudo borrar' }) })
          }}><Trash2 size={14} />Borrar</button>
        ) : <span />}
        <button disabled={pending} className="btn btn-primary">{pending && <Spinner />}{pending ? 'Guardando…' : sitio ? 'Guardar sitio' : 'Crear sitio'}</button>
      </div>
    </form>
  )
  if (!sitio) return cuerpo
  return (
    <details className="rounded-md border border-rs-border/60 px-3 py-2">
      <summary className="flex cursor-pointer flex-wrap items-center gap-2 text-sm font-medium">
        {sitio.nombre}<span className="font-mono text-xs font-normal text-rs-muted">/reservar/{sitio.alias}</span>
        {!sitio.activo && <span className="rounded-full bg-rs-warn/15 px-2 py-0.5 text-[11px] font-bold uppercase text-rs-warn">Apagado</span>}
        {origen && <a href={enlace} target="_blank" rel="noopener noreferrer" onClick={(e) => e.stopPropagation()} className="ml-auto inline-flex items-center gap-1 text-xs text-rs-lime hover:underline"><ExternalLink size={12} />Abrir</a>}
      </summary>
      <div className="mt-3">{cuerpo}</div>
    </details>
  )
}
