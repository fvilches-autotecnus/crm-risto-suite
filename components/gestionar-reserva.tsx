'use client'

import { useEffect, useState, useTransition } from 'react'
import { CalendarClock, Check, MessageCircle, Minus, Plus, ShieldCheck, Users, X } from 'lucide-react'
import { FechaInput } from '@/components/inputs'
import { consultarHorarios, consultarPlano, pedirAccionReserva, type MesaWeb, type ResultadoAccion, type SalonWeb, type SlotWeb } from '@/app/reservar/[slug]/actions'
import { PlanoWeb } from '@/components/reservar-publico'
import { fechaCorta } from '@/lib/fechas'

export interface InfoReserva {
  negocio: string
  reserva: { numero: number; nombre: string; fecha: string; hora: string | null; personas: number | null; ubicacion: string | null; sede: string | null; sede_id: string | null; estado: string }
  puede_cancelar: boolean; puede_modificar: boolean; whatsapp: string; elegir_mesa?: boolean; mesas?: string | null
  ubicaciones?: string[]; permite_cualquiera?: boolean; texto_cualquiera?: string | null
  config: { personas_min: number; personas_max: number; dias_adelante: number } | null
}

const sumarDias = (iso: string, d: number) => new Date(new Date(iso + 'T12:00:00Z').getTime() + d * 86400000).toISOString().slice(0, 10)
const MOTIVO: Record<string, string> = { completo: 'Completo', pasado: 'Ya pasó', bloqueado: 'Cerrado', fuera_de_rango: 'No disponible' }
const ESTADO: Record<string, string> = { nueva: 'Pendiente de confirmación', confirmada: 'Confirmada', pendiente_pago: 'Pendiente de pago', revisar_pago: 'Pago en revisión', cancelada: 'Cancelada', no_show: 'No asistió' }

