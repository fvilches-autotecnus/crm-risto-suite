'use client'

import { useCallback, useEffect, useState, useTransition } from 'react'
import { BellRing, Download, Smartphone } from 'lucide-react'
import Modal from '@/components/modal'
import { useToast } from '@/components/feedback'
import { cambiarAvisosNegocio, enviarPrueba, guardarSuscripcion, quitarSuscripcion } from '@/app/(panel)/push-actions'

interface EventoInstalar extends Event { prompt: () => Promise<void>; userChoice: Promise<{ outcome: string }> }

const aBytes = (b64: string) => {
  const pad = '='.repeat((4 - (b64.length % 4)) % 4)
  const raw = atob((b64 + pad).replace(/-/g, '+').replace(/_/g, '/'))
  return Uint8Array.from(raw, (c) => c.charCodeAt(0))
}
const aTexto = (buf: ArrayBuffer | null) => (buf ? btoa(String.fromCharCode(...new Uint8Array(buf))).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '') : '')
const nombreDispositivo = () => {
  const ua = navigator.userAgent
  const so = /iPhone|iPad/.test(ua) ? 'iPhone/iPad' : /Android/.test(ua) ? 'Android' : /Windows/.test(ua) ? 'Windows' : /Mac OS/.test(ua) ? 'Mac' : /Linux/.test(ua) ? 'Linux' : 'Dispositivo'
  const nav = /Edg\//.test(ua) ? 'Edge' : /OPR\//.test(ua) ? 'Opera' : /Chrome\//.test(ua) ? 'Chrome' : /Firefox\//.test(ua) ? 'Firefox' : /Safari\//.test(ua) ? 'Safari' : 'navegador'
  return `${so} · ${nav}`
}

/**
 * App instalable + avisos push (solo superadmin): instalar el CRM como aplicación, activar los avisos en este dispositivo
 * (reservas y pedidos nuevos, aunque el CRM esté cerrado) y elegir de qué negocios se reciben.
 */
