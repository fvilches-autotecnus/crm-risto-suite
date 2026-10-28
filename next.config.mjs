// Dominio donde corre este CRM. En producción los archivos (estilos, scripts, fuentes) se piden con dirección completa:
// así el sitio de reservas se puede publicar también en otro dominio (por ejemplo reservas.ristosuite.app/<dirección>)
// con una regla de "rewrite" hacia /reservar/<dirección>, y sigue viéndose y funcionando igual.
const DOMINIO = process.env.CRM_ORIGEN ?? 'https://crm.ristosuite.app'
const prefijo = process.env.ASSET_PREFIX || (process.env.VERCEL_ENV === 'production' ? DOMINIO : undefined)

/** @type {import('next').NextConfig} */
const nextConfig = {
  assetPrefix: prefijo,
  // las fotos de la carta se achican en el navegador antes de subir; el tope deja margen para el formulario
  experimental: { serverActions: { bodySizeLimit: '4mb', allowedOrigins: ['reservas.ristosuite.app'] } },
}
export default nextConfig
