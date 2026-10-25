'use client'

import { useEffect, useId, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { CalendarDays, ChevronLeft, ChevronRight, Clock } from 'lucide-react'
import { SEP_FECHA, TZ_AR, hoyEn } from '@/lib/fechas'

// Entradas "estilo LATAM": fecha dd-mm-aaaa con calendario que empieza el lunes, hora de 24 h y teléfono
// con código de país + código de área + número. Cada una emite un <input type="hidden" name=...> con el
// valor normalizado (ISO yyyy-mm-dd, HH:MM, solo dígitos), así que las server actions no cambian.

const MESES = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre']
const DIAS = ['Lu', 'Ma', 'Mi', 'Ju', 'Vi', 'Sá', 'Do']
const pad = (n: number) => String(n).padStart(2, '0')
const aIso = (y: number, m: number, d: number) => `${y}-${pad(m)}-${pad(d)}`
const isoATexto = (iso: string) => (/^\d{4}-\d{2}-\d{2}$/.test(iso) ? `${iso.slice(8, 10)}${SEP_FECHA}${iso.slice(5, 7)}${SEP_FECHA}${iso.slice(0, 4)}` : '')

function textoAIso(t: string): string | null {
  const m = t.match(/^(\d{2})[-/](\d{2})[-/](\d{4})$/)
  if (!m) return null
  const d = +m[1], mo = +m[2], y = +m[3]
  const dt = new Date(Date.UTC(y, mo - 1, d))
  return dt.getUTCFullYear() === y && dt.getUTCMonth() === mo - 1 && dt.getUTCDate() === d ? aIso(y, mo, d) : null
}

/** Máscara dd-mm-aaaa mientras se escribe (sirve escribir solo los números o pegar con / o -). */
function mascaraFecha(raw: string): string {
  const d = raw.replace(/\D/g, '').slice(0, 8)
  return d.length <= 2 ? d : d.length <= 4 ? `${d.slice(0, 2)}${SEP_FECHA}${d.slice(2)}` : `${d.slice(0, 2)}${SEP_FECHA}${d.slice(2, 4)}${SEP_FECHA}${d.slice(4)}`
}

// ---------------------------------------------------------------------------
// Fecha
// ---------------------------------------------------------------------------
export function FechaInput({ name, id, value, defaultValue = '', onChange, required, min, max, placeholder = 'dd-mm-aaaa', className = '' }: {
  name?: string; id?: string; value?: string; defaultValue?: string; onChange?: (iso: string) => void
  required?: boolean; min?: string; max?: string; placeholder?: string; className?: string
}) {
  const auto = useId()
  const controlado = value !== undefined
  const [interno, setInterno] = useState(defaultValue)
  const iso = controlado ? value! : interno
  const [texto, setTexto] = useState(isoATexto(iso))
  const [abierto, setAbierto] = useState(false)
  const caja = useRef<HTMLDivElement>(null)
  const campo = useRef<HTMLInputElement>(null)
  const [pos, setPos] = useState<{ top: number; left: number } | null>(null)

  // si el valor cambia desde afuera (controlado), el texto lo sigue
  useEffect(() => { if (controlado && isoATexto(value!) !== texto && textoAIso(texto) !== value) setTexto(isoATexto(value!)) }, [value]) // eslint-disable-line react-hooks/exhaustive-deps

  const emitir = (nuevo: string) => { if (!controlado) setInterno(nuevo); onChange?.(nuevo) }
  const hoy = hoyEn(TZ_AR)
  const base = iso || hoy
  const [vista, setVista] = useState({ y: +base.slice(0, 4), m: +base.slice(5, 7) })
  useEffect(() => { if (abierto) setVista({ y: +(iso || hoy).slice(0, 4), m: +(iso || hoy).slice(5, 7) }) }, [abierto]) // eslint-disable-line react-hooks/exhaustive-deps

  // el calendario se dibuja en <body> (portal) para que no lo recorte un modal, tabla o tarjeta
  useEffect(() => {
    if (!abierto) return
    const colocar = () => {
      const r = campo.current?.getBoundingClientRect(); if (!r) return
      const alto = 330, ancho = 280
      const abajo = r.bottom + 6 + alto <= window.innerHeight
      setPos({ top: abajo ? r.bottom + 6 : Math.max(8, r.top - alto - 6), left: Math.min(Math.max(8, r.left), window.innerWidth - ancho - 8) })
    }
    colocar()
    const cerrar = (e: MouseEvent) => { const t = e.target as Node; if (!caja.current?.contains(t) && !campo.current?.contains(t)) setAbierto(false) }
    const tecla = (e: KeyboardEvent) => { if (e.key === 'Escape') { e.stopPropagation(); setAbierto(false) } }
    document.addEventListener('mousedown', cerrar); window.addEventListener('keydown', tecla, true); window.addEventListener('resize', colocar); window.addEventListener('scroll', colocar, true)
    return () => { document.removeEventListener('mousedown', cerrar); window.removeEventListener('keydown', tecla, true); window.removeEventListener('resize', colocar); window.removeEventListener('scroll', colocar, true) }
  }, [abierto])

  const celdas = useMemo(() => {
    const primero = (new Date(Date.UTC(vista.y, vista.m - 1, 1)).getUTCDay() + 6) % 7 // lunes = 0
    const dias = new Date(Date.UTC(vista.y, vista.m, 0)).getUTCDate()
    return [...Array(primero).fill(null), ...Array.from({ length: dias }, (_, i) => i + 1)]
  }, [vista])

  const fueraDeRango = (d: string) => (min && d < min) || (max && d > max)
  const elegir = (d: number) => { const n = aIso(vista.y, vista.m, d); if (fueraDeRango(n)) return; setTexto(isoATexto(n)); emitir(n); setAbierto(false); campo.current?.focus() }
  const mover = (delta: number) => setVista((v) => { const t = v.y * 12 + (v.m - 1) + delta; return { y: Math.floor(t / 12), m: (t % 12) + 1 } })

  return (
    <div className={'relative ' + className}>
      {name && <input type="hidden" name={name} value={iso} />}
      <div className="relative">
        <input
          ref={campo}
          id={id ?? auto}
          type="text"
          inputMode="numeric"
          autoComplete="off"
          placeholder={placeholder}
          maxLength={10}
          value={texto}
          required={required}
          aria-haspopup="dialog"
          className="input w-full pr-9"
          onChange={(e) => {
            const t = mascaraFecha(e.target.value); setTexto(t)
            const v = textoAIso(t); campo.current?.setCustomValidity(t && !v ? 'Fecha no válida (dd-mm-aaaa)' : '')
            if (v) emitir(v); else if (!t) emitir('')
          }}
          onFocus={() => setAbierto(true)}
          onKeyDown={(e) => { if (e.key === 'ArrowDown') setAbierto(true) }}
        />
        <button type="button" tabIndex={-1} aria-label="Abrir calendario" onClick={() => { setAbierto((a) => !a); campo.current?.focus() }} className="absolute right-2 top-1/2 -translate-y-1/2 text-rs-muted transition hover:text-rs-lime"><CalendarDays size={16} /></button>
      </div>
      {abierto && pos && createPortal(
        <div ref={caja} role="dialog" aria-label="Calendario" className="fixed z-[80] w-[280px] animate-scale-in rounded-rs-lg border border-rs-control bg-rs-header p-3 shadow-2xl shadow-black/70" style={{ top: pos.top, left: pos.left }}>
          <div className="mb-2 flex items-center justify-between">
            <button type="button" onClick={() => mover(-1)} aria-label="Mes anterior" className="rounded-md p-1.5 text-rs-muted transition hover:bg-rs-raised hover:text-rs-text"><ChevronLeft size={16} /></button>
            <span className="text-sm font-semibold">{MESES[vista.m - 1]} {vista.y}</span>
            <button type="button" onClick={() => mover(1)} aria-label="Mes siguiente" className="rounded-md p-1.5 text-rs-muted transition hover:bg-rs-raised hover:text-rs-text"><ChevronRight size={16} /></button>
          </div>
          <div className="grid grid-cols-7 gap-1 text-center text-[11px] font-semibold uppercase text-rs-muted">{DIAS.map((d) => <span key={d} className="py-1">{d}</span>)}</div>
          <div className="grid grid-cols-7 gap-1">
            {celdas.map((d, i) => {
              if (!d) return <span key={i} />
              const n = aIso(vista.y, vista.m, d), esSel = n === iso, esHoy = n === hoy, off = !!fueraDeRango(n)
              return (
                <button key={i} type="button" disabled={off} onClick={() => elegir(d)} className={'h-8 rounded-md text-sm tabular-nums transition ' + (esSel ? 'bg-rs-lime font-bold text-rs-on-lime' : off ? 'cursor-not-allowed text-rs-muted/40' : 'hover:bg-rs-raised ' + (esHoy ? 'border border-rs-lime/60 text-rs-lime' : ''))}>{d}</button>
              )
            })}
          </div>
          <div className="mt-2 flex justify-between border-t border-rs-border pt-2">
            <button type="button" onClick={() => { setTexto(''); emitir(''); setAbierto(false) }} className="text-xs text-rs-muted transition hover:text-rs-text">Borrar</button>
            <button type="button" onClick={() => { const [y, m, d] = hoy.split('-').map(Number); setVista({ y, m }); if (!fueraDeRango(hoy)) { setTexto(isoATexto(hoy)); emitir(hoy); setAbierto(false) } }} className="text-xs font-semibold text-rs-lime transition hover:underline">Hoy</button>
          </div>
        </div>,
        document.body,
      )}
    </div>
  )
}

// ---------------------------------------------------------------------------
// Hora (24 h)
// ---------------------------------------------------------------------------
export function HoraInput({ name, id, value, defaultValue = '', onChange, required, placeholder = 'hh:mm', className = '' }: {
  name?: string; id?: string; value?: string; defaultValue?: string; onChange?: (hhmm: string) => void; required?: boolean; placeholder?: string; className?: string
}) {
  const auto = useId()
  const controlado = value !== undefined
  const [interno, setInterno] = useState(defaultValue.slice(0, 5))
  const hhmm = controlado ? value!.slice(0, 5) : interno
  const [texto, setTexto] = useState(hhmm)
  const campo = useRef<HTMLInputElement>(null)
  useEffect(() => { if (controlado && value!.slice(0, 5) !== texto && !/^\d{1,2}:?\d{0,2}$/.test(texto)) setTexto(value!.slice(0, 5)) }, [value]) // eslint-disable-line react-hooks/exhaustive-deps

  const emitir = (v: string) => { if (!controlado) setInterno(v); onChange?.(v) }
  const valida = (t: string) => { const m = t.match(/^(\d{2}):(\d{2})$/); return !!m && +m[1] <= 23 && +m[2] <= 59 }
  const mascara = (raw: string) => { const d = raw.replace(/\D/g, '').slice(0, 4); return d.length <= 2 ? d : `${d.slice(0, 2)}:${d.slice(2)}` }
  // "9" -> "09:00", "930" -> "09:30"
  const completar = (t: string) => {
    const d = t.replace(/\D/g, '')
    if (!d) return ''
    if (d.length <= 2) return `${pad(+d)}:00`
    if (d.length === 3) return `0${d[0]}:${d.slice(1)}`
    return `${d.slice(0, 2)}:${d.slice(2)}`
  }

  return (
    <div className={'relative ' + className}>
      {name && <input type="hidden" name={name} value={hhmm} />}
      <input
        ref={campo}
        id={id ?? auto}
        type="text"
        inputMode="numeric"
        autoComplete="off"
        placeholder={placeholder}
        maxLength={5}
        value={texto}
        required={required}
        className="input w-full pr-9"
        onChange={(e) => {
          const t = mascara(e.target.value); setTexto(t)
          campo.current?.setCustomValidity(t.length === 5 && !valida(t) ? 'Hora no válida (00:00 a 23:59)' : '')
          if (valida(t)) emitir(t); else if (!t) emitir('')
        }}
        onBlur={() => { const c = completar(texto); if (c && valida(c)) { setTexto(c); emitir(c); campo.current?.setCustomValidity('') } else if (texto) campo.current?.setCustomValidity('Hora no válida (00:00 a 23:59)') }}
      />
      <Clock size={15} className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-rs-muted" />
    </div>
  )
}

// ---------------------------------------------------------------------------
// Teléfono: código de país + código de área + número
// ---------------------------------------------------------------------------
function partirTelefono(d: string): { pais: string; area: string; num: string } {
  if (!d) return { pais: '549', area: '', num: '' }
  if (d.startsWith('549') && d.length >= 12) {
    const resto = d.slice(3)
    const n = resto.startsWith('11') ? 2 : 3 // Buenos Aires: 11 + 8 dígitos; resto del país: 3 dígitos de área
    return { pais: '549', area: resto.slice(0, n), num: resto.slice(n) }
  }
  if (d.startsWith('54')) return { pais: '54', area: '', num: d.slice(2) }
  return { pais: d.slice(0, 2), area: '', num: d.slice(2) }
}

export function TelefonoInput({ name, defaultValue = '', required, label, ayuda = true, onChange }: { name: string; defaultValue?: string; required?: boolean; label?: string; ayuda?: boolean; onChange?: (digitos: string) => void }) {
  const inicial = useMemo(() => partirTelefono(defaultValue.replace(/\D/g, '')), []) // eslint-disable-line react-hooks/exhaustive-deps
  const [pais, setPais] = useState(inicial.pais)
  const [area, setArea] = useState(inicial.area)
  const [num, setNum] = useState(inicial.num)
  const numRef = useRef<HTMLInputElement>(null)
  const solo = (s: string, n: number) => s.replace(/\D/g, '').slice(0, n)
  const completo = area && num ? `${pais}${area}${num}` : ''
  const total = (completo || '').length

  useEffect(() => { onChange?.(completo) }, [completo]) // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => {
    const el = numRef.current; if (!el) return
    el.setCustomValidity(!required && !area && !num ? '' : (!area || !num) ? 'Completá el código de área y el número' : total < 8 || total > 15 ? 'El teléfono no es válido' : '')
  }, [area, num, total, required])

  return (
    <div>
      {label && <span className="label">{label}</span>}
      {completo && <input type="hidden" name={name} value={completo} />}
      <div className="grid grid-cols-[4.5rem_5rem_1fr] gap-2" role="group" aria-label={label ?? 'Teléfono'}>
        <div>
          <input aria-label="Código de país" inputMode="numeric" value={pais} onChange={(e) => setPais(solo(e.target.value, 4))} className="input w-full text-center tabular-nums" required />
        </div>
        <input aria-label="Código de área" inputMode="numeric" placeholder="341" value={area} onChange={(e) => setArea(solo(e.target.value, 4))} className="input w-full text-center tabular-nums" required={required} />
        <input ref={numRef} aria-label="Número" inputMode="numeric" placeholder="5551234" value={num} onChange={(e) => setNum(solo(e.target.value, 10))} className="input w-full tabular-nums" required={required} />
      </div>
      {ayuda && <p className="mt-1 text-[11px] text-rs-muted">País (549 = Argentina móvil), área sin 0 y número sin 15{completo ? <span className="text-rs-text"> · se guarda +{completo}</span> : null}</p>}
    </div>
  )
}
