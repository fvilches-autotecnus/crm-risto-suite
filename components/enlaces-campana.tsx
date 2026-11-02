'use client'

import { sinTildes } from '@/lib/validar'
import { useEffect, useState } from 'react'
import { Copy, ExternalLink, Link2 } from 'lucide-react'
import { useToast } from '@/components/feedback'
import { limpiarCampana } from '@/lib/promos'

export interface ResultadoEnlace { codigo: string; reservas: number; personas: number; pedidos: number; ventas: number }

const dinero = (n: number) => '$ ' + n.toLocaleString('es-AR', { maximumFractionDigits: 0 })

/**
 * Enlaces para difusiones: la misma dirección de reservas (y de pedidos) con un código de campaña (?c=…), así se ve cuántas reservas y pedidos
 * entraron por cada difusión. El código viaja con la solicitud y queda guardado en la reserva o el pedido.
 */
export default function EnlacesCampana({ slug, sedes, tipos, conPedidos, resultados, dias }: {
  slug: string; sedes: { nombre: string }[]; tipos: { value: string; label: string }[]; conPedidos: boolean; resultados: ResultadoEnlace[]; dias: number
}) {
  const [nombre, setNombre] = useState('')
  const [sede, setSede] = useState('')
  const [tipo, setTipo] = useState('')
  const [origen, setOrigen] = useState('')
  const toast = useToast()
  useEffect(() => setOrigen(window.location.origin), [])
  const codigo = limpiarCampana(sinTildes(nombre))
  const extra = `${sede ? `&sede=${sinTildes(sede)}` : ''}${tipo ? `&tipo=${tipo}` : ''}`
  const enlaces = codigo ? [
    { id: 'reservas', titulo: 'Reservar', url: `${origen}/reservar/${slug}?c=${codigo}${extra}` },
    ...(conPedidos ? [{ id: 'pedidos', titulo: 'Pedir', url: `${origen}/carta/${slug}?c=${codigo}` }] : []),
  ] : []
  const copiar = async (t: string) => { try { await navigator.clipboard.writeText(t); toast({ texto: 'Enlace copiado' }) } catch { toast({ tipo: 'error', texto: t }) } }

  return (
    <section className="card space-y-4 p-4 sm:p-5" data-enlaces-campana>
      <div>
        <h2 className="flex items-center gap-2 font-bold"><Link2 size={16} className="text-rs-lime" />Enlaces para tus difusiones</h2>
        <p className="mt-0.5 text-sm text-rs-muted">Ponele nombre a la difusión y copiá su enlace para mandarlo por WhatsApp, redes o donde quieras. Todo lo que entre por ese enlace queda marcado con ese nombre y lo ves acá abajo.</p>
      </div>
      <div className="grid gap-3 sm:grid-cols-3">
        <div className="sm:col-span-3"><label className="label" htmlFor="ec_nombre">Nombre de la difusión</label><input id="ec_nombre" value={nombre} onChange={(e) => setNombre(e.target.value)} maxLength={40} placeholder="Ej. Halloween 2026" className="input w-full" /></div>
        {sedes.length > 1 && <div><label className="label" htmlFor="ec_sede">Sede (opcional)</label><select id="ec_sede" value={sede} onChange={(e) => setSede(e.target.value)} className="input w-full"><option value="">El cliente elige</option>{sedes.map((s) => <option key={s.nombre} value={s.nombre}>{s.nombre}</option>)}</select></div>}
        {tipos.length > 1 && <div><label className="label" htmlFor="ec_tipo">Tipo de reserva (opcional)</label><select id="ec_tipo" value={tipo} onChange={(e) => setTipo(e.target.value)} className="input w-full"><option value="">El cliente elige</option>{tipos.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}</select></div>}
      </div>
      {enlaces.length > 0 && (
        <ul className="space-y-2">
          {enlaces.map((e) => (
            <li key={e.id} className="flex flex-wrap items-center gap-2 rounded-md bg-rs-raised/50 px-3 py-2 text-sm" data-enlace={e.id}>
              <span className="w-16 shrink-0 font-semibold">{e.titulo}</span>
              <span className="min-w-0 flex-1 truncate font-mono text-xs" title={e.url}>{e.url}</span>
              <button type="button" onClick={() => copiar(e.url)} className="btn btn-sm"><Copy size={13} />Copiar</button>
              <a href={e.url} target="_blank" rel="noopener noreferrer" className="btn btn-sm"><ExternalLink size={13} />Abrir</a>
            </li>
          ))}
          <li className="text-xs text-rs-muted">Código de la campaña: <code className="rounded bg-rs-raised px-1 font-mono text-rs-lime">{codigo}</code></li>
        </ul>
      )}
      <div>
        <h3 className="text-sm font-semibold">Qué entró por cada enlace (últimos {dias} días)</h3>
        {resultados.length === 0 ? <p className="mt-1 text-sm text-rs-muted">Todavía no entró nada por un enlace de campaña en este período.</p> : (
          <div className="mt-2 overflow-x-auto">
            <table className="w-full min-w-[420px] text-sm">
              <thead className="border-b border-rs-border text-left"><tr><th className="th">Campaña</th><th className="th">Reservas</th><th className="th">Personas</th>{conPedidos && <><th className="th">Pedidos</th><th className="th">Ventas</th></>}</tr></thead>
              <tbody>
                {resultados.map((r) => (
                  <tr key={r.codigo} className="border-b border-rs-border/60 last:border-0" data-resultado={r.codigo}>
                    <td className="td font-mono text-xs text-rs-lime">{r.codigo}</td><td className="td tabular-nums">{r.reservas}</td><td className="td tabular-nums">{r.personas}</td>
                    {conPedidos && <><td className="td tabular-nums">{r.pedidos}</td><td className="td tabular-nums">{dinero(r.ventas)}</td></>}
                  </tr>
                ))}
              </tbody>
            </table>
            <p className="mt-1 text-xs text-rs-muted">No cuenta lo cancelado. Si una reserva entra por el bot de WhatsApp sin pasar por el enlace, no tiene campaña.</p>
          </div>
        )}
      </div>
    </section>
  )
}
