import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import PaginaCartaPublica from '@/components/pagina-carta-publica'
import { cargarCartaPublica, metadataCarta } from '@/lib/carta-publica'

// Carta pública con pedidos (sin iniciar sesión). Se regenera sola cada minuto y al instante cuando el negocio edita algo.
export const revalidate = 60

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  return metadataCarta((await params).slug, 'pedir')
}

export default async function CartaPublicaPage({ params }: { params: Promise<{ slug: string }> }) {
  const slug = (await params).slug
  const d = await cargarCartaPublica(slug, 'pedir')
  if (!d) notFound()
  return <PaginaCartaPublica slug={slug} d={d} />
}
