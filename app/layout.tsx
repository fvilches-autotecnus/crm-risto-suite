import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: 'RistoSuite · Portal CRM',
  description: 'Reservas, clientes y consultas de tu restaurante.',
  icons: { icon: '/logo.jpeg' },
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es">
      <body>{children}</body>
    </html>
  )
}
