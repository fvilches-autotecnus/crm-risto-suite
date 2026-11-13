import { Suspense } from 'react'
import type { Metadata } from 'next'
import Image from 'next/image'
import { LogOut } from 'lucide-react'
import BarraProgreso from '@/components/barra-progreso'
import BotToggle from '@/components/bot-toggle'
import AvisosEnVivo from '@/components/avisos-en-vivo'
import AvisosPush from '@/components/avisos-push'
import { FeedbackProvider } from '@/components/feedback'
import Nav from '@/components/nav'
import NegocioSelect from '@/components/negocio-select'
import SedeSelect from '@/components/sede-select'
import { getContexto } from '@/lib/context'
import CampanaNotificaciones from '@/components/campana-notificaciones'
import { cargarNotificaciones } from '@/lib/notificaciones'
import { contarPausados } from '@/lib/pausados'
import { AvisoComandera, ComanderaProvider } from '@/components/comandera-auto'

/** App instalable (manifest, ícono de iPhone): por ahora solo para superadmin; el resto del panel no ofrece instalarla. */
export async function generateMetadata(): Promise<Metadata> {
  const ctx = await getContexto()
  if (!ctx.esSuperadmin) return {}
  return {
    manifest: '/manifest.webmanifest',
    appleWebApp: { capable: true, title: 'RistoSuite', statusBarStyle: 'black-translucent' },
    icons: { icon: process.env.VERCEL_ENV === 'production' ? 'https://crm.ristosuite.app/logo.jpeg' : '/logo.jpeg', apple: '/icons/apple-touch-icon.png' },
  }
}

/** La impresión automática de pedidos vive acá, en el layout, para que imprima desde cualquier pantalla del panel y no solo desde Pedidos. */
function ConImpresion({ activa, desde, negocio, negocioId, puedeEscribir, children }: { activa: boolean; desde: string | null; negocio: string; negocioId: string; puedeEscribir: boolean; children: React.ReactNode }) {
  if (!activa) return <>{children}</>
  return <ComanderaProvider key={negocioId} negocio={negocio} negocioId={negocioId} desdeInicial={desde} puedeEscribir={puedeEscribir}>{children}<AvisoComandera /></ComanderaProvider>
}

export default async function PanelLayout({ children }: { children: React.ReactNode }) {
  const ctx = await getContexto()
  const clavePush = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY ?? ''
  const [pausados, notificaciones, cfgImpresion, apagadosPush] = await Promise.all([
    ctx.puedeApagarBot ? contarPausados(ctx) : 0,   // chats que el bot dejó esperando a una persona
    cargarNotificaciones(ctx),
    ctx.modulosActivos.pedidos ? ctx.supabase.from('pedidos_config').select('comandera_desde').eq('negocio_id', ctx.negocio.id).maybeSingle() : Promise.resolve(null),   // interruptor de la impresión automática
    ctx.esSuperadmin ? ctx.supabase.from('push_negocios_apagados').select('negocio_id').eq('usuario_id', ctx.userId) : Promise.resolve(null),   // negocios cuyos avisos push apagó este superadmin
  ])
  const desdeImpresion = (cfgImpresion?.data?.comandera_desde as string | null | undefined) ?? null

  return (
    <FeedbackProvider>
      <Suspense fallback={null}><BarraProgreso /></Suspense>
      <AvisosEnVivo negocioId={ctx.negocio.id} pedidos={ctx.modulosActivos.pedidos} sedes={Object.fromEntries(ctx.sedesTodas.map((s) => [s.id, s.nombre]))} />
      <ConImpresion activa={!!ctx.modulosActivos.pedidos} desde={desdeImpresion} negocio={ctx.negocio.nombre} negocioId={ctx.negocio.id} puedeEscribir={ctx.puedeEscribir}>
      <div className="min-h-screen">
        <header className="no-print sticky top-0 z-40 border-b border-rs-raised bg-rs-header/90 backdrop-blur-md">
          <div className="mx-auto flex max-w-[1280px] flex-wrap items-center justify-between gap-x-3 gap-y-2 px-4 py-3">
            <div className="flex min-w-0 flex-wrap items-center gap-x-2.5 gap-y-2">
              <Image src="/logo.jpeg" alt="Risto Suite" width={28} height={28} className="rounded-lg transition hover:rotate-6 hover:scale-110" />
              <span className="font-bold text-rs-lime">RistoSuite</span>
              <div className="order-last flex w-full items-center gap-2 sm:order-none sm:w-auto">
                {ctx.negocios.length > 1 ? (
                  <NegocioSelect negocios={ctx.negocios} actual={ctx.negocio.id} />
                ) : (
                  <span className="truncate rounded-full bg-rs-raised px-2.5 py-0.5 text-xs text-rs-lime">{ctx.negocio.nombre}</span>
                )}
                {ctx.sedes.length > 0 && <SedeSelect sedes={ctx.sedes} actual={ctx.sede?.id ?? null} />}
              </div>
            </div>
            <div className="flex shrink-0 items-center gap-3">
              {ctx.tieneApagadoBot && <BotToggle activo={ctx.negocio.bot_activo} puedeCambiar={ctx.puedeApagarBot} />}
              {ctx.esSuperadmin && <AvisosPush negocios={ctx.negocios.map((n) => ({ id: n.id, nombre: n.nombre }))} apagadosInicial={(apagadosPush?.data ?? []).map((f) => f.negocio_id as string)} clavePublica={clavePush} listo={!!clavePush && !apagadosPush?.error} />}
              <CampanaNotificaciones key={ctx.negocio.id} inicial={notificaciones} />
              <span className="hidden text-sm font-semibold md:inline">{ctx.nombreUsuario}</span>
              <form action="/salir" method="post">
                <button className="btn btn-sm h-8 px-3"><LogOut size={14} /> Salir</button>
              </form>
            </div>
          </div>
          <Nav esSuperadmin={ctx.esSuperadmin} pausados={pausados} modulos={{ ...ctx.modulosActivos, pausados: ctx.puedeApagarBot }} />
        </header>
        {ctx.tieneApagadoBot && !ctx.negocio.bot_activo && (
          <div role="status" className="animate-fade-in border-b border-rs-danger/30 bg-rs-danger/10 px-4 py-2 text-center text-sm text-rs-danger">
            El bot está apagado: no responde ni registra los mensajes de WhatsApp. {ctx.puedeApagarBot ? 'Encendelo desde el botón de arriba.' : 'Pedile a un encargado que lo encienda.'}
          </div>
        )}
        <main className="mx-auto max-w-[1280px] px-4 py-6">{children}</main>
      </div>
      </ConImpresion>
    </FeedbackProvider>
  )
}
