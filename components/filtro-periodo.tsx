'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { FechaInput } from '@/components/inputs'
import { iniciarCarga } from '@/lib/carga'

const sumarDias = (iso: string, d: number) => new Date(new Date(iso + 'T12:00:00Z').getTime() + d * 86400000).toISOString().slice(0, 10)

/**
 * Filtro de período de las pantallas con "días anteriores": las opciones de siempre más "Rango de fechas…" (desde / hasta).
 * Todo viaja en la dirección: el período de siempre en `param` (?dias=30 / ?periodo=7) o el rango en ?desde=&hasta= (el rango manda). `extra` son los
 * otros filtros de la pantalla, que se conservan al cambiar de período (la página vuelve a la primera).
 */
export default function FiltroPeriodo({ ruta, param, opciones, actual, desde, hasta, hoy, extra = {}, variante = 'chips', maxDias = 366 }: {
  ruta: string; param: string; opciones: { v: string; l: string }[]; actual: string; desde?: string; hasta?: string; hoy: string
  extra?: Record<string, string | undefined>; variante?: 'chips' | 'select'; maxDias?: number
}) {
  const router = useRouter()
  const enRango = !!(desde && hasta)
  const [abierto, setAbierto] = useState(enRango)   // ¿está elegido "Rango de fechas"? (aunque todavía no se haya aplicado)
  const [d1, setD1] = useState(desde ?? sumarDias(hoy, -29))
  const [d2, setD2] = useState(hasta ?? hoy)
  const [error, setError] = useState<string | null>(null)

  const ir = (cambios: Record<string, string>) => {
    const p = new URLSearchParams()
    for (const [k, v] of Object.entries({ ...extra, ...cambios })) if (v) p.set(k, v)
    iniciarCarga()
    router.push(`${ruta}?${p.toString()}`)
  }
  const aplicar = () => {
    if (!d1 || !d2) { setError('Elegí las dos fechas.'); return }
    if (d1 > d2) { setError('La fecha de inicio no puede ser posterior a la final.'); return }
    if (d2 > hoy) { setError('La fecha final no puede ser futura.'); return }
    if ((Date.parse(d2) - Date.parse(d1)) / 86400000 + 1 > maxDias) { setError(`El rango puede ser de hasta ${maxDias === 366 ? 'un año' : maxDias + ' días'}.`); return }
    setError(null); ir({ desde: d1, hasta: d2 })
  }
  const elegir = (v: string) => { setAbierto(false); setError(null); ir({ [param]: v }) }

  const rango = abierto && (
    <div className="flex flex-wrap items-end gap-2" role="group" aria-label="Rango de fechas">
      <div><label className="label" htmlFor={`fp_d_${ruta}`}>Desde</label><FechaInput id={`fp_d_${ruta}`} value={d1} max={hoy} onChange={(v) => { if (v) setD1(v) }} className="w-36" /></div>
      <div><label className="label" htmlFor={`fp_h_${ruta}`}>Hasta</label><FechaInput id={`fp_h_${ruta}`} value={d2} max={hoy} onChange={(v) => { if (v) setD2(v) }} className="w-36" /></div>
      <button type="button" onClick={aplicar} className="btn btn-primary btn-sm">Aplicar</button>
      {error && <p role="alert" className="basis-full text-xs text-rs-danger">{error}</p>}
    </div>
  )

  if (variante === 'select') {
    return (
      <div className="flex flex-wrap items-end gap-2">
        <select aria-label="Período" value={abierto || enRango ? 'rango' : actual} onChange={(e) => { if (e.target.value === 'rango') { setAbierto(true); return } elegir(e.target.value) }} className="input normal-case tracking-normal">
          {opciones.map((o) => <option key={o.v} value={o.v}>{o.l}</option>)}
          <option value="rango">Rango de fechas…</option>
        </select>
        {rango}
      </div>
    )
  }
  return (
    <div className="flex flex-wrap items-end gap-2">
      {opciones.map((o) => <button key={o.v} type="button" onClick={() => elegir(o.v)} aria-pressed={!abierto && !enRango && actual === o.v} className={'btn btn-sm ' + (!abierto && !enRango && actual === o.v ? 'btn-primary' : '')}>{o.l}</button>)}
      <button type="button" onClick={() => setAbierto(true)} aria-pressed={abierto || enRango} className={'btn btn-sm ' + (abierto || enRango ? 'btn-primary' : '')}>Rango de fechas…</button>
      {rango}
    </div>
  )
}
