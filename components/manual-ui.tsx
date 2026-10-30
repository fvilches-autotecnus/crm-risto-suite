'use client'

import { Fragment, useMemo, useState } from 'react'
import { AlertTriangle, ChevronUp, Lightbulb, Printer, Search } from 'lucide-react'
import type { Bloque, SeccionManual } from '@/lib/manual'

export interface SeccionVista extends SeccionManual { inactivo?: boolean }

/** **negrita** y `código` dentro de un texto. */
function Inline({ x }: { x: string }) {
  return (
    <>
      {x.split(/(\*\*[^*]+\*\*|`[^`]+`)/g).map((t, i) =>
        t.startsWith('**') ? <strong key={i} className="font-semibold text-rs-text">{t.slice(2, -2)}</strong>
          : t.startsWith('`') ? <code key={i} className="rounded bg-rs-raised px-1 py-0.5 font-mono text-[0.85em] text-rs-lime">{t.slice(1, -1)}</code>
            : <Fragment key={i}>{t}</Fragment>)}
    </>
  )
}

function BloqueVista({ b }: { b: Bloque }) {
  switch (b.t) {
    case 'p': return <p className="leading-relaxed text-rs-muted"><Inline x={b.x} /></p>
    case 'pasos': return <ol className="space-y-2 pl-0">{b.x.map((x, i) => <li key={i} className="flex gap-3 leading-relaxed text-rs-muted"><span className="mt-0.5 grid h-5 w-5 shrink-0 place-items-center rounded-full bg-rs-lime/15 text-xs font-bold text-rs-lime">{i + 1}</span><span><Inline x={x} /></span></li>)}</ol>
    case 'lista': return <ul className="list-disc space-y-1.5 pl-5 leading-relaxed text-rs-muted marker:text-rs-lime/60">{b.x.map((x, i) => <li key={i}><Inline x={x} /></li>)}</ul>
    case 'tip': return <div className="flex gap-2.5 rounded-md border border-rs-lime/25 bg-rs-lime/5 px-3 py-2.5 text-sm leading-relaxed text-rs-muted"><Lightbulb size={16} className="mt-0.5 shrink-0 text-rs-lime" /><span><Inline x={b.x} /></span></div>
    case 'ojo': return <div className="flex gap-2.5 rounded-md border border-rs-warn/30 bg-rs-warn/5 px-3 py-2.5 text-sm leading-relaxed text-rs-muted"><AlertTriangle size={16} className="mt-0.5 shrink-0 text-rs-warn" /><span><Inline x={b.x} /></span></div>
    case 'tabla': return (
      <div className="overflow-x-auto rounded-md border border-rs-border">
        <table className="w-full text-left text-sm">
          <thead><tr className="border-b border-rs-border bg-rs-raised/50">{b.cab.map((c) => <th key={c} className="px-3 py-2 font-semibold text-rs-text">{c}</th>)}</tr></thead>
          <tbody>{b.filas.map((f, i) => <tr key={i} className="border-b border-rs-border/60 last:border-0">{f.map((c, j) => <td key={j} className={'px-3 py-2 align-top leading-relaxed ' + (j === 0 ? 'font-medium text-rs-text' : 'text-rs-muted')}><Inline x={c} /></td>)}</tr>)}</tbody>
        </table>
      </div>
    )
  }
}

const texto = (s: SeccionVista) => [s.titulo, s.resumen, ...s.bloques.map((b) => (b.t === 'tabla' ? [...b.cab, ...b.filas.flat()].join(' ') : Array.isArray(b.x) ? b.x.join(' ') : b.x))].join(' ').toLowerCase()
const sinTildes = (t: string) => t.normalize('NFD').replace(/[̀-ͯ]/g, '')

export default function ManualUI({ secciones, grupos }: { secciones: SeccionVista[]; grupos: readonly string[] }) {
  const [q, setQ] = useState('')
  const filtradas = useMemo(() => {
    const t = sinTildes(q.trim().toLowerCase())
    return t ? secciones.filter((s) => sinTildes(texto(s)).includes(t)) : secciones
  }, [q, secciones])

  return (
    <div className="space-y-5">
      <div className="no-print flex flex-wrap items-center gap-3">
        <div className="relative min-w-[220px] flex-1">
          <Search size={15} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-rs-muted" />
          <input value={q} onChange={(e) => setQ(e.target.value)} type="search" placeholder="Buscar en el manual (ej. mesa, voucher, aforo)" aria-label="Buscar en el manual" className="input w-full pl-9" />
        </div>
        <button type="button" onClick={() => window.print()} className="btn"><Printer size={14} />Imprimir o guardar en PDF</button>
      </div>

      <div className="grid gap-6 lg:grid-cols-[250px_1fr]">
        <nav aria-label="Índice del manual" className="no-print lg:sticky lg:top-28 lg:max-h-[calc(100vh-9rem)] lg:self-start lg:overflow-y-auto">
          <details className="card p-3 lg:!block" open>
            <summary className="card-title cursor-pointer lg:pointer-events-none lg:list-none">Índice</summary>
            <div className="mt-2 space-y-3">
              {grupos.map((g) => {
                const items = filtradas.filter((s) => s.grupo === g)
                if (!items.length) return null
                return (
                  <div key={g}>
                    <p className="mb-1 text-[11px] font-bold uppercase tracking-wide text-rs-muted/80">{g}</p>
                    <ul className="space-y-0.5">{items.map((s) => <li key={s.id}><a href={`#${s.id}`} className={'block rounded px-2 py-1 text-sm hover:bg-rs-raised ' + (s.inactivo ? 'text-rs-muted/60' : 'text-rs-text')}>{s.titulo}</a></li>)}</ul>
                  </div>
                )
              })}
            </div>
          </details>
        </nav>

        <div className="min-w-0 space-y-8">
          {filtradas.length === 0 && <div className="card p-6 text-center text-rs-muted">No encontramos nada para “{q}”. Probá con otra palabra.</div>}
          {grupos.map((g) => {
            const items = filtradas.filter((s) => s.grupo === g)
            if (!items.length) return null
            return (
              <section key={g} className="space-y-5">
                <h2 className="border-b border-rs-border pb-2 text-lg font-bold text-rs-lime">{g}</h2>
                {items.map((s) => (
                  <article key={s.id} id={s.id} className="card scroll-mt-28 space-y-3 p-5 break-inside-avoid-page">
                    <header>
                      <div className="flex flex-wrap items-center gap-2">
                        <h3 className="text-base font-bold sm:text-lg">{s.titulo}</h3>
                        {s.inactivo && <span className="rounded-full bg-rs-raised px-2 py-0.5 text-[11px] font-semibold text-rs-muted">No activo en este negocio</span>}
                        {s.solo === 'admin' && <span className="rounded-full bg-rs-raised px-2 py-0.5 text-[11px] font-semibold text-rs-lime">Dueño y administrador</span>}
                      </div>
                      <p className="mt-0.5 text-sm text-rs-muted/80">{s.resumen}</p>
                    </header>
                    {s.bloques.map((b, i) => <BloqueVista key={i} b={b} />)}
                  </article>
                ))}
              </section>
            )
          })}
          <a href="#ingresar" className="no-print inline-flex items-center gap-1 text-sm text-rs-muted hover:text-rs-lime"><ChevronUp size={14} />Volver al principio</a>
        </div>
      </div>
    </div>
  )
}
