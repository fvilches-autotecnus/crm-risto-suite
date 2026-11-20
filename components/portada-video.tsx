'use client'

import { useEffect, useRef, useState } from 'react'

/**
 * Video de portada del sitio de reservas: va detrás del logo, en el encabezado, sin sonido y en bucle.
 * Si hay varios, se pasan uno tras otro.
 * Arranca solo siempre que el navegador lo permita (es un video mudo, así que Chrome lo deja). Si el navegador lo frena igual (ahorro de batería,
 * "menos movimiento" del sistema, pestaña en segundo plano…) se reintenta cada tanto, al volver a la pestaña y con el primer gesto de la persona
 * (toque, clic, scroll, tecla), hasta que arranque.
 * Encima lleva una capa del color del encabezado para que el logo y los textos se lean siempre.
 * En pantallas anchas el video ocupa solo el ancho de la columna del formulario (un video vertical estirado a todo el ancho se vería recortado y borroso).
 */
export default function PortadaVideo({ videos, poster }: { videos: string[]; poster: string | null }) {
  const [listo, setListo] = useState(false)      // el <video> se crea recién en el navegador: así nace "muted" y el autoplay no se bloquea
  const [i, setI] = useState(0)
  const ref = useRef<HTMLVideoElement>(null)

  useEffect(() => { setListo(true) }, [])

  useEffect(() => {
    const v = ref.current
    if (!v) return
    const gestos = ['pointerdown', 'touchstart', 'click', 'keydown', 'wheel', 'scroll'] as const
    let intentos = 0
    const reloj = { id: 0 as unknown as ReturnType<typeof setInterval> }

    const arrancar = () => {
      v.muted = true            // sin sonido: es lo que permite el autoplay
      v.defaultMuted = true
      v.playsInline = true
      if (v.paused) v.play().catch(() => { /* el navegador no dejó todavía: se reintenta */ })
    }
    const alVolver = () => { if (document.visibilityState === 'visible') arrancar() }
    const limpiar = () => {
      clearInterval(reloj.id)
      gestos.forEach((g) => window.removeEventListener(g, arrancar))
      document.removeEventListener('visibilitychange', alVolver)
      window.removeEventListener('pageshow', arrancar)
    }

    v.addEventListener('playing', limpiar, { once: true })   // ya está andando: no hace falta seguir intentando
    v.addEventListener('loadeddata', arrancar)
    v.addEventListener('canplay', arrancar)
    gestos.forEach((g) => window.addEventListener(g, arrancar, { passive: true }))
    document.addEventListener('visibilitychange', alVolver)
    window.addEventListener('pageshow', arrancar)
    reloj.id = setInterval(() => { if (++intentos > 20) clearInterval(reloj.id); else arrancar() }, 1500)   // reintento cada 1,5 s (unos 30 s)
    arrancar()

    return () => { limpiar(); v.removeEventListener('loadeddata', arrancar); v.removeEventListener('canplay', arrancar); v.removeEventListener('playing', limpiar) }
  }, [listo, i])

  const solo = videos.length === 1
  return (
    <div aria-hidden className="pointer-events-none absolute inset-y-0 left-1/2 -z-10 w-full max-w-2xl -translate-x-1/2 overflow-hidden">
      {listo && (
        <video
          ref={ref} key={videos[i]} src={videos[i]} poster={poster ?? undefined}
          autoPlay muted loop={solo} playsInline preload="auto" disablePictureInPicture disableRemotePlayback
          onEnded={() => setI((n) => (n + 1) % videos.length)}
          className="h-full w-full object-cover"
        />
      )}
      {!listo && poster && (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={poster} alt="" className="h-full w-full object-cover" />
      )}
      <div className="absolute inset-0 bg-gradient-to-b from-rs-header/40 via-rs-header/45 to-rs-header/90" />
    </div>
  )
}
