import { headers } from 'next/headers'
import { ImageResponse } from 'next/og'
import { fondoClaro, origenCrm, urlAbsoluta } from '@/lib/marca'
import { resolverSitio } from '@/lib/sitio-reservas'

// Ícono de la pestaña (y de "agregar a inicio"): cuadrado con el fondo de la marca y el logo adentro, sin transparencia.
export const revalidate = 300

export async function GET(_req: Request, { params }: { params: Promise<{ slug: string }> }) {
  const s = await resolverSitio((await params).slug)
  const marca = s?.marca
  const fondo = marca && fondoClaro(marca)
  if (!marca?.logo_url || !fondo) return new Response(null, { status: 404 })
  // satori no resuelve rutas relativas: las imágenes propias del CRM van con dirección completa (en local, la del propio servidor)
  const h = await headers()
  const host = origenCrm() || `${h.get('x-forwarded-proto') ?? 'http'}://${h.get('host')}`
  const a = urlAbsoluta(marca.logo_url), logo = a?.startsWith('/') ? host + a : a
  return new ImageResponse(
    (
      <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', background: fondo }}>
        <img src={logo!} width={440} style={{ width: 440, objectFit: 'contain' }} />
      </div>
    ),
    { width: 512, height: 512 },
  )
}
