import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import TicketPedido from '@/components/ticket-pedido'
import { COLS_TICKET, aDatosTicket } from '@/lib/comandera'
import { getContexto } from '@/lib/context'
import BotonImprimir from './boton-imprimir'

export const metadata: Metadata = { title: 'Ticket de pedido', robots: { index: false } }

/** Ticket de un pedido, pensado para impresora térmica de 80 mm (o cualquier hoja). Solo para usuarios con sesión del negocio. */
export default async function Ticket({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ auto?: string }> }) {
  const { id } = await params
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound()
  const ctx = await getContexto()
  if (!ctx.modulosActivos.pedidos) notFound()
  const { data: p } = await ctx.supabase.from('pedidos').select(COLS_TICKET).eq('id', id).eq('negocio_id', ctx.negocio.id).maybeSingle()
  if (!p) notFound()
  return (
    <div className="min-h-screen bg-white p-4 text-black print:p-0">
      <BotonImprimir auto={(await searchParams).auto === '1'} />
      <TicketPedido negocio={ctx.negocio.nombre} p={aDatosTicket(p as unknown as Record<string, unknown>)} />
    </div>
  )
}
