'use client'

import { Barra, Contador } from '@/components/ui'

export function Tile({ valor, etiqueta, sub, color, subColor, i = 0 }: { valor: number; etiqueta: string; sub: string; color: string; subColor?: string; i?: number }) {
  return (
    <div className="reveal card card-hover p-4 sm:p-5" style={{ ['--i' as string]: i }}>
      <div className={'text-2xl font-bold tabular-nums sm:text-3xl ' + color}><Contador valor={valor} /></div>
      <div className="card-title mt-3">{etiqueta}</div>
      <div className={'mt-1 text-xs ' + (subColor ?? 'text-rs-muted/80')}>{sub}</div>
    </div>
  )
}

export interface FilaAforo { etiqueta: string; usado: number; maximo: number }

/** Reglas de aforo del día con su ocupación: la barra cambia de color al acercarse al tope. */
export function AforoLista({ filas }: { filas: FilaAforo[] }) {
  return (
    <div className="reveal card p-5" style={{ ['--i' as string]: 4 }}>
      <span className="card-title">Aforo del día</span>
      <ul className="mt-4 space-y-4">
        {filas.map((f, i) => {
          const pct = Math.round((f.usado / f.maximo) * 100)
          const color = pct >= 100 ? 'bg-rs-danger' : pct >= 90 ? 'bg-rs-warn' : 'bg-rs-lime'
          return (
            <li key={i}>
              <div className="mb-1.5 flex items-center justify-between gap-3 text-sm">
                <span className="font-medium">{f.etiqueta}</span>
                <span className={'text-xs tabular-nums ' + (pct >= 100 ? 'text-rs-danger' : pct >= 90 ? 'text-rs-warn' : 'text-rs-muted')}>{f.usado} / {f.maximo} personas · {pct}%</span>
              </div>
              <Barra pct={pct} className={color} />
            </li>
          )
        })}
      </ul>
    </div>
  )
}
