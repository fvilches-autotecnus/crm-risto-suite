'use client'

import { useState, useTransition } from 'react'
import { Check, Copy, RefreshCw, Sparkles } from 'lucide-react'
import Modal from '@/components/modal'
import { Spinner } from '@/components/ui'
import type { ResumenIAResult } from '@/lib/ia'

const hora = (iso: string) => new Date(iso).toLocaleString('es-AR', { timeZone: 'America/Argentina/Buenos_Aires', day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })

function comoTexto(titulo: string, r: Extract<ResumenIAResult, { ok: true }>) {
  return [titulo, '', r.resumen, '', ...r.secciones.flatMap((s) => [s.titulo, ...s.items.map((i) => '• ' + i), '']),
    ...(r.temas.length ? ['Temas que más se repiten', ...r.temas.map((t) => `• ${t.tema} (${t.cantidad} de ${r.analizadas})`), ''] : []),
    ...(r.acciones.length ? ['Qué hacer', ...r.acciones.map((a, i) => `${i + 1}. ${a}`)] : [])].join('\n')
}

/**
 * Botón "Resumen con IA": al tocarlo pide el resumen de lo que se está viendo (con los filtros actuales) y lo muestra en un diálogo.
 * `generar` es una acción del servidor ya con los filtros aplicados; la clave de OpenAI nunca llega al navegador.
 */
export default function ResumenIA({ titulo, generar, pista }: { titulo: string; generar: () => Promise<ResumenIAResult>; pista: string }) {
  const [abierto, setAbierto] = useState(false)
  const [res, setRes] = useState<ResumenIAResult | null>(null)
  const [pend, ir] = useTransition()
  const [copiado, setCopiado] = useState(false)

  const pedir = () => { setRes(null); ir(async () => { try { setRes(await generar()) } catch { setRes({ ok: false, error: 'No se pudo generar el resumen. Probá de nuevo.' }) } }) }
  const abrir = () => { setAbierto(true); if (!res) pedir() }
  const copiar = async () => { if (res?.ok) { try { await navigator.clipboard.writeText(comoTexto(titulo, res)); setCopiado(true); setTimeout(() => setCopiado(false), 1800) } catch { /* sin permiso de portapapeles */ } } }

  return (
    <>
      <button type="button" onClick={abrir} className="btn" title={pista}><Sparkles size={15} className="text-rs-lime" />Resumen con IA</button>
      {abierto && (
        <Modal titulo={titulo} onClose={() => setAbierto(false)} ancho="max-w-2xl">
          {pend || !res ? (
            <div className="flex flex-col items-center gap-3 py-10 text-sm text-rs-muted" role="status"><Spinner size={22} />Leyendo y resumiendo… puede tardar unos segundos</div>
          ) : !res.ok ? (
            <div className="space-y-4"><p role="alert" className="rounded-md border border-rs-danger/40 bg-rs-danger/10 px-3 py-2 text-sm text-rs-danger">{res.error}</p>
              <div className="flex justify-end"><button type="button" onClick={pedir} className="btn"><RefreshCw size={14} />Reintentar</button></div></div>
          ) : (
            <div className="space-y-5 text-sm">
              <p className="text-[15px] leading-relaxed">{res.resumen}</p>
              {res.secciones.map((s) => (
                <section key={s.titulo}><h3 className="card-title mb-2">{s.titulo}</h3><ul className="list-disc space-y-1.5 pl-5 marker:text-rs-lime">{s.items.map((i, k) => <li key={k}>{i}</li>)}</ul></section>
              ))}
              {res.temas.length > 0 && (
                <section><h3 className="card-title mb-2">Temas que más se repiten <span className="font-normal normal-case tracking-normal text-rs-muted">· cuántos de los {res.analizadas} analizados lo mencionan</span></h3>
                  <ul className="space-y-1.5">{res.temas.map((t) => (
                    <li key={t.tema} className="grid grid-cols-[1fr_auto] items-center gap-3"><span><span className="block">{t.tema}</span><span className="mt-1 block h-1.5 overflow-hidden rounded-full bg-rs-raised"><span className="block h-full rounded-full bg-rs-lime" style={{ width: `${Math.max(6, (t.cantidad / Math.max(...res.temas.map((x) => x.cantidad), 1)) * 100)}%` }} /></span></span><span className="tabular-nums text-rs-muted">{t.cantidad}</span></li>
                  ))}</ul></section>
              )}
              {res.acciones.length > 0 && (
                <section><h3 className="card-title mb-2">Qué hacer</h3><ol className="list-decimal space-y-1.5 pl-5 marker:font-semibold marker:text-rs-lime">{res.acciones.map((a, k) => <li key={k}>{a}</li>)}</ol></section>
              )}
              <p className="border-t border-rs-border/60 pt-3 text-xs text-rs-muted">Generado con IA · {hora(res.generado)}. {res.nota ?? ''} Puede equivocarse: revisalo antes de tomar decisiones.</p>
              <div className="flex flex-wrap justify-end gap-2">
                <button type="button" onClick={copiar} className="btn">{copiado ? <Check size={14} /> : <Copy size={14} />}{copiado ? 'Copiado' : 'Copiar'}</button>
                <button type="button" onClick={pedir} className="btn"><RefreshCw size={14} />Volver a generar</button>
              </div>
            </div>
          )}
        </Modal>
      )}
    </>
  )
}
