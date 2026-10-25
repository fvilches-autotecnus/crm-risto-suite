'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { createBrowserClient } from '@supabase/ssr'

/**
 * Mantiene la lista de Vouchers al día: cuando se emite, se canjea, se anula o se borra un voucher del negocio
 * (el bot, n8n u otra persona del equipo) vuelve a cargar la pantalla sola. Solo está activo mientras se mira Vouchers.
 * Junta ráfagas (ej. una difusión que crea decenas de vouchers) en una sola recarga.
 */
export default function VouchersEnVivo({ negocioId }: { negocioId: string }) {
  const router = useRouter()

  useEffect(() => {
    const sb = createBrowserClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!)
    let activo = true
    let timer: ReturnType<typeof setTimeout> | null = null
    let canal: ReturnType<typeof sb.channel> | null = null
    let conectadoAntes = false
    const recargar = () => { if (timer) return; timer = setTimeout(() => { timer = null; if (activo) router.refresh() }, 600) }

    // Si el servidor rechaza la suscripción (pasa de forma transitoria al conectar) o se corta, reintenta solo.
    const escuchar = (intento = 1) => {
      const c = sb.channel(`vouchers-${negocioId}-${intento}`)
        .on('postgres_changes', { event: '*', schema: 'public', table: 'vouchers', filter: `negocio_id=eq.${negocioId}` }, recargar)
        .subscribe((estado) => {
          if (!activo) return
          if (estado === 'SUBSCRIBED') {
            if (conectadoAntes) recargar()   // volvió la conexión: trae lo que llegó mientras estuvo cortada
            conectadoAntes = true
            return
          }
          if (estado !== 'CHANNEL_ERROR' && estado !== 'TIMED_OUT') return
          void sb.removeChannel(c)
          setTimeout(() => { if (activo) escuchar(intento + 1) }, Math.min(1500 * intento, 15000))
        })
      canal = c
    }
    // Se conecta recién cuando la sesión del navegador está cargada: si no, Realtime lo toma como anónimo y rechaza la suscripción.
    void (async () => {
      const { data } = await sb.auth.getSession()
      if (!activo) return
      if (data.session) sb.realtime.setAuth(data.session.access_token)
      escuchar()
    })()

    return () => {
      activo = false
      if (timer) clearTimeout(timer)
      if (canal) void sb.removeChannel(canal)
    }
  }, [negocioId, router])

  return null
}
