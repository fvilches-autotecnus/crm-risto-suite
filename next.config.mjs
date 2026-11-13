// Dominio donde corre este CRM. En producción los archivos (estilos, scripts, fuentes) se piden con dirección completa:
// así el sitio de reservas se puede publicar también en otro dominio (por ejemplo reservas.ristosuite.app/<dirección>)
// con una regla de "rewrite" hacia /reservar/<dirección>, y sigue viéndose y funcionando igual.
const DOMINIO = process.env.CRM_ORIGEN ?? 'https://crm.ristosuite.app'
const prefijo = process.env.ASSET_PREFIX || (process.env.VERCEL_ENV === 'production' ? DOMINIO : undefined)

const dev = process.env.NODE_ENV !== 'production'

// Política de contenido en modo "solo reporte": el navegador avisa en consola lo que bloquearía, pero no bloquea nada.
// (Next necesita scripts y estilos "inline" para hidratar la página; los archivos pueden venir del dominio del CRM.)
const csp = () => [
  "default-src 'self'",
  `script-src 'self' 'unsafe-inline'${dev ? " 'unsafe-eval'" : ''} ${DOMINIO}`,
  `style-src 'self' 'unsafe-inline' ${DOMINIO}`,
  `img-src 'self' data: blob: https:`,
  `font-src 'self' data: ${DOMINIO}`,
  `connect-src 'self' ${DOMINIO} https://*.supabase.co wss://*.supabase.co${dev ? ' ws:' : ''}`,
  "media-src 'self' data: blob:",
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'self'",
].join('; ')

const comunes = [
  { key: 'X-Content-Type-Options', value: 'nosniff' },
  { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
  { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=(), payment=(), usb=(), interest-cohort=()' },
]

/** @type {import('next').NextConfig} */
const nextConfig = {
  assetPrefix: prefijo,
  poweredByHeader: false,
  async headers() {
    return [
      { source: '/:path*', headers: [...comunes, { key: 'Content-Security-Policy-Report-Only', value: csp() }] },
      // el service worker nunca se guarda en caché: así una versión nueva se toma enseguida
      { source: '/sw.js', headers: [{ key: 'Cache-Control', value: 'no-cache, no-store, must-revalidate' }, { key: 'Content-Type', value: 'application/javascript; charset=utf-8' }] },
      // el panel no se puede incrustar en otro sitio (anti-clickjacking). Los sitios públicos (reservas, carta, shows) sí pueden mostrarse
      // dentro de la web del local, y los dominios cortos (reservas./carta.) tampoco llevan esta regla porque solo aplica al dominio del CRM.
      { source: '/((?!reservar/|carta/|shows/).*)', has: [{ type: 'host', value: new URL(DOMINIO).hostname }], headers: [{ key: 'X-Frame-Options', value: 'DENY' }] },
    ]
  },

  // las fotos de la carta se achican en el navegador antes de subir; el tope deja margen para el formulario
  experimental: { serverActions: { bodySizeLimit: '4mb', allowedOrigins: ['reservas.ristosuite.app', 'pedidos.ristosuite.app'] } },
}
export default nextConfig
