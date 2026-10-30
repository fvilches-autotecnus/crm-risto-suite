import { NextResponse, type NextRequest } from 'next/server'
import { getContexto } from '@/lib/context'
import { cargarNotificaciones, marcarLeidas, marcarTodasLeidas } from '@/lib/notificaciones'

export const dynamic = 'force-dynamic'
const SIN_CACHE = { 'Cache-Control': 'no-store' }

/** Lista de la campanita del usuario con sesión iniciada (sin sesión, el proxy ya lo manda a /login). */
export async function GET() {
  const ctx = await getContexto()
  return NextResponse.json(await cargarNotificaciones(ctx), { headers: SIN_CACHE })
}

/** { accion: 'leer', claves: string[] } marca esos avisos; { accion: 'todas' } marca todo. Devuelve la lista ya actualizada. */
export async function POST(req: NextRequest) {
  // Solo se acepta JSON enviado por la propia página (un formulario de otro sitio no puede fijar este tipo de contenido)
  if (!req.headers.get('content-type')?.includes('application/json')) return NextResponse.json({ error: 'formato' }, { status: 415, headers: SIN_CACHE })
  const cuerpo = (await req.json().catch(() => null)) as { accion?: string; claves?: unknown } | null
  const ctx = await getContexto()
  if (cuerpo?.accion === 'todas') await marcarTodasLeidas(ctx)
  else if (cuerpo?.accion === 'leer' && Array.isArray(cuerpo.claves)) await marcarLeidas(ctx, cuerpo.claves.filter((c): c is string => typeof c === 'string'))
  else return NextResponse.json({ error: 'accion' }, { status: 400, headers: SIN_CACHE })
  return NextResponse.json(await cargarNotificaciones(ctx), { headers: SIN_CACHE })
}
