'use client'

import { guardarReservasWeb } from '@/app/(panel)/reservas-web-actions'
import { useToast } from '@/components/feedback'
import { Spinner } from '@/components/ui'
import { useAccionFormulario } from '@/components/use-accion-formulario'
import { useEffect, useMemo, useState } from 'react'
import { PLANTILLA_WA_DEFECTO, VARIABLES_WA, renderPlantillaWA } from '@/lib/reservas-config'
import { Copy, ExternalLink } from 'lucide-react'
import { DIAS_SEMANA } from '@/components/config-calendario'
import MarcaCampos from '@/components/marca-campos'
import type { Marca } from '@/lib/marca'

export interface ConfigReservasWeb { activo: boolean; elegir_mesa: boolean; tipos: string[]; horarios: string[]; dias_adelante: number; horas_anticipacion: number; personas_min: number; personas_max: number; mensaje: string | null
  modo_prueba: boolean; titulo: string | null; subtitulo: string | null; texto_whatsapp: string | null; validez_horas: number; max_mesas: number; cualquier_ubicacion: boolean; texto_cualquier_ubicacion: string | null; pedir_cumple: boolean; horarios_dias?: Record<string, string[]>; escasez_modo?: 'off' | 'pocos' | 'cantidad'; escasez_umbral?: number; escasez_texto?: string | null; marca?: Marca }

/** Configuración del sitio público de reservas (/reservar/<negocio>): qué ofrece y con qué reglas. Lo demás (ubicaciones, aforo, fechas bloqueadas, planos) sale de lo ya configurado en el CRM. */
export interface SedeCfg { id: string; nombre: string; whatsapp: string; propio: boolean; activo: boolean; horarios: string[]; elegir_mesa: boolean | null; mensaje: string | null; tiene_plano: boolean; horarios_dias?: Record<string, string[]>; alias_web?: string | null }
const sinTildes = (t: string) => t.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '')

