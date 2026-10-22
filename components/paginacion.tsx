import Link from 'next/link'
import { ChevronLeft, ChevronRight } from 'lucide-react'

const fmt = (n: number) => n.toLocaleString('es-AR')

/** Páginas a mostrar: la primera, la última y las vecinas de la actual (con "…" en los saltos). */
function numeros(p: number, n: number): (number | null)[] {
  const set = new Set([1, n, p - 1, p, p + 1].filter((x) => x >= 1 && x <= n))
  const orden = [...set].sort((a, b) => a - b)
  const out: (number | null)[] = []
  orden.forEach((x, i) => { if (i && x - orden[i - 1] > 1) out.push(null); out.push(x) })
  return out
}

/** Navegación de páginas para listados largos. Conserva los filtros de la URL (params) y cambia solo ?pagina=. */
export default function Paginacion({ ruta, params, pagina, paginas, total, desde, hasta }: { ruta: string; params: Record<string, string | undefined>; pagina: number; paginas: number; total: number; desde: number; hasta: number }) {
  if (total === 0) return null
  const href = (n: number) => {
    const p = new URLSearchParams()
    for (const [k, v] of Object.entries(params)) if (v && k !== 'pagina') p.set(k, v)
    if (n > 1) p.set('pagina', String(n))
    const s = p.toString()
    return s ? `${ruta}?${s}` : ruta
  }
  return (
    <nav aria-label="Páginas" className="flex flex-wrap items-center justify-between gap-3 text-sm">
      <p className="text-rs-muted">Mostrando <span className="font-semibold text-rs-text tabular-nums">{fmt(desde)}–{fmt(hasta)}</span> de <span className="font-semibold text-rs-text tabular-nums">{fmt(total)}</span></p>
      {paginas > 1 && (
        <div className="flex flex-wrap items-center gap-1.5">
          {pagina > 1 ? <Link href={href(pagina - 1)} className="btn btn-sm" aria-label="Página anterior"><ChevronLeft size={14} />Anterior</Link> : <span className="btn btn-sm pointer-events-none opacity-40"><ChevronLeft size={14} />Anterior</span>}
          {numeros(pagina, paginas).map((n, i) => n === null
            ? <span key={'e' + i} className="px-1 text-rs-muted">…</span>
            : <Link key={n} href={href(n)} aria-current={n === pagina ? 'page' : undefined} className={'btn btn-sm min-w-[2.25rem] tabular-nums ' + (n === pagina ? 'btn-primary' : '')}>{n}</Link>)}
          {pagina < paginas ? <Link href={href(pagina + 1)} className="btn btn-sm" aria-label="Página siguiente">Siguiente<ChevronRight size={14} /></Link> : <span className="btn btn-sm pointer-events-none opacity-40">Siguiente<ChevronRight size={14} /></span>}
        </div>
      )}
    </nav>
  )
}
