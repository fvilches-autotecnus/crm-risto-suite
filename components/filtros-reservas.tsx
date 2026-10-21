'use client'

import { useRouter, useSearchParams } from 'next/navigation'
import { useEffect, useState } from 'react'
import { RefreshCw, Search } from 'lucide-react'
import { ESTADOS, TIPOS_RESERVA } from '@/lib/reservas'

// Los filtros viven en la URL (?estado=&rango=&tipo=&q=&desde=&hasta=): la página es un Server Component.
export default function FiltrosReservas() {
  const router = useRouter()
  const sp = useSearchParams()
  const [q, setQ] = useState(sp.get('q') ?? '')
  const [rangoManual, setRangoManual] = useState(sp.get('rango') === 'rango')

  const set = (cambios: Record<string, string>) => {
    const p = new URLSearchParams(window.location.search) // no `sp`: puede estar atrasado si hay una navegación en curso
    for (const [k, v] of Object.entries(cambios)) v ? p.set(k, v) : p.delete(k)
    router.push('/reservas?' + p.toString())
  }

  useEffect(() => {
    const t = setTimeout(() => (sp.get('q') ?? '') !== q.trim() && set({ q: q.trim() }), 350)
    return () => clearTimeout(t)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [q])

  return (
    <div className="flex flex-wrap items-center gap-2">
      <div className="relative min-w-[220px] flex-1">
        <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-rs-muted" />
        <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Buscar nombre o teléfono" className="input w-full pl-9" />
      </div>
      <select aria-label="Estado" value={sp.get('estado') ?? ''} onChange={(e) => set({ estado: e.target.value })} className="input">
        <option value="">Todos los estados</option>
        <option value="sin_confirmar">No confirmadas</option>
        {ESTADOS.map((e) => <option key={e.value} value={e.value}>{e.label}</option>)}
      </select>
      <select
        aria-label="Fecha"
        value={rangoManual ? 'rango' : sp.get('rango') ?? 'hoy'}
        onChange={(e) => { setRangoManual(e.target.value === 'rango'); set({ rango: e.target.value, desde: '', hasta: '' }) }}
        className="input"
      >
        <option value="hoy">Hoy</option>
        <option value="manana">Mañana</option>
        <option value="7d">Próximos 7 días</option>
        <option value="futuras">Todas las fechas futuras</option>
        <option value="todas">Todas las fechas</option>
        <option value="rango">Filtrar por rango</option>
      </select>
      {rangoManual && (
        <>
          <input type="date" aria-label="Desde" value={sp.get('desde') ?? ''} onChange={(e) => set({ desde: e.target.value })} className="input" />
          <input type="date" aria-label="Hasta" value={sp.get('hasta') ?? ''} onChange={(e) => set({ hasta: e.target.value })} className="input" />
        </>
      )}
      <select aria-label="Tipo" value={sp.get('tipo') ?? ''} onChange={(e) => set({ tipo: e.target.value })} className="input">
        <option value="">Todos los tipos</option>
        {TIPOS_RESERVA.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
      </select>
      <button onClick={() => { setQ(''); setRangoManual(false); router.push('/reservas') }} className="btn">Limpiar</button>
      <button onClick={() => router.refresh()} aria-label="Actualizar" className="btn w-9 px-0"><RefreshCw size={14} /></button>
    </div>
  )
}
