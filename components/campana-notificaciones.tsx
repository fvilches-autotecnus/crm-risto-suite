'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { AlertTriangle, Bell, CalendarPlus, CheckCheck, MessageCircleQuestion, ShoppingBag } from 'lucide-react'
import type { Notificacion, Notificaciones, TipoNotificacion } from '@/lib/notificaciones'

/** Evento que dispara AvisosEnVivo cuando llega algo nuevo: la campanita vuelve a pedir la lista. */
export const EVENTO_NOTIFICACIONES = 'rs:notificaciones'

const ICONO: Record<TipoNotificacion, { Icono: typeof Bell; color: string }> = {
  reserva: { Icono: CalendarPlus, color: 'bg-rs-lime/15 text-rs-lime' },
  consulta: { Icono: MessageCircleQuestion, color: 'bg-rs-lav/15 text-rs-lav' },
  reclamo: { Icono: AlertTriangle, color: 'bg-rs-danger/15 text-rs-danger' },
  pedido: { Icono: ShoppingBag, color: 'bg-rs-warn/15 text-rs-warn' },
}

/** "hace 5 min", "hace 3 h", "ayer", "hace 4 días". */
function hace(iso: string, ahora: number) {
  const min = Math.max(0, Math.round((ahora - new Date(iso).getTime()) / 60_000))
  if (min < 1) return 'recién'
  if (min < 60) return `hace ${min} min`
  const h = Math.round(min / 60)
  if (h < 24) return `hace ${h} h`
  const d = Math.round(h / 24)
  return d === 1 ? 'ayer' : `hace ${d} días`
}

const cantidad = (n: number) => (n > 99 ? '99+' : String(n))

