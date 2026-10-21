import 'server-only'
import { createAdminClient } from '@/lib/supabase/server'

/**
 * Avisa por WhatsApp al cliente cuando el equipo confirma o cancela su reserva.
 * Delega el envío a un workflow de n8n por negocio (negocios.webhook_aviso_reserva_url).
 *
 * Es opcional y best-effort: sin TOQUE_STATUS_WEBHOOK_SECRET o sin URL cargada no se manda
 * nada (sin error), y si n8n está caído el cambio de estado igual queda guardado.
 */
export async function avisarCambioDeEstado(input: {
  negocioId: string
  telefono: string | null
  numero: number
  estado: 'confirmada' | 'cancelada'
  clienteNombre: string | null
  cantidadPersonas: number | null
  fecha: string | null
  hora: string | null
  motivoCancelacion?: string | null
}) {
  const secret = process.env.TOQUE_STATUS_WEBHOOK_SECRET
  if (!secret || !input.telefono) return

  const { negocioId, ...body } = input
  const { data: negocio } = await createAdminClient().from('negocios').select('webhook_aviso_reserva_url').eq('id', negocioId).maybeSingle()
  if (!negocio?.webhook_aviso_reserva_url) return

  try {
    const res = await fetch(negocio.webhook_aviso_reserva_url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-Toque-Secret': secret },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(8000),
    })
    if (!res.ok) console.error('[aviso reserva] el webhook respondió', res.status)
  } catch (e) {
    console.error('[aviso reserva] error llamando al webhook:', e)
  }
}
