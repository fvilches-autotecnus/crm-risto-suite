'use client'

import { useEffect, useRef, useState } from 'react'

/**
 * Video de portada del sitio de reservas: va detrás del logo, en el encabezado, sin sonido y en bucle.
 * Si hay varios, se pasan uno tras otro. Con "menos movimiento" o "ahorro de datos" no se reproduce: queda la imagen fija (o solo el color del local).
 * Encima lleva una capa del color del encabezado para que el logo y los textos se lean siempre.
 * En pantallas anchas el video ocupa solo el ancho de la columna del formulario (un video vertical estirado a todo el ancho se vería recortado y borroso).
 */
export default function PortadaVideo({ videos, poster }: { videos: string[]; poster: string | null }) {
  const [listo, setListo] = useState(false)      // el <video> se crea recién en el navegador: así nace "muted" y el autoplay no se bloquea
  const [quieto, setQuieto] = useState(false)
  const [i, setI] = useState(0)
  const ref = useRef<HTMLVideoElement>(null)

  useEffect(() => {
    try {
      const c = (navigator as Navigator & { connection?: { saveData?: boolean } }).connection
      if (window.matchMedia('(prefers-reduced-motion: reduce)').matches || c?.saveData) setQuieto(true)
    } catch { /* sin esa información: se reproduce */ }
    setListo(true)
  }, [])

  useEffect(() => {
    const v = ref.current
    if (!v) return
    v.muted = true
    v.play().catch(() => { /* el navegador no dejó reproducir (ahorro de batería…): queda la imagen fija */ })
  }, [listo, i, quieto])

  const solo = videos.length === 1
  return (
    <div aria-hidden className="pointer-events-none absolute inset-y-0 left-1/2 -z-10 w-full max-w-2xl -translate-x-1/2 overflow-hidden">
      {listo && !quieto && (
        <video
          ref={ref} key={videos[i]} src={videos[i]} poster={poster ?? undefined}
          autoPlay muted loop={solo} playsInline preload="auto" disablePictureInPicture disableRemotePlayback
          onEnded={() => setI((n) => (n + 1) % videos.length)}
          className="h-full w-full object-cover"
        />
      )}
      {(!listo || quieto) && poster && (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={poster} alt="" className="h-full w-full object-cover" />
      )}
      <div className="absolute inset-0 bg-gradient-to-b from-rs-header/40 via-rs-header/45 to-rs-header/90" />
    </div>
  )
}
