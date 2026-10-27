'use client'

import { useEffect, useMemo, useRef, useState, useTransition } from 'react'
import { Check, MessageCircle, Minus, Plus, Users } from 'lucide-react'
import { CajaMesa, Derecho } from '@/components/mesa-sillas'
import { FechaInput } from '@/components/inputs'
import { unirNombre } from '@/lib/nombres'
import { PLANTILLA_WA_DEFECTO, renderPlantillaWA } from '@/lib/reservas-config'
import { MapPin } from 'lucide-react'
import { consultarHorarios, consultarPlano, crearReservaPublica, type MesaWeb, type ResultadoReserva, type SalonWeb, type SedeWeb, type SlotWeb, type TipoWeb } from '@/app/reservar/[slug]/actions'

interface Props {
  slug: string; nombre: string; ubicaciones: { nombre: string; sucursal_id: string | null }[]; sedes: SedeWeb[]; tipos: TipoWeb[]; cerrados: Record<string, string[]>
  cfg: { elegir_mesa: boolean; dias_adelante: number; personas_min: number; personas_max: number; mensaje: string | null; modo_prueba: boolean; titulo: string | null; subtitulo: string | null; texto_whatsapp: string | null; max_mesas: number; cualquier_ubicacion: boolean; texto_cualquier_ubicacion: string | null; pedir_cumple: boolean }; hoy: string; whatsapp: string
}

const sumarDias = (iso: string, d: number) => new Date(new Date(iso + 'T12:00:00Z').getTime() + d * 86400000).toISOString().slice(0, 10)
const rango = (m: Pick<MesaWeb, 'capacidad' | 'capacidad_min'>) => (m.capacidad_min > 1 ? `${m.capacidad_min}–${m.capacidad}` : `${m.capacidad}`)
const MOTIVO: Record<string, string> = { completo: 'Completo', pasado: 'Ya pasó', bloqueado: 'Cerrado', fuera_de_rango: 'No disponible' }

const sinTildes = (t: string) => t.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '')

