'use client'

import { useState } from 'react'
import { UserRoundCheck } from 'lucide-react'
import { completarNombresDesdeBotConversa } from '@/app/(panel)/clientes-actions'
import { useToast } from '@/components/feedback'
import { Spinner } from '@/components/ui'

/**
 * Botón de la lista de clientes: completa las fichas que dicen "Sin nombre" con el nombre que tienen en BotConversa.
 * Trabaja de a lotes (cada uno es una llamada al servidor) y muestra cuántas lleva revisadas.
 */
export default function CompletarNombresBC({ pendientes }: { pendientes: number }) {
  const toast = useToast()
  const [corriendo, setCorriendo] = useState(false)
  const [revisadas, setRevisadas] = useState(0)

  async function completar() {
    setCorriendo(true); setRevisadas(0)
    let desde: string | null = null
    let total = pendientes, hechas = 0, completadas = 0, sinDato = 0, errores = 0
    try {
      for (;;) {
        const r = await completarNombresDesdeBotConversa(desde)
        if (!r.ok) { toast({ tipo: 'error', texto: `${r.error ?? 'No se pudo completar'}${completadas ? ` (ya se completaron ${completadas})` : ''}` }); return }
        if (r.total !== undefined) total = r.total
        hechas += r.revisados; completadas += r.completados; sinDato += r.sinDato; errores += r.errores
        setRevisadas(hechas)
        if (r.hecho || !r.ultimo) break
        desde = r.ultimo
      }
      const resto = [sinDato ? `${sinDato} sin nombre en BotConversa` : '', errores ? `${errores} sin respuesta de BotConversa` : ''].filter(Boolean).join(', ')
      toast({ tipo: completadas ? 'ok' : 'info', ms: 7000, texto: `Se completaron ${completadas} de ${total} nombres${resto ? ` (${resto})` : ''}.` })
    } catch {
      toast({ tipo: 'error', texto: 'No se pudo completar los nombres, probá de nuevo' })
    } finally {
      setCorriendo(false)
    }
  }

  return (
    <button type="button" onClick={completar} disabled={corriendo} className="btn whitespace-nowrap" title={`Busca en BotConversa el nombre de los ${pendientes} clientes que figuran como “Sin nombre”`}>
      {corriendo ? <Spinner /> : <UserRoundCheck size={14} />}
      {corriendo ? `Buscando… ${revisadas}/${pendientes}` : `Completar nombres (${pendientes})`}
    </button>
  )
}
