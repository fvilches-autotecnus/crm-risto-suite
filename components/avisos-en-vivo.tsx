'use client'

import { useEffect, useRef } from 'react'
import { usePathname, useRouter } from 'next/navigation'
import { createBrowserClient } from '@supabase/ssr'
import { useToast } from '@/components/feedback'

interface FilaReserva { id: string; numero: number; cliente_nombre: string | null; cantidad_personas: number | null; fecha: string | null; hora: string | null; sucursal_id: string | null; es_manual: boolean; estado: string }
interface FilaConsulta { id: string; telefono: string | null; nombre?: string | null; mensaje: string | null; tipo: string; sucursal_id: string | null }
interface FilaPedido { id: string; numero: number; nombre: string; tipo: string; total: number }
type Evento = { tipo: 'reserva'; fila: FilaReserva } | { tipo: 'consulta'; fila: FilaConsulta } | { tipo: 'pedido'; fila: FilaPedido }

/** Aviso sonoro corto para un pedido nuevo (si el navegador todavía no permite audio, no pasa nada). */
const sonar = () => { try { const A = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext; const c = new A(); const o = c.createOscillator(), g = c.createGain(); o.connect(g); g.connect(c.destination); o.frequency.value = 880; g.gain.setValueAtTime(0.15, c.currentTime); g.gain.exponentialRampToValueAtTime(0.0001, c.currentTime + 0.5); o.start(); o.stop(c.currentTime + 0.5); setTimeout(() => void c.close(), 700) } catch { /* sin audio */ } }
const corto = (t: string | null, n: number) => { const s = (t ?? '').replace(/\s+/g, ' ').trim(); return s.length > n ? s.slice(0, n - 1) + '…' : s }
const diaMes = (f: string | null) => (f ? `${f.slice(8, 10)}/${f.slice(5, 7)}` : 'a coordinar')

/** Páginas que se actualizan solas cuando llega algo nuevo (sin recargar). */
const REFRESCAR = ['/', '/reservas', '/consultas', '/clientes', '/metricas']

/**
 * Avisos en tiempo real: cuando entra una reserva nueva (la toma el bot) o una consulta / reclamo,
 * aparece un aviso con acceso directo, se actualiza la pantalla abierta y, si la pestaña está en segundo plano,
 * se muestra la cantidad de novedades en el título.
 */
