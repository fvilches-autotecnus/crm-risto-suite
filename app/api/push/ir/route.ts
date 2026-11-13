import { cookies } from 'next/headers'
import { NextResponse, type NextRequest } from 'next/server'
import { getContexto, NEGOCIO_COOKIE, SEDE_COOKIE } from '@/lib/context'
import { UUID } from '@/lib/validar'

export const dynamic = 'force-dynamic'

/** Adónde lleva cada aviso push: una lista fija (nunca una dirección que venga en el enlace). */
const DESTINOS: Record<string, string> = { reservas: '/reservas?rango=todas', pedidos: '/pedidos' }

/**
 * Al tocar una notificación push: cambia al negocio del aviso (si la persona tiene acceso) y abre la pantalla correspondiente.
 * Sin sesión, el proxy manda primero a /login.
 */
export async function GET(req: NextRequest) {
  const ctx = await getContexto()
  const negocio = req.nextUrl.searchParams.get('n') ?? ''
  const destino = DESTINOS[req.nextUrl.searchParams.get('a') ?? ''] ?? '/'
  if (UUID.test(negocio) && ctx.negocios.some((n) => n.id === negocio) && negocio !== ctx.negocio.id) {
    const jar = await cookies()
    jar.set(NEGOCIO_COOKIE, negocio, { path: '/', httpOnly: true, sameSite: 'lax', maxAge: 60 * 60 * 24 * 365 })
    jar.delete(SEDE_COOKIE)   // la sede elegida era del otro negocio
  }
  return NextResponse.redirect(new URL(destino, req.url), { headers: { 'Cache-Control': 'no-store' } })
}