/** Ver, cancelar o modificar una reserva desde su link. Pedirlo NO cambia nada: se arma un mensaje de WhatsApp y el cambio se aplica cuando llega desde el teléfono de la reserva. */
export default function GestionarReserva({ slug, codigo, info, hoy, cerrados = [] }: { slug: string; codigo: string; info: InfoReserva; hoy: string; cerrados?: string[] }) {
  const r = info.reserva
  const [modo, setModo] = useState<'cancelar' | 'modificar' | null>(null)
  const [fecha, setFecha] = useState(r.fecha)
  const [personas, setPersonas] = useState(r.personas ?? 2)
  const [hora, setHora] = useState(r.hora ?? '')
  const [ubic, setUbic] = useState(r.ubicacion ?? '')   // '' = la que tiene · '*' = cualquier ubicación disponible
  const ubicaciones = info.ubicaciones ?? []
  const etiquetaCualquiera = info.texto_cualquiera?.trim() || 'Cualquier ubicación disponible'
  const ubicTexto = (u: string) => (u === '*' ? etiquetaCualquiera : u)
  const igualUbic = (ubic || '') === (r.ubicacion ?? '')
  const [slots, setSlots] = useState<SlotWeb[] | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [pend, start] = useTransition()
  const [listo, setListo] = useState<Extract<ResultadoAccion, { ok: true }> | null>(null)
  // elegir mesa al modificar (solo si el negocio / la sede lo permite y tiene plano)
  const [modoMesa, setModoMesa] = useState<'elegir' | 'asesor'>('asesor')
  const [plano, setPlano] = useState<{ salones: SalonWeb[]; mesas: MesaWeb[] } | null>(null)
  const [salonId, setSalonId] = useState('')
  const [sel, setSel] = useState<string[]>([])
  const [aviso, setAviso] = useState<string | null>(null)
  const cfg = info.config
  const fechaTxt = (iso: string) => new Date(iso + 'T12:00:00').toLocaleDateString('es-AR', { weekday: 'long', day: 'numeric', month: 'long' })

  useEffect(() => {
    if (modo !== 'modificar') return
    let vivo = true
    const t = setTimeout(async () => {
      const x = await consultarHorarios(slug, fecha, personas, ubic, r.sede_id ?? '')
      if (!vivo) return
      if (!x.ok) { setSlots(null); setError(x.error); return }
      setError(null)
      // el horario que ya tiene se puede conservar aunque figure completo (la reserva ya está contada ahí)
      setSlots(x.slots.map((s) => (fecha === r.fecha && s.hora === r.hora && igualUbic ? { ...s, disponible: true, motivo: undefined } : s)))
      setHora((h) => (x.slots.some((s) => s.hora === h && (s.disponible || (fecha === r.fecha && s.hora === r.hora && igualUbic))) ? h : ''))
    }, 250)
    return () => { vivo = false; clearTimeout(t) }
  }, [modo, slug, fecha, personas, ubic, r.sede_id, r.fecha, r.hora]) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => { setSel([]); setPlano(null) }, [fecha, hora, personas, ubic])
  useEffect(() => {
    if (modo !== 'modificar' || !info.elegir_mesa || modoMesa !== 'elegir' || !hora || ubic === '*') return
    let vivo = true
    void (async () => {
      const x = await consultarPlano(slug, fecha, hora, personas, ubic, r.sede_id ?? '', codigo)
      if (!vivo) return
      if (!x.ok) { setPlano(null); setError(x.error); return }
      setPlano({ salones: x.salones, mesas: x.mesas }); setSalonId(x.salones[0]?.id ?? '')
    })()
    return () => { vivo = false }
  }, [modo, modoMesa, fecha, hora, personas, ubic, slug, codigo, r.sede_id, info.elegir_mesa])
  const mesasSel = (plano?.mesas ?? []).filter((m) => sel.includes(m.id))
  const totalMesas = mesasSel.reduce((s, m) => ({ min: s.min + m.capacidad_min, max: s.max + m.capacidad }), { min: 0, max: 0 })
  const seleccionValida = mesasSel.length > 0 && personas >= totalMesas.min && personas <= totalMesas.max && (mesasSel.length === 1 || mesasSel.every((m) => m.movil))
  const tocarMesa = (m: MesaWeb) => {
    setAviso(null)
    if (m.estado === 'ocupada') { setAviso(`La mesa ${m.numero} ya está reservada a esa hora.`); return }
    if (m.estado === 'no_apta') { setAviso(`La mesa ${m.numero} no es para ${personas} personas.`); return }
    if (m.estado !== 'disponible') return
    if (sel.includes(m.id)) { setSel(sel.filter((i) => i !== m.id)); return }
    const actuales = (plano?.mesas ?? []).filter((x) => sel.includes(x.id))
    if (m.movil && actuales.length > 0 && actuales.every((x) => x.movil)) { setSel([...sel, m.id]); return }
    setSel([m.id])
  }

  const mensaje = (a: Extract<ResultadoAccion, { ok: true }>) => {
    const sede = a.sede ? ` (${a.sede})` : ''
    if (a.tipo === 'cancelar') return [`CANCELACIÓN DE RESERVA - ${info.negocio}`, `Código: ${a.codigo}`, '', `Quiero cancelar mi reserva #${a.numero}${sede}: ${fechaCorta(r.fecha)} ${r.hora ?? ''}, ${r.personas ?? ''} personas.`].join('\n')
    return [`MODIFICACIÓN DE RESERVA - ${info.negocio}`, `Código: ${a.codigo}`, '', `Quiero modificar mi reserva #${a.numero}${sede}.`, `Nuevo día: ${fechaTxt(fecha)}`, `Nueva hora: ${hora}`, `Personas: ${personas}`, ...(ubic && !igualUbic ? [`Ubicación: ${ubicTexto(ubic)}`] : []), ...(modoMesa === 'elegir' && mesasSel.length ? [`Mesa: ${mesasSel.map((m) => m.numero).join(' + ')}`] : [])].join('\n')
  }
  const urlWA = (a: Extract<ResultadoAccion, { ok: true }>) => `https://wa.me/${(a.whatsapp || info.whatsapp).replace(/\D/g, '')}?text=${encodeURIComponent(mensaje(a))}`
  const enviar = () => {
    setError(null)
    start(async () => {
      const x = await pedirAccionReserva(slug, codigo, modo === 'cancelar' ? { tipo: 'cancelar' } : { tipo: 'modificar', fecha, hora, personas, ubicacion: igualUbic ? '' : ubic, mesas: modoMesa === 'elegir' ? sel : [] })
      if (!x.ok) { setError(x.error); return }
      setListo(x); window.scrollTo({ top: 0, behavior: 'smooth' }); window.location.href = urlWA(x)
    })
  }

  const cabecera = (
    <header className="border-b border-rs-raised bg-rs-header px-4 pb-4 pt-6 text-center">
      <h1 className="text-2xl font-bold text-rs-lime">{info.negocio}</h1>
      <p className="mt-1 text-sm text-rs-muted">Tu reserva</p>
    </header>
  )

  if (listo) {
    return (
      <div className="min-h-screen">{cabecera}
        <main className="mx-auto max-w-lg space-y-4 px-4 py-8 text-center">
          <div className="mx-auto grid h-14 w-14 place-items-center rounded-full bg-rs-warn/15 text-rs-warn"><ShieldCheck size={28} /></div>
          <h2 className="text-xl font-bold">Último paso: confirmalo por WhatsApp</h2>
          <p className="text-sm text-rs-muted">Todavía <b className="text-rs-text">no cambiamos nada</b>. Se abre WhatsApp con tu pedido ya escrito: <b className="text-rs-text">enviálo desde el mismo número con el que reservaste</b>. Así nos aseguramos de que nadie toque tu reserva por vos.</p>
          <p className="text-3xl font-bold tracking-widest text-rs-lime" aria-label="Código del pedido">{listo.codigo}</p>
          <a href={urlWA(listo)} className="btn btn-primary h-12 w-full text-base"><MessageCircle size={18} />Enviar por WhatsApp</a>
          <p className="text-xs text-rs-muted">Si WhatsApp no se abrió, tocá el botón. El pedido espera 48 horas.</p>
        </main>
      </div>
    )
  }

  const activa = info.puede_cancelar || info.puede_modificar
  return (
    <div className="min-h-screen pb-16">{cabecera}
      <main className="mx-auto max-w-lg space-y-4 px-4 py-6">
        <section className="card space-y-1 p-4 text-sm">
          <p className="text-lg font-bold"><span className="text-rs-lime">#{r.numero}</span> · {r.nombre}</p>
          <p><CalendarClock size={14} className="mr-1 inline text-rs-muted" /><b className="capitalize">{fechaTxt(r.fecha)}</b>{r.hora ? ` · ${r.hora}` : ''}</p>
          <p><Users size={14} className="mr-1 inline text-rs-muted" />{r.personas ?? '—'} personas{r.sede ? ` · ${r.sede}` : ''}{r.ubicacion ? ` · ${r.ubicacion}` : ''}</p>
          <p className="text-xs text-rs-muted">Estado: <b className="text-rs-text">{ESTADO[r.estado] ?? r.estado}</b></p>
        </section>

        {!activa && <p className="rounded-md bg-rs-raised/60 px-3 py-2 text-sm text-rs-muted">Esta reserva ya no se puede cambiar por acá (está cancelada o ya pasó). Si necesitás algo, escribinos por WhatsApp.</p>}

        {activa && !modo && (
          <section className="grid gap-2 sm:grid-cols-2">
            {info.puede_modificar && <button type="button" onClick={() => setModo('modificar')} className="btn h-12 text-base"><CalendarClock size={18} />Modificar</button>}
            {info.puede_cancelar && <button type="button" onClick={() => setModo('cancelar')} className="btn btn-danger h-12 text-base"><X size={18} />Cancelar</button>}
            <p className="col-span-full text-xs text-rs-muted">Para proteger tu reserva, cualquier cambio se confirma con un mensaje de WhatsApp desde el teléfono con el que reservaste.</p>
          </section>
        )}

        {modo === 'cancelar' && (
          <section className="card space-y-3 p-4">
            <h2 className="font-bold">¿Cancelar tu reserva?</h2>
            <p className="text-sm text-rs-muted">Vamos a armar un mensaje de WhatsApp para que lo envíes desde tu número. Recién entonces se cancela.</p>
            {error && <p role="alert" className="text-sm text-rs-danger">{error}</p>}
            <div className="flex gap-2"><button type="button" onClick={() => { setModo(null); setError(null) }} className="btn flex-1">Volver</button><button type="button" disabled={pend} onClick={enviar} className="btn btn-danger flex-1">{pend ? 'Preparando…' : 'Sí, cancelar por WhatsApp'}</button></div>
          </section>
        )}

        {modo === 'modificar' && cfg && (
          <section className="card space-y-4 p-4">
            <h2 className="font-bold">Modificar tu reserva</h2>
            <div className="grid grid-cols-2 gap-3">
              <div><label className="label" htmlFor="gr_fecha">Día</label><FechaInput id="gr_fecha" value={fecha} min={hoy} max={sumarDias(hoy, cfg.dias_adelante)} deshabilitado={(d) => cerrados.includes(d) && d !== r.fecha} onChange={(v) => v && setFecha(v)} /></div>
              <div><span className="label">Personas</span>
                <div className="flex h-9 items-center justify-between rounded-rs border border-rs-control px-1">
                  <button type="button" onClick={() => setPersonas((p) => Math.max(cfg.personas_min, p - 1))} aria-label="Una persona menos" className="grid h-7 w-7 place-items-center rounded-full hover:bg-rs-raised"><Minus size={14} /></button>
                  <span className="font-bold tabular-nums" aria-live="polite"><Users size={13} className="mr-1 inline text-rs-muted" />{personas}</span>
                  <button type="button" onClick={() => setPersonas((p) => Math.min(cfg.personas_max, p + 1))} aria-label="Una persona más" className="grid h-7 w-7 place-items-center rounded-full hover:bg-rs-raised"><Plus size={14} /></button>
                </div></div>
            </div>
            {(ubicaciones.length > 1 || info.permite_cualquiera) && (
              <div><span className="label">Ubicación</span>
                <div className="flex flex-wrap gap-2">
                  {ubicaciones.map((u) => <button key={u} type="button" onClick={() => setUbic(u)} aria-pressed={ubic === u} className={'inline-flex h-9 items-center rounded-full border px-3.5 text-sm font-medium transition ' + (ubic === u ? 'border-rs-lime/70 bg-rs-lime/15 font-semibold text-rs-lime' : 'border-rs-control text-rs-muted hover:border-rs-lime/40 hover:text-rs-text')}>{u}</button>)}
                  {info.permite_cualquiera && <button type="button" onClick={() => setUbic('*')} aria-pressed={ubic === '*'} className={'inline-flex h-9 items-center rounded-full border px-3.5 text-sm font-medium transition ' + (ubic === '*' ? 'border-rs-lime/70 bg-rs-lime/15 font-semibold text-rs-lime' : 'border-rs-control text-rs-muted hover:border-rs-lime/40 hover:text-rs-text')}>{etiquetaCualquiera}</button>}
                </div>
              </div>
            )}
            <div><span className="label">Horario</span>
              <div className="flex flex-wrap gap-2">
                {(slots ?? []).map((s) => (
                  <button key={s.hora} type="button" disabled={!s.disponible} onClick={() => setHora(s.hora)} aria-pressed={hora === s.hora}
                    className={'inline-flex h-9 items-center rounded-full border px-3.5 text-sm font-medium transition ' + (hora === s.hora ? 'border-rs-lime/70 bg-rs-lime/15 font-semibold text-rs-lime' : 'border-rs-control text-rs-muted hover:border-rs-lime/40 hover:text-rs-text') + (s.disponible ? '' : ' cursor-not-allowed line-through opacity-50')}>
                    {s.hora}{!s.disponible && <span className="ml-1.5 text-[10px] font-semibold uppercase no-underline">{MOTIVO[s.motivo ?? 'fuera_de_rango']}</span>}
                  </button>
                ))}
                {!slots && !error && <p className="text-sm text-rs-muted">Buscando horarios…</p>}
              </div>
            </div>
            {info.elegir_mesa && hora && ubic !== '*' && (
              <div className="space-y-2">
                <span className="label">Tu mesa</span>
                <div className="grid gap-2 sm:grid-cols-2">
                  <button type="button" onClick={() => setModoMesa('elegir')} aria-pressed={modoMesa === 'elegir'} className={'rounded-rs-lg border p-3 text-left transition ' + (modoMesa === 'elegir' ? 'border-rs-lime/70 bg-rs-lime/10' : 'border-rs-control hover:border-rs-lime/40')}><span className="block font-semibold">Elegir mi mesa</span><span className="text-xs text-rs-muted">La ves en el plano del salón</span></button>
                  <button type="button" onClick={() => { setModoMesa('asesor'); setSel([]) }} aria-pressed={modoMesa === 'asesor'} className={'rounded-rs-lg border p-3 text-left transition ' + (modoMesa === 'asesor' ? 'border-rs-lime/70 bg-rs-lime/10' : 'border-rs-control hover:border-rs-lime/40')}><span className="block font-semibold">Que la elija el local</span><span className="text-xs text-rs-muted">{r.sede ? 'Te asignamos la mejor mesa disponible' : 'Te asignamos la mejor mesa disponible'}</span></button>
                </div>
                {modoMesa === 'elegir' && plano && plano.salones.length > 0 && (
                  <div className="space-y-2">
                    {plano.salones.length > 1 && <div className="flex flex-wrap gap-2">{plano.salones.map((s) => <button key={s.id} type="button" onClick={() => setSalonId(s.id)} className={'btn btn-sm ' + (salonId === s.id ? 'btn-primary' : '')}>{s.nombre}</button>)}</div>}
                    {(() => { const salon = plano.salones.find((s) => s.id === salonId); return salon ? <PlanoWeb salon={salon} mesas={plano.mesas.filter((m) => m.salon_id === salon.id)} sel={sel} onTocar={tocarMesa} /> : null })()}
                    {aviso && <p role="status" className="text-sm text-rs-warn">{aviso}</p>}
                    <p className={'rounded-md px-3 py-2 text-sm ' + (mesasSel.length === 0 ? 'bg-rs-raised/50 text-rs-muted' : seleccionValida ? 'bg-rs-ok/10 text-rs-ok' : 'bg-rs-warn/10 text-rs-warn')}>{mesasSel.length === 0 ? 'Tocá una mesa disponible.' : seleccionValida ? `Mesa ${mesasSel.map((m) => m.numero).join(' + ')} ✓` : `Mesa ${mesasSel.map((m) => m.numero).join(' + ')}: entran de ${totalMesas.min} a ${totalMesas.max} personas y son ${personas}.`}</p>
                  </div>
                )}
                {modoMesa === 'elegir' && plano && plano.salones.length === 0 && <p className="text-sm text-rs-muted">No hay un plano para esta sede: el local te asigna la mesa.</p>}
              </div>
            )}
            {error && <p role="alert" className="text-sm text-rs-danger">{error}</p>}
            <div className="flex gap-2"><button type="button" onClick={() => { setModo(null); setError(null) }} className="btn flex-1">Volver</button><button type="button" disabled={pend || !hora || (modoMesa === 'elegir' && info.elegir_mesa && !seleccionValida && !!plano && plano.salones.length > 0) || (fecha === r.fecha && hora === r.hora && personas === r.personas && igualUbic)} onClick={enviar} className="btn btn-primary flex-1">{pend ? 'Preparando…' : <><Check size={16} />Pedir el cambio</>}</button></div>
            <p className="text-xs text-rs-muted">El cambio se aplica cuando envíes el mensaje de WhatsApp desde tu número. Si el horario se completa mientras tanto, te avisamos.</p>
          </section>
        )}
        {modo === 'modificar' && !cfg && <p className="rounded-md bg-rs-raised/60 px-3 py-2 text-sm text-rs-muted">Por ahora esta reserva solo se puede cancelar por acá. Para cambiarla, escribinos por WhatsApp.</p>}
      </main>
    </div>
  )
}
