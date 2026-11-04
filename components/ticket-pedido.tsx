import type { DatosTicket } from '@/lib/comandera'
import { fechaHoraLarga } from '@/lib/fechas'
import { dinero, labelEntrega, labelPago } from '@/lib/pedidos'

/** Ticket de un pedido para impresora térmica de 80 mm (o cualquier hoja). Lo usan la página del ticket y la comandera. */
export default function TicketPedido({ negocio, p }: { negocio: string; p: DatosTicket }) {
  return (
    <div className="mx-auto w-[300px] font-mono text-[13px] leading-snug">
      <p className="text-center text-base font-bold">{negocio}</p>
      <p className="text-center text-2xl font-bold">PEDIDO #{p.numero}</p>
      <p className="text-center">{fechaHoraLarga(p.creado_en)}</p>
      <hr className="my-2 border-dashed border-black" />
      <p className="text-lg font-bold">{labelEntrega(p).toUpperCase()}{p.tipo === 'mesa' && p.mesa ? ` ${p.mesa}` : ''}</p>
      <p>{p.nombre}{p.telefono ? ` · ${p.telefono}` : ''}</p>
      {p.direccion && <p>Dirección: {p.direccion}</p>}
      <hr className="my-2 border-dashed border-black" />
      {p.items.map((i) => (
        <div key={i.id} className="mb-1.5">
          <div className="flex justify-between gap-2"><span className="font-bold">{i.cantidad} x {i.nombre}{i.variante ? ` (${i.variante})` : ''}</span><span>{dinero(i.subtotal)}</span></div>
          {i.categoria && <p className="pl-3">[{i.categoria}]</p>}
          {i.observaciones && <p className="pl-3">» {i.observaciones}</p>}
        </div>
      ))}
      <hr className="my-2 border-dashed border-black" />
      {(p.envio > 0 || p.descuento > 0) && <div className="flex justify-between"><span>Subtotal</span><span>{dinero(p.subtotal)}</span></div>}
      {p.descuento > 0 && <div className="flex justify-between"><span>Descuento{p.descuento_nombre ? ` (${p.descuento_nombre})` : ''}</span><span>-{dinero(p.descuento)}</span></div>}
      {p.envio > 0 && <div className="flex justify-between"><span>Envío</span><span>{dinero(p.envio)}</span></div>}
      <div className="flex justify-between text-lg font-bold"><span>TOTAL</span><span>{dinero(p.total)}</span></div>
      <p>Pago: {labelPago(p.medio_pago, p.medio_pago_nombre)}</p>
      {p.observaciones && <><hr className="my-2 border-dashed border-black" /><p className="font-bold">NOTAS: {p.observaciones}</p></>}
    </div>
  )
}
