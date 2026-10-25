'use client'

import { guardarReservasWeb } from '@/app/(panel)/reservas-web-actions'
import { useToast } from '@/components/feedback'
import { Spinner } from '@/components/ui'
import { useAccionFormulario } from '@/components/use-accion-formulario'
import { useEffect, useMemo, useState } from 'react'
import { PLANTILLA_WA_DEFECTO, VARIABLES_WA, renderPlantillaWA } from '@/lib/reservas-config'
import { Copy, ExternalLink } from 'lucide-react'

export interface ConfigReservasWeb { activo: boolean; elegir_mesa: boolean; tipos: string[]; horarios: string[]; dias_adelante: number; horas_anticipacion: number; personas_min: number; personas_max: number; mensaje: string | null
  modo_prueba: boolean; titulo: string | null; subtitulo: string | null; texto_whatsapp: string | null; validez_horas: number; max_mesas: number }

/** Configuración del sitio público de reservas (/reservar/<negocio>): qué ofrece y con qué reglas. Lo demás (ubicaciones, aforo, fechas bloqueadas, planos) sale de lo ya configurado en el CRM. */
export default function ReservasWebConfig({ config, slug, tiposDisponibles, horariosSugeridos, tieneWhatsapp }: { config: ConfigReservasWeb; slug: string; tieneWhatsapp: boolean; tiposDisponibles: { value: string; label: string }[]; horariosSugeridos: string[] }) {
  const { state, pending, formProps } = useAccionFormulario(guardarReservasWeb)
  const toast = useToast()
  const [origen, setOrigen] = useState('')
  const [plantilla, setPlantilla] = useState(config.texto_whatsapp ?? '')
  const vista = useMemo(() => renderPlantillaWA(plantilla.trim() || PLANTILLA_WA_DEFECTO, { negocio: 'Tu local', codigo: '3FA09C', nombre: 'Ana Pérez', dia: 'sábado 31 de octubre', hora: '21:00', personas: '4', ubicacion: 'SALÓN', tipo: 'Cumpleaños', mesa: 'M1 + M2', comentarios: 'Una torta con velita' }), [plantilla])
  useEffect(() => setOrigen(window.location.origin), [])
  useEffect(() => { if (state?.ok) toast({ texto: 'Configuración guardada' }) }, [state]) // eslint-disable-line react-hooks/exhaustive-deps
  const url = `${origen}/reservar/${slug}`
  const copiar = async () => { try { await navigator.clipboard.writeText(url); toast({ texto: 'Enlace copiado' }) } catch { toast({ tipo: 'error', texto: url }) } }
  return (
    <form {...formProps} className="space-y-4">
      {!tieneWhatsapp && <p role="alert" className="rounded-md border border-rs-warn/40 bg-rs-warn/10 px-3 py-2 text-sm text-rs-warn">Este negocio no tiene WhatsApp cargado (Negocio → WhatsApp): sin eso el sitio no se puede usar, porque nadie podría recibir el mensaje que confirma la reserva.</p>}
      <p className="rounded-md bg-rs-raised/50 px-3 py-2 text-xs text-rs-muted">Cómo funciona: el sitio <b className="text-rs-text">no pide teléfono</b>. Al terminar abre WhatsApp con la solicitud escrita (lleva un código). Cuando el cliente la envía, el bot registra la reserva con el número de quien escribió; si el bot no lo hace solo, la registrás a mano desde <b className="text-rs-text">Reservas → Solicitudes web</b>. Mientras tanto no ocupa mesa ni aforo.</p>
      <label className="flex items-start gap-2 text-sm"><input type="checkbox" name="activo" defaultChecked={config.activo} className="mt-0.5 h-4 w-4 accent-[#c8e62b]" /><span><span className="font-medium">Sitio de reservas activo</span><span className="block text-xs text-rs-muted">Apagado, el enlace muestra “no encontrado”. El cliente arma su solicitud en el sitio y la reserva se registra recién cuando manda el mensaje por WhatsApp (queda en estado inicial, normalmente “Nueva”, marcada “[Sitio de prueba]”).</span></span></label>
      <div className="flex flex-wrap items-center gap-2 rounded-md bg-rs-raised/50 px-3 py-2 text-sm"><span className="min-w-0 flex-1 truncate font-mono text-xs">{url}</span><button type="button" onClick={copiar} className="btn btn-sm"><Copy size={13} />Copiar</button><a href={`/reservar/${slug}`} target="_blank" rel="noopener noreferrer" className="btn btn-sm"><ExternalLink size={13} />Abrir</a></div>
      <label className="flex items-start gap-2 text-sm"><input type="checkbox" name="elegir_mesa" defaultChecked={config.elegir_mesa} className="mt-0.5 h-4 w-4 accent-[#c8e62b]" /><span><span className="font-medium">El cliente puede elegir su mesa en el plano</span><span className="block text-xs text-rs-muted">Usa el plano de Salón y mesas. Se muestran como no disponibles las mesas con reservas confirmadas, pendientes de pago o en revisión de pago. Sin esto, siempre elige un asesor.</span></span></label>
      <fieldset><legend className="label">Tipos de reserva que se ofrecen</legend>
        <div className="flex flex-wrap gap-2">{tiposDisponibles.map((t) => <label key={t.value} className="flex cursor-pointer items-center gap-1.5 rounded-full border border-rs-control px-3 py-1 text-sm has-[:checked]:border-rs-lime/60 has-[:checked]:bg-rs-lime/10"><input type="checkbox" name="tipos" value={t.value} defaultChecked={config.tipos.includes(t.value)} className="h-3.5 w-3.5 accent-[#c8e62b]" />{t.label}</label>)}</div>
        <p className="mt-1 text-xs text-rs-muted">Son los tipos que ya existen en tus reservas. Si no marcás ninguno se ofrece solo “Común”.</p>
      </fieldset>
      <div>
        <label className="label" htmlFor="rw_horarios">Horarios</label>
        <input id="rw_horarios" name="horarios" defaultValue={config.horarios.join(', ')} placeholder={horariosSugeridos.join(', ') || '13:00, 21:00'} className="input w-full" />
        <p className="mt-1 text-xs text-rs-muted">Separados por coma. Si lo dejás vacío se usan los horarios que más se usan en tus reservas{horariosSugeridos.length ? <>: <b className="text-rs-text">{horariosSugeridos.join(', ')}</b></> : ''}. La disponibilidad de cada horario sale de tus reglas de aforo y fechas bloqueadas.</p>
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
        <div className="grid gap-3 sm:grid-cols-2">
          <div><label className="label" htmlFor="rw_titulo">Título de la página</label><input id="rw_titulo" name="titulo" defaultValue={config.titulo ?? ''} maxLength={80} placeholder="Por defecto: el nombre del local" className="input w-full" /></div>
          <div><label className="label" htmlFor="rw_subtitulo">Subtítulo</label><input id="rw_subtitulo" name="subtitulo" defaultValue={config.subtitulo ?? ''} maxLength={160} placeholder="Por defecto: Reservá tu mesa" className="input w-full" /></div>
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
