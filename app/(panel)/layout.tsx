import { Suspense } from 'react'
import Image from 'next/image'
import { LogOut } from 'lucide-react'
import BarraProgreso from '@/components/barra-progreso'
import BotToggle from '@/components/bot-toggle'
import AvisosEnVivo from '@/components/avisos-en-vivo'
import { FeedbackProvider } from '@/components/feedback'
import Nav from '@/components/nav'
import NegocioSelect from '@/components/negocio-select'
import SedeSelect from '@/components/sede-select'
import { getContexto } from '@/lib/context'
import { contarPausados } from '@/lib/pausados'

export default async function PanelLayout({ children }: { children: React.ReactNode }) {
  const ctx = await getContexto()
  const pausados = ctx.puedeApagarBot ? await contarPausados(ctx) : 0   // chats que el bot dejó esperando a una persona

  return (
    <FeedbackProvider>
      <Suspense fallback={null}><BarraProgreso /></Suspense>
      <AvisosEnVivo negocioId={ctx.negocio.id} pedidos={ctx.modulosActivos.pedidos} sedes={Object.fromEntries(ctx.sedesTodas.map((s) => [s.id, s.nombre]))} />
      <div className="min-h-screen">
        <header className="sticky top-0 z-40 border-b border-rs-raised bg-rs-header/90 backdrop-blur-md">
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
    </FeedbackProvider>
  )
}
