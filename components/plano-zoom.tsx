'use client'

import { useCallback, useLayoutEffect, useRef, useState } from 'react'
import { Maximize2, Minus, Plus } from 'lucide-react'

/** Píxeles por casillero con los que una mesa se lee y se toca cómodo en el celular. */
const CELDA_COMODA = 28
const RELLENO = 24   // p-3 a cada lado
/** Con casilleros así de grandes el plano ya se ve de sobra: no hacen falta los botones de zoom. */
const CELDA_SOBRADA = 40

/**
 * Marco del plano de mesas para pantallas chicas: arranca con las mesas a un tamaño que se toca bien (se desliza para recorrer),
 * se acerca y aleja con los botones + / − o pellizcando, y "Ver todo" lo ajusta al ancho de la pantalla.
 * Los hijos se ubican en porcentajes sobre un cuadro con la proporción del salón (y su tipografía se escala con el cuadro).
 */
export default function PlanoZoom({ ancho, alto, children }: { ancho: number; alto: number; children: React.ReactNode }) {
  const caja = useRef<HTMLDivElement>(null)
  const [disp, setDisp] = useState(0)   // ancho del marco en píxeles
  const [z, setZ] = useState(1)         // 1 = todo el ancho del salón entra en el marco
  const zRef = useRef(1); zRef.current = z
  const iniciado = useRef(false)
  const pellizco = useRef<{ dist: number; z: number } | null>(null)
  const foco = useRef<{ fx: number; fy: number; cx: number; cy: number } | null>(null)   // punto que debe quedar quieto al cambiar el zoom

  const util = Math.max(0, disp - RELLENO)
  const ajuste = util / ancho   // px por casillero con z = 1
  const zMax = ajuste > 0 ? Math.max(1, 90 / ajuste) : 1
  const puedeZoom = ajuste > 0 && ajuste < CELDA_SOBRADA

  // medir el marco (y volver a medir si cambia: girar el celular, abrir/cerrar la lista…)
  useLayoutEffect(() => {
    const el = caja.current; if (!el) return
    const medir = () => setDisp(el.clientWidth)
    medir()
    const ro = new ResizeObserver(medir); ro.observe(el)
    return () => ro.disconnect()
  }, [])
  // primera medición: las mesas arrancan a un tamaño cómodo (si el salón es chico, ya entra entero)
  useLayoutEffect(() => {
    if (iniciado.current || ajuste <= 0) return
    iniciado.current = true
    setZ(Math.max(1, Math.min(CELDA_COMODA / ajuste, 90 / ajuste)))
  }, [ajuste])
  // al cambiar el zoom, el punto de interés (centro del pellizco o de la pantalla) se queda donde estaba
  useLayoutEffect(() => {
    const f = foco.current, el = caja.current
    if (!f || !el) return
    foco.current = null
    const w = util * z, h = (w * alto) / ancho
    el.scrollLeft = f.fx * w + RELLENO / 2 - f.cx
    el.scrollTop = f.fy * h + RELLENO / 2 - f.cy
  }, [z, util, alto, ancho])

  const zoomA = useCallback((nuevo: number, cx: number, cy: number) => {
    const el = caja.current; if (!el || util <= 0) return
    const n = Math.min(zMax, Math.max(1, nuevo))
    if (Math.abs(n - zRef.current) < 0.001) return
    const w = util * zRef.current, h = (w * alto) / ancho
    foco.current = { fx: (el.scrollLeft + cx - RELLENO / 2) / w, fy: (el.scrollTop + cy - RELLENO / 2) / h, cx, cy }
    setZ(n)
  }, [util, zMax, alto, ancho])
  const desdeCentro = (factor: number) => { const el = caja.current; if (el) zoomA(zRef.current * factor, el.clientWidth / 2, el.clientHeight / 2) }

  const dist = (t: React.TouchList) => Math.hypot(t[0].clientX - t[1].clientX, t[0].clientY - t[1].clientY)
  const alTocar = (e: React.TouchEvent) => { pellizco.current = e.touches.length === 2 ? { dist: dist(e.touches), z: zRef.current } : null }
  const alMover = (e: React.TouchEvent) => {
    const p = pellizco.current, el = caja.current
    if (!p || !el || e.touches.length !== 2) return
    const r = el.getBoundingClientRect()
    zoomA(p.z * (dist(e.touches) / p.dist), (e.touches[0].clientX + e.touches[1].clientX) / 2 - r.left, (e.touches[0].clientY + e.touches[1].clientY) / 2 - r.top)
  }
  const alSoltar = (e: React.TouchEvent) => { if (e.touches.length < 2) pellizco.current = null }

  const ancho_px = util > 0 ? util * z : undefined
  return (
    <div>
      {puedeZoom && (
        <div className="mb-1.5 flex items-center justify-between gap-2 sm:hidden">
          <p className="text-xs text-rs-muted">Pellizcá o usá los botones para acercar; deslizá para moverte.</p>
          <div className="flex shrink-0 items-center gap-1" role="group" aria-label="Zoom del plano">
            <button type="button" onClick={() => desdeCentro(1 / 1.4)} disabled={z <= 1.001} aria-label="Alejar el plano" className="btn btn-sm h-8 w-8 px-0 disabled:opacity-40"><Minus size={14} /></button>
            <button type="button" onClick={() => desdeCentro(1.4)} disabled={z >= zMax - 0.001} aria-label="Acercar el plano" className="btn btn-sm h-8 w-8 px-0 disabled:opacity-40"><Plus size={14} /></button>
            <button type="button" onClick={() => { zoomA(1, 0, 0); caja.current?.scrollTo({ left: 0, top: 0 }) }} disabled={z <= 1.001} aria-label="Ver todo el plano" className="btn btn-sm h-8 gap-1 px-2 text-xs disabled:opacity-40"><Maximize2 size={13} /> Ver todo</button>
          </div>
        </div>
      )}
      <div ref={caja} onTouchStart={alTocar} onTouchMove={alMover} onTouchEnd={alSoltar} onTouchCancel={alSoltar}
        className="max-h-[70vh] overflow-auto overscroll-contain rounded-rs-lg border border-rs-border bg-rs-bg/60 p-3" style={{ touchAction: 'pan-x pan-y' }}>
        <div className="relative" style={{ aspectRatio: `${ancho} / ${alto}`, width: ancho_px ?? '100%', containerType: 'inline-size' }}>{children}</div>
      </div>
    </div>
  )
}
