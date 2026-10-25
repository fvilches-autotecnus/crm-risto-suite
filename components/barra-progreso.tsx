'use client'

import { useEffect, useRef, useState } from 'react'
import { usePathname, useSearchParams } from 'next/navigation'

const DEMORA_MS = 120      // si la pantalla responde antes, no se muestra nada (evita el parpadeo)
const MAX_MS = 15000       // por seguridad: si nunca avisa que terminó, se apaga sola

/**
 * Indicador de carga global: una barra lima arriba de todo + la pantalla se atenúa mientras se carga la siguiente.
 * Se activa solo al tocar un link interno, al cambiar un filtro/selector (ver lib/carga.ts) o al usar atrás/adelante,
 * y se apaga cuando cambia la dirección (o cuando algo llama a terminarCarga()).
 */
export default function BarraProgreso() {
  const pathname = usePathname()
  const sp = useSearchParams()
  const clave = pathname + '?' + sp.toString()
  const [visible, setVisible] = useState(false)
  const [pct, setPct] = useState(0)
  const activa = useRef(false)
  const timers = useRef<{ demora?: ReturnType<typeof setTimeout>; paso?: ReturnType<typeof setInterval>; tope?: ReturnType<typeof setTimeout>; cierre?: ReturnType<typeof setTimeout> }>({})

  const limpiar = () => { const t = timers.current; clearTimeout(t.demora); clearInterval(t.paso); clearTimeout(t.tope); clearTimeout(t.cierre) }
  const marcar = (on: boolean) => { if (on) document.documentElement.setAttribute('data-navegando', '1'); else document.documentElement.removeAttribute('data-navegando') }

  const terminar = useRef(() => {})
  terminar.current = () => {
    if (!activa.current) return
    activa.current = false
    limpiar(); marcar(false)
    setPct(100)
    timers.current.cierre = setTimeout(() => { setVisible(false); setPct(0) }, 260)
  }

  const iniciar = useRef(() => {})
  iniciar.current = () => {
    if (activa.current) return
    activa.current = true
    limpiar()
    timers.current.demora = setTimeout(() => {
      if (!activa.current) return
      setPct(8); setVisible(true); marcar(true)
      timers.current.paso = setInterval(() => setPct((p) => p + (90 - p) * 0.1), 200)
    }, DEMORA_MS)
    timers.current.tope = setTimeout(() => terminar.current(), MAX_MS)
  }

  // La dirección cambió: la pantalla nueva ya está lista.
  useEffect(() => { terminar.current() }, [clave])

  useEffect(() => {
    const alClick = (e: MouseEvent) => {
      if (e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return
      const a = (e.target as Element | null)?.closest?.('a[href]') as HTMLAnchorElement | null
      if (!a || (a.target && a.target !== '_self') || a.hasAttribute('download')) return
      const url = new URL(a.href, window.location.href)
      if (url.origin !== window.location.origin) return
      if (url.pathname === window.location.pathname && url.search === window.location.search) return   // mismo lugar o solo #ancla
      iniciar.current()
    }
    const alEnviar = (e: Event) => { const f = e.target as HTMLFormElement; if (f?.method?.toLowerCase() === 'get') iniciar.current() }
    const ini = () => iniciar.current(), fin = () => terminar.current()
    document.addEventListener('click', alClick)
    document.addEventListener('submit', alEnviar)
    window.addEventListener('popstate', ini)
    window.addEventListener('rs:carga-inicio', ini)
    window.addEventListener('rs:carga-fin', fin)
    return () => {
      document.removeEventListener('click', alClick); document.removeEventListener('submit', alEnviar)
      window.removeEventListener('popstate', ini); window.removeEventListener('rs:carga-inicio', ini); window.removeEventListener('rs:carga-fin', fin)
      limpiar(); marcar(false)
    }
  }, [])

  return (
    <>
      <div aria-hidden className={'pointer-events-none fixed inset-x-0 top-0 z-[70] h-[3px] transition-opacity duration-200 ' + (visible ? 'opacity-100' : 'opacity-0')}>
        <div className="h-full origin-left bg-rs-lime shadow-[0_0_10px_rgba(200,230,43,.8)] transition-transform duration-200 ease-out" style={{ transform: `scaleX(${pct / 100})` }} />
      </div>
      <div role="status" aria-live="polite" className="sr-only">{visible ? 'Cargando…' : ''}</div>
    </>
  )
}
