'use client'

import { useEffect, useState } from 'react'
import { ExternalLink } from 'lucide-react'
import { guardarReservasWebSede } from '@/app/(panel)/config-sedes-actions'
import { useToast } from '@/components/feedback'
import GrupoSede from '@/components/grupo-sede'
import { Spinner } from '@/components/ui'
import { useAccionFormulario } from '@/components/use-accion-formulario'
import type { ConfigReservasWeb, SedeCfg } from '@/components/reservas-web-config'
import { DIAS_SEMANA } from '@/lib/dias'
import { PLANTILLA_WA_DEFECTO, VARIABLES_WA } from '@/lib/reservas-config'

const sinTildes = (t: string) => t.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '')

/** Sitio de reservas de UNA sede: lo suyo de siempre (activa, horarios, mesa, mensaje) y los grupos de ajustes que puede personalizar o heredar del negocio.
 *  `config` es la configuración efectiva (la del negocio con lo propio de la sede encima); `pisados` dice qué grupos tiene personalizados. */
export default function ReservasWebSede({ sede, config, pisados, slug, tiposDisponibles }: { sede: SedeCfg; config: ConfigReservasWeb; pisados: Record<string, boolean>; slug: string; tiposDisponibles: { value: string; label: string }[] }) {
  const { state, pending, formProps } = useAccionFormulario(guardarReservasWebSede)
  const toast = useToast()
  const [origen, setOrigen] = useState('')
  const [alias, setAlias] = useState(sede.alias_web ?? '')
  const copiarEnlace = async (t: string) => { try { await navigator.clipboard.writeText(t); toast({ texto: 'Enlace copiado' }) } catch { toast({ tipo: 'error', texto: t }) } }
  useEffect(() => setOrigen(window.location.origin), [])
  useEffect(() => { if (state?.ok) toast({ texto: `Sitio de ${sede.nombre} guardado` }) }, [state]) // eslint-disable-line react-hooks/exhaustive-deps
  const enlace = `${origen}/reservar/${slug}?sede=${sinTildes(sede.nombre)}`
  const g = (id: string) => ({ sedeId: sede.id, pisado: !!pisados[id] })
  return (
    <form {...formProps} className="space-y-4">
      <input type="hidden" name="sede_id" value={sede.id} />
      <p className="rounded-md bg-rs-raised/50 px-3 py-2 text-xs text-rs-muted">Esta es la configuración del sitio de reservas solo para <b className="text-rs-text">{sede.nombre}</b>. Cada grupo hereda lo del negocio hasta que lo personalices. Que el sitio esté activo y el modo prueba se deciden para todo el negocio.</p>
      <div className="space-y-2 rounded-md bg-rs-raised/30 p-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <label className="flex items-center gap-2 text-sm font-semibold"><input type="checkbox" name="sede_activo" defaultChecked={sede.activo} className="h-4 w-4 accent-[#c8e62b]" />{sede.nombre} se ofrece en el sitio</label>
          <span className="text-xs text-rs-muted">{sede.whatsapp ? <>WhatsApp: <b className="text-rs-text">{sede.whatsapp}</b>{sede.propio ? '' : ' (el del negocio)'}</> : <span className="text-rs-warn">Sin WhatsApp: cargalo en Sedes para poder ofrecerla</span>} · {sede.tiene_plano ? 'con plano de mesas' : 'sin plano de mesas'}</span>
        </div>
        <div className="grid gap-2 sm:grid-cols-3">
          <div><label className="label" htmlFor="ws_horarios">Horarios de esta sede</label><input id="ws_horarios" name="sede_horarios" defaultValue={sede.horarios.join(', ')} placeholder="Hereda los del sitio" className="input w-full" /></div>
          <div><label className="label" htmlFor="ws_mesa">Elegir mesa en el plano</label>
            <select id="ws_mesa" name="sede_mesa" defaultValue={sede.elegir_mesa === null ? '' : sede.elegir_mesa ? 'si' : 'no'} className="input w-full"><option value="">Como el sitio</option><option value="si">Sí</option><option value="no">No (decide un asesor)</option></select></div>
          <div><label className="label" htmlFor="ws_mensaje">Mensaje de esta sede</label><input id="ws_mensaje" name="sede_mensaje" defaultValue={sede.mensaje ?? ''} maxLength={400} placeholder="Hereda el del sitio" className="input w-full" /></div>
        </div>
        <details className="rounded-md border border-rs-border/60 px-3 py-2" open={Object.values(sede.horarios_dias ?? {}).some((h) => h.length > 0)}>
          <summary className="cursor-pointer text-sm font-medium">Horarios según el día de la semana (opcional)</summary>
          <div className="mt-2 grid gap-2 sm:grid-cols-2">
            {DIAS_SEMANA.map((d) => <div key={d.n}><label className="label" htmlFor={`ws_hd_${d.n}`}>{d.l}</label><input id={`ws_hd_${d.n}`} name={`sede_horarios_dia_${d.n}`} defaultValue={(sede.horarios_dias?.[String(d.n)] ?? []).map((h) => String(h).slice(0, 5)).join(', ')} placeholder="Los de la sede" className="input w-full" /></div>)}
          </div>
        </details>
        <p className="flex items-center gap-2 truncate font-mono text-[11px] text-rs-muted" title="Enlace directo a esta sede">{enlace}<a href={enlace} target="_blank" rel="noopener noreferrer" className="btn btn-sm"><ExternalLink size={12} />Abrir</a></p>
      </div>

      <div className="space-y-2 rounded-md border border-rs-border/60 p-3">
        <label className="label" htmlFor="ws_alias">Dirección propia del sitio de {sede.nombre}</label>
        <div className="flex flex-wrap items-center gap-2">
          <span className="font-mono text-xs text-rs-muted">{origen}/reservar/</span>
          <input id="ws_alias" name="alias_web" value={alias} onChange={(e) => setAlias(e.target.value)} placeholder="ej. nenina-san-lorenzo" maxLength={60} autoCapitalize="none" autoCorrect="off" spellCheck={false} className="input w-64 font-mono" />
        </div>
        <p className="text-xs text-rs-muted">Con una dirección propia, el sitio de esta sede muestra <b className="text-rs-text">solo {sede.nombre}</b> (el cliente no elige sede). Dejala vacía para usar solo el sitio del negocio. Letras minúsculas, números y guiones; no puede repetirse con la de otra sede ni con la de un negocio.</p>
        {sede.alias_web && alias.trim() === sede.alias_web && (
          <div className="flex flex-wrap items-center gap-2 rounded-md bg-rs-raised/50 px-3 py-2 text-sm">
            <span className="min-w-0 flex-1 truncate font-mono text-xs">{origen}/reservar/{sede.alias_web}</span>
            <button type="button" className="btn btn-sm" onClick={() => copiarEnlace(`${origen}/reservar/${sede.alias_web}`)}>Copiar</button>
            <a href={`/reservar/${sede.alias_web}`} target="_blank" rel="noopener noreferrer" className="btn btn-sm"><ExternalLink size={13} />Abrir</a>
          </div>
        )}
        <p className="text-xs text-rs-muted">¿Querés publicarla en otro dominio, por ejemplo <span className="font-mono">reservas.ristosuite.app/{alias.trim() || 'mi-sede'}</span>? Se hace con una regla en el proyecto de ese dominio que reenvíe esa dirección a <span className="font-mono">{origen}/reservar/{alias.trim() || 'mi-sede'}</span> (ver el manual).</p>
      </div>

      <GrupoSede id="reglas" titulo="Reglas de la reserva" {...g('reglas')}>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          <div><label className="label" htmlFor="ws_dias">Días hacia adelante</label><input id="ws_dias" name="dias_adelante" type="number" min={1} max={365} defaultValue={config.dias_adelante} className="input w-full" /></div>
          <div><label className="label" htmlFor="ws_horas">Anticipación (horas)</label><input id="ws_horas" name="horas_anticipacion" type="number" min={0} max={72} defaultValue={config.horas_anticipacion} className="input w-full" /></div>
          <div><label className="label" htmlFor="ws_validez">Espera de la solicitud (horas)</label><input id="ws_validez" name="validez_horas" type="number" min={1} max={168} defaultValue={config.validez_horas} className="input w-full" /></div>
          <div><label className="label" htmlFor="ws_pmin">Personas: mínimo</label><input id="ws_pmin" name="personas_min" type="number" min={1} max={100} defaultValue={config.personas_min} className="input w-full" /></div>
          <div><label className="label" htmlFor="ws_pmax">Personas: máximo</label><input id="ws_pmax" name="personas_max" type="number" min={1} max={200} defaultValue={config.personas_max} className="input w-full" /></div>
          <div><label className="label" htmlFor="ws_maxmesas">Máximo de mesas por reserva</label><input id="ws_maxmesas" name="max_mesas" type="number" min={1} max={12} defaultValue={config.max_mesas} className="input w-full" /></div>
        </div>
      </GrupoSede>

      <GrupoSede id="tipos" titulo="Tipos de reserva que se ofrecen" {...g('tipos')}>
        <div className="flex flex-wrap gap-2">{tiposDisponibles.map((t) => <label key={t.value} className="flex cursor-pointer items-center gap-1.5 rounded-full border border-rs-control px-3 py-1 text-sm has-[:checked]:border-rs-lime/60 has-[:checked]:bg-rs-lime/10"><input type="checkbox" name="tipos" value={t.value} defaultChecked={config.tipos.includes(t.value)} className="h-3.5 w-3.5 accent-[#c8e62b]" />{t.label}</label>)}</div>
        <p className="text-xs text-rs-muted">En qué días se ofrece cada tipo en esta sede se cambia en “Tipos de reserva” de esta misma pantalla.</p>
      </GrupoSede>

      <GrupoSede id="cualquiera" titulo="Cualquier ubicación disponible" {...g('cualquiera')}>
        <label className="flex items-start gap-2 text-sm"><input type="checkbox" name="cualquier_ubicacion" defaultChecked={config.cualquier_ubicacion} className="mt-0.5 h-4 w-4 accent-[#c8e62b]" /><span className="font-medium">Ofrecer “cualquier ubicación disponible”</span></label>
        <div><label className="label" htmlFor="ws_cualq">Texto de esa opción</label><input id="ws_cualq" name="texto_cualquier_ubicacion" defaultValue={config.texto_cualquier_ubicacion ?? ''} maxLength={60} placeholder="Cualquier ubicación disponible" className="input w-full" /></div>
      </GrupoSede>

      <GrupoSede id="cumple" titulo="Cumpleaños" {...g('cumple')}>
        <label className="flex items-start gap-2 text-sm"><input type="checkbox" name="pedir_cumple" defaultChecked={config.pedir_cumple} className="mt-0.5 h-4 w-4 accent-[#c8e62b]" /><span className="font-medium">Preguntar el cumpleaños (opcional para el cliente)</span></label>
      </GrupoSede>

      <GrupoSede id="escasez" titulo="Aviso de pocos lugares" {...g('escasez')}>
        <div className="grid gap-3 sm:grid-cols-3">
          <div><label className="label" htmlFor="ws_esc_modo">Qué mostrar</label>
            <select id="ws_esc_modo" name="escasez_modo" defaultValue={config.escasez_modo ?? 'off'} className="input w-full"><option value="off">No avisar</option><option value="pocos">“Quedan pocos lugares”</option><option value="cantidad">“Quedan 6 lugares” (el número exacto)</option></select></div>
          <div><label className="label" htmlFor="ws_esc_umbral">Avisar cuando queden…</label>
            <div className="flex items-center gap-2"><input id="ws_esc_umbral" name="escasez_umbral" type="number" min={1} max={500} defaultValue={config.escasez_umbral ?? 10} className="input w-24" /><span className="text-sm text-rs-muted">lugares o menos</span></div></div>
          <div><label className="label" htmlFor="ws_esc_texto">Texto (solo “pocos lugares”)</label>
            <input id="ws_esc_texto" name="escasez_texto" maxLength={40} defaultValue={config.escasez_texto ?? ''} placeholder="Quedan pocos lugares" className="input w-full" /></div>
        </div>
      </GrupoSede>

      <GrupoSede id="textos" titulo="Textos del sitio" {...g('textos')}>
        <div className="grid gap-3 sm:grid-cols-2">
          <div><label className="label" htmlFor="ws_titulo">Título de la página</label><input id="ws_titulo" name="titulo" defaultValue={config.titulo ?? ''} maxLength={80} placeholder="Por defecto: el nombre del local" className="input w-full" /></div>
          <div><label className="label" htmlFor="ws_subtitulo">Subtítulo</label><input id="ws_subtitulo" name="subtitulo" defaultValue={config.subtitulo ?? ''} maxLength={160} placeholder="Por defecto: Reservá tu mesa" className="input w-full" /></div>
        </div>
        <div>
          <label className="label" htmlFor="ws_wa">Mensaje de WhatsApp que se arma para el cliente</label>
          <textarea id="ws_wa" name="texto_whatsapp" defaultValue={config.texto_whatsapp ?? ''} rows={7} maxLength={1200} placeholder={PLANTILLA_WA_DEFECTO} className="input w-full font-mono text-xs" />
          <p className="mt-1 text-xs text-rs-muted">Vacío = el mensaje original. Variables: {VARIABLES_WA.map(([v, d]) => <code key={v} title={d} className="mr-1 rounded bg-rs-raised px-1 font-mono text-rs-lime">{`{${v}}`}</code>)}. <b className="text-rs-text">Tiene que llevar {'{codigo}'}</b>.</p>
        </div>
      </GrupoSede>

      {state && !state.ok && <p role="alert" className="text-sm text-rs-danger">{state.error}</p>}
      <div className="flex justify-end"><button disabled={pending} className="btn btn-primary">{pending && <Spinner />}{pending ? 'Guardando…' : `Guardar el sitio de ${sede.nombre}`}</button></div>
    </form>
  )
}
