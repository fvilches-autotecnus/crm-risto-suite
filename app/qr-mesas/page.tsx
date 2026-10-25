import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { getContexto } from '@/lib/context'
import HojaQR from './hoja-qr'

export const metadata: Metadata = { title: 'QR de mesas', robots: { index: false } }

/** Hoja imprimible con un código QR por mesa: abre la carta del negocio con la mesa ya cargada (?mesa=N). */
export default async function QRMesas() {
  const ctx = await getContexto()
  if (!ctx.modulosActivos.mesas) notFound()
  const { data: salones } = await ctx.supabase.from('salones').select('id, nombre').eq('negocio_id', ctx.negocio.id).order('orden').order('creado_en')
  const { data: mesas } = await ctx.supabase.from('mesas').select('id, salon_id, numero').eq('negocio_id', ctx.negocio.id).eq('tipo', 'mesa').eq('activa', true).order('numero').limit(500)
  const grupos = (salones ?? []).map((s) => ({ nombre: s.nombre, mesas: (mesas ?? []).filter((m) => m.salon_id === s.id).sort((a, b) => a.numero.localeCompare(b.numero, 'es', { numeric: true })).map((m) => m.numero) })).filter((g) => g.mesas.length)
  return <HojaQR negocio={ctx.negocio.nombre} slug={ctx.negocio.slug} grupos={grupos} conPedidos={ctx.modulosActivos.pedidos} conCarta={ctx.modulosActivos.carta} />
}
