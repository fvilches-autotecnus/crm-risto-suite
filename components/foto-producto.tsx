'use client'

import { useEffect, useState } from 'react'
import { X } from 'lucide-react'

/** Foto de un producto: miniatura en la carta; al tocarla se ve en pantalla completa (se cierra tocando, con la X o con Escape). */
export default function FotoProducto({ src, alt }: { src: string; alt: string }) {
  const [abierta, setAbierta] = useState(false)
  useEffect(() => {
    if (!abierta) return
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setAbierta(false) }
    window.addEventListener('keydown', onKey)
    const previo = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => { window.removeEventListener('keydown', onKey); document.body.style.overflow = previo }
  }, [abierta])
  return (
    <>
      <button type="button" onClick={() => setAbierta(true)} aria-label={`Ver la foto de ${alt} en pantalla completa`} className="h-24 w-24 shrink-0 cursor-zoom-in self-start overflow-hidden rounded-md sm:h-28 sm:w-28">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={src} alt={alt} loading="lazy" className="h-full w-full object-cover" />
      </button>
      {abierta && (
        <div role="dialog" aria-modal="true" aria-label={`Foto de ${alt}`} onClick={() => setAbierta(false)} className="fixed inset-0 z-[70] flex animate-fade-in items-center justify-center bg-black/90 p-3 pt-[max(0.75rem,env(safe-area-inset-top))] pb-[max(0.75rem,env(safe-area-inset-bottom))]">
          <button type="button" onClick={() => setAbierta(false)} aria-label="Cerrar la foto" className="absolute right-3 top-[max(0.75rem,env(safe-area-inset-top))] grid h-11 w-11 place-items-center rounded-full bg-black/60 text-white backdrop-blur"><X size={22} /></button>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={src} alt={alt} className="max-h-full max-w-full rounded-md object-contain shadow-2xl" />
          <p className="pointer-events-none absolute inset-x-0 bottom-[max(0.75rem,env(safe-area-inset-bottom))] px-4 text-center text-sm font-medium text-white/90 [text-shadow:0_1px_4px_rgba(0,0,0,.8)]">{alt}</p>
        </div>
      )}
    </>
  )
}
