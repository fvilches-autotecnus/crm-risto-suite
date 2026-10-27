import type { CSSProperties, ReactNode } from 'react'

// Sillas alrededor de las mesas del plano. Una silla por lugar (capacidad máxima), repartidas por los lados de la mesa
// (o en círculo si es redonda). El tema (redondas / cuadradas / con respaldo / ninguna) y el color son del salón; la rotación,
// si lleva sillas y de qué lados son de cada mesa. Se dibuja con CSS, sin imágenes.

export type TemaSillas = 'redondas' | 'cuadradas' | 'respaldo' | 'ninguna'
export const TEMAS_SILLAS: { value: TemaSillas; label: string }[] = [
  { value: 'redondas', label: 'Redondas' }, { value: 'cuadradas', label: 'Cuadradas' }, { value: 'respaldo', label: 'Con respaldo' }, { value: 'ninguna', label: 'Sin sillas' },
]
export const LADOS_SILLAS = [{ v: 'n', l: 'Arriba' }, { v: 'e', l: 'Derecha' }, { v: 's', l: 'Abajo' }, { v: 'o', l: 'Izquierda' }]
export const COLOR_SILLAS_DEFECTO = '#9aa7b8'

export interface DatosSillas { capacidad: number | null; forma: 'cuadrada' | 'redonda'; w: number; h: number; sillas?: boolean | null; sillas_lados?: string[] | null; rotacion?: number | null }
export interface TemaPlano { tema_sillas?: string | null; color_sillas?: string | null }

const TAM = 0.8    // lado de la silla, en "em" (el plano fija 1 em ≈ medio casillero)
const SEP = 0.12   // separación entre la silla y la mesa

interface Silla { left: string; top: string; giro: number }

const rgba = (hex: string, a: number) => {
  const m = /^#([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})$/i.exec(hex)
  return m ? `rgba(${parseInt(m[1], 16)}, ${parseInt(m[2], 16)}, ${parseInt(m[3], 16)}, ${a})` : hex
}

/** Dónde va cada silla, relativo a la caja de la mesa (porcentajes + em). Pura: la usan el plano, el sitio y las pruebas. */
export function sillasDe(m: DatosSillas): Silla[] {
  const n = Math.max(0, Math.min(40, m.capacidad ?? 0))
  if (!n || m.sillas === false) return []
  const r = TAM / 2 + SEP
  if (m.forma === 'redonda') {
    return Array.from({ length: n }, (_, i) => {
      const a = (2 * Math.PI * i) / n - Math.PI / 2   // arranca arriba y sigue en sentido horario
      const c = Math.cos(a), s = Math.sin(a)
      return { left: `calc(${(50 + 50 * c).toFixed(2)}% + ${(c * r - TAM / 2).toFixed(3)}em)`, top: `calc(${(50 + 50 * s).toFixed(2)}% + ${(s * r - TAM / 2).toFixed(3)}em)`, giro: (a * 180) / Math.PI + 90 }
    })
  }
  const elegidos = m.sillas_lados && m.sillas_lados.length > 0 ? m.sillas_lados : ['n', 'e', 's', 'o']
  const orden = (['n', 's', 'e', 'o'] as const).filter((l) => elegidos.includes(l))
  const largo = { n: m.w, s: m.w, e: m.h, o: m.h }
  const total = orden.reduce((s, l) => s + largo[l], 0)
  // reparto proporcional al largo de cada lado (resto mayor primero; a igualdad, lados opuestos antes)
  const exacto = orden.map((l) => (n * largo[l]) / total)
  const cuota = exacto.map(Math.floor)
  let faltan = n - cuota.reduce((s, c) => s + c, 0)
  const porResto = orden.map((_, i) => i).sort((a, b) => exacto[b] - Math.floor(exacto[b]) - (exacto[a] - Math.floor(exacto[a])) || a - b)
  for (const i of porResto) { if (faltan <= 0) break; cuota[i]++; faltan-- }
  const res: Silla[] = []
  orden.forEach((l, k) => {
    for (let i = 0; i < cuota[k]; i++) {
      const t = (((i + 0.5) / cuota[k]) * 100).toFixed(2)
      if (l === 'n') res.push({ left: `calc(${t}% - ${TAM / 2}em)`, top: `${-(TAM + SEP)}em`, giro: 0 })
      else if (l === 's') res.push({ left: `calc(${t}% - ${TAM / 2}em)`, top: `calc(100% + ${SEP}em)`, giro: 180 })
      else if (l === 'o') res.push({ left: `${-(TAM + SEP)}em`, top: `calc(${t}% - ${TAM / 2}em)`, giro: 270 })
      else res.push({ left: `calc(100% + ${SEP}em)`, top: `calc(${t}% - ${TAM / 2}em)`, giro: 90 })
    }
  })
  return res
}

function estiloSilla(s: Silla, tema: string, color: string): CSSProperties {
  const base: CSSProperties = { position: 'absolute', width: `${TAM}em`, height: `${TAM}em`, left: s.left, top: s.top, transform: `rotate(${s.giro}deg)`, pointerEvents: 'none', background: rgba(color, 0.4), border: `1px solid ${rgba(color, 0.9)}` }
  if (tema === 'redondas') return { ...base, borderRadius: '50%' }
  if (tema === 'respaldo') return { ...base, borderRadius: '.18em', borderTop: `${(TAM * 0.28).toFixed(3)}em solid ${rgba(color, 0.95)}` }   // el respaldo mira hacia afuera de la mesa
  return { ...base, borderRadius: '.14em' }
}

/** Caja de una mesa del plano: la mesa (los hijos, normalmente un botón `absolute inset-0`) más sus sillas, girada según su rotación. */
export function CajaMesa({ mesa, tema, style, className = '', children }: { mesa: DatosSillas; tema: TemaPlano; style: CSSProperties; className?: string; children: ReactNode }) {
  const rot = mesa.rotacion ?? 0
  const t = tema.tema_sillas ?? 'redondas'
  const color = tema.color_sillas && /^#[0-9a-f]{6}$/i.test(tema.color_sillas) ? tema.color_sillas : COLOR_SILLAS_DEFECTO
  const sillas = t === 'ninguna' ? [] : sillasDe(mesa)
  return (
    <div className={'absolute ' + className} style={{ ...style, transform: rot ? `rotate(${rot}deg)` : undefined }}>
      {sillas.map((s, i) => <span key={i} aria-hidden="true" data-silla="" style={estiloSilla(s, t, color)} />)}
      {children}
    </div>
  )
}

/** Deshace la rotación de la mesa para que su texto se lea derecho. */
export function Derecho({ rot, children }: { rot?: number | null; children: ReactNode }) {
  return rot ? <span className="flex flex-col items-center justify-center" style={{ transform: `rotate(${-rot}deg)` }}>{children}</span> : <>{children}</>
}