export default function AvisosEnVivo({ negocioId, sedes, pedidos = false }: { negocioId: string; sedes: Record<string, string>; pedidos?: boolean }) {
  const toast = useToast()
  const router = useRouter()
  const pathname = usePathname()
  const ruta = useRef(pathname)
  ruta.current = pathname

  useEffect(() => {
    const titulo = document.title.replace(/^\(\d+\)\s*/, '')
    let sinLeer = 0
    const alVolver = () => { if (!document.hidden) { sinLeer = 0; document.title = titulo } }
    document.addEventListener('visibilitychange', alVolver)

    const cola: Evento[] = []
    let timer: ReturnType<typeof setTimeout> | null = null
    const nombreSede = (id: string | null) => (id && sedes[id] ? ` · ${sedes[id]}` : '')

    const mostrar = () => {
      timer = null
      const lote = cola.splice(0)
      if (!lote.length) return
      if (lote.length <= 3) {
        for (const e of lote) {
          if (e.tipo === 'reserva') {
            const r = e.fila
            toast({ tipo: 'info', ms: 12000, texto: `Nueva reserva #${r.numero} · ${r.cliente_nombre ?? 'Sin nombre'}${r.cantidad_personas ? ` · ${r.cantidad_personas} personas` : ''} · ${diaMes(r.fecha)}${r.hora ? ' ' + r.hora.slice(0, 5) : ''}${nombreSede(r.sucursal_id)}`, accion: { label: 'Ver', onClick: () => router.push('/reservas?rango=todas') } })
          } else if (e.tipo === 'pedido') {
            const p = e.fila
            toast({ tipo: 'info', ms: 15000, texto: `Nuevo pedido #${p.numero} · ${p.tipo === 'delivery' ? 'Delivery' : p.tipo === 'mesa' ? 'Mesa' : 'Retiro'} · ${p.nombre} · $ ${Number(p.total).toLocaleString('es-AR')}`, accion: { label: 'Ver', onClick: () => router.push('/pedidos') } })
          } else {
            const c = e.fila, reclamo = c.tipo === 'reclamo'
            toast({ tipo: reclamo ? 'error' : 'info', ms: 12000, texto: `${reclamo ? 'Nuevo reclamo' : 'Nueva consulta'}${c.nombre || c.telefono ? ' · ' + (c.nombre ?? c.telefono) : ''}${nombreSede(c.sucursal_id)}${c.mensaje ? ` · “${corto(c.mensaje, 70)}”` : ''}`, accion: { label: 'Ver', onClick: () => router.push('/consultas?estado=pendiente') } })
          }
        }
      } else {
        const res = lote.filter((e) => e.tipo === 'reserva').length, ped = lote.filter((e) => e.tipo === 'pedido').length, con = lote.length - res - ped
        toast({ tipo: 'info', ms: 12000, texto: `Llegaron ${lote.length} registros nuevos${res ? ` · ${res} reserva${res > 1 ? 's' : ''}` : ''}${con ? ` · ${con} consulta${con > 1 ? 's' : ''} o reclamo${con > 1 ? 's' : ''}` : ''}`, accion: { label: 'Ver', onClick: () => router.push(res >= con ? '/reservas?rango=todas' : '/consultas?estado=pendiente') } })
      }
      if (document.hidden) { sinLeer += lote.length; document.title = `(${sinLeer}) ${titulo}` }
      if (lote.some((e) => e.tipo === 'pedido')) sonar()
      if (REFRESCAR.includes(ruta.current)) router.refresh()
    }
    const encolar = (e: Evento) => { cola.push(e); if (!timer) timer = setTimeout(mostrar, 1200) }   // junta ráfagas (ej. una importación) en un solo aviso

    const sb = createBrowserClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!)
    let activo = true
    const canales = new Set<ReturnType<typeof sb.channel>>()

    // Un canal por tabla; si el servidor lo rechaza (pasa de forma transitoria al conectar) o se corta, se reintenta solo.
    const escuchar = (tabla: 'reservas' | 'consultas_reclamos' | 'pedidos', alRecibir: (fila: Record<string, unknown>) => void, intento = 1) => {
      const canal = sb.channel(`avisos-${tabla}-${negocioId}-${intento}`)
        .on('postgres_changes', { event: 'INSERT', schema: 'public', table: tabla, filter: `negocio_id=eq.${negocioId}` }, (p) => alRecibir(p.new))
        .subscribe((estado) => {
          if (!activo || (estado !== 'CHANNEL_ERROR' && estado !== 'TIMED_OUT')) return
          canales.delete(canal); void sb.removeChannel(canal)
          setTimeout(() => { if (activo) escuchar(tabla, alRecibir, intento + 1) }, Math.min(1500 * intento, 15000))
        })
      canales.add(canal)
    }
    // Se conecta recién cuando la sesión del navegador está cargada: si no, Realtime lo toma como anónimo y rechaza la suscripción.
    void (async () => {
      const { data } = await sb.auth.getSession()
      if (!activo) return
      if (data.session) sb.realtime.setAuth(data.session.access_token)
      escuchar('reservas', (f) => {
        const fila = f as unknown as FilaReserva
        if (fila.es_manual) return   // las que carga una persona desde el CRM no se avisan: ya las está viendo
        encolar({ tipo: 'reserva', fila })
      })
      escuchar('consultas_reclamos', (f) => encolar({ tipo: 'consulta', fila: f as unknown as FilaConsulta }))
      if (pedidos) escuchar('pedidos', (f) => encolar({ tipo: 'pedido', fila: f as unknown as FilaPedido }))
    })()

    return () => {
      activo = false
      if (timer) clearTimeout(timer)
      document.removeEventListener('visibilitychange', alVolver)
      document.title = titulo
      canales.forEach((c) => void sb.removeChannel(c))
    }
  }, [negocioId, pedidos]) // eslint-disable-line react-hooks/exhaustive-deps

  return null
}
