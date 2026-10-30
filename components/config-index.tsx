'use client'

import { useEffect, useState } from 'react'

export interface GrupoIndice { titulo: string; items: { id: string; label: string }[] }

// Índice de Configuración: salta a cada sección con desplazamiento suave y marca la que se está viendo.
// En pantallas anchas es una barra lateral con las secciones agrupadas; en el celular, una fila de botones que se desliza.
export default function ConfigIndex({ grupos, modo }: { grupos: GrupoIndice[]; modo: 'lateral' | 'chips' }) {
  const todas = grupos.flatMap((g) => g.items)
  const [activa, setActiva] = useState(todas[0]?.id)

  useEffect(() => {
    const obs = new IntersectionObserver(
      (entradas) => { const visible = entradas.filter((e) => e.isIntersecting).sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top)[0]; if (visible) setActiva(visible.target.id) },
      { rootMargin: '-120px 0px -60% 0px' },
    )
    todas.forEach((s) => { const el = document.getElementById(s.id); if (el) obs.observe(el) })
    return () => obs.disconnect()
  }, [grupos]) // eslint-disable-line react-hooks/exhaustive-deps

  const ir = (id: string) => (e: React.MouseEvent) => { e.preventDefault(); document.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'start' }); history.replaceState(null, '', `#${id}`) }

  if (modo === 'lateral') {
    return (
      <nav aria-label="Secciones de configuración" className="sticky top-28 hidden max-h-[calc(100vh-8rem)] space-y-4 overflow-y-auto pr-2 xl:block">
        {grupos.map((g) => (
          <div key={g.titulo}>
            <p className="px-2 text-[11px] font-semibold uppercase tracking-[0.06em] text-rs-muted">{g.titulo}</p>
            <ul className="mt-1 space-y-0.5">
              {g.items.map((s) => (
                <li key={s.id}>
                  <a href={`#${s.id}`} onClick={ir(s.id)} aria-current={activa === s.id ? 'location' : undefined}
                    className={'block rounded-md px-2 py-1.5 text-sm transition-colors ' + (activa === s.id ? 'bg-rs-lime/15 font-semibold text-rs-lime' : 'text-rs-muted hover:bg-rs-raised hover:text-rs-text')}>{s.label}</a>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </nav>
    )
  }
  return (
    <nav aria-label="Secciones de configuración" className="-mx-1 flex gap-2 overflow-x-auto px-1 pb-1 xl:hidden">
      {todas.map((s) => (
        <a key={s.id} href={`#${s.id}`} onClick={ir(s.id)}
          className={'shrink-0 rounded-full border px-3 py-1 text-xs font-medium transition-colors duration-200 ' + (activa === s.id ? 'border-rs-lime/60 bg-rs-lime/15 text-rs-lime' : 'border-rs-control text-rs-muted hover:bg-rs-raised hover:text-rs-text')}>{s.label}</a>
      ))}
    </nav>
  )
}
