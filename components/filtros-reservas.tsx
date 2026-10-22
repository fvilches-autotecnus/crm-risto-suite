'use client'

import { useRouter, useSearchParams } from 'next/navigation'
import { useEffect, useRef, useState } from 'react'
import { ArrowDownUp, RefreshCw, Search, X } from 'lucide-react'
import { FechaInput } from '@/components/inputs'
import { PUNTO_ESTADO } from '@/components/menu-estado'
import { ESTADOS, labelTipo } from '@/lib/reservas'

export const ORDENES = [
  { value: 'alta_desc', label: 'Alta: más recientes primero' },
  { value: 'alta_asc', label: 'Alta: más antiguas primero' },
  { value: 'fecha_asc', label: 'Reserva: próximas primero' },
  { value: 'fecha_desc', label: 'Reserva: más lejanas primero' },
] as const

const RANGOS = [
  { value: 'hoy', label: 'Hoy' },
  { value: 'manana', label: 'Mañana' },
  { value: '7d', label: 'Próximos 7 días' },
  { value: 'futuras', label: 'Futuras' },
  { value: 'todas', label: 'Todas' },
  { value: 'rango', label: 'Rango…' },
]

// Los filtros viven en la URL (?q=&rango=&desde=&hasta=&estado=&tipo=&ubic=&orden=): la página es un Server Component.
export default function FiltrosReservas({ conteos, tipos, ubicaciones, total }: { conteos: Record<string, number>; tipos: string[]; ubicaciones: string[]; total: number }) {
  const router = useRouter()
  const sp = useSearchParams()
  const [q, setQ] = useState(sp.get('q') ?? '')
  const buscador = useRef<HTMLInputElement>(null)
  const rango = sp.get('rango') ?? 'hoy'
  const estado = sp.get('estado') ?? ''
  const tipo = sp.get('tipo') ?? ''
  const ubic = sp.get('ubic') ?? ''
  const orden = sp.get('orden') ?? 'alta_desc'

  const set = (cambios: Record<string, string>) => {
    const p = new URLSearchParams(window.location.search) // no `sp`: puede estar atrasado si hay una navegación en curso
    for (const [k, v] of Object.entries(cambios)) v ? p.set(k, v) : p.delete(k)
    p.delete('pagina')
    router.push('/reservas?' + p.toString())
  }

  // atajo: "/" lleva el cursor a la búsqueda
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement | null
      if (e.key !== '/' || (t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.tagName === 'SELECT'))) return
      e.preventDefault(); buscador.current?.focus()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  useEffect(() => {
    const t = setTimeout(() => (sp.get('q') ?? '') !== q.trim() && set({ q: q.trim() }), 350)
    return () => clearTimeout(t)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [q])

  const todosLosEstados = Object.values(conteos).reduce((a, b) => a + b, 0)
  const activos: { clave: string; texto: string }[] = [
    ...(estado ? [{ clave: 'estado', texto: `Estado: ${ESTADOS.find((e) => e.value === estado)?.label ?? estado}` }] : []),
    ...(tipo ? [{ clave: 'tipo', texto: `Tipo: ${labelTipo(tipo)}` }] : []),
    ...(ubic ? [{ clave: 'ubic', texto: `Ubicación: ${ubic}` }] : []),
    ...(q.trim() ? [{ clave: 'q', texto: `Búsqueda: “${q.trim()}”` }] : []),
  ]
  const hayCambios = activos.length > 0 || rango !== 'hoy' || orden !== 'alta_desc'

  const chip = (activo: boolean) => 'btn btn-sm ' + (activo ? 'btn-primary' : '')

  return (
    <div className="card space-y-3.5 p-4">
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative min-w-[220px] flex-1">
          <Search size={14} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-rs-muted" />
          <input ref={buscador} value={q} onChange={(e) => setQ(e.target.value)} placeholder="Buscar por nombre o teléfono   ( / )" className="input w-full pl-9" />
        </div>
        <label className="relative">
          <ArrowDownUp size={14} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-rs-muted" />
          <select aria-label="Ordenar por" value={orden} onChange={(e) => set({ orden: e.target.value === 'alta_desc' ? '' : e.target.value })} className="input pl-9">
            {ORDENES.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
          </select>
        </label>
        <button onClick={() => router.refresh()} aria-label="Actualizar" title="Actualizar" className="btn w-9 px-0"><RefreshCw size={14} /></button>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <span className="label mb-0 mr-1 w-14 shrink-0">Fecha</span>
        {RANGOS.map((r) => <button key={r.value} onClick={() => set({ rango: r.value === 'hoy' ? '' : r.value, desde: '', hasta: '' })} className={chip(rango === r.value)}>{r.label}</button>)}
        {rango === 'rango' && (
          <span className="flex animate-fade-in flex-wrap items-center gap-2">
            <FechaInput key={'d' + (sp.get('desde') ?? '')} value={sp.get('desde') ?? ''} onChange={(v) => set({ desde: v })} className="w-36" />
            <span className="text-rs-muted">→</span>
            <FechaInput key={'h' + (sp.get('hasta') ?? '')} value={sp.get('hasta') ?? ''} onChange={(v) => set({ hasta: v })} className="w-36" />
          </span>
        )}
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <span className="label mb-0 mr-1 w-14 shrink-0">Estado</span>
        <button onClick={() => set({ estado: '' })} className={chip(!estado)}>Todos <span className="opacity-70">{todosLosEstados}</span></button>
        {ESTADOS.map((e) => (
          <button key={e.value} onClick={() => set({ estado: estado === e.value ? '' : e.value })} className={chip(estado === e.value)}>
            <span className={'h-1.5 w-1.5 rounded-full ' + PUNTO_ESTADO[e.value]} />{e.label} <span className="opacity-70">{conteos[e.value] ?? 0}</span>
          </button>
        ))}
      </div>

      {(tipos.length > 0 || ubicaciones.length > 0) && (
        <div className="flex flex-wrap items-center gap-2">
          <span className="label mb-0 mr-1 w-14 shrink-0">Detalle</span>
          {tipos.length > 0 && (
            <select aria-label="Tipo de reserva" value={tipo} onChange={(e) => set({ tipo: e.target.value })} className="input">
              <option value="">Todos los tipos</option>
              {tipos.map((t) => <option key={t} value={t}>{labelTipo(t)}</option>)}
            </select>
          )}
          {ubicaciones.length > 0 && (
            <select aria-label="Ubicación" value={ubic} onChange={(e) => set({ ubic: e.target.value })} className="input">
              <option value="">Todas las ubicaciones</option>
              {ubicaciones.map((u) => <option key={u} value={u}>{u}</option>)}
            </select>
          )}
        </div>
      )}

      <div className="flex flex-wrap items-center gap-2 border-t border-rs-border/60 pt-3 text-xs text-rs-muted">
        <span><span className="font-semibold text-rs-text">{total}</span> reserva{total === 1 ? '' : 's'}</span>
        {activos.map((a) => (
          <button key={a.clave} onClick={() => { if (a.clave === 'q') setQ(''); set({ [a.clave]: '' }) }} className="inline-flex animate-fade-in items-center gap-1.5 rounded-full bg-rs-raised px-2.5 py-1 text-rs-text transition hover:bg-rs-control">
            {a.texto}<X size={11} className="text-rs-muted" />
          </button>
        ))}
        {hayCambios && <button onClick={() => { setQ(''); router.push('/reservas') }} className="ml-auto text-rs-lime transition hover:underline">Restablecer filtros</button>}
      </div>
    </div>
  )
}
