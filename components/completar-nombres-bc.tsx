'use client'

import { useState } from 'react'
import { UserRoundCheck } from 'lucide-react'
import { completarNombresDeLaBase, completarNombresDesdeBotConversa } from '@/app/(panel)/clientes-actions'
import { useToast } from '@/components/feedback'
import { Spinner } from '@/components/ui'

/**
 * Botón de la lista de clientes: completa las fichas sin nombre real ("Sin nombre", solo símbolos, un teléfono…).
 * Primero con lo que ya hay en el CRM (reserva que hicieron, pedidos, reseña, perfil de WhatsApp del bot) y, si el negocio tiene BotConversa,
 * después con el nombre que tienen ahí (de a lotes: cada uno es una llamada al servidor).
 */
export default function CompletarNombresBC({ pendientes, conBotConversa }: { pendientes: number; conBotConversa: boolean }) {
  const toast = useToast()
  const [corriendo, setCorriendo] = useState(false)
  const [revisadas, setRevisadas] = useState(0)

  async function completar() {
    setCorriendo(true); setRevisadas(0)
    let desde: string | null = null
    let hechas = 0, completadas = 0, sinDato = 0, errores = 0
    let propios = 0
    try {
      const local = await completarNombresDeLaBase()
      if (!local.ok) { toast({ tipo: 'error', texto: local.error ?? 'No se pudo completar' }); return }
      propios = local.completados ?? 0
      let total = local.revisados ?? pendientes
      if (conBotConversa) {
        for (;;) {
          const r = await completarNombresDesdeBotConversa(desde)
          if (!r.ok) { toast({ tipo: 'error', texto: `${r.error ?? 'No se pudo completar'}${completadas + propios ? ` (ya se completaron ${completadas + propios})` : ''}` }); return }
          hechas += r.revisados; completadas += r.completados; sinDato += r.sinDato; errores += r.errores
          setRevisadas(hechas)
          if (r.hecho || !r.ultimo) break
          desde = r.ultimo
        }
      }
      const resto = [sinDato ? `${sinDato} sin nombre en BotConversa` : '', errores ? `${errores} sin respuesta de BotConversa` : ''].filter(Boolean).join(', ')
      const detalle = [propios ? `${propios} desde reservas, pedidos o reseñas` : '', completadas ? `${completadas} desde BotConversa` : ''].filter(Boolean).join(' y ')
      toast({ tipo: propios + completadas ? 'ok' : 'info', ms: 8000, texto: `Se completaron ${propios + completadas} de ${total} nombres${detalle ? ` (${detalle})` : ''}${resto ? `; ${resto}` : ''}.` })
    } catch {
      toast({ tipo: 'error', texto: 'No se pudo completar los nombres, probá de nuevo' })
    } finally {
      setCorriendo(false)
    }
  }

  return (
    <button type="button" onClick={completar} disabled={corriendo} className="btn whitespace-nowrap" title={`Completa el nombre de los ${pendientes} clientes sin nombre real con la reserva que hicieron${conBotConversa ? ', y si no, con su nombre en BotConversa' : ' o su perfil de WhatsApp'}`}>
      {corriendo ? <Spinner /> : <UserRoundCheck size={14} />}
      {corriendo ? (conBotConversa && revisadas ? `Buscando… ${revisadas}` : 'Completando…') : `Completar nombres (${pendientes})`}
    </button>
  )
}
