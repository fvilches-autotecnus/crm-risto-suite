'use client'

import { useEffect, useState } from 'react'

// Índice de secciones de Configuración: salta a cada una con desplazamiento suave y marca la que se está viendo.
export default function ConfigIndex({ secciones }: { secciones: { id: string; label: string }[] }) {
  const [activa, setActiva] = useState(secciones[0]?.id)

  useEffect(() => {
    const obs = new IntersectionObserver(
      (entradas) => { const visible = entradas.filter((e) => e.isIntersecting).sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top)[0]; if (visible) setActiva(visible.target.id) },
      { rootMargin: '-120px 0px -60% 0px' },
    )
    secciones.forEach((s) => { const el = document.getElementById(s.id); if (el) obs.observe(el) })
    return () => obs.disconnect()
  }, [secciones])

  return (
    <nav aria-label="Secciones de configuración" className="-mx-1 flex gap-2 overflow-x-auto px-1 pb-1">
      {secciones.map((s) => (
        <a
          key={s.id}
          href={`#${s.id}`}
          onClick={(e) => { e.preventDefault(); document.getElementById(s.id)?.scrollIntoView({ behavior: 'smooth', block: 'start' }); history.replaceState(null, '', `#${s.id}`) }}
          className={'shrink-0 rounded-full border px-3 py-1 text-xs font-medium transition-colors duration-200 ' + (activa === s.id ? 'border-rs-lime/60 bg-rs-lime/15 text-rs-lime' : 'border-rs-control text-rs-muted hover:bg-rs-raised hover:text-rs-text')}
        >
          {s.label}
        </a>
      ))}
    </nav>
  )
}