export default function CampanaNotificaciones({ inicial }: { inicial: Notificaciones }) {
  const router = useRouter()
  const [datos, setDatos] = useState<Notificaciones>(inicial)
  const [abierta, setAbierta] = useState(false)
  const [soloSinLeer, setSoloSinLeer] = useState(false)
  const [ahora, setAhora] = useState(() => Date.now())
  const caja = useRef<HTMLDivElement>(null)
  const boton = useRef<HTMLButtonElement>(null)

  // OJO: `inicial` solo sirve para la primera imagen. Después manda lo que responde /api/notificaciones: si se volviera a copiar
  // `inicial` en cada router.refresh(), una lista vieja podía pisar lo que la persona acababa de marcar como leído.
  // (Al cambiar de negocio el layout le pone otra `key` y el componente arranca de cero.)

  // Si hay varios pedidos en vuelo (ej. abrir la campanita y marcar todas a la vez), vale solo la respuesta del último
  const ultimo = useRef(0)
  const pedir = useCallback(async (opciones?: RequestInit) => {
    const numero = ++ultimo.current
    try {
      const res = await fetch('/api/notificaciones', { cache: 'no-store', ...opciones })
      if (!res.ok || !res.headers.get('content-type')?.includes('application/json')) return   // sesión vencida u otro problema: se deja lo que había
      const nuevos = (await res.json()) as Notificaciones
      if (numero === ultimo.current) setDatos(nuevos)
    } catch { /* sin conexión: se deja lo que había */ }
  }, [])
  const enviar = useCallback((cuerpo: object) => pedir({ method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(cuerpo) }), [pedir])

  // Llegó algo nuevo (lo avisa AvisosEnVivo) o la persona volvió a esta pestaña: se actualiza la lista
  useEffect(() => {
    const alAvisar = () => void pedir()
    const alVolver = () => { if (!document.hidden) void pedir() }
    window.addEventListener(EVENTO_NOTIFICACIONES, alAvisar)
    document.addEventListener('visibilitychange', alVolver)
    return () => { window.removeEventListener(EVENTO_NOTIFICACIONES, alAvisar); document.removeEventListener('visibilitychange', alVolver) }
  }, [pedir])

  // Abierta: se refresca la lista, los "hace X min" se mantienen al día y se cierra con Escape o al tocar afuera
  useEffect(() => {
    if (!abierta) return
    void pedir()
    setAhora(Date.now())
    const reloj = setInterval(() => setAhora(Date.now()), 30_000)
    const alTeclear = (e: KeyboardEvent) => { if (e.key === 'Escape') { setAbierta(false); boton.current?.focus() } }
    const alTocar = (e: MouseEvent) => { if (caja.current && !caja.current.contains(e.target as Node)) setAbierta(false) }
    document.addEventListener('keydown', alTeclear)
    document.addEventListener('mousedown', alTocar)
    return () => { clearInterval(reloj); document.removeEventListener('keydown', alTeclear); document.removeEventListener('mousedown', alTocar) }
  }, [abierta, pedir])

  const abrir = (n: Notificacion) => {
    setAbierta(false)
    if (!n.leida) {
      setDatos((d) => ({ items: d.items.map((i) => (i.clave === n.clave ? { ...i, leida: true } : i)), sinLeer: Math.max(0, d.sinLeer - 1) }))
      void enviar({ accion: 'leer', claves: [n.clave] })
    }
    router.push(n.href)
  }
  const marcarTodas = () => {
    setDatos((d) => ({ items: d.items.map((i) => ({ ...i, leida: true })), sinLeer: 0 }))
    void enviar({ accion: 'todas' })
  }

  const lista = soloSinLeer ? datos.items.filter((i) => !i.leida) : datos.items
  const etiqueta = datos.sinLeer > 0 ? `Notificaciones, ${datos.sinLeer} sin leer` : 'Notificaciones'

  // En el celular el panel se ancla al encabezado entero (ocupa el ancho); desde "sm" cuelga de la campanita
  return (
    <div ref={caja} className="sm:relative">
      <button ref={boton} type="button" onClick={() => setAbierta((v) => !v)} aria-label={etiqueta} aria-haspopup="dialog" aria-expanded={abierta}
        className={'btn btn-sm relative h-8 w-8 px-0 ' + (abierta ? 'border-rs-lime/50 text-rs-lime' : '')}>
        <Bell size={15} className={datos.sinLeer > 0 ? 'text-rs-lime' : ''} />
        {datos.sinLeer > 0 && (
          <span aria-hidden className="absolute -right-1.5 -top-1.5 min-w-[18px] rounded-full bg-rs-lime px-1 text-center text-[10px] font-bold leading-[18px] text-rs-on-lime">{cantidad(datos.sinLeer)}</span>
        )}
      </button>

      {abierta && (
        <div role="dialog" aria-label="Notificaciones" className="absolute inset-x-4 top-full z-50 mt-2 animate-fade-in sm:inset-x-auto sm:right-0 sm:w-96 overflow-hidden rounded-rs-lg border border-rs-control bg-rs-header shadow-xl shadow-black/50">
          <div className="flex items-center justify-between gap-2 border-b border-rs-raised px-4 py-3">
            <p className="font-semibold">Notificaciones</p>
            <button type="button" onClick={marcarTodas} disabled={datos.sinLeer === 0} className="flex items-center gap-1 rounded-md px-2 py-1 text-xs font-semibold text-rs-lime transition hover:bg-rs-lime/10 disabled:pointer-events-none disabled:opacity-40">
              <CheckCheck size={14} /> Marcar todas como leídas
            </button>
          </div>
          <div className="flex gap-2 border-b border-rs-raised px-4 py-2">
            <button type="button" onClick={() => setSoloSinLeer(false)} aria-pressed={!soloSinLeer} className={'rounded-full border px-3 py-0.5 text-xs font-medium transition-colors ' + (!soloSinLeer ? 'border-rs-lime/60 bg-rs-lime/15 text-rs-lime' : 'border-rs-control text-rs-muted hover:bg-rs-raised')}>Todas</button>
            <button type="button" onClick={() => setSoloSinLeer(true)} aria-pressed={soloSinLeer} className={'rounded-full border px-3 py-0.5 text-xs font-medium transition-colors ' + (soloSinLeer ? 'border-rs-lime/60 bg-rs-lime/15 text-rs-lime' : 'border-rs-control text-rs-muted hover:bg-rs-raised')}>Sin leer{datos.sinLeer > 0 ? ` (${cantidad(datos.sinLeer)})` : ''}</button>
          </div>

          {lista.length === 0 ? (
            <div className="px-4 py-10 text-center">
              <Bell size={22} className="mx-auto text-rs-muted" />
              <p className="mt-2 text-sm font-medium">{soloSinLeer ? 'No tenés notificaciones sin leer' : 'Todavía no hay notificaciones'}</p>
              <p className="mt-0.5 text-xs text-rs-muted">{soloSinLeer ? 'Estás al día.' : 'Acá aparecen las reservas, consultas, reclamos y pedidos que van llegando (últimos 14 días).'}</p>
            </div>
          ) : (
            <ul className="max-h-[min(26rem,70vh)] overflow-y-auto">
              {lista.map((n) => {
                const { Icono, color } = ICONO[n.tipo]
                return (
                  <li key={n.clave} className="border-b border-rs-raised/70 last:border-0">
                    <button type="button" onClick={() => abrir(n)} className={'flex w-full items-start gap-3 px-4 py-3 text-left transition-colors hover:bg-rs-raised/60 ' + (n.leida ? '' : 'bg-rs-lime/[0.06]')}>
                      <span className={'mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full ' + color}><Icono size={16} /></span>
                      <span className="min-w-0 flex-1">
                        <span className="flex items-baseline justify-between gap-2">
                          <span className={'truncate text-sm ' + (n.leida ? 'font-medium text-rs-muted' : 'font-semibold')}>{n.titulo}</span>
                          <span className="shrink-0 text-[11px] text-rs-muted">{hace(n.creadoEn, ahora)}</span>
                        </span>
                        <span className={'mt-0.5 line-clamp-2 block text-xs ' + (n.leida ? 'text-rs-muted' : 'text-rs-text')}>{n.detalle}</span>
                        {n.sede && <span className="mt-1 block text-[11px] text-rs-muted">{n.sede}</span>}
                      </span>
                      {!n.leida && <span aria-label="Sin leer" className="mt-2 h-2 w-2 shrink-0 rounded-full bg-rs-lime" />}
                    </button>
                  </li>
                )
              })}
            </ul>
          )}
        </div>
      )}
    </div>
  )
}
