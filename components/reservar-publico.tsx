'use client'

import { useEffect, useMemo, useRef, useState, useTransition } from 'react'
import { Check, Minus, Plus, Users } from 'lucide-react'
import { consultarHorarios, consultarPlano, crearReservaPublica, type MesaWeb, type ResultadoReserva, type SalonWeb, type SlotWeb } from '@/app/reservar/[slug]/actions'

interface Props {
  slug: string; nombre: string; ubicaciones: string[]; tipos: { value: string; label: string }[]
  cfg: { elegir_mesa: boolean; dias_adelante: number; personas_min: number; personas_max: number; mensaje: string | null }; hoy: string; whatsapp: string | null
}

const sumarDias = (iso: string, d: number) => new Date(new Date(iso + 'T12:00:00Z').getTime() + d * 86400000).toISOString().slice(0, 10)
const rango = (m: Pick<MesaWeb, 'capacidad' | 'capacidad_min'>) => (m.capacidad_min > 1 ? `${m.capacidad_min}–${m.capacidad}` : `${m.capacidad}`)
const MOTIVO: Record<string, string> = { completo: 'Completo', pasado: 'Ya pasó', bloqueado: 'Cerrado', fuera_de_rango: 'No disponible' }

export default function ReservarPublico({ slug, nombre, ubicaciones, tipos, cfg, hoy, whatsapp }: Props) {
  const [fecha, setFecha] = useState(sumarDias(hoy, 1))
  const [personas, setPersonas] = useState(Math.min(Math.max(2, cfg.personas_min), cfg.personas_max))
  const [ubicacion, setUbicacion] = useState(ubicaciones[0] ?? '')
  const [tipo, setTipo] = useState(tipos[0]?.value ?? 'comun')
  const [slots, setSlots] = useState<SlotWeb[] | null>(null)
  const [cargandoSlots, setCargandoSlots] = useState(false)
  const [errorSlots, setErrorSlots] = useState<string | null>(null)
  const [hora, setHora] = useState('')
  const [modo, setModo] = useState<'elegir' | 'asesor' | null>(cfg.elegir_mesa ? null : 'asesor')
  const [plano, setPlano] = useState<{ salones: SalonWeb[]; mesas: MesaWeb[] } | null>(null)
  const [cargandoPlano, setCargandoPlano] = useState(false)
  const [errorPlano, setErrorPlano] = useState<string | null>(null)
  const [salonId, setSalonId] = useState('')
  const [sel, setSel] = useState<string[]>([])
  const [aviso, setAviso] = useState<string | null>(null)
  const [form, setForm] = useState({ nombre: '', telefono: '', observaciones: '', web: '' })
  const [error, setError] = useState<string | null>(null)
  const [resultado, setResultado] = useState<Extract<ResultadoReserva, { ok: true }> | null>(null)
  const [pend, start] = useTransition()
  const refDatos = useRef<HTMLDivElement>(null)

  // horarios: se vuelven a pedir cuando cambia el día, la cantidad de personas o la ubicación
  useEffect(() => {
    let vivo = true
    setCargandoSlots(true); setErrorSlots(null)
    const t = setTimeout(async () => {
      const r = await consultarHorarios(slug, fecha, personas, ubicacion)
      if (!vivo) return
      setCargandoSlots(false)
      if (!r.ok) { setSlots(null); setErrorSlots(r.error); return }
      setSlots(r.slots)
      setHora((h) => (r.slots.some((s) => s.hora === h && s.disponible) ? h : ''))
    }, 250)
    return () => { vivo = false; clearTimeout(t) }
  }, [slug, fecha, personas, ubicacion])

  // plano: cuando se eligió horario y la persona quiere elegir mesa
  useEffect(() => {
    if (!hora || modo !== 'elegir') { setPlano(null); return }
    let vivo = true
    setCargandoPlano(true); setErrorPlano(null); setSel([])
    void (async () => {
      const r = await consultarPlano(slug, fecha, hora, personas, ubicacion)
      if (!vivo) return
      setCargandoPlano(false)
      if (!r.ok) { setPlano(null); setErrorPlano(r.error); return }
      setPlano({ salones: r.salones, mesas: r.mesas }); setSalonId(r.salones[0]?.id ?? '')
    })()
    return () => { vivo = false }
  }, [slug, fecha, hora, personas, ubicacion, modo])

  const mesasSel = useMemo(() => (plano?.mesas ?? []).filter((m) => sel.includes(m.id)), [plano, sel])
  const total = mesasSel.reduce((s, m) => ({ min: s.min + m.capacidad_min, max: s.max + m.capacidad }), { min: 0, max: 0 })
  const seleccionValida = mesasSel.length > 0 && personas >= total.min && personas <= total.max && (mesasSel.length === 1 || mesasSel.every((m) => m.movil))
  const salon = plano?.salones.find((s) => s.id === salonId) ?? null

  const tocarMesa = (m: MesaWeb) => {
    setAviso(null)
    if (m.estado === 'ocupada') { setAviso(`La mesa ${m.numero} ya está reservada a esa hora.`); return }
    if (m.estado === 'no_apta') { setAviso(`La mesa ${m.numero} es para ${rango(m)} personas (tu reserva es de ${personas}).`); return }
    if (m.estado !== 'disponible') return
    if (sel.includes(m.id)) { setSel(sel.filter((i) => i !== m.id)); return }
    const actuales = (plano?.mesas ?? []).filter((x) => sel.includes(x.id))
    if (m.movil && actuales.length > 0 && actuales.every((x) => x.movil)) { if (actuales.length >= 6) return; setSel([...sel, m.id]); return }
    if (actuales.length > 0) setAviso(m.movil ? 'Se cambió la mesa elegida: las móviles solo se juntan con otras móviles.' : 'Las mesas fijas no se juntan: elegiste esta en lugar de la anterior.')
    setSel([m.id])
  }

  const listoParaDatos = !!hora && (modo === 'asesor' || (modo === 'elegir' && seleccionValida))
  const enviar = (e: React.FormEvent) => {
    e.preventDefault(); setError(null)
    start(async () => {
      const r = await crearReservaPublica(slug, { fecha, hora, personas, ubicacion, tipo, ...form, mesas: modo === 'elegir' ? sel : [] })
      if (r.ok) { setResultado(r); window.scrollTo({ top: 0, behavior: 'smooth' }) } else { setError(r.error); refDatos.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }) }
    })
  }
  const campo = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => setForm((f) => ({ ...f, [k]: e.target.value }))
  const fechaTxt = (iso: string) => new Date(iso + 'T12:00:00').toLocaleDateString('es-AR', { weekday: 'long', day: 'numeric', month: 'long' })

  if (resultado) {
    const textoWA = `Hola, soy ${form.nombre}. Hice la reserva #${resultado.numero} para el ${fechaTxt(resultado.fecha)} a las ${resultado.hora} (${resultado.personas} personas).`
    return (
      <div className="min-h-screen">
        <Banner nombre={nombre} />
        <main className="mx-auto max-w-lg space-y-4 px-4 py-8 text-center">
          <div className="mx-auto grid h-14 w-14 place-items-center rounded-full bg-rs-ok/15 text-rs-ok"><Check size={28} /></div>
          <h1 className="text-xl font-bold">¡Recibimos tu reserva!</h1>
          <p className="text-4xl font-bold tabular-nums text-rs-lime">#{resultado.numero}</p>
          <div className="card space-y-1 p-4 text-left text-sm">
            <p><span className="text-rs-muted">Día:</span> <b className="capitalize">{fechaTxt(resultado.fecha)}</b> · {resultado.hora}</p>
            <p><span className="text-rs-muted">Personas:</span> <b>{resultado.personas}</b>{resultado.ubicacion ? <> · <span className="text-rs-muted">Ubicación:</span> <b>{resultado.ubicacion}</b></> : null}</p>
            <p><span className="text-rs-muted">Mesa:</span> <b>{resultado.mesas ? `Mesa ${resultado.mesas} (la confirmamos con vos)` : 'La elige un asesor'}</b></p>
          </div>
          <p className="text-sm text-rs-muted">Tu reserva queda <b className="text-rs-text">pendiente de confirmación</b>: un asesor la revisa y te escribe por WhatsApp al {form.telefono}.</p>
          {resultado.mensaje && <p className="whitespace-pre-line text-sm text-rs-muted">{resultado.mensaje}</p>}
          {whatsapp && <a href={`https://wa.me/${whatsapp.replace(/\D/g, '')}?text=${encodeURIComponent(textoWA)}`} target="_blank" rel="noopener noreferrer" className="btn btn-primary w-full">Escribir por WhatsApp</a>}
          <button type="button" onClick={() => { setResultado(null); setHora(''); setSel([]); setForm({ nombre: '', telefono: '', observaciones: '', web: '' }); setModo(cfg.elegir_mesa ? null : 'asesor') }} className="btn w-full">Hacer otra reserva</button>
        </main>
      </div>
    )
  }

  const chip = (activo: boolean) => 'inline-flex h-9 items-center rounded-full border px-3.5 text-sm font-medium transition ' + (activo ? 'border-rs-lime/70 bg-rs-lime/15 font-semibold text-rs-lime' : 'border-rs-control text-rs-muted hover:border-rs-lime/40 hover:text-rs-text')
  return (
    <div className="min-h-screen pb-16">
      <Banner nombre={nombre} />
      <main className="mx-auto max-w-2xl space-y-5 px-4 py-6">
        {cfg.mensaje && <p className="whitespace-pre-line rounded-md bg-rs-raised/60 px-3 py-2 text-sm text-rs-muted">{cfg.mensaje}</p>}

        {/* 1. cuándo y cuántos */}
        <section className="card space-y-4 p-4">
          <h2 className="font-bold">1 · ¿Cuándo y cuántos?</h2>
          <div className="grid grid-cols-2 gap-3">
            <div><label className="label" htmlFor="rw_fecha">Día</label><input id="rw_fecha" type="date" value={fecha} min={hoy} max={sumarDias(hoy, cfg.dias_adelante)} onChange={(e) => e.target.value && setFecha(e.target.value)} className="input w-full" /></div>
            <div>
              <span className="label">Personas</span>
              <div className="flex h-9 items-center justify-between rounded-rs border border-rs-control px-1">
                <button type="button" onClick={() => setPersonas((p) => Math.max(cfg.personas_min, p - 1))} aria-label="Una persona menos" className="grid h-7 w-7 place-items-center rounded-full hover:bg-rs-raised"><Minus size={14} /></button>
                <span className="font-bold tabular-nums" aria-live="polite"><Users size={13} className="mr-1 inline text-rs-muted" />{personas}</span>
                <button type="button" onClick={() => setPersonas((p) => Math.min(cfg.personas_max, p + 1))} aria-label="Una persona más" className="grid h-7 w-7 place-items-center rounded-full hover:bg-rs-raised"><Plus size={14} /></button>
              </div>
            </div>
          </div>
          {ubicaciones.length > 0 && <div><span className="label">Ubicación</span><div className="flex flex-wrap gap-2">{ubicaciones.map((u) => <button key={u} type="button" onClick={() => setUbicacion(u)} aria-pressed={ubicacion === u} className={chip(ubicacion === u)}>{u}</button>)}</div></div>}
          {tipos.length > 1 && <div><span className="label">Tipo de reserva</span><div className="flex flex-wrap gap-2">{tipos.map((t) => <button key={t.value} type="button" onClick={() => setTipo(t.value)} aria-pressed={tipo === t.value} className={chip(tipo === t.value)}>{t.label}</button>)}</div></div>}
          <div>
            <span className="label">Horario</span>
            {cargandoSlots && !slots ? <p className="text-sm text-rs-muted">Buscando horarios…</p> : errorSlots ? <p role="alert" className="text-sm text-rs-danger">{errorSlots}</p> : (
              <div className={'flex flex-wrap gap-2 ' + (cargandoSlots ? 'opacity-60' : '')}>
                {(slots ?? []).map((s) => (
                  <button key={s.hora} type="button" disabled={!s.disponible} onClick={() => { setHora(s.hora); setModo(cfg.elegir_mesa ? null : 'asesor'); setSel([]) }} aria-pressed={hora === s.hora}
                    className={chip(hora === s.hora) + (s.disponible ? '' : ' cursor-not-allowed line-through opacity-50')} title={s.disponible ? undefined : MOTIVO[s.motivo ?? 'fuera_de_rango']}>
                    {s.hora}{!s.disponible && <span className="ml-1.5 text-[10px] font-semibold uppercase no-underline">{MOTIVO[s.motivo ?? 'fuera_de_rango']}</span>}
                  </button>
                ))}
                {slots && slots.length === 0 && <p className="text-sm text-rs-muted">No hay horarios para este día.</p>}
              </div>
            )}
          </div>
        </section>

        {/* 2. mesa */}
        {hora && (
          <section className="card space-y-3 p-4">
            <h2 className="font-bold">2 · Tu mesa</h2>
            {cfg.elegir_mesa && (
              <div className="grid gap-2 sm:grid-cols-2">
                <button type="button" onClick={() => setModo('elegir')} aria-pressed={modo === 'elegir'} className={'rounded-rs-lg border p-3 text-left transition ' + (modo === 'elegir' ? 'border-rs-lime/70 bg-rs-lime/10' : 'border-rs-control hover:border-rs-lime/40')}><span className="block font-semibold">Elegir mi mesa</span><span className="text-xs text-rs-muted">La ves en el plano del salón</span></button>
                <button type="button" onClick={() => { setModo('asesor'); setSel([]) }} aria-pressed={modo === 'asesor'} className={'rounded-rs-lg border p-3 text-left transition ' + (modo === 'asesor' ? 'border-rs-lime/70 bg-rs-lime/10' : 'border-rs-control hover:border-rs-lime/40')}><span className="block font-semibold">Que un asesor la elija</span><span className="text-xs text-rs-muted">Te asignamos la mejor mesa disponible</span></button>
              </div>
            )}
            {modo === 'elegir' && (
              cargandoPlano ? <p className="text-sm text-rs-muted">Cargando el plano…</p> : errorPlano ? <p role="alert" className="text-sm text-rs-danger">{errorPlano}</p> : plano && plano.salones.length === 0 ? <p className="text-sm text-rs-muted">Todavía no hay un plano cargado para esta ubicación: un asesor va a elegir tu mesa.</p> : plano && (
                <div className="space-y-3">
                  {plano.salones.length > 1 && <div className="flex flex-wrap gap-2">{plano.salones.map((s) => <button key={s.id} type="button" onClick={() => setSalonId(s.id)} className={chip(salonId === s.id)}>{s.nombre}</button>)}</div>}
                  {salon && <PlanoWeb salon={salon} mesas={plano.mesas.filter((m) => m.salon_id === salon.id)} sel={sel} onTocar={tocarMesa} />}
                  <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-rs-muted">
                    <Leyenda clase="border-rs-ok/70 bg-rs-ok/15" t="Disponible" /><Leyenda clase="border-rs-lime bg-rs-lime/30" t="Tu elección" /><Leyenda clase="border-rs-muted/40 bg-rs-raised/40 opacity-60" t="No disponible" /><Leyenda clase="border-dashed border-rs-ok/70 bg-rs-ok/15" t="Móvil (se puede juntar)" />
                  </div>
                  {aviso && <p role="status" className="text-sm text-rs-warn">{aviso}</p>}
                  <p className={'rounded-md px-3 py-2 text-sm ' + (mesasSel.length === 0 ? 'bg-rs-raised/50 text-rs-muted' : seleccionValida ? 'bg-rs-ok/10 text-rs-ok' : 'bg-rs-warn/10 text-rs-warn')} role="status">
                    {mesasSel.length === 0 ? `Tocá una mesa disponible. Para ${personas} personas se muestran las que entran; las punteadas se pueden juntar para grupos grandes.`
                      : seleccionValida ? `Mesa ${mesasSel.map((m) => m.numero).join(' + ')} · entran de ${total.min} a ${total.max} personas ✓`
                      : personas > total.max ? `Mesa ${mesasSel.map((m) => m.numero).join(' + ')}: entran hasta ${total.max} y son ${personas}. ${mesasSel.every((m) => m.movil) ? 'Sumá otra mesa móvil.' : 'Elegí otra mesa.'}`
                      : `Mesa ${mesasSel.map((m) => m.numero).join(' + ')}: piden al menos ${total.min} personas y son ${personas}. Sacá una mesa o elegí otra.`}
                  </p>
                </div>
              )
            )}
            {modo === 'asesor' && <p className="rounded-md bg-rs-raised/50 px-3 py-2 text-sm text-rs-muted">Perfecto: un asesor va a revisar tu reserva y te asigna la mejor mesa disponible.</p>}
          </section>
        )}

        {/* 3. datos */}
        {listoParaDatos && (
          <section ref={refDatos} className="card p-4">
            <h2 className="mb-3 font-bold">3 · Tus datos</h2>
            <form onSubmit={enviar} className="space-y-3">
              {error && <p role="alert" className="rounded-md border border-rs-danger/40 bg-rs-danger/10 px-3 py-2 text-sm text-rs-danger">{error}</p>}
              <div className="grid grid-cols-2 gap-3">
                <div className="col-span-2 sm:col-span-1"><label className="label" htmlFor="rw_nombre">Nombre y apellido *</label><input id="rw_nombre" value={form.nombre} onChange={campo('nombre')} maxLength={80} autoComplete="name" className="input w-full" required /></div>
                <div className="col-span-2 sm:col-span-1"><label className="label" htmlFor="rw_tel">WhatsApp *</label><input id="rw_tel" type="tel" inputMode="tel" value={form.telefono} onChange={campo('telefono')} autoComplete="tel" placeholder="Ej. 341 6582156" className="input w-full" required /></div>
              </div>
              <div><label className="label" htmlFor="rw_obs">Comentarios (opcional)</label><textarea id="rw_obs" value={form.observaciones} onChange={campo('observaciones')} maxLength={400} rows={2} placeholder="Cumpleaños, alergias, cochecito…" className="input w-full" /></div>
              <input type="text" name="web" value={form.web} onChange={campo('web')} tabIndex={-1} autoComplete="off" aria-hidden className="absolute -left-[9999px] h-0 w-0 opacity-0" />
              <div className="rounded-md bg-rs-raised/50 px-3 py-2 text-sm"><b className="capitalize">{fechaTxt(fecha)}</b> · {hora} · {personas} personas{ubicacion ? ` · ${ubicacion}` : ''}{modo === 'elegir' && mesasSel.length ? ` · Mesa ${mesasSel.map((m) => m.numero).join(' + ')}` : ''}</div>
              <button disabled={pend} className="btn btn-primary h-12 w-full text-base">{pend ? 'Enviando…' : 'Reservar'}</button>
            </form>
          </section>
        )}
      </main>
    </div>
  )
}

