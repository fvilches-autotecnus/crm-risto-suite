/** @type {import('next').NextConfig} */
const nextConfig = {
  // las fotos de la carta se achican en el navegador antes de subir; el tope deja margen para el formulario
  experimental: { serverActions: { bodySizeLimit: '4mb' } },
}
export default nextConfig
