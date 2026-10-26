'use client'

import { useEffect, useMemo, useState } from 'react'
import { Users } from 'lucide-react'
import { consultarPlanoReserva, type MesaPanel, type SalonPanel } from '@/app/(panel)/actions'

const rango = (m: Pick<MesaPanel, 'capacidad' | 'capacidad_min'>) => (m.capacidad_min > 1 ? `${m.capacidad_min}–${m.capacidad}` : `${m.capacidad}`)

/** Selección de mesas: una sola mesa (fija o móvil) o varias móviles juntas. Devuelve la nueva selección y, si hace falta, un aviso. */
function alternar(mesas: MesaPanel[], sel: string[], m: MesaPanel, personas: number, maxMesas: number): { sel: string[]; aviso: string | null } {
  if (m.estado === 'ocupada') return { sel, aviso: `La mesa ${m.numero} ya está ocupada a esa hora${m.ocupada_por ? ` (${m.ocupada_por})` : ''}.` }
  if (m.estado === 'no_apta') return { sel, aviso: `La mesa ${m.numero} es para ${rango(m)} personas (la reserva es de ${personas}).` }
  if (m.estado !== 'disponible') return { sel, aviso: null }
  if (sel.includes(m.id)) return { sel: sel.filter((i) => i !== m.id), aviso: null }
  const actuales = mesas.filter((x) => sel.includes(x.id))
  if (m.movil && actuales.length > 0 && actuales.every((x) => x.movil)) return actuales.length >= maxMesas ? { sel, aviso: `Se pueden juntar hasta ${maxMesas} mesas.` } : { sel: [...sel, m.id], aviso: null }
  return { sel: [m.id], aviso: actuales.length > 0 ? (m.movil ? 'Se cambió la mesa elegida: las móviles solo se juntan con otras móviles.' : 'Las mesas fijas no se juntan: se eligió esta en lugar de la anterior.') : null }
}

function Plano({ salon, mesas, sel, onTocar }: { salon: SalonPanel; mesas: MesaPanel[]; sel: string[]; onTocar: (m: MesaPanel) => void }) {
  return (
    <div className="overflow-x-auto rounded-rs-lg border border-rs-border bg-rs-bg/60">
      <div className="relative" style={{ aspectRatio: `${salon.ancho} / ${salon.alto}`, minWidth: Math.max(salon.ancho * 24, 320), containerType: 'inline-size' }}>
        {mesas.map((m) => {
          const base = { left: `${(m.x / salon.ancho) * 100}%`, top: `${(m.y / salon.alto) * 100}%`, width: `${(m.w / salon.ancho) * 100}%`, height: `${(m.h / salon.alto) * 100}%`, fontSize: `calc(100cqw / ${salon.ancho} * .55)` }
          if (m.tipo === 'deco') return <div key={m.id} style={base} className="absolute grid place-items-center overflow-hidden rounded border border-dashed border-rs-muted/50 bg-rs-raised/40 px-1 text-center font-semibold uppercase tracking-wide text-rs-muted">{m.numero}</div>
          const elegida = sel.includes(m.id), libre = m.estado === 'disponible'
          return (
            <button key={m.id} type="button" style={base} onClick={() => onTocar(m)} aria-pressed={elegida} title={m.ocupada_por ? `Ocupada: ${m.ocupada_por}` : undefined}
              aria-label={`Mesa ${m.numero}, ${rango(m)} personas, ${m.movil ? 'móvil, ' : 'fija, '}${libre ? 'libre' : m.estado === 'ocupada' ? 'ocupada' : 'no apta para esta cantidad'}`}
              className={'absolute flex flex-col items-center justify-center overflow-hidden border-2 leading-tight transition ' + (m.forma === 'redonda' ? 'rounded-full ' : 'rounded-lg ') + (m.movil ? 'border-dashed ' : '') +
                (elegida ? 'border-rs-lime bg-rs-lime/30 text-rs-text ring-2 ring-rs-lime ' : libre ? 'border-rs-ok/70 bg-rs-ok/15 text-rs-text hover:bg-rs-ok/25 ' : 'cursor-not-allowed border-rs-muted/40 bg-rs-raised/40 text-rs-muted opacity-60 ')}>
              <span className="font-bold">{m.numero}</span>
              <span className="opacity-80" style={{ fontSize: '.68em' }}><Users className="mr-0.5 inline" size={9} />{rango(m)}</span>
              {!libre && !elegida && <span style={{ fontSize: '.58em' }} className="uppercase">{m.estado === 'ocupada' ? 'Ocupada' : 'No apta'}</span>}
            </button>
          )
        })}
      </div>
    </div>
  )
}

