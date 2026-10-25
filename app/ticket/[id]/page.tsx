import type { Metadata } from 'next'
import { fechaHoraLarga } from '@/lib/fechas'
import { notFound } from 'next/navigation'
import { getContexto } from '@/lib/context'
import { dinero, labelPago, labelTipo } from '@/lib/pedidos'
import BotonImprimir from './boton-imprimir'

export const metadata: Metadata = { title: 'Ticket de pedido', robots: { index: false } }

/** Ticket de un pedido, pensado para impresora térmica de 80 mm (o cualquier hoja). Solo para usuarios con sesión del negocio. */
export default async function Ticket({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ auto?: string }> }) {
  const { id } = await params
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound()
  const ctx = await getContexto()
  if (!ctx.modulosActivos.pedidos) notFound()
  const { data: p } = await ctx.supabase.from('pedidos')
    .select('numero, nombre, telefono, tipo, mesa, direccion, observaciones, medio_pago, estado, subtotal, envio, total, creado_en, items:pedido_items(id, nombre, variante, cantidad, observaciones, subtotal)')
    .eq('id', id).eq('negocio_id', ctx.negocio.id).maybeSingle()
  if (!p) notFound()
  const items = (p.items ?? []) as { id: string; nombre: string; variante: string | null; cantidad: number; observaciones: string | null; subtotal: number }[]
  const fecha = fechaHoraLarga(p.creado_en)
  return (
    <div className="min-h-screen bg-white p-4 text-black print:p-0">
      <BotonImprimir auto={(await searchParams).auto === '1'} />
      <div className="mx-auto w-[300px] font-mono text-[13px] leading-snug">
        <p className="text-center text-base font-bold">{ctx.negocio.nombre}</p>
        <p className="text-center text-2xl font-bold">PEDIDO #{p.numero}</p>
        <p className="text-center">{fecha}</p>
        <hr className="my-2 border-dashed border-black" />
        <p className="text-lg font-bold">{labelTipo(p.tipo).toUpperCase()}{p.tipo === 'mesa' && p.mesa ? ` ${p.mesa}` : ''}</p>
        <p>{p.nombre}{p.telefono ? ` · ${p.telefono}` : ''}</p>
        {p.direccion && <p>Dirección: {p.direccion}</p>}
        <hr className="my-2 border-dashed border-black" />
        {items.map((i) => (
          <div key={i.id} className="mb-1.5">
            <div className="flex justify-between gap-2"><span className="font-bold">{i.cantidad} x {i.nombre}{i.variante ? ` (${i.variante})` : ''}</span><span>{dinero(Number(i.subtotal))}</span></div>
            {i.observaciones && <p className="pl-3">» {i.observaciones}</p>}
          </div>
        ))}
        <hr className="my-2 border-dashed border-black" />
        {Number(p.envio) > 0 && <><div className="flex justify-between"><span>Subtotal</span><span>{dinero(Number(p.subtotal))}</span></div><div className="flex justify-between"><span>Envío</span><span>{dinero(Number(p.envio))}</span></div></>}
        <div className="flex justify-between text-lg font-bold"><span>TOTAL</span><span>{dinero(Number(p.total))}</span></div>
        <p>Pago: {labelPago(p.medio_pago)}</p>
        {p.observaciones && <><hr className="my-2 border-dashed border-black" /><p className="font-bold">NOTAS: {p.observaciones}</p></>}
      </div>
    </div>
  )
}
