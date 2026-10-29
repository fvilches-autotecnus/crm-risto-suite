import { headers } from 'next/headers'
import { ImageResponse } from 'next/og'
import { cargarMarcaSitio, origenCrm, tieneMarca, urlAbsoluta, variablesMarca } from '@/lib/marca'

// Miniatura que se ve al compartir el link del sitio de reservas (WhatsApp, redes): la marca del local y la de Risto Suite.
export const alt = 'Reservá tu mesa'
export const size = { width: 1200, height: 630 }
export const contentType = 'image/png'
export const revalidate = 300

const rgb = (v: string | undefined, def: string) => (v ? `rgb(${v.split(' ').join(',')})` : def)

export default async function Miniatura({ params }: { params: Promise<{ slug: string }> }) {
  const s = await cargarMarcaSitio((await params).slug)
  const marca = s?.marca
  const vars = (marca && variablesMarca(marca)) ?? {}
  const fondo = rgb(vars['--rs-header'], '#0a1100'), acento = rgb(vars['--rs-lime'], '#c8e62b'), texto = rgb(vars['--rs-text'], '#f0f4e8'), suave = rgb(vars['--rs-muted'], '#7a9050')
  // satori no resuelve rutas relativas: las imágenes propias del CRM van con dirección completa (en local, la del propio servidor)
  const h = await headers()
  const host = origenCrm() || `${h.get('x-forwarded-proto') ?? 'http'}://${h.get('host')}`
  const abs = (u: string | null) => { const a = urlAbsoluta(u); return a?.startsWith('/') ? host + a : a }
  const logo = abs(marca?.logo_url ?? null), orn = abs(marca?.ornamento_url ?? null), risto = `${host}/logo.jpeg`
  const nombre = s?.nombre ?? 'Risto Suite'
  return new ImageResponse(
    (
      <div style={{ width: '100%', height: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', background: fondo, color: texto, position: 'relative', overflow: 'hidden' }}>
        {orn && <img src={orn} width={420} height={528} style={{ position: 'absolute', top: -40, right: -30, opacity: 0.28 }} />}
        {orn && <img src={orn} width={420} height={528} style={{ position: 'absolute', bottom: -40, left: -30, opacity: 0.18, transform: 'rotate(180deg)' }} />}
        {logo
          ? <img src={logo} width={230} height={230} style={{ borderRadius: 115, border: `3px solid ${acento}` }} />
          : <img src={risto} width={170} height={170} style={{ borderRadius: 40 }} />}
        <div style={{ display: 'flex', marginTop: 28, fontSize: 54, fontWeight: 300, letterSpacing: 10, textTransform: 'uppercase', color: acento, textAlign: 'center', maxWidth: 1000 }}>{nombre}</div>
        {marca?.lema && <div style={{ display: 'flex', marginTop: 12, fontSize: 32, fontStyle: 'italic', color: texto, textAlign: 'center', maxWidth: 900 }}>{marca.lema}</div>}
        <div style={{ display: 'flex', marginTop: 18, fontSize: 36, color: suave }}>{s?.subtitulo || 'Reservá tu mesa'}</div>
        {logo || (marca && tieneMarca(marca)) ? (
          <div style={{ position: 'absolute', bottom: 34, display: 'flex', alignItems: 'center', fontSize: 26, color: suave }}>
            Reservas con
            <img src={risto} width={36} height={36} style={{ borderRadius: 9, margin: '0 10px 0 12px' }} />
            <div style={{ display: 'flex', fontWeight: 700, color: texto }}>Risto Suite</div>
          </div>
        ) : null}
      </div>
    ),
    { ...size },
  )
}