/** Elegir mesa en el plano al cargar una reserva a mano. Muestra las mesas de la sede / ubicación elegidas con su estado para esa fecha y hora. */
export default function PlanoElegir({ fecha, hora, personas, sede, ubicacion, value, onChange, excluirReserva }: {
  fecha: string; hora: string; personas: number; sede: string; ubicacion: string; value: string[]; onChange: (ids: string[]) => void; excluirReserva?: string
}) {
  const [abierto, setAbierto] = useState(false)
  const [cargando, setCargando] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [datos, setDatos] = useState<{ salones: SalonPanel[]; mesas: MesaPanel[] } | null>(null)
  const [salonId, setSalonId] = useState('')
  const [aviso, setAviso] = useState<string | null>(null)
  const listo = !!fecha && !!hora && personas > 0

  useEffect(() => {
    if (!abierto || !listo) return
    let vivo = true
    setCargando(true); setError(null)
    void (async () => {
      const r = await consultarPlanoReserva({ fecha, hora, personas, sede: sede || null, ubicacion: ubicacion || null, excluirId: excluirReserva })
      if (!vivo) return
      setCargando(false)
      if (!r.ok) { setDatos(null); setError(r.error); return }
      setDatos({ salones: r.salones, mesas: r.mesas }); setSalonId((s) => (r.salones.some((x) => x.id === s) ? s : r.salones[0]?.id ?? ''))
      onChange(value.filter((id) => r.mesas.some((m) => m.id === id && m.estado === 'disponible')))   // si algo se ocupó, se saca de la selección
    })()
    return () => { vivo = false }
  }, [abierto, listo, fecha, hora, personas, sede, ubicacion]) // eslint-disable-line react-hooks/exhaustive-deps

  const elegidas = useMemo(() => (datos?.mesas ?? []).filter((m) => value.includes(m.id)), [datos, value])
  const salon = datos?.salones.find((s) => s.id === salonId) ?? null
  const total = elegidas.reduce((s, m) => ({ min: s.min + m.capacidad_min, max: s.max + m.capacidad }), { min: 0, max: 0 })

  return (
    <div className="col-span-2 space-y-2 rounded-md border border-rs-border/60 p-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <span className="label">Mesa (opcional)</span>
          <p className="text-xs text-rs-muted">{value.length ? `Elegida: ${elegidas.map((m) => m.numero).join(' + ') || '…'}` : listo ? 'Podés elegirla ahora en el plano o asignarla después desde Salón y mesas.' : 'Completá fecha, hora y personas para ver el plano.'}</p>
        </div>
        <div className="flex gap-2">
          {value.length > 0 && <button type="button" onClick={() => { onChange([]); setAviso(null) }} className="btn btn-sm">Quitar mesa</button>}
          <button type="button" disabled={!listo} onClick={() => setAbierto((a) => !a)} className="btn btn-sm">{abierto ? 'Ocultar plano' : 'Elegir en el plano'}</button>
        </div>
      </div>
      {abierto && listo && (
        cargando ? <p className="text-sm text-rs-muted">Cargando el plano…</p> : error ? <p role="alert" className="text-sm text-rs-danger">{error}</p>
        : datos && datos.salones.length === 0 ? <p className="text-sm text-rs-muted">No hay un plano cargado para esta sede / ubicación.</p>
        : datos && (
          <div className="space-y-2">
            {datos.salones.length > 1 && <div className="flex flex-wrap gap-2">{datos.salones.map((s) => <button key={s.id} type="button" onClick={() => setSalonId(s.id)} aria-pressed={salonId === s.id} className={'btn btn-sm ' + (salonId === s.id ? 'btn-primary' : '')}>{s.nombre}</button>)}</div>}
            {salon && <Plano salon={salon} mesas={datos.mesas.filter((m) => m.salon_id === salon.id)} sel={value} onTocar={(m) => { const r = alternar(datos.mesas, value, m, personas, 6); onChange(r.sel); setAviso(r.aviso) }} />}
            <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-rs-muted">
              <span className="inline-flex items-center gap-1.5"><span className="h-3 w-3 rounded border-2 border-rs-ok/70 bg-rs-ok/15" />Libre</span>
              <span className="inline-flex items-center gap-1.5"><span className="h-3 w-3 rounded border-2 border-rs-lime bg-rs-lime/30" />Elegida</span>
              <span className="inline-flex items-center gap-1.5"><span className="h-3 w-3 rounded border-2 border-rs-muted/40 bg-rs-raised/40 opacity-60" />Ocupada / no apta</span>
              <span className="inline-flex items-center gap-1.5"><span className="h-3 w-3 rounded border-2 border-dashed border-rs-ok/70 bg-rs-ok/15" />Móvil (se puede juntar)</span>
            </div>
            {aviso && <p role="status" className="text-sm text-rs-warn">{aviso}</p>}
            {elegidas.length > 0 && <p className={'rounded-md px-3 py-2 text-sm ' + (personas >= total.min && personas <= total.max ? 'bg-rs-ok/10 text-rs-ok' : 'bg-rs-warn/10 text-rs-warn')}>Mesa {elegidas.map((m) => m.numero).join(' + ')} · entran de {total.min} a {total.max} personas{personas > total.max ? ` y son ${personas}: sumá otra mesa móvil` : personas < total.min ? ` y son ${personas}: piden al menos ${total.min}` : ' ✓'}</p>}
          </div>
        )
      )}
    </div>
  )
}