function Banner({ nombre }: { nombre: string }) {
  return (
    <header className="border-b border-rs-raised bg-rs-header px-4 pb-4 pt-6 text-center">
      <span className="mb-2 inline-block rounded-full bg-rs-warn/15 px-3 py-0.5 text-[11px] font-bold uppercase tracking-wide text-rs-warn">Sitio de prueba</span>
      <h1 className="text-2xl font-bold text-rs-lime">{nombre}</h1>
      <p className="mt-1 text-sm text-rs-muted">Reservá tu mesa</p>
      <p className="mx-auto mt-2 max-w-md text-xs text-rs-muted">Las reservas que se hagan en este sitio llegan al CRM marcadas como “[Sitio de prueba]”.</p>
    </header>
  )
}
const Leyenda = ({ clase, t }: { clase: string; t: string }) => <span className="inline-flex items-center gap-1.5"><span className={'h-3 w-3 rounded border-2 ' + clase} />{t}</span>

function PlanoWeb({ salon, mesas, sel, onTocar }: { salon: SalonWeb; mesas: MesaWeb[]; sel: string[]; onTocar: (m: MesaWeb) => void }) {
  return (
    <div className="overflow-x-auto rounded-rs-lg border border-rs-border bg-rs-bg/60">
      <div className="relative" style={{ aspectRatio: `${salon.ancho} / ${salon.alto}`, minWidth: Math.max(salon.ancho * 24, 320), containerType: 'inline-size' }}>
        {mesas.map((m) => {
          const base = { left: `${(m.x / salon.ancho) * 100}%`, top: `${(m.y / salon.alto) * 100}%`, width: `${(m.w / salon.ancho) * 100}%`, height: `${(m.h / salon.alto) * 100}%`, fontSize: `calc(100cqw / ${salon.ancho} * .55)` }
          if (m.tipo === 'deco') return <div key={m.id} style={base} className="absolute grid place-items-center overflow-hidden rounded border border-dashed border-rs-muted/50 bg-rs-raised/40 px-1 text-center font-semibold uppercase tracking-wide text-rs-muted">{m.numero}</div>
          const elegida = sel.includes(m.id), libre = m.estado === 'disponible'
          return (
            <button key={m.id} type="button" style={base} onClick={() => onTocar(m)} aria-pressed={elegida} aria-label={`Mesa ${m.numero}, ${rango(m)} personas, ${m.movil ? 'móvil, ' : 'fija, '}${libre ? 'disponible' : m.estado === 'ocupada' ? 'no disponible, ya reservada' : 'no apta para tu grupo'}`}
              className={'absolute flex flex-col items-center justify-center overflow-hidden border-2 leading-tight transition ' + (m.forma === 'redonda' ? 'rounded-full ' : 'rounded-lg ') + (m.movil ? 'border-dashed ' : '') +
                (elegida ? 'border-rs-lime bg-rs-lime/30 text-rs-text ring-2 ring-rs-lime ' : libre ? 'border-rs-ok/70 bg-rs-ok/15 text-rs-text hover:bg-rs-ok/25 ' : 'cursor-not-allowed border-rs-muted/40 bg-rs-raised/40 text-rs-muted opacity-60 ')}>
              <span className="font-bold">{m.numero}</span>
              <span className="opacity-80" style={{ fontSize: '.68em' }}><Users className="mr-0.5 inline" size={9} />{rango(m)}</span>
              {!libre && !elegida && <span style={{ fontSize: '.58em' }} className="uppercase">{m.estado === 'ocupada' ? 'Reservada' : 'No apta'}</span>}
            </button>
          )
        })}
      </div>
    </div>
  )
}
