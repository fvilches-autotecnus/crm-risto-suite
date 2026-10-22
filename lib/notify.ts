import 'server-only'
import { createAdminClient } from '@/lib/supabase/server'
import { ESTADOS_AVISO, ESTADOS_AVISO_POR_DEFECTO, type EstadoAviso } from '@/lib/reservas'

export interface ConfigAviso {
  /** El negocio tiene el webhook de aviso al cliente y el secreto para llamarlo. */
  disponible: boolean
  /** Estados que el webhook del negocio sabe tratar (se eligen en Configuración). */
  estados: EstadoAviso[]
}

/**
 * Configuración del aviso al cliente de un negocio.
 * El webhook (workflow de n8n por negocio) y su secreto se cargan en la base; el secreto puede ser por negocio
 * (negocios.webhook_secret) o el general del servidor (TOQUE_STATUS_WEBHOOK_SECRET).
 * Los estados avisables: por defecto solo confirmada y cancelada (lo que entienden los workflows actuales);
 * se amplía por negocio con modulos.avisos_estados cuando su workflow ya sabe tratar los demás.
 */
export async function configuracionAviso(negocioId: string): Promise<ConfigAviso> {
  const { data } = await createAdminClient().from('negocios').select('webhook_aviso_reserva_url, webhook_secret, modulos').eq('id', negocioId).maybeSingle()
  const secreto = data?.webhook_secret || process.env.TOQUE_STATUS_WEBHOOK_SECRET
  const elegidos = (data?.modulos as { avisos_estados?: unknown } | null)?.avisos_estados
  const estados = Array.isArray(elegidos) ? ESTADOS_AVISO.filter((e) => elegidos.includes(e)) : ESTADOS_AVISO_POR_DEFECTO
  return { disponible: !!data?.webhook_aviso_reserva_url && !!secreto, estados }
}

/**
 * Avisa por WhatsApp al cliente que su reserva cambió de estado (solo cuando la persona del equipo elige avisar).
 * Delega el envío al workflow de n8n del negocio. Si n8n está caído, el cambio de estado igual queda guardado.
 */
export async function avisarCambioDeEstado(input: {
  negocioId: string
  telefono: string | null
  numero: number
  estado: EstadoAviso
  clienteNombre: string | null
  cantidadPersonas: number | null
  fecha: string | null
  hora: string | null
  motivoCancelacion?: string | null
  monto?: number | null
}): Promise<'enviado' | 'no_disponible' | 'fallo'> {
  if (!input.telefono) return 'no_disponible'
  const { negocioId, ...body } = input
  const { data: negocio } = await createAdminClient().from('negocios').select('webhook_aviso_reserva_url, webhook_secret, modulos').eq('id', negocioId).maybeSingle()
  const secreto = negocio?.webhook_secret || process.env.TOQUE_STATUS_WEBHOOK_SECRET
  if (!negocio?.webhook_aviso_reserva_url || !secreto) return 'no_disponible'
  const elegidos = (negocio.modulos as { avisos_estados?: unknown } | null)?.avisos_estados
  const habilitados = Array.isArray(elegidos) ? elegidos : ESTADOS_AVISO_POR_DEFECTO
  if (!habilitados.includes(input.estado)) return 'no_disponible'

  try {
    const res = await fetch(negocio.webhook_aviso_reserva_url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-Toque-Secret': secreto },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(8000),
    })
    if (!res.ok) { console.error('[aviso reserva] el webhook respondió', res.status); return 'fallo' }
    return 'enviado'
  } catch (e) {
    console.error('[aviso reserva] error llamando al webhook:', e)
    return 'fallo'
  }
}
