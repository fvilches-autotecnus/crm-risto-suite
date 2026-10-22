'use client'

import { useEffect, useId, useRef, useState } from 'react'
import { Table2, BarChart3 } from 'lucide-react'

// Gráficos SVG propios (sin librerías). Reglas: una sola escala, marcas finas (líneas de 2px, barras de hasta 24px con
// extremo redondeado de 4px y base recta), grilla de 1px recesiva, texto en tokens de texto (nunca con el color de la serie),
// tooltip al pasar el mouse / enfocar con teclado, y una vista de tabla con los mismos datos.
const SUPERFICIE = '#131d03'
const LIMA = '#c8e62b'
const GRILLA = '#1f2d03'
const TEXTO_SUAVE = '#7a9050'
const TEXTO = '#f0f4e8'

function useAncho<T extends HTMLElement>(inicial = 560) {
  const ref = useRef<T>(null)
  const [ancho, setAncho] = useState(inicial)
  useEffect(() => {
    const el = ref.current
    if (!el) return
    const ro = new ResizeObserver(([e]) => setAncho(Math.max(240, Math.floor(e.contentRect.width))))
    ro.observe(el)
    setAncho(Math.max(240, Math.floor(el.getBoundingClientRect().width)))
    return () => ro.disconnect()
  }, [])
  return [ref, ancho] as const
}

/** Máximo "redondo" para el eje Y: 1/2/5 x 10^n con ~4 divisiones. */
function ejeY(max: number) {
  if (max <= 0) return { tope: 4, marcas: [0, 1, 2, 3, 4] }
  const paso0 = max / 4
  const mag = Math.pow(10, Math.floor(Math.log10(paso0)))
  const paso = [1, 2, 5, 10].map((m) => m * mag).find((p) => p >= paso0) ?? 10 * mag
  const marcas: number[] = []
  for (let v = 0; v <= max + paso - 0.0001; v += paso) marcas.push(Math.round(v * 100) / 100)
  return { tope: marcas[marcas.length - 1], marcas }
}
const compacto = (n: number) => (n >= 1000 ? `${Math.round(n / 100) / 10}K` : String(n))

/** Rectángulo con el extremo superior redondeado (4px) y la base recta. */
function columna(x: number, y: number, w: number, h: number, r = 4) {
  const rr = Math.min(r, w / 2, h)
  return `M${x},${y + h} L${x},${y + rr} Q${x},${y} ${x + rr},${y} L${x + w - rr},${y} Q${x + w},${y} ${x + w},${y + rr} L${x + w},${y + h} Z`
}

// ---------------------------------------------------------------------------
// Tarjeta con vista de gráfico / tabla
// ---------------------------------------------------------------------------
export function TarjetaGrafico({ titulo, children, columnas, filas, vacio, i = 0, ancho = false }: { titulo: string; children: React.ReactNode; columnas: string[]; filas: (string | number)[][]; vacio?: boolean; i?: number; ancho?: boolean }) {
  const [tabla, setTabla] = useState(false)
  return (
    <section className={'reveal card min-w-0 p-5 ' + (ancho ? 'lg:col-span-2' : '')} style={{ ['--i' as string]: i }}>
      <div className="mb-4 flex items-start justify-between gap-3">
        <h2 className="card-title">{titulo}</h2>
        {!vacio && (
          <button onClick={() => setTabla((v) => !v)} className="btn btn-sm shrink-0" aria-pressed={tabla}>
            {tabla ? <BarChart3 size={13} /> : <Table2 size={13} />}{tabla ? 'Gráfico' : 'Tabla'}
          </button>
        )}
      </div>
      {vacio ? <p className="py-10 text-center text-sm text-rs-muted">No hay datos en este período.</p> : tabla ? (
        <div className="max-h-[260px] overflow-auto animate-fade-in">
          <table className="w-full text-sm">
            <caption className="sr-only">{titulo}</caption>
            <thead><tr>{columnas.map((c) => <th key={c} scope="col" className="th">{c}</th>)}</tr></thead>
            <tbody>{filas.map((f, k) => <tr key={k} className="border-t border-rs-border/60">{f.map((v, j) => <td key={j} className={'td ' + (j === 0 ? 'text-rs-muted' : 'tabular-nums')}>{v}</td>)}</tr>)}</tbody>
          </table>
        </div>
      ) : children}
    </section>
  )
}

