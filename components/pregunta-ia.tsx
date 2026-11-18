'use client'

import { useState, useTransition } from 'react'
import { RefreshCw, Send, Sparkles } from 'lucide-react'
import { Spinner } from '@/components/ui'
import { preguntarDatos, type RespuestaPregunta } from '@/app/(panel)/ia-preguntas-actions'

const EJEMPLOS = [
  '¿Cuántas reservas tuve el mes pasado?',
  '¿Qué día de la semana reservan más personas?',
  '¿Qué clientes vinieron 3 veces o más y no vuelven hace 60 días?',
  '¿Cuál es mi ticket promedio de pedidos este mes?',
]

/** Cuadro "Preguntale a tus datos": una pregunta en lenguaje natural y la respuesta con su base. Tope diario por negocio (lo controla el servidor). */
export default function PreguntaIA({ restantesIniciales, tope, ejemplos = EJEMPLOS }: { restantesIniciales: number; tope: number; ejemplos?: string[] }) {
  const [texto, setTexto] = useState('')
  const [res, setRes] = useState<RespuestaPregunta | null>(null)
  const [preguntada, setPreguntada] = useState('')
  const [restantes, setRestantes] = useState(restantesIniciales)
  const [pend, ir] = useTransition()

  const enviar = (p: string) => {
    const q = p.trim(); if (q.length < 5 || pend || restantes <= 0) return
    setPreguntada(q); setRes(null)
    ir(async () => {
      try { const r = await preguntarDatos(q); setRes(r); setRestantes(r.restantes) }
      catch { setRes({ ok: false, error: 'No se pudo responder. Probá de nuevo.', restantes }) }
    })
  }

  return (
    <section className="card p-4 sm:p-5" aria-labelledby="h-pregunta">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 id="h-pregunta" className="card-title flex items-center gap-2"><Sparkles size={15} className="text-rs-lime" />Preguntale a tus datos</h2>
      </div>
      {restantes <= 0 && <p role="status" data-testid="tope-ia" className="mt-3 rounded-md border border-rs-warn/40 bg-rs-warn/10 px-3 py-2 text-sm">Llegaste al límite de {tope} preguntas de hoy. Se renueva mañana a las 00:00.</p>}
      <form className="mt-3 flex flex-wrap gap-2" onSubmit={(e) => { e.preventDefault(); enviar(texto) }}>
        <input value={texto} onChange={(e) => setTexto(e.target.value)} maxLength={300} disabled={restantes <= 0} aria-label="Tu pregunta" placeholder="Ej.: ¿Cuántas reservas de más de 6 personas tuve los sábados de octubre?" className="input min-w-[220px] flex-1" />
        <button disabled={pend || restantes <= 0 || texto.trim().length < 5} className="btn btn-primary">{pend ? <Spinner /> : <Send size={14} />}Preguntar</button>
      </form>
      {!res && !pend && restantes > 0 && (
        <div className="mt-3 flex flex-wrap gap-2">
          {ejemplos.map((e) => <button key={e} type="button" onClick={() => { setTexto(e); enviar(e) }} className="rounded-full border border-rs-border px-3 py-1 text-left text-xs text-rs-muted hover:border-rs-lime hover:text-rs-text">{e}</button>)}
        </div>
      )}
      {pend && <div className="mt-4 flex items-center gap-3 text-sm text-rs-muted" role="status"><Spinner size={18} />Consultando tus datos… puede tardar unos segundos</div>}
      {res && !pend && (
        <div className="mt-4 space-y-3 text-sm" aria-live="polite">
          <p className="text-xs text-rs-muted">Pregunta: {preguntada}</p>
          {res.ok ? (
            <>
              <p className="whitespace-pre-wrap text-[15px] leading-relaxed" data-testid="respuesta-ia">{res.respuesta}</p>
              {res.tablas.map((t, i) => (
                <div key={i} className="overflow-x-auto rounded-rs border border-rs-border/60">
                  <p className="border-b border-rs-border/60 px-3 py-2 text-xs font-semibold">{t.titulo}</p>
                  <table className="w-full text-left text-xs"><thead><tr className="text-rs-muted">{t.columnas.map((c) => <th key={c} className="px-3 py-1.5 font-medium">{c}</th>)}</tr></thead>
                    <tbody>{t.filas.length === 0 ? <tr><td className="px-3 py-2 text-rs-muted" colSpan={t.columnas.length}>Sin resultados.</td></tr> : t.filas.map((f, k) => <tr key={k} className="border-t border-rs-border/40">{f.map((v, n) => <td key={n} className="px-3 py-1.5">{v}</td>)}</tr>)}</tbody></table>
                </div>
              ))}
              <p className="border-t border-rs-border/60 pt-3 text-xs text-rs-muted">
                {res.fuentes.length > 0 && <>Datos consultados: {res.fuentes.join(' · ')}. </>}Generado con IA: puede equivocarse, revisalo antes de decidir.
              </p>
            </>
          ) : (
            <p role="alert" className="rounded-md border border-rs-danger/40 bg-rs-danger/10 px-3 py-2 text-rs-danger">{res.error}</p>
          )}
          {restantes > 0 && <button type="button" onClick={() => { setRes(null); setTexto('') }} className="btn btn-sm"><RefreshCw size={13} />Otra pregunta</button>}
        </div>
      )}
    </section>
  )
}
