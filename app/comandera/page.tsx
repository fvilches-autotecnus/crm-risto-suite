import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { estadoComandera } from '@/app/(panel)/pedidos-actions'
import Comandera from '@/components/comandera'
import { getContexto } from '@/lib/context'

export const metadata: Metadata = { title: 'Comandera', robots: { index: false } }

/** Pantalla de la PC del local con impresora térmica: queda abierta y imprime sola el ticket de cada pedido nuevo. Solo para usuarios con sesión del negocio. */
export default async function ComanderaPage() {
  const ctx = await getContexto()
  if (!ctx.modulosActivos.pedidos) notFound()
  const r = await estadoComandera()
  if (!r.ok) notFound()
  const puedeAjustes = ctx.puedeEscribir && (ctx.puedeAdministrar || ctx.rol === 'encargado') && ctx.sinRestriccionSede
  return <Comandera negocio={ctx.negocio.nombre} negocioId={ctx.negocio.id} inicial={r.estado} puedeAjustes={puedeAjustes} />
}
