'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { CalendarCheck, LayoutGrid, MessageCircle, MessagesSquare, Settings, Users } from 'lucide-react'

const TABS = [
  { href: '/', label: 'Dashboard', icon: LayoutGrid },
  { href: '/reservas', label: 'Reservas', icon: CalendarCheck },
  { href: '/clientes', label: 'Clientes', icon: Users },
  { href: '/consultas', label: 'Consultas', icon: MessageCircle },
  { href: '/conversaciones', label: 'Conversaciones', icon: MessagesSquare },
  { href: '/configuracion', label: 'Configuración', icon: Settings },
]

export default function Nav() {
  const pathname = usePathname()
  return (
    <nav className="mx-auto flex max-w-[1280px] gap-2 overflow-x-auto px-4 pb-3">
      {TABS.map(({ href, label, icon: Icon }) => {
        const activo = href === '/' ? pathname === '/' : pathname.startsWith(href)
        return (
          <Link
            key={href}
            href={href}
            className={
              'inline-flex h-8 shrink-0 items-center gap-2 rounded-[10px] border px-3.5 text-sm font-medium transition ' +
              (activo ? 'border-transparent bg-rs-lime font-semibold text-rs-on-lime' : 'border-rs-control text-rs-muted hover:bg-rs-raised hover:text-rs-text')
            }
          >
            <Icon size={15} />
            {label}
          </Link>
        )
      })}
    </nav>
  )
}
