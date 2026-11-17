'use client'

import FiltroPeriodo from '@/components/filtro-periodo'
import { DIAS_PERIODO } from '@/lib/campanas'

/** Selector de período para pantallas con filtro por URL: los últimos N días (?dias=) o un rango de fechas (?desde=&hasta=). */
export default function SelectorDias({ ruta, dias, desde, hasta, hoy, extra = {} }: { ruta: string; dias: number; desde?: string; hasta?: string; hoy: string; extra?: Record<string, string> }) {
  return (
    <label className="flex flex-wrap items-center gap-2 text-xs font-semibold uppercase tracking-[0.05em] text-rs-muted">
      Período:
      <FiltroPeriodo ruta={ruta} param="dias" variante="select" opciones={DIAS_PERIODO.map((d) => ({ v: String(d), l: `Últimos ${d} días` }))} actual={String(dias)} desde={desde} hasta={hasta} hoy={hoy} extra={extra} />
    </label>
  )
}