function Tooltip({ x, y, ancho, titulo, valor }: { x: number; y: number; ancho: number; titulo: string; valor: string }) {
  const izquierda = x > ancho * 0.65
  return (
    <div role="tooltip" className="pointer-events-none absolute z-10 -translate-y-full whitespace-nowrap rounded-rs border border-rs-control bg-rs-header/95 px-2.5 py-1.5 text-xs shadow-lg shadow-black/50 backdrop-blur" style={{ left: izquierda ? undefined : x + 10, right: izquierda ? ancho - x + 10 : undefined, top: Math.max(y - 6, 36) }}>
      <div className="flex items-center gap-2"><span className="h-0.5 w-3 rounded" style={{ background: LIMA }} /><span className="text-sm font-semibold" style={{ color: TEXTO }}>{valor}</span></div>
      <div style={{ color: TEXTO_SUAVE }}>{titulo}</div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Línea (evolución en el tiempo): curva suave, área degradada, tendencia opcional
// ---------------------------------------------------------------------------
export interface PuntoLinea { x: string; valor: number; etiqueta: string; titulo: string }

/** Interpolación cúbica monótona (Fritsch-Carlson): suaviza sin inventar picos ni valores negativos. */
function curva(pts: { x: number; y: number }[]): string {
  const n = pts.length
  if (n === 0) return ''
  if (n === 1) return `M${pts[0].x},${pts[0].y}`
  const dx = pts.slice(1).map((p, i) => p.x - pts[i].x)
  const m = pts.slice(1).map((p, i) => (p.y - pts[i].y) / dx[i])
  const t = new Array(n).fill(0)
  t[0] = m[0]; t[n - 1] = m[n - 2]
  for (let i = 1; i < n - 1; i++) t[i] = m[i - 1] * m[i] <= 0 ? 0 : (m[i - 1] + m[i]) / 2
  for (let i = 0; i < n - 1; i++) {
    if (m[i] === 0) { t[i] = 0; t[i + 1] = 0; continue }
    const a = t[i] / m[i], b = t[i + 1] / m[i], h = Math.hypot(a, b)
    if (h > 3) { t[i] = (3 * a * m[i]) / h; t[i + 1] = (3 * b * m[i]) / h }
  }
  let d = `M${pts[0].x.toFixed(1)},${pts[0].y.toFixed(1)}`
  for (let i = 0; i < n - 1; i++) {
    const c1x = pts[i].x + dx[i] / 3, c1y = pts[i].y + (t[i] * dx[i]) / 3
    const c2x = pts[i + 1].x - dx[i] / 3, c2y = pts[i + 1].y - (t[i + 1] * dx[i]) / 3
    d += ` C${c1x.toFixed(1)},${c1y.toFixed(1)} ${c2x.toFixed(1)},${c2y.toFixed(1)} ${pts[i + 1].x.toFixed(1)},${pts[i + 1].y.toFixed(1)}`
  }
  return d
}

export function GraficoLinea({ puntos, unidad = 'reservas', tendencia = false }: { puntos: PuntoLinea[]; unidad?: string; tendencia?: boolean }) {
  const [ref, W] = useAncho<HTMLDivElement>()
  const [hover, setHover] = useState<number | null>(null)
  const idGrad = useId().replace(/:/g, '')
  const H = 240, m = { l: 36, r: 16, t: 16, b: 28 }
  const n = puntos.length
  const max = Math.max(...puntos.map((p) => p.valor), 0)
  const { tope, marcas } = ejeY(max)
  const iw = W - m.l - m.r, ih = H - m.t - m.b
  const px = (i: number) => m.l + (n <= 1 ? iw / 2 : (i / (n - 1)) * iw)
  const py = (v: number) => m.t + ih - (v / tope) * ih
  const xy = puntos.map((p, i) => ({ x: px(i), y: py(p.valor) }))
  const trazo = curva(xy)
  const area = n > 1 ? `${trazo} L${px(n - 1).toFixed(1)},${m.t + ih} L${px(0).toFixed(1)},${m.t + ih} Z` : ''

  // Tendencia: recta de mínimos cuadrados sobre los puntos del período
  let recta: { y0: number; y1: number } | null = null
  if (tendencia && n >= 3) {
    const sx = n * (n - 1) / 2, sxx = (n - 1) * n * (2 * n - 1) / 6, sy = puntos.reduce((s, p) => s + p.valor, 0), sxy = puntos.reduce((s, p, i) => s + i * p.valor, 0)
    const den = n * sxx - sx * sx
    if (den !== 0) { const b1 = (n * sxy - sx * sy) / den, b0 = (sy - b1 * sx) / n; recta = { y0: Math.max(0, b0), y1: Math.max(0, b0 + b1 * (n - 1)) } }
  }

  const pasoX = Math.max(1, Math.ceil(n / Math.max(2, Math.floor(iw / 64))))
  const marcadores = n <= 16
  const act = hover ?? n - 1

  const buscar = (clientX: number, el: SVGElement) => {
    const r = el.getBoundingClientRect()
    const rel = ((clientX - r.left) / r.width) * W
    return Math.min(n - 1, Math.max(0, Math.round(((rel - m.l) / iw) * (n - 1))))
  }

  return (
    <div ref={ref} className="relative w-full min-w-0 overflow-hidden" onPointerLeave={() => setHover(null)}>
      <svg width={W} height={H} role="img" aria-label={`Evolución: ${puntos.reduce((s, p) => s + p.valor, 0)} ${unidad} en ${n} puntos`} tabIndex={0}
        onKeyDown={(e) => { if (e.key === 'ArrowRight') setHover(Math.min(n - 1, (hover ?? -1) + 1)); if (e.key === 'ArrowLeft') setHover(Math.max(0, (hover ?? n) - 1)) }}
        onBlur={() => setHover(null)} className="block overflow-visible outline-none focus-visible:ring-2 focus-visible:ring-rs-lime/40">
        <defs>
          <linearGradient id={idGrad} x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor={LIMA} stopOpacity={0.28} /><stop offset="100%" stopColor={LIMA} stopOpacity={0} /></linearGradient>
        </defs>
        {marcas.map((v) => (
          <g key={v}>
            <line x1={m.l} x2={W - m.r} y1={py(v)} y2={py(v)} stroke={GRILLA} strokeWidth={1} />
            <text x={m.l - 8} y={py(v) + 4} textAnchor="end" fontSize={11} fill={TEXTO_SUAVE}>{compacto(v)}</text>
          </g>
        ))}
        {puntos.map((p, i) => i % pasoX === 0 || i === n - 1 ? <text key={p.x} x={px(i)} y={H - 8} textAnchor={i === 0 ? 'start' : i === n - 1 ? 'end' : 'middle'} fontSize={11} fill={TEXTO_SUAVE}>{p.etiqueta}</text> : null)}
        {area && <path d={area} fill={`url(#${idGrad})`} />}
        {recta && <line x1={px(0)} x2={px(n - 1)} y1={py(recta.y0)} y2={py(recta.y1)} stroke={TEXTO} strokeOpacity={0.45} strokeWidth={1.5} strokeLinecap="round" />}
        <path d={trazo} fill="none" stroke={LIMA} strokeWidth={2} strokeLinejoin="round" strokeLinecap="round" pathLength={1} className="draw" />
        {marcadores && puntos.map((p, i) => <circle key={p.x} cx={px(i)} cy={py(p.valor)} r={4} fill={LIMA} stroke={SUPERFICIE} strokeWidth={2} opacity={hover === null || hover === i ? 1 : 0.55} />)}
        {hover !== null && <line x1={px(hover)} x2={px(hover)} y1={m.t} y2={m.t + ih} stroke={TEXTO_SUAVE} strokeWidth={1} />}
        <circle cx={px(act)} cy={py(puntos[act]?.valor ?? 0)} r={5} fill={LIMA} stroke={SUPERFICIE} strokeWidth={2} />
        <rect x={m.l} y={0} width={iw} height={H} fill="transparent" onPointerMove={(e) => setHover(buscar(e.clientX, e.currentTarget))} />
      </svg>
      {(tendencia || true) && (
        <div className="mt-2 flex items-center gap-4 text-xs text-rs-muted">
          <span className="inline-flex items-center gap-2"><span className="h-0.5 w-4 rounded" style={{ background: LIMA }} />{unidad[0].toUpperCase() + unidad.slice(1)}</span>
          {recta && <span className="inline-flex items-center gap-2"><span className="h-0.5 w-4 rounded" style={{ background: TEXTO, opacity: 0.45 }} />Tendencia</span>}
        </div>
      )}
      {hover !== null && <Tooltip x={px(hover)} y={py(puntos[hover].valor)} ancho={W} titulo={puntos[hover].titulo} valor={`${puntos[hover].valor} ${unidad}`} />}
    </div>
  )
}

// ---------------------------------------------------------------------------
// Columnas (comparar categorías: día de la semana)
// ---------------------------------------------------------------------------
export function GraficoColumnas({ datos, unidad = 'reservas' }: { datos: { etiqueta: string; valor: number }[]; unidad?: string }) {
  const [ref, W] = useAncho<HTMLDivElement>()
  const [hover, setHover] = useState<number | null>(null)
  const H = 220, m = { l: 34, r: 10, t: 22, b: 26 }
  const max = Math.max(...datos.map((d) => d.valor), 0)
  const { tope, marcas } = ejeY(max)
  const iw = W - m.l - m.r, ih = H - m.t - m.b
  const banda = iw / datos.length, ancho = Math.min(24, banda * 0.62)
  const top = datos.findIndex((d) => d.valor === max)
  return (
    <div ref={ref} className="relative w-full min-w-0 overflow-hidden" onPointerLeave={() => setHover(null)}>
      <svg width={W} height={H} role="img" aria-label="Reservas por día de la semana" className="block overflow-visible">
        {marcas.map((v) => (
          <g key={v}>
            <line x1={m.l} x2={W - m.r} y1={m.t + ih - (v / tope) * ih} y2={m.t + ih - (v / tope) * ih} stroke={GRILLA} strokeWidth={1} />
            <text x={m.l - 8} y={m.t + ih - (v / tope) * ih + 4} textAnchor="end" fontSize={11} fill={TEXTO_SUAVE}>{compacto(v)}</text>
          </g>
        ))}
        {datos.map((d, i) => {
          const h = (d.valor / tope) * ih, x = m.l + banda * i + (banda - ancho) / 2, y = m.t + ih - h
          return (
            <g key={d.etiqueta} tabIndex={0} onFocus={() => setHover(i)} onBlur={() => setHover(null)} onPointerEnter={() => setHover(i)} className="outline-none">
              <rect x={m.l + banda * i} y={m.t} width={banda} height={ih + 8} fill="transparent" />
              {d.valor > 0 && <path d={columna(x, y, ancho, h)} fill={LIMA} opacity={hover === i ? 1 : i === top ? 0.95 : 0.45} className="grow-y transition-opacity" style={{ animationDelay: `${i * 50}ms` }} />}
              {i === top && d.valor > 0 && <text x={x + ancho / 2} y={y - 6} textAnchor="middle" fontSize={11} fontWeight={600} fill={TEXTO}>{d.valor}</text>}
              <text x={m.l + banda * i + banda / 2} y={H - 6} textAnchor="middle" fontSize={11} fill={TEXTO_SUAVE}>{d.etiqueta}</text>
            </g>
          )
        })}
      </svg>
      {hover !== null && <Tooltip x={m.l + banda * hover + banda / 2} y={m.t + ih - (datos[hover].valor / tope) * ih} ancho={W} titulo={datos[hover].etiqueta} valor={`${datos[hover].valor} ${unidad}`} />}
    </div>
  )
}

// ---------------------------------------------------------------------------
// Barras horizontales (ranking: horarios, sedes)
// ---------------------------------------------------------------------------
export function BarrasHorizontales({ datos, unidad = 'reservas' }: { datos: { etiqueta: string; valor: number }[]; unidad?: string }) {
  const max = Math.max(...datos.map((d) => d.valor), 1)
  return (
    <ul className="space-y-2.5">
      {datos.map((d, i) => (
        <li key={d.etiqueta} className="group grid grid-cols-[4.5rem_1fr_2.5rem] items-center gap-3 text-sm" title={`${d.etiqueta}: ${d.valor} ${unidad}`}>
          <span className="truncate text-rs-muted tabular-nums">{d.etiqueta}</span>
          <span className="h-2.5 overflow-hidden rounded-full bg-rs-raised">
            <span className="grow-x block h-full rounded-full transition-opacity group-hover:opacity-100" style={{ width: `${(d.valor / max) * 100}%`, background: LIMA, opacity: i === 0 ? 1 : 0.55, animationDelay: `${i * 60}ms` }} />
          </span>
          <span className="text-right font-semibold tabular-nums">{d.valor}</span>
        </li>
      ))}
    </ul>
  )
}

// ---------------------------------------------------------------------------
// Barra apilada con leyenda (composición por estado)
// ---------------------------------------------------------------------------
export function BarraApilada({ datos }: { datos: { etiqueta: string; valor: number; color: string }[] }) {
  const total = datos.reduce((s, d) => s + d.valor, 0) || 1
  return (
    <div>
      <div className="flex h-4 w-full gap-[2px] overflow-hidden rounded-full" role="img" aria-label={datos.map((d) => `${d.etiqueta}: ${d.valor}`).join(', ')}>
        {datos.filter((d) => d.valor > 0).map((d, i) => <span key={d.etiqueta} className="grow-x block h-full first:rounded-l-full last:rounded-r-full" style={{ width: `${(d.valor / total) * 100}%`, background: d.color, animationDelay: `${i * 80}ms` }} title={`${d.etiqueta}: ${d.valor}`} />)}
      </div>
      <ul className="mt-4 space-y-2">
        {datos.map((d) => (
          <li key={d.etiqueta} className="flex items-center justify-between gap-3 text-sm">
            <span className="inline-flex items-center gap-2"><span className="h-2.5 w-2.5 rounded-full" style={{ background: d.color }} />{d.etiqueta}</span>
            <span className="tabular-nums"><span className="font-semibold">{d.valor}</span> <span className="text-rs-muted">· {Math.round((d.valor / total) * 100)}%</span></span>
          </li>
        ))}
      </ul>
    </div>
  )
}