export default function ReservasWebConfig({ config, slug, tiposDisponibles, horariosSugeridos, tieneWhatsapp, sedes = [] }: { config: ConfigReservasWeb; slug: string; tieneWhatsapp: boolean; sedes?: SedeCfg[]; tiposDisponibles: { value: string; label: string }[]; horariosSugeridos: string[] }) {
  const { state, pending, formProps } = useAccionFormulario(guardarReservasWeb)
  const toast = useToast()
  const [origen, setOrigen] = useState('')
  const [plantilla, setPlantilla] = useState(config.texto_whatsapp ?? '')
  const vista = useMemo(() => renderPlantillaWA(plantilla.trim() || PLANTILLA_WA_DEFECTO, { negocio: 'Tu local', codigo: '3FA09C', nombre: 'Ana Pérez', nombre_pila: 'Ana', apellido: 'Pérez', dia: 'sábado 31 de octubre', hora: '21:00', personas: '4', ubicacion: 'SALÓN', tipo: 'Cumpleaños', mesa: 'M1 + M2', comentarios: 'Una torta con velita' }), [plantilla])
  useEffect(() => setOrigen(window.location.origin), [])
  useEffect(() => { if (state?.ok) toast({ texto: 'Configuración guardada' }) }, [state]) // eslint-disable-line react-hooks/exhaustive-deps
  const url = `${origen}/reservar/${slug}`
  const copiar = async () => { try { await navigator.clipboard.writeText(url); toast({ texto: 'Enlace copiado' }) } catch { toast({ tipo: 'error', texto: url }) } }
  return (
    <form {...formProps} className="space-y-4">
      {!tieneWhatsapp && <p role="alert" className="rounded-md border border-rs-warn/40 bg-rs-warn/10 px-3 py-2 text-sm text-rs-warn">Falta un WhatsApp: cargalo en el negocio o en cada sede. Sin eso el sitio no se puede usar, porque nadie podría recibir el mensaje que confirma la reserva.</p>}
      <p className="rounded-md bg-rs-raised/50 px-3 py-2 text-xs text-rs-muted">Cómo funciona: el sitio <b className="text-rs-text">no pide teléfono</b>. Al terminar abre WhatsApp con la solicitud escrita (lleva un código). Cuando el cliente la envía, el bot registra la reserva con el número de quien escribió; si el bot no lo hace solo, la registrás a mano desde <b className="text-rs-text">Reservas → Solicitudes web</b>. Mientras tanto no ocupa mesa ni aforo.</p>
      <label className="flex items-start gap-2 text-sm"><input type="checkbox" name="activo" defaultChecked={config.activo} className="mt-0.5 h-4 w-4 accent-[#c8e62b]" /><span><span className="font-medium">Sitio de reservas activo</span><span className="block text-xs text-rs-muted">Apagado, el enlace muestra “no encontrado”. El cliente arma su solicitud en el sitio y la reserva se registra recién cuando manda el mensaje por WhatsApp (queda en estado inicial, normalmente “Nueva”, marcada “[Sitio de prueba]”).</span></span></label>
      <div className="flex flex-wrap items-center gap-2 rounded-md bg-rs-raised/50 px-3 py-2 text-sm"><span className="min-w-0 flex-1 truncate font-mono text-xs">{url}</span><button type="button" onClick={copiar} className="btn btn-sm"><Copy size={13} />Copiar</button><a href={`/reservar/${slug}`} target="_blank" rel="noopener noreferrer" className="btn btn-sm"><ExternalLink size={13} />Abrir</a></div>
      <label className="flex items-start gap-2 text-sm"><input type="checkbox" name="elegir_mesa" defaultChecked={config.elegir_mesa} className="mt-0.5 h-4 w-4 accent-[#c8e62b]" /><span><span className="font-medium">El cliente puede elegir su mesa en el plano</span><span className="block text-xs text-rs-muted">Usa el plano de Salón y mesas. Se muestran como no disponibles las mesas con reservas confirmadas, pendientes de pago o en revisión de pago. Sin esto, siempre elige un asesor.</span></span></label>
      {sedes.length > 0 && (
        <fieldset className="space-y-3 rounded-md border border-rs-border/60 p-3">
          <legend className="label px-1">Sedes en el sitio</legend>
          <p className="text-xs text-rs-muted">El cliente elige primero la sede y de ahí sale todo lo que esa sede tiene: su WhatsApp, sus ubicaciones y aforo, sus fechas bloqueadas y su plano de mesas (una sede puede tener plano y otra no). Lo que dejes vacío acá lo hereda del sitio. Los horarios y el mensaje se pueden cambiar por sede; las ubicaciones, el aforo y el plano se arman en sus propias pantallas.</p>
          {sedes.map((s) => {
            const enlace = `${origen}/reservar/${slug}?sede=${sinTildes(s.nombre)}`
            return (
              <div key={s.id} className="space-y-2 rounded-md bg-rs-raised/30 p-3">
                <input type="hidden" name="sede_id" value={s.id} />
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <label className="flex items-center gap-2 text-sm font-semibold"><input type="checkbox" name={`sede_activo_${s.id}`} defaultChecked={s.activo} className="h-4 w-4 accent-[#c8e62b]" />{s.nombre}</label>
                  <span className="text-xs text-rs-muted">{s.whatsapp ? <>WhatsApp: <b className="text-rs-text">{s.whatsapp}</b>{s.propio ? '' : ' (el del negocio)'}</> : <span className="text-rs-warn">Sin WhatsApp: cargalo en Sedes para poder ofrecerla</span>} · {s.tiene_plano ? 'con plano de mesas' : 'sin plano de mesas'}</span>
                </div>
                <div className="grid gap-2 sm:grid-cols-3">
                  <div><label className="label" htmlFor={`sh_${s.id}`}>Horarios de esta sede</label><input id={`sh_${s.id}`} name={`sede_horarios_${s.id}`} defaultValue={s.horarios.join(', ')} placeholder="Hereda los del sitio" className="input w-full" /></div>
                  <div><label className="label" htmlFor={`sm_${s.id}`}>Elegir mesa en el plano</label>
                    <select id={`sm_${s.id}`} name={`sede_mesa_${s.id}`} defaultValue={s.elegir_mesa === null ? '' : s.elegir_mesa ? 'si' : 'no'} className="input w-full"><option value="">Como el sitio</option><option value="si">Sí</option><option value="no">No (decide un asesor)</option></select></div>
                  <div><label className="label" htmlFor={`sg_${s.id}`}>Mensaje de esta sede</label><input id={`sg_${s.id}`} name={`sede_mensaje_${s.id}`} defaultValue={s.mensaje ?? ''} maxLength={400} placeholder="Hereda el del sitio" className="input w-full" /></div>
                </div>
                <details className="rounded-md border border-rs-border/60 px-3 py-2" open={Object.values(s.horarios_dias ?? {}).some((h) => h.length > 0)}>
                  <summary className="cursor-pointer text-sm font-medium">Horarios de {s.nombre} según el día de la semana (opcional)</summary>
                  <p className="mt-1 text-xs text-rs-muted">Si un día queda vacío usa los horarios de esta sede y, si tampoco tiene, los del sitio (incluidos los de ese día de la semana).</p>
                  <div className="mt-2 grid gap-2 sm:grid-cols-2">
                    {DIAS_SEMANA.map((d) => <div key={d.n}><label className="label" htmlFor={`shd_${s.id}_${d.n}`}>{d.l}</label><input id={`shd_${s.id}_${d.n}`} name={`sede_horarios_dia_${s.id}_${d.n}`} defaultValue={(s.horarios_dias?.[String(d.n)] ?? []).map((h) => String(h).slice(0, 5)).join(', ')} placeholder="Los de la sede" className="input w-full" /></div>)}
                  </div>
                </details>
                <p className="truncate font-mono text-[11px] text-rs-muted" title="Enlace directo a esta sede">{enlace}</p>
              </div>
            )
          })}
        </fieldset>
      )}
      <fieldset><legend className="label">Tipos de reserva que se ofrecen</legend>
        <div className="flex flex-wrap gap-2">{tiposDisponibles.map((t) => <label key={t.value} className="flex cursor-pointer items-center gap-1.5 rounded-full border border-rs-control px-3 py-1 text-sm has-[:checked]:border-rs-lime/60 has-[:checked]:bg-rs-lime/10"><input type="checkbox" name="tipos" value={t.value} defaultChecked={config.tipos.includes(t.value)} className="h-3.5 w-3.5 accent-[#c8e62b]" />{t.label}</label>)}</div>
        <p className="mt-1 text-xs text-rs-muted">Son los tipos que ya existen en tus reservas. Si no marcás ninguno se ofrece solo “Común”.</p>
      </fieldset>
      <div>
        <label className="label" htmlFor="rw_horarios">Horarios</label>
        <input id="rw_horarios" name="horarios" defaultValue={config.horarios.join(', ')} placeholder={horariosSugeridos.join(', ') || '13:00, 21:00'} className="input w-full" />
        <p className="mt-1 text-xs text-rs-muted">Separados por coma. Si lo dejás vacío se usan los horarios que más se usan en tus reservas{horariosSugeridos.length ? <>: <b className="text-rs-text">{horariosSugeridos.join(', ')}</b></> : ''}. La disponibilidad de cada horario sale de tus reglas de aforo y fechas bloqueadas.</p>
        <details className="mt-2 rounded-md border border-rs-border/60 bg-rs-raised/30 px-3 py-2" open={Object.values(config.horarios_dias ?? {}).some((h) => h.length > 0)}>
          <summary className="cursor-pointer text-sm font-medium">Horarios distintos según el día de la semana (opcional)</summary>
          <p className="mt-1 text-xs text-rs-muted">Por ejemplo, los sábados abrís al mediodía y el resto de la semana solo de noche. El día que dejes vacío usa los horarios de arriba.</p>
          <div className="mt-2 grid gap-2 sm:grid-cols-2">
            {DIAS_SEMANA.map((d) => <div key={d.n}><label className="label" htmlFor={`rw_hd_${d.n}`}>{d.l}</label><input id={`rw_hd_${d.n}`} name={`horarios_dia_${d.n}`} defaultValue={(config.horarios_dias?.[String(d.n)] ?? []).map((h) => String(h).slice(0, 5)).join(', ')} placeholder="Los de arriba" className="input w-full" /></div>)}
          </div>
        </details>
      </div>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <div><label className="label" htmlFor="rw_dias">Días hacia adelante</label><input id="rw_dias" name="dias_adelante" type="number" min={1} max={365} defaultValue={config.dias_adelante} className="input w-full" /></div>
        <div><label className="label" htmlFor="rw_horas">Anticipación (horas)</label><input id="rw_horas" name="horas_anticipacion" type="number" min={0} max={72} defaultValue={config.horas_anticipacion} className="input w-full" /></div>
        <div><label className="label" htmlFor="rw_pmin">Personas: mínimo</label><input id="rw_pmin" name="personas_min" type="number" min={1} max={100} defaultValue={config.personas_min} className="input w-full" /></div>
        <div><label className="label" htmlFor="rw_pmax">Personas: máximo</label><input id="rw_pmax" name="personas_max" type="number" min={1} max={200} defaultValue={config.personas_max} className="input w-full" /></div>
      </div>
      <fieldset className="space-y-3 rounded-md border border-rs-border/60 p-3">
        <legend className="label px-1">Textos y reglas del sitio</legend>
        <label className="flex items-start gap-2 text-sm"><input type="checkbox" name="modo_prueba" defaultChecked={config.modo_prueba} className="mt-0.5 h-4 w-4 accent-[#c8e62b]" /><span><span className="font-medium">Modo prueba</span><span className="block text-xs text-rs-muted">Muestra el cartel “Sitio de prueba” y marca las reservas como “[Sitio de prueba]”. Apagalo cuando quieras publicarlo de verdad.</span></span></label>
        <label className="flex items-start gap-2 text-sm"><input type="checkbox" name="cualquier_ubicacion" defaultChecked={config.cualquier_ubicacion} className="mt-0.5 h-4 w-4 accent-[#c8e62b]" /><span><span className="font-medium">Ofrecer “cualquier ubicación disponible”</span><span className="block text-xs text-rs-muted">El cliente puede no elegir lugar ni mesa y reservar directo. Solo se ofrece si hay lugar en al menos una ubicación según el aforo de cada una (y los topes generales), y al registrar la reserva se le asigna la primera ubicación con lugar, en el orden en que cargaste las ubicaciones. Se muestra solo si tenés dos o más ubicaciones.</span></span></label>
        <fieldset className="space-y-2 rounded-md border border-rs-border/60 p-3 sm:col-span-2">
          <legend className="label px-1">Aviso de pocos lugares</legend>
          <p className="text-xs text-rs-muted">Cuando a un horario de un sector (ubicación) le quedan pocos lugares, el sitio lo avisa junto al horario. Se calcula con tus reglas de aforo (por ubicación y franja): si un sector no tiene regla de aforo, no se avisa nada.</p>
          <div className="grid gap-3 sm:grid-cols-3">
            <div><label className="label" htmlFor="rw_esc_modo">Qué mostrar</label>
              <select id="rw_esc_modo" name="escasez_modo" defaultValue={config.escasez_modo ?? 'off'} className="input w-full"><option value="off">No avisar</option><option value="pocos">“Quedan pocos lugares”</option><option value="cantidad">“Quedan 6 lugares” (el número exacto)</option></select></div>
            <div><label className="label" htmlFor="rw_esc_umbral">Avisar cuando queden…</label>
              <div className="flex items-center gap-2"><input id="rw_esc_umbral" name="escasez_umbral" type="number" min={1} max={500} defaultValue={config.escasez_umbral ?? 10} className="input w-24" /><span className="text-sm text-rs-muted">lugares o menos</span></div></div>
            <div><label className="label" htmlFor="rw_esc_texto">Texto (solo “pocos lugares”)</label>
              <input id="rw_esc_texto" name="escasez_texto" maxLength={40} defaultValue={config.escasez_texto ?? ''} placeholder="Quedan pocos lugares" className="input w-full" /></div>
          </div>
          <p className="text-xs text-rs-muted">Recomendado: “pocos lugares”. Dice que se está llenando sin mostrar la capacidad del local ni confundir (los lugares son personas, no mesas). Con el número exacto el cliente ve, por ejemplo, “Quedan 6 lugares”.</p>
        </fieldset>
        <label className="flex items-start gap-2 text-sm"><input type="checkbox" name="pedir_cumple" defaultChecked={config.pedir_cumple} className="mt-0.5 h-4 w-4 accent-[#c8e62b]" /><span><span className="font-medium">Preguntar el cumpleaños (opcional para el cliente)</span><span className="block text-xs text-rs-muted">Agrega al formulario el día y el mes. Si lo completa, queda en la reserva y en su ficha (módulo Cumpleaños) para saludarlo.</span></span></label>
        <div><label className="label" htmlFor="rw_cualq">Texto de esa opción</label><input id="rw_cualq" name="texto_cualquier_ubicacion" defaultValue={config.texto_cualquier_ubicacion ?? ''} maxLength={60} placeholder="Cualquier ubicación disponible" className="input w-full" /></div>
        <div className="grid gap-3 sm:grid-cols-2">
          <div><label className="label" htmlFor="rw_titulo">Título de la página</label><input id="rw_titulo" name="titulo" defaultValue={config.titulo ?? ''} maxLength={80} placeholder="Por defecto: el nombre del local" className="input w-full" /></div>
          <div><label className="label" htmlFor="rw_subtitulo">Subtítulo</label><input id="rw_subtitulo" name="subtitulo" defaultValue={config.subtitulo ?? ''} maxLength={160} placeholder="Por defecto: Reservá tu mesa" className="input w-full" /></div>
          <fieldset className="space-y-3 rounded-rs-lg border border-rs-border p-3 sm:col-span-2">
            <legend className="px-1 text-xs font-semibold uppercase tracking-[0.05em] text-rs-muted">Marca del sitio (opcional)</legend>
            <p className="text-xs text-rs-muted">Para que el sitio se vea como tu local. Sin esto usa la identidad de Risto Suite; con esto mantiene su estilo oscuro y siempre firma “Reservas con Risto Suite”. Las imágenes van por dirección (https://… o /ruta).</p>
            <MarcaCampos marca={config.marca} prefijo="rw" />
          </fieldset>
          <div><label className="label" htmlFor="rw_validez">Cuánto espera la solicitud (horas)</label><input id="rw_validez" name="validez_horas" type="number" min={1} max={168} defaultValue={config.validez_horas} className="input w-full" /><p className="mt-1 text-xs text-rs-muted">Si el cliente no manda el mensaje de WhatsApp en ese tiempo, la solicitud vence.</p></div>
          <div><label className="label" htmlFor="rw_maxmesas">Máximo de mesas por reserva</label><input id="rw_maxmesas" name="max_mesas" type="number" min={1} max={12} defaultValue={config.max_mesas} className="input w-full" /><p className="mt-1 text-xs text-rs-muted">Cuántas mesas móviles se pueden juntar para un grupo.</p></div>
        </div>
        <div>
          <label className="label" htmlFor="rw_wa">Mensaje de WhatsApp que se arma para el cliente</label>
          <textarea id="rw_wa" name="texto_whatsapp" value={plantilla} onChange={(e) => setPlantilla(e.target.value)} rows={9} maxLength={1200} placeholder={PLANTILLA_WA_DEFECTO} className="input w-full font-mono text-xs" />
          <p className="mt-1 text-xs text-rs-muted">Vacío = el mensaje original. Variables: {VARIABLES_WA.map(([v, d]) => <code key={v} title={d} className="mr-1 rounded bg-rs-raised px-1 font-mono text-rs-lime">{`{${v}}`}</code>)}. Una línea con una variable vacía no se incluye. <b className="text-rs-text">Tiene que llevar {'{codigo}'}</b> y, si cambiás la primera frase, actualizá la palabra clave de la regla del bot.</p>
          <div className="mt-2 rounded-md bg-rs-raised/50 p-3"><p className="mb-1 text-[11px] font-bold uppercase tracking-wide text-rs-muted">Así lo ve el cliente (ejemplo)</p><pre className="whitespace-pre-wrap font-sans text-sm">{vista}</pre></div>
        </div>
      </fieldset>
      <div><label className="label" htmlFor="rw_msg">Mensaje para el cliente</label><textarea id="rw_msg" name="mensaje" rows={2} maxLength={400} defaultValue={config.mensaje ?? ''} placeholder="Ej. Las reservas se confirman por WhatsApp. Tolerancia de 15 minutos." className="input w-full" /></div>
      {state && !state.ok && <p role="alert" className="text-sm text-rs-danger">{state.error}</p>}
      <div className="flex justify-end"><button disabled={pending} className="btn btn-primary">{pending && <Spinner />}{pending ? 'Guardando…' : 'Guardar'}</button></div>
    </form>
  )
}
