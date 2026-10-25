import { redirect } from 'next/navigation'
import { ShoppingBag } from 'lucide-react'
import ModuloPreparacion from '@/components/modulo-preparacion'
import { getContexto } from '@/lib/context'

export default async function PedidosPage() {
  const ctx = await getContexto()
  if (!ctx.modulosActivos.pedidos) redirect('/')
  return (
    <ModuloPreparacion
      icono={<ShoppingBag size={22} />}
      titulo="Pedidos"
      subtitulo="Pedidos de los clientes"
      vaA={['Pedidos de delivery y retiro armados desde la carta', 'Estados del pedido y aviso al cliente por WhatsApp', 'Resumen de ventas del día']}
      nota="Los pedidos se arman desde la carta digital, por eso este módulo siempre viene con la Carta encendida."
    />
  )
}
