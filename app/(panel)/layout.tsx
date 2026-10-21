import Image from 'next/image'
import { LogOut } from 'lucide-react'
import BotToggle from '@/components/bot-toggle'
import Nav from '@/components/nav'
import NegocioSelect from '@/components/negocio-select'
import { getContexto } from '@/lib/context'
import { cerrarSesion } from './actions'

export default async function PanelLayout({ children }: { children: React.ReactNode }) {
  const ctx = await getContexto()

  return (
    <div className="min-h-screen">
      <header className="border-b border-rs-raised bg-rs-header">
        <div className="mx-auto flex max-w-[1280px] items-center justify-between gap-3 px-4 py-3">
          <div className="flex min-w-0 items-center gap-2.5">
            <Image src="/logo.jpeg" alt="Risto Suite" width={28} height={28} className="rounded-lg" />
            <span className="font-bold text-rs-lime">RistoSuite</span>
            {ctx.negocios.length > 1 ? (
              <NegocioSelect negocios={ctx.negocios} actual={ctx.negocio.id} />
            ) : (
              <span className="truncate rounded-full bg-rs-raised px-2.5 py-0.5 text-xs text-rs-lime">{ctx.negocio.nombre}</span>
            )}
          </div>
          <div className="flex shrink-0 items-center gap-3">
            {ctx.tieneApagadoBot && <BotToggle activo={ctx.negocio.bot_activo} puedeCambiar={ctx.puedeApagarBot} />}
            <span className="hidden text-sm font-semibold sm:inline">{ctx.nombreUsuario}</span>
            <form action={cerrarSesion}>
              <button className="btn btn-sm h-8 px-3"><LogOut size={14} /> Salir</button>
            </form>
          </div>
        </div>
        <Nav esSuperadmin={ctx.esSuperadmin} />
      </header>
      {ctx.tieneApagadoBot && !ctx.negocio.bot_activo && (
        <div role="status" className="border-b border-rs-danger/30 bg-rs-danger/10 px-4 py-2 text-center text-sm text-rs-danger">
          El bot está apagado: no responde los mensajes de WhatsApp. {ctx.puedeApagarBot ? 'Encendelo desde el botón de arriba.' : 'Pedile a un encargado que lo encienda.'}
        </div>
      )}
      <main className="mx-auto max-w-[1280px] px-4 py-6">{children}</main>
    </div>
  )
}
