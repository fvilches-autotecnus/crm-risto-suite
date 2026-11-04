import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import SeguimientoPedido from '@/components/seguimiento-pedido'
import { origenCrm, normalizarMarca, urlAbsoluta, variablesMarca, type Marca } from '@/lib/marca'
import { createAdminClient } from '@/lib/supabase/server'

export const metadata: Metadata = { title: 'Estado de tu pedido', robots: { index: false } }

/** Seguimiento público del pedido: el cliente pone su número (o entra por el link que le llegó) y ve en qué estado está. */
export default async function PaginaSeguimiento({ params, searchParams }: { params: Promise<{ slug: string }>; searchParams: Promise<{ numero?: string }> }) {
  const slug = (await params).slug
  if (!/^[a-z0-9-]{2,49}$/.test(slug)) notFound()
  const admin = createAdminClient()
  const { data: negocio } = await admin.from('negocios').select('id, nombre').eq('slug', slug).eq('activo', true).maybeSingle()
  if (!negocio) notFound()
  const { data: web } = await admin.from('reservas_web_config').select('marca').eq('negocio_id', negocio.id).maybeSingle()
  const m = normalizarMarca(web?.marca)
  const marca: Marca = { ...m, logo_url: urlAbsoluta(m.logo_url), ornamento_url: urlAbsoluta(m.ornamento_url) }
  const vars = variablesMarca(marca)
  const numero = Number((await searchParams).numero)
  return (
    <>
      {vars && <style>{`:root{${Object.entries(vars).map(([k, v]) => `${k}:${v}`).join(';')}}`}</style>}
      <SeguimientoPedido slug={slug} nombre={negocio.nombre as string} marca={marca} numeroInicial={Number.isInteger(numero) && numero > 0 ? numero : null} logoRisto={`${origenCrm()}/logo.jpeg`} />
    </>
  )
}
