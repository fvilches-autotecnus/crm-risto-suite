import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import PaginaCartaPublica from '@/components/pagina-carta-publica'
import { cargarCartaPublica, metadataCarta } from '@/lib/carta-publica'

// Carta pública de SOLO LECTURA (sin carrito ni pedidos): el mismo catálogo y los mismos precios que la carta con pedidos, siempre sincronizados.
// Se enciende en los ajustes de la carta; apagada, esta dirección muestra "carta no disponible".
export const revalidate = 60

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  return metadataCarta((await params).slug, 'ver')
}

export default async function CartaSoloLecturaPage({ params }: { params: Promise<{ slug: string }> }) {
  const slug = (await params).slug
  const d = await cargarCartaPublica(slug, 'ver')
  if (!d) notFound()
  return <PaginaCartaPublica slug={slug} d={d} />
}
