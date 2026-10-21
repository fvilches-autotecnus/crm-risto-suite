import Link from 'next/link'
import { notFound } from 'next/navigation'
import { ArrowLeft } from 'lucide-react'
import { getContexto } from '@/lib/context'
import { fechaCorta, horaCorta } from '@/lib/fechas'
import { labelTipo } from '@/lib/reservas'
import { EstadoBadge } from '@/components/reservas-ui'
import NotasCliente from './notas'

export default async function ClienteDetalle({ params }: { params: Promise<{ id: string }> }) {
  const ctx = await getContexto()
  const { supabase, negocio } = ctx
  const { id } = await params
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound()

  const { data: cliente } = await supabase.from('clientes').select('id, nombre, telefono, email, canal_origen, notas, creado_en').eq('id', id).eq('negocio_id', negocio.id).maybeSingle()
  if (!cliente) notFound()

  const { data: reservas } = await supabase
    .from('reservas')
    .select('id, numero, fecha, hora, cantidad_personas, tipo_reserva, estado, observaciones')
    .eq('cliente_id', id)
    .is('eliminado_en', null)
    .order('fecha', { ascending: false, nullsFirst: true })

  return (
    <div className="space-y-6">
      <Link href="/clientes" className="inline-flex items-center gap-1.5 text-sm text-rs-muted hover:text-rs-text"><ArrowLeft size={14} /> Clientes</Link>

      <div className="card p-5">
        <h1 className="text-xl font-bold">{cliente.nombre}</h1>
        <dl className="mt-3 grid gap-3 text-sm sm:grid-cols-3">
          <div><dt className="card-title">Teléfono</dt><dd className="mt-1">{cliente.telefono ?? '—'}</dd></div>
          <div><dt className="card-title">Origen</dt><dd className="mt-1">{cliente.canal_origen === 'whatsapp' ? 'WhatsApp' : 'Manual'}</dd></div>
          <div><dt className="card-title">Cliente desde</dt><dd className="mt-1">{fechaCorta(cliente.creado_en.slice(0, 10))}</dd></div>
        </dl>
        {cliente.telefono && (
          <Link href={`/conversaciones?tel=${cliente.telefono}`} className="btn btn-sm mt-4 inline-flex">Ver conversación</Link>
        )}
      </div>

      <NotasCliente id={cliente.id} notas={cliente.notas ?? ''} puedeEscribir={ctx.puedeEscribir} />

      <section>
        <h2 className="card-title mb-3">Historial de reservas</h2>
        <div className="card overflow-x-auto">
          <table className="w-full min-w-[560px]">
            <thead className="border-b border-rs-border">
              <tr><th className="th">#</th><th className="th">Fecha</th><th className="th">Hora</th><th className="th">Personas</th><th className="th">Tipo</th><th className="th">Estado</th></tr>
            </thead>
            <tbody>
              {(reservas ?? []).length === 0 && <tr><td colSpan={6} className="td py-8 text-center text-rs-muted">Sin reservas.</td></tr>}
              {(reservas ?? []).map((r) => (
                <tr key={r.id} className="border-b border-rs-border/60 last:border-0">
                  <td className="td font-semibold text-rs-lime">#{r.numero}</td>
                  <td className="td">{fechaCorta(r.fecha)}</td>
                  <td className="td">{horaCorta(r.hora)}</td>
                  <td className="td">{r.cantidad_personas ?? '—'}</td>
                  <td className="td text-rs-muted">{labelTipo(r.tipo_reserva)}</td>
                  <td className="td"><EstadoBadge estado={r.estado} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  )
}