export default function AvisosPush({ negocios, apagadosInicial, clavePublica, listo }: { negocios: { id: string; nombre: string }[]; apagadosInicial: string[]; clavePublica: string; listo: boolean }) {
  const toast = useToast()
  const [abierto, setAbierto] = useState(false)
  const [soporta, setSoporta] = useState<boolean | null>(null)
  const [permiso, setPermiso] = useState<NotificationPermission>('default')
  const [activo, setActivo] = useState(false)          // este dispositivo tiene una suscripción
  const [instalada, setInstalada] = useState(false)    // el CRM corre como app (pantalla de inicio / ventana propia)
  const [esIos, setEsIos] = useState(false)
  const [instalar, setInstalar] = useState<EventoInstalar | null>(null)
  const [apagados, setApagados] = useState<Set<string>>(() => new Set(apagadosInicial))
  const [pending, start] = useTransition()

  const leerEstado = useCallback(async () => {
    const ok = 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window
    setSoporta(ok)
    setInstalada(window.matchMedia('(display-mode: standalone)').matches || (navigator as unknown as { standalone?: boolean }).standalone === true)
    setEsIos(/iPhone|iPad|iPod/.test(navigator.userAgent))
    if (!ok) return
    setPermiso(Notification.permission)
    try {
      const reg = await navigator.serviceWorker.getRegistration('/sw.js')
      const sub = await reg?.pushManager.getSubscription()
      setActivo(!!sub)
      // si el navegador renovó la suscripción por su cuenta, la base se actualiza sola
      if (sub && Notification.permission === 'granted') void guardarSuscripcion({ endpoint: sub.endpoint, p256dh: aTexto(sub.getKey('p256dh')), auth: aTexto(sub.getKey('auth')), dispositivo: nombreDispositivo() })
    } catch { /* sin estado */ }
  }, [])

  useEffect(() => {
    void leerEstado()
    // El service worker se registra siempre (también hace falta para instalar la app)
    if ('serviceWorker' in navigator) void navigator.serviceWorker.register('/sw.js', { scope: '/' }).catch(() => undefined)
    const alOfrecer = (e: Event) => { e.preventDefault(); setInstalar(e as EventoInstalar) }
    const alInstalar = () => { setInstalar(null); setInstalada(true) }
    window.addEventListener('beforeinstallprompt', alOfrecer)
    window.addEventListener('appinstalled', alInstalar)
    return () => { window.removeEventListener('beforeinstallprompt', alOfrecer); window.removeEventListener('appinstalled', alInstalar) }
  }, [leerEstado])

  const activar = () => start(async () => {
    try {
      const p = await Notification.requestPermission()
      setPermiso(p)
      if (p !== 'granted') { toast({ tipo: 'error', texto: 'El navegador no dio permiso para mostrar notificaciones. Se cambia desde los ajustes del sitio.' }); return }
      const reg = (await navigator.serviceWorker.getRegistration('/sw.js')) ?? (await navigator.serviceWorker.register('/sw.js', { scope: '/' }))
      await navigator.serviceWorker.ready
      const sub = (await reg.pushManager.getSubscription()) ?? (await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: aBytes(clavePublica) }))
      const r = await guardarSuscripcion({ endpoint: sub.endpoint, p256dh: aTexto(sub.getKey('p256dh')), auth: aTexto(sub.getKey('auth')), dispositivo: nombreDispositivo() })
      if (!r.ok) { await sub.unsubscribe().catch(() => undefined); toast({ tipo: 'error', texto: r.error ?? 'No se pudo activar' }); return }
      setActivo(true)
      toast({ texto: 'Avisos activados en este dispositivo' })
    } catch { toast({ tipo: 'error', texto: 'No se pudieron activar los avisos en este dispositivo' }) }
  })

  const desactivar = () => start(async () => {
    try {
      const reg = await navigator.serviceWorker.getRegistration('/sw.js')
      const sub = await reg?.pushManager.getSubscription()
      if (sub) { await quitarSuscripcion(sub.endpoint); await sub.unsubscribe() }
      setActivo(false)
      toast({ texto: 'Avisos desactivados en este dispositivo' })
    } catch { toast({ tipo: 'error', texto: 'No se pudieron desactivar los avisos' }) }
  })

  const probar = () => start(async () => {
    const r = await enviarPrueba()
    toast(r.ok ? { texto: 'Prueba enviada: debería llegarte una notificación' } : { tipo: 'error', texto: r.error ?? 'No se pudo enviar la prueba' })
  })

  const alternar = (id: string, encendido: boolean) => {
    const antes = apagados
    const nuevo = new Set(apagados); if (encendido) nuevo.delete(id); else nuevo.add(id)
    setApagados(nuevo)
    start(async () => {
      const r = await cambiarAvisosNegocio(id, encendido)
      if (!r.ok) { setApagados(antes); toast({ tipo: 'error', texto: r.error ?? 'No se pudo guardar el cambio' }) }
    })
  }
  const todos = (encendido: boolean) => negocios.forEach((n) => { if (apagados.has(n.id) === encendido) alternar(n.id, encendido) })

  const instalarApp = async () => {
    if (!instalar) return
    await instalar.prompt()
    await instalar.userChoice.catch(() => undefined)
    setInstalar(null)
  }

  // Los iPhone solo reciben avisos desde la app instalada en la pantalla de inicio
  const faltaInstalarIos = esIos && !instalada
  const encendidos = negocios.length - negocios.filter((n) => apagados.has(n.id)).length

  return (
    <>
      <button type="button" onClick={() => setAbierto(true)} title="App y avisos en el celular" aria-label="App y avisos en el celular" className={'relative rounded-md p-1.5 transition hover:bg-rs-raised ' + (activo ? 'text-rs-lime' : 'text-rs-muted hover:text-rs-text')}>
        <Smartphone size={18} />
        {activo && <span className="absolute right-0.5 top-0.5 h-2 w-2 rounded-full bg-rs-lime" aria-hidden />}
      </button>
      {abierto && (
        <Modal titulo="App y avisos en el celular" onClose={() => setAbierto(false)} ancho="max-w-xl">
          <div className="space-y-5 text-sm">
            {!listo && <p className="rounded-md border border-rs-warn/40 bg-rs-warn/10 p-3 text-rs-warn">Los avisos todavía no están habilitados en el servidor. Cuando estén, se activan desde acá.</p>}

            <section className="space-y-2">
              <h3 className="font-semibold">1 · Instalar la app</h3>
              {instalada ? <p className="text-rs-muted">Ya estás usando el CRM como aplicación.</p>
                : instalar ? <button type="button" onClick={instalarApp} className="btn btn-sm"><Download size={14} /> Instalar RistoSuite</button>
                : esIos ? <p className="text-rs-muted">En iPhone: tocá <b>Compartir</b> en Safari y elegí <b>Agregar a pantalla de inicio</b>. Después abrí la app desde ese ícono y volvé acá.</p>
                : <p className="text-rs-muted">Desde el menú del navegador elegí <b>Instalar app</b> (o <b>Agregar a pantalla de inicio</b>). Si no aparece la opción, ya puede estar instalada.</p>}
            </section>

            <section className="space-y-2">
              <h3 className="font-semibold">2 · Avisos de este dispositivo</h3>
              <p className="text-rs-muted">Llega una notificación por cada reserva o pedido nuevo, aunque el CRM esté cerrado. Si lo tenés abierto y a la vista, se sigue viendo el aviso en pantalla.</p>
              {soporta === false ? <p className="text-rs-warn">Este navegador no admite notificaciones push.</p>
                : faltaInstalarIos ? <p className="text-rs-warn">En iPhone hay que instalar primero la app (paso 1).</p>
                : permiso === 'denied' ? <p className="text-rs-danger">Las notificaciones están bloqueadas para este sitio: se habilitan desde los ajustes del navegador.</p>
                : activo ? (
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="inline-flex items-center gap-1.5 rounded-full bg-rs-lime/15 px-2.5 py-1 text-xs text-rs-lime"><BellRing size={13} /> Activados</span>
                    <button type="button" onClick={probar} disabled={pending || !listo} className="btn btn-sm">Enviar prueba</button>
                    <button type="button" onClick={desactivar} disabled={pending} className="btn btn-sm">Desactivar</button>
                  </div>
                ) : <button type="button" onClick={activar} disabled={pending || !listo || soporta === null} className="btn btn-sm"><BellRing size={14} /> Activar avisos</button>}
            </section>

            <section className="space-y-2">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <h3 className="font-semibold">3 · Negocios que avisan <span className="font-normal text-rs-muted">({encendidos} de {negocios.length})</span></h3>
                <div className="flex gap-2 text-xs">
                  <button type="button" onClick={() => todos(true)} disabled={pending} className="text-rs-lime hover:underline">Encender todos</button>
                  <button type="button" onClick={() => todos(false)} disabled={pending} className="text-rs-muted hover:underline">Apagar todos</button>
                </div>
              </div>
              <ul className="max-h-64 divide-y divide-rs-border overflow-y-auto rounded-md border border-rs-border">
                {negocios.map((n) => {
                  const encendido = !apagados.has(n.id)
                  return (
                    <li key={n.id}>
                      <label className="flex cursor-pointer items-center justify-between gap-3 px-3 py-2 hover:bg-rs-raised/50">
                        <span className={encendido ? '' : 'text-rs-muted'}>{n.nombre}</span>
                        <input type="checkbox" role="switch" checked={encendido} onChange={(e) => alternar(n.id, e.target.checked)} className="h-4 w-4 accent-[rgb(var(--rs-lime))]" />
                      </label>
                    </li>
                  )
                })}
              </ul>
              <p className="text-xs text-rs-muted">Vale para todos tus dispositivos. Un negocio nuevo empieza encendido.</p>
            </section>
          </div>
        </Modal>
      )}
    </>
  )
}
