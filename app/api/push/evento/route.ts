import { timingSafeEqual } from 'node:crypto'
import { NextResponse, type NextRequest } from 'next/server'
import { armarAviso, destinatarios, enviarAviso, type TablaPush } from '@/lib/push'
import { UUID } from '@/lib/validar'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
const SIN_CACHE = { 'Cache-Control': 'no-store' }

/** Comparación en tiempo constante del secreto compartido con la base. */
function secretoValido(recibido: string | null): boolean {
  const esperado = process.env.PUSH_WEBHOOK_SECRET
  if (!esperado || !recibido) return false
  const a = Buffer.from(recibido), b = Buffer.from(esperado)
  return a.length === b.length && timingSafeEqual(a, b)
}

/**
 * Lo llama la base (trigger → pg_net) cuando entra una reserva o un pedido: { tabla: 'reservas' | 'pedidos', id }.
 * No lleva sesión (el proxy no la pide acá): se autentica con el secreto compartido en el encabezado x-push-secret.
 * Del cuerpo solo se toma el id: el texto del aviso sale de lo guardado en la base, no de lo que diga quien llama.
 */
export async function POST(req: NextRequest) {
  if (!process.env.PUSH_WEBHOOK_SECRET) return NextResponse.json({ error: 'sin_configurar' }, { status: 503, headers: SIN_CACHE })
  if (!secretoValido(req.headers.get('x-push-secret'))) return NextResponse.json({ error: 'no_autorizado' }, { status: 401, headers: SIN_CACHE })
  const cuerpo = (await req.json().catch(() => null)) as { tabla?: unknown; id?: unknown } | null
  const tabla = cuerpo?.tabla, id = cuerpo?.id
  if ((tabla !== 'reservas' && tabla !== 'pedidos') || typeof id !== 'string' || !UUID.test(id)) return NextResponse.json({ error: 'datos' }, { status: 400, headers: SIN_CACHE })

  try {
    const armado = await armarAviso(tabla as TablaPush, id)
    if (!armado) return NextResponse.json({ enviados: 0, motivo: 'no_corresponde' }, { headers: SIN_CACHE })
    const subs = await destinatarios(armado.negocioId)
    const enviados = await enviarAviso(subs, armado.aviso)
    return NextResponse.json({ enviados, destinatarios: subs.length }, { headers: SIN_CACHE })
  } catch {
    return NextResponse.json({ error: 'fallo' }, { status: 500, headers: SIN_CACHE })
  }
}