export default function ReservarPublico({ slug, nombre, ubicaciones: ubicacionesTodas, sedes, tipos: tiposTodos, cerrados, cfg, hoy, whatsapp }: Props) {
  const [fecha, setFecha] = useState(sumarDias(hoy, 1))
  const [personas, setPersonas] = useState(Math.min(Math.max(2, cfg.personas_min), cfg.personas_max))
  // Sedes: el negocio con sedes elige primero la sede y de ahí sale todo (WhatsApp, ubicaciones, plano, horarios, aforo). Con una sola sede ofrecida se elige sola.
  const conSedes = sedes.length > 0
  const [sedeId, setSedeId] = useState(sedes.length === 1 ? sedes[0].id : '')
  const sede = sedes.find((s) => s.id === sedeId) ?? null
  const listo = !conSedes || !!sede
  const diasCerrados = useMemo(() => new Set(cerrados[conSedes ? sedeId : '*'] ?? []), [cerrados, conSedes, sedeId])
  // tipos de reserva que se ofrecen ese día (algunos son solo de ciertos días de la semana o de fechas puntuales)
  const tipos = useMemo(() => {
    const dow = new Date(fecha + 'T12:00:00Z').getUTCDay()
    return tiposTodos.filter((t) => t.modo === 'semana' ? t.dias_semana.includes(dow) : t.modo === 'fechas' ? t.fechas.includes(fecha) : true)
  }, [tiposTodos, fecha])
  useEffect(() => { if (tipos.length > 0 && !tipos.some((t) => t.value === tipo)) setTipo(tipos[0].value) }, [tipos]) // eslint-disable-line react-hooks/exhaustive-deps
  const ubicacionesDe = (id: string) => ubicacionesTodas.filter((u) => !conSedes || !u.sucursal_id || u.sucursal_id === id).map((u) => u.nombre)
  const ubicaciones = ubicacionesDe(sedeId)
  const puedeElegirDe = (id: string) => (conSedes ? !!sedes.find((s) => s.id === id && s.elegir_mesa && s.tiene_plano) : cfg.elegir_mesa)
  const puedeElegir = puedeElegirDe(sedeId)
  const [ubicacion, setUbicacion] = useState(ubicacionesDe(sedeId)[0] ?? '')
  // "Cualquier ubicación disponible": el cliente no elige lugar ni mesa; la disponibilidad respeta el aforo de cada ubicación y el local le asigna una al registrar
  const ofreceCualquiera = cfg.cualquier_ubicacion && ubicaciones.length >= 2
  const cualquiera = ofreceCualquiera && ubicacion === '*'
  const etiquetaCualquiera = cfg.texto_cualquier_ubicacion?.trim() || 'Cualquier ubicación disponible'
  const ubicTexto = (u: string | null) => (u === '*' ? etiquetaCualquiera : u)
  const [tipo, setTipo] = useState(tiposTodos[0]?.value ?? 'comun')
  const [slots, setSlots] = useState<SlotWeb[] | null>(null)
  const [cargandoSlots, setCargandoSlots] = useState(false)
  const [errorSlots, setErrorSlots] = useState<string | null>(null)
  const [hora, setHora] = useState('')
  const [modo, setModo] = useState<'elegir' | 'asesor' | null>(puedeElegir ? null : 'asesor')
  const [plano, setPlano] = useState<{ salones: SalonWeb[]; mesas: MesaWeb[] } | null>(null)
  const [cargandoPlano, setCargandoPlano] = useState(false)
  const [errorPlano, setErrorPlano] = useState<string | null>(null)
  const [salonId, setSalonId] = useState('')
  const [sel, setSel] = useState<string[]>([])
  const [aviso, setAviso] = useState<string | null>(null)
  const [form, setForm] = useState({ nombre: '', apellido: '', cumple_dia: '', cumple_mes: '', observaciones: '', web: '' })
  const [error, setError] = useState<string | null>(null)
  const [resultado, setResultado] = useState<Extract<ResultadoReserva, { ok: true }> | null>(null)
  const [pend, start] = useTransition()
  const refDatos = useRef<HTMLDivElement>(null)

  const elegirSede = (id: string) => { setSedeId(id); setUbicacion(ubicacionesDe(id)[0] ?? ''); setHora(''); setSel([]); setSlots(null); setModo(puedeElegirDe(id) ? null : 'asesor') }
  // enlace directo a una sede: /reservar/<negocio>?sede=<nombre de la sede>
  useEffect(() => {
    if (!conSedes || sedeId) return
    const q = new URLSearchParams(window.location.search).get('sede'); if (!q) return
    const s = sedes.find((x) => x.id === q || sinTildes(x.nombre) === sinTildes(q)); if (s) elegirSede(s.id)
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  // horarios: se vuelven a pedir cuando cambia el día, la cantidad de personas, la ubicación o la sede
  useEffect(() => {
    if (!listo) return
    let vivo = true
    setCargandoSlots(true); setErrorSlots(null)
    const t = setTimeout(async () => {
      const r = await consultarHorarios(slug, fecha, personas, ubicacion, sedeId)
      if (!vivo) return
      setCargandoSlots(false)
      if (!r.ok) { setSlots(null); setErrorSlots(r.error); return }
      setSlots(r.slots)
      setHora((h) => (r.slots.some((s) => s.hora === h && s.disponible) ? h : ''))
    }, 250)
    return () => { vivo = false; clearTimeout(t) }
  }, [slug, fecha, personas, ubicacion, sedeId, listo])

  // plano: cuando se eligió horario y la persona quiere elegir mesa
  useEffect(() => {
    if (!listo || !hora || modo !== 'elegir') { setPlano(null); return }
    let vivo = true
    setCargandoPlano(true); setErrorPlano(null); setSel([])
    void (async () => {
      const r = await consultarPlano(slug, fecha, hora, personas, ubicacion, sedeId)
      if (!vivo) return
      setCargandoPlano(false)
      if (!r.ok) { setPlano(null); setErrorPlano(r.error); return }
      setPlano({ salones: r.salones, mesas: r.mesas }); setSalonId(r.salones[0]?.id ?? '')
    })()
    return () => { vivo = false }
  }, [slug, fecha, hora, personas, ubicacion, modo, sedeId, listo])

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
    if (m.movil && actuales.length > 0 && actuales.every((x) => x.movil)) { if (actuales.length >= cfg.max_mesas) { setAviso(`Se pueden juntar hasta ${cfg.max_mesas} mesas.`); return }; setSel([...sel, m.id]); return }
    if (actuales.length > 0) setAviso(m.movil ? 'Se cambió la mesa elegida: las móviles solo se juntan con otras móviles.' : 'Las mesas fijas no se juntan: elegiste esta en lugar de la anterior.')
    setSel([m.id])
  }

  const listoParaDatos = !!hora && (cualquiera || modo === 'asesor' || (modo === 'elegir' && seleccionValida))
  const enviar = (e: React.FormEvent) => {
    e.preventDefault(); setError(null)
    if (!!form.cumple_dia !== !!form.cumple_mes) { setError('Completá el día y el mes del cumpleaños, o dejá los dos vacíos.'); return }
    start(async () => {
      const r = await crearReservaPublica(slug, { sede: sedeId, fecha, hora, personas, ubicacion, tipo, ...form, nombre: unirNombre(form.nombre, form.apellido), mesas: modo === 'elegir' ? sel : [] })
      if (r.ok) { setResultado(r); window.scrollTo({ top: 0, behavior: 'smooth' }); window.location.href = urlWA(r) } else { setError(r.error); refDatos.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }) }
    })
  }
  const campo = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => setForm((f) => ({ ...f, [k]: e.target.value }))
  const fechaTxt = (iso: string) => new Date(iso + 'T12:00:00').toLocaleDateString('es-AR', { weekday: 'long', day: 'numeric', month: 'long' })
  // La reserva se registra recién cuando el cliente manda el mensaje por WhatsApp (como el pedido de Toque): acá solo hay una solicitud en espera.
  // El código del mensaje es lo que une el mensaje con la solicitud; el teléfono es el de quien escribe, por eso no lo pedimos en el formulario.
  const urlWA = (r: Extract<ResultadoReserva, { ok: true }>) => {
    const tipoTxt = tipos.find((t) => t.value === tipo)?.label ?? ''
    const texto = renderPlantillaWA(cfg.texto_whatsapp?.trim() || PLANTILLA_WA_DEFECTO, {
      negocio: cfg.titulo || nombre, codigo: r.codigo, sede: r.sede ?? '', nombre_pila: form.nombre.trim(), apellido: form.apellido.trim(), cumple: form.cumple_dia && form.cumple_mes ? `${form.cumple_dia.padStart(2, '0')}-${form.cumple_mes.padStart(2, '0')}` : '', nombre: unirNombre(form.nombre, form.apellido), dia: fechaTxt(r.fecha), hora: r.hora, personas: String(r.personas),
      ubicacion: r.ubicacion ?? (cualquiera ? etiquetaCualquiera : ''), tipo: tipoTxt, mesa: r.mesas ? r.mesas : 'que la elija el local', comentarios: form.observaciones.trim(),
    })
    return `https://wa.me/${(r.whatsapp || sede?.whatsapp || whatsapp).replace(/\D/g, '')}?text=${encodeURIComponent(texto)}`
  }

  if (resultado) {
    return (
      <div className="min-h-screen">
        <Banner nombre={cfg.titulo || nombre} subtitulo={cfg.subtitulo} prueba={cfg.modo_prueba} />
        <main className="mx-auto max-w-lg space-y-4 px-4 py-8 text-center">
          <div className="mx-auto grid h-14 w-14 place-items-center rounded-full bg-rs-warn/15 text-rs-warn"><MessageCircle size={28} /></div>
          <h1 className="text-xl font-bold">¡Último paso: mandá el mensaje por WhatsApp!</h1>
          <p className="text-sm text-rs-muted">Tu reserva <b className="text-rs-text">todavía no está registrada</b>: queda en espera hasta que nos escribas. Se abre WhatsApp con tu solicitud ya escrita: <b className="text-rs-text">enviála sin cambiarla</b> (lleva tu código).</p>
          <p className="text-3xl font-bold tracking-widest text-rs-lime" aria-label="Tu código">{resultado.codigo}</p>
          <div className="card space-y-1 p-4 text-left text-sm">
            {resultado.sede && <p><span className="text-rs-muted">Sede:</span> <b>{resultado.sede}</b></p>}
            <p><span className="text-rs-muted">Día:</span> <b className="capitalize">{fechaTxt(resultado.fecha)}</b> · {resultado.hora}</p>
            <p><span className="text-rs-muted">Personas:</span> <b>{resultado.personas}</b>{resultado.ubicacion || cualquiera ? <> · <span className="text-rs-muted">Ubicación:</span> <b>{resultado.ubicacion ?? etiquetaCualquiera}</b></> : null}</p>
            <p><span className="text-rs-muted">Mesa:</span> <b>{resultado.mesas ? `Mesa ${resultado.mesas} (la confirmamos con vos)` : 'La elige un asesor'}</b></p>
          </div>
          {resultado.mensaje && <p className="whitespace-pre-line text-sm text-rs-muted">{resultado.mensaje}</p>}
          <a href={urlWA(resultado)} className="btn btn-primary h-12 w-full text-base"><MessageCircle size={18} />Enviar por WhatsApp</a>
          <p className="text-xs text-rs-muted">Si WhatsApp no se abrió, tocá el botón. La solicitud espera 48 horas. Después de que escribas, un asesor te confirma la reserva.</p>
          <button type="button" onClick={() => { setResultado(null); setHora(''); setSel([]); setForm({ nombre: '', apellido: '', cumple_dia: '', cumple_mes: '', observaciones: '', web: '' }); setModo(puedeElegir ? null : 'asesor') }} className="btn w-full">Hacer otra reserva</button>
        </main>
      </div>
    )
  }

  const chip = (activo: boolean) => 'inline-flex h-9 items-center rounded-full border px-3.5 text-sm font-medium transition ' + (activo ? 'border-rs-lime/70 bg-rs-lime/15 font-semibold text-rs-lime' : 'border-rs-control text-rs-muted hover:border-rs-lime/40 hover:text-rs-text')
  return (
    <div className="min-h-screen pb-16">
      <Banner nombre={cfg.titulo || nombre} subtitulo={cfg.subtitulo} prueba={cfg.modo_prueba} />
      <main className="mx-auto max-w-2xl space-y-5 px-4 py-6">
        {cfg.mensaje && !sede?.mensaje && <p className="whitespace-pre-line rounded-md bg-rs-raised/60 px-3 py-2 text-sm text-rs-muted">{cfg.mensaje}</p>}

        {/* 0. sede */}
        {conSedes && sedes.length > 1 && (
          <section className="card space-y-3 p-4">
            <h2 className="font-bold">1 · ¿En qué sede?</h2>
            <div className="grid gap-2 sm:grid-cols-2">
              {sedes.map((s) => (
                <button key={s.id} type="button" onClick={() => elegirSede(s.id)} aria-pressed={sedeId === s.id}
                  className={'rounded-rs-lg border p-3 text-left transition ' + (sedeId === s.id ? 'border-rs-lime/70 bg-rs-lime/10' : 'border-rs-control hover:border-rs-lime/40')}>
                  <span className="block font-semibold">{s.nombre}</span>
                  {s.direccion && <span className="mt-0.5 flex items-start gap-1 text-xs text-rs-muted"><MapPin size={12} className="mt-0.5 shrink-0" />{s.direccion}</span>}
                  {s.elegir_mesa && s.tiene_plano && <span className="mt-1 block text-[11px] font-semibold text-rs-ok">Podés elegir tu mesa en el plano</span>}
                </button>
              ))}
            </div>
            {sede?.maps_url && <a href={sede.maps_url} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-xs text-rs-lime hover:underline"><MapPin size={12} />Ver {sede.nombre} en el mapa</a>}
            {sede?.mensaje && <p className="whitespace-pre-line rounded-md bg-rs-raised/60 px-3 py-2 text-sm text-rs-muted">{sede.mensaje}</p>}
          </section>
        )}

        {/* 1. cuándo y cuántos */}
        {listo && (
        <section className="card space-y-4 p-4">
          <h2 className="font-bold">{conSedes && sedes.length > 1 ? 2 : 1} · ¿Cuándo y cuántos?</h2>
          <div className="grid grid-cols-2 gap-3">
            <div><label className="label" htmlFor="rw_fecha">Día</label><FechaInput id="rw_fecha" value={fecha} min={hoy} max={sumarDias(hoy, cfg.dias_adelante)} deshabilitado={(d) => diasCerrados.has(d)} onChange={(v) => v && setFecha(v)} /></div>
            <div>
              <span className="label">Personas</span>
              <div className="flex h-9 items-center justify-between rounded-rs border border-rs-control px-1">
                <button type="button" onClick={() => setPersonas((p) => Math.max(cfg.personas_min, p - 1))} aria-label="Una persona menos" className="grid h-7 w-7 place-items-center rounded-full hover:bg-rs-raised"><Minus size={14} /></button>
                <span className="font-bold tabular-nums" aria-live="polite"><Users size={13} className="mr-1 inline text-rs-muted" />{personas}</span>
                <button type="button" onClick={() => setPersonas((p) => Math.min(cfg.personas_max, p + 1))} aria-label="Una persona más" className="grid h-7 w-7 place-items-center rounded-full hover:bg-rs-raised"><Plus size={14} /></button>
              </div>
            </div>
          </div>
          {ubicaciones.length > 0 && <div><span className="label">Ubicación</span><div className="flex flex-wrap gap-2">{ubicaciones.map((u) => <button key={u} type="button" onClick={() => { setUbicacion(u); setSel([]); setModo(puedeElegir ? null : 'asesor') }} aria-pressed={ubicacion === u} className={chip(ubicacion === u)}>{u}</button>)}{ofreceCualquiera && <button type="button" onClick={() => { setUbicacion('*'); setSel([]); setModo('asesor') }} aria-pressed={cualquiera} className={chip(cualquiera)}>{etiquetaCualquiera}</button>}</div></div>}
          {tipos.length === 0 && <p role="status" className="rounded-md bg-rs-warn/10 px-3 py-2 text-sm text-rs-warn">Ese día no hay reservas disponibles por acá. Probá con otro día.</p>}
          {tipos.length > 1 && <div><span className="label">Tipo de reserva</span><div className="flex flex-wrap gap-2">{tipos.map((t) => <button key={t.value} type="button" onClick={() => setTipo(t.value)} aria-pressed={tipo === t.value} className={chip(tipo === t.value)}>{t.label}</button>)}</div></div>}
          <div>
            <span className="label">Horario</span>
            {cargandoSlots && !slots ? <p className="text-sm text-rs-muted">Buscando horarios…</p> : errorSlots ? <p role="alert" className="text-sm text-rs-danger">{errorSlots}</p> : (
              <div className={'flex flex-wrap gap-2 ' + (cargandoSlots ? 'opacity-60' : '')}>
                {(slots ?? []).map((s) => (
                  <button key={s.hora} type="button" disabled={!s.disponible} onClick={() => { setHora(s.hora); setModo(cualquiera || !puedeElegir ? 'asesor' : null); setSel([]) }} aria-pressed={hora === s.hora}
                    className={chip(hora === s.hora) + (s.disponible ? '' : ' cursor-not-allowed line-through opacity-50')} title={s.disponible ? undefined : MOTIVO[s.motivo ?? 'fuera_de_rango']}>
                    {s.hora}{!s.disponible && <span className="ml-1.5 text-[10px] font-semibold uppercase no-underline">{MOTIVO[s.motivo ?? 'fuera_de_rango']}</span>}
                  </button>
                ))}
                {slots && slots.length === 0 && <p className="text-sm text-rs-muted">No hay horarios para este día.</p>}
              </div>
            )}
          </div>
        </section>
        )}

        {/* 2. mesa */}
        {listo && hora && !cualquiera && (
          <section className="card space-y-3 p-4">
            <h2 className="font-bold">{conSedes && sedes.length > 1 ? 3 : 2} · Tu mesa</h2>
            {puedeElegir && (
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
            {modo === 'asesor' && <p className="rounded-md bg-rs-raised/50 px-3 py-2 text-sm text-rs-muted">Perfecto: un asesor revisa tu reserva y te asigna la mejor mesa disponible.</p>}
          </section>
        )}

        {/* 3. datos */}
        {listo && listoParaDatos && (
          <section ref={refDatos} className="card p-4">
            <h2 className="mb-3 font-bold">{(cualquiera ? 2 : 3) + (conSedes && sedes.length > 1 ? 1 : 0)} · Tus datos</h2>
            <form onSubmit={enviar} className="space-y-3">
              {error && <p role="alert" className="rounded-md border border-rs-danger/40 bg-rs-danger/10 px-3 py-2 text-sm text-rs-danger">{error}</p>}
              <div className="grid grid-cols-2 gap-3">
                <div><label className="label" htmlFor="rw_nombre">Nombre *</label><input id="rw_nombre" value={form.nombre} onChange={campo('nombre')} maxLength={60} autoComplete="given-name" className="input w-full" required /></div>
                <div><label className="label" htmlFor="rw_apellido">Apellido *</label><input id="rw_apellido" value={form.apellido} onChange={campo('apellido')} maxLength={60} autoComplete="family-name" className="input w-full" required /></div>
              </div>
              {cfg.pedir_cumple && (
                <div>
                  <span className="label">Tu cumpleaños (opcional)</span>
                  <div className="grid grid-cols-2 gap-3">
                    <select aria-label="Día de cumpleaños" value={form.cumple_dia} onChange={(e) => setForm((f) => ({ ...f, cumple_dia: e.target.value }))} className="input w-full"><option value="">Día</option>{Array.from({ length: 31 }, (_, i) => <option key={i + 1} value={String(i + 1)}>{i + 1}</option>)}</select>
                    <select aria-label="Mes de cumpleaños" value={form.cumple_mes} onChange={(e) => setForm((f) => ({ ...f, cumple_mes: e.target.value }))} className="input w-full"><option value="">Mes</option>{['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'].map((m, i) => <option key={m} value={String(i + 1)}>{m}</option>)}</select>
                  </div>
                  <p className="mt-1 text-xs text-rs-muted">Solo el día y el mes, para saludarte en tu día. Podés dejarlo vacío.</p>
                </div>
              )}
              <div><label className="label" htmlFor="rw_obs">Comentarios (opcional)</label><textarea id="rw_obs" value={form.observaciones} onChange={campo('observaciones')} maxLength={400} rows={2} placeholder="Cumpleaños, alergias, cochecito…" className="input w-full" /></div>
              <input type="text" name="web" value={form.web} onChange={campo('web')} tabIndex={-1} autoComplete="off" aria-hidden className="absolute -left-[9999px] h-0 w-0 opacity-0" />
              <div className="rounded-md bg-rs-raised/50 px-3 py-2 text-sm"><b className="capitalize">{fechaTxt(fecha)}</b> · {hora} · {personas} personas{sede && sedes.length > 1 ? ` · ${sede.nombre}` : ''}{ubicacion ? ` · ${ubicTexto(ubicacion)}` : ''}{modo === 'elegir' && mesasSel.length ? ` · Mesa ${mesasSel.map((m) => m.numero).join(' + ')}` : ''}</div>
              <button disabled={pend} className="btn btn-primary h-12 w-full text-base">{pend ? 'Guardando…' : 'Reservar y enviar por WhatsApp'}</button>
              <p className="text-center text-xs text-rs-muted">No te pedimos el teléfono: usamos el de tu WhatsApp. La reserva se registra cuando nos mandás el mensaje.</p>
            </form>
          </section>
        )}
      </main>
    </div>
  )
}

function Banner({ nombre, subtitulo, prueba }: { nombre: string; subtitulo: string | null; prueba: boolean }) {
  return (
    <header className="border-b border-rs-raised bg-rs-header px-4 pb-4 pt-6 text-center">
      {prueba && <span className="mb-2 inline-block rounded-full bg-rs-warn/15 px-3 py-0.5 text-[11px] font-bold uppercase tracking-wide text-rs-warn">Sitio de prueba</span>}
      <h1 className="text-2xl font-bold text-rs-lime">{nombre}</h1>
      <p className="mt-1 text-sm text-rs-muted">{subtitulo || 'Reservá tu mesa'}</p>
      {prueba && <p className="mx-auto mt-2 max-w-md text-xs text-rs-muted">Las reservas que se hagan en este sitio llegan al CRM marcadas como “[Sitio de prueba]”.</p>}
    </header>
  )
}
const Leyenda = ({ clase, t }: { clase: string; t: string }) => <span className="inline-flex items-center gap-1.5"><span className={'h-3 w-3 rounded border-2 ' + clase} />{t}</span>

export function PlanoWeb({ salon, mesas, sel, onTocar }: { salon: SalonWeb; mesas: MesaWeb[]; sel: string[]; onTocar: (m: MesaWeb) => void }) {
  return (
    <div className="overflow-x-auto rounded-rs-lg border border-rs-border bg-rs-bg/60 p-3">
      <div className="relative" style={{ aspectRatio: `${salon.ancho} / ${salon.alto}`, minWidth: Math.max(salon.ancho * 24, 320), containerType: 'inline-size' }}>
        {mesas.map((m) => {
          const base = { left: `${(m.x / salon.ancho) * 100}%`, top: `${(m.y / salon.alto) * 100}%`, width: `${(m.w / salon.ancho) * 100}%`, height: `${(m.h / salon.alto) * 100}%`, fontSize: `calc(100cqw / ${salon.ancho} * .55)` }
          if (m.tipo === 'deco') return <div key={m.id} style={base} className="absolute grid place-items-center overflow-hidden rounded border border-dashed border-rs-muted/50 bg-rs-raised/40 px-1 text-center font-semibold uppercase tracking-wide text-rs-muted">{m.numero}</div>
          const elegida = sel.includes(m.id), libre = m.estado === 'disponible'
          return (
            <CajaMesa key={m.id} mesa={m} tema={salon} style={base}><button type="button" onClick={() => onTocar(m)} aria-pressed={elegida} aria-label={`Mesa ${m.numero}, ${rango(m)} personas, ${m.movil ? 'móvil, ' : 'fija, '}${libre ? 'disponible' : m.estado === 'ocupada' ? 'no disponible, ya reservada' : 'no apta para tu grupo'}`}
              className={'absolute inset-0 flex flex-col items-center justify-center overflow-hidden border-2 leading-tight transition ' + (m.forma === 'redonda' ? 'rounded-full ' : 'rounded-lg ') + (m.movil ? 'border-dashed ' : '') +
                (elegida ? 'border-rs-lime bg-rs-lime/30 text-rs-text ring-2 ring-rs-lime ' : libre ? 'border-rs-ok/70 bg-rs-ok/15 text-rs-text hover:bg-rs-ok/25 ' : 'cursor-not-allowed border-rs-muted/40 bg-rs-raised/40 text-rs-muted opacity-60 ')}>
              <Derecho rot={m.rotacion}><span className="font-bold">{m.numero}</span>
              <span className="opacity-80" style={{ fontSize: '.68em' }}><Users className="mr-0.5 inline" size={9} />{rango(m)}</span>
              {!libre && !elegida && <span style={{ fontSize: '.58em' }} className="uppercase">{m.estado === 'ocupada' ? 'Reservada' : 'No apta'}</span>}</Derecho>
            </button></CajaMesa>
          )
        })}
      </div>
    </div>
  )
}
