'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useLayoutEffect, useRef, useState } from 'react'
import { BarChart3, BookOpen, Building2, Cake, CalendarCheck, Clapperboard, CornerUpRight, Gift, Megaphone, LayoutGrid, MessageCircleQuestion, MessagesSquare, PauseCircle, Settings, ShoppingBag, Star, Ticket, Users } from 'lucide-react'

const TABS = [
  { href: '/', label: 'Dashboard', icon: LayoutGrid },
  { href: '/reservas', label: 'Reservas', icon: CalendarCheck, modulo: 'reservas' },
  { href: '/shows', label: 'Shows', icon: Clapperboard, modulo: 'shows' },
  { href: '/pedidos', label: 'Pedidos', icon: ShoppingBag, modulo: 'pedidos' },
  { href: '/carta', label: 'Carta', icon: BookOpen, modulo: 'carta' },
  { href: '/cumpleanos', label: 'Cumpleaños', icon: Cake, modulo: 'cumpleanos' },
  { href: '/derivadas', label: 'Derivadas', icon: CornerUpRight, modulo: 'derivadas' },
  { href: '/vouchers', label: 'Vouchers', icon: Ticket, modulo: 'vouchers' },
  { href: '/fidelizacion', label: 'Fidelización', icon: Gift, modulo: 'fidelizacion' },
  { href: '/campanas', label: 'Campañas', icon: Megaphone, modulo: 'campanas' },
  { href: '/metricas', label: 'Métricas', icon: BarChart3, modulo: 'metricas' },
  { href: '/resenas', label: 'Reseñas', icon: Star, modulo: 'resenas' },
  { href: '/clientes', label: 'Clientes', icon: Users, modulo: 'clientes' },
  { href: '/consultas', label: 'Consultas y reclamos', icon: MessageCircleQuestion, modulo: 'consultas' },
  { href: '/pausados', label: 'Chats pausados', icon: PauseCircle, modulo: 'pausados' },
  { href: '/conversaciones', label: 'Conversaciones', icon: MessagesSquare, modulo: 'conversaciones' },
  { href: '/configuracion', label: 'Configuración', icon: Settings },
]

export default function Nav({ esSuperadmin = false, pausados = 0, modulos = {} }: { esSuperadmin?: boolean; pausados?: number; modulos?: Record<string, boolean> }) {
  const pathname = usePathname()
  const visibles = TABS.filter((t) => { const m = (t as { modulo?: string }).modulo; return !m || modulos[m] === true })
  const tabs = esSuperadmin ? [...visibles, { href: '/administracion', label: 'Administración', icon: Building2 }] : visibles
  const activo = tabs.find((t) => (t.href === '/' ? pathname === '/' : pathname.startsWith(t.href)))?.href ?? null
  const refs = useRef<Record<string, HTMLAnchorElement | null>>({})
  const [pill, setPill] = useState<{ left: number; width: number } | null>(null)

  // La "pastilla" lima se desliza hasta la pestaña activa y la trae a la vista en pantallas chicas.
  useLayoutEffect(() => {
    const el = activo ? refs.current[activo] : null
    if (!el) { setPill(null); return }
    setPill({ left: el.offsetLeft, width: el.offsetWidth })
    el.scrollIntoView({ inline: 'center', block: 'nearest', behavior: 'smooth' })
  }, [activo, tabs.length])

  return (
    <nav aria-label="Secciones" className="mx-auto max-w-[1280px] overflow-x-auto px-4 pb-3">
      <div className="relative flex w-max gap-2">
        {pill && <span aria-hidden className="absolute inset-y-0 rounded-[10px] bg-rs-lime shadow-[0_0_22px_-6px_rgba(200,230,43,.7)] transition-[left,width] duration-300 ease-[cubic-bezier(.22,1,.36,1)]" style={{ left: pill.left, width: pill.width }} />}
        {tabs.map(({ href, label, icon: Icon }) => {
          const on = href === activo
          return (
            <Link
              key={href}
              href={href}
              ref={(el) => { refs.current[href] = el }}
              aria-current={on ? 'page' : undefined}
              className={'relative z-10 inline-flex h-8 shrink-0 items-center gap-2 rounded-[10px] border px-3.5 text-sm font-medium transition-colors duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rs-lime/50 ' + (on ? 'border-transparent font-semibold text-rs-on-lime' : 'border-rs-control text-rs-muted hover:bg-rs-raised hover:text-rs-text')}
            >
              <Icon size={15} className={'transition-transform duration-200 ' + (on ? 'scale-110' : 'group-hover:scale-110')} />
              {label}
              {href === '/pausados' && pausados > 0 && <span aria-label={`${pausados} chats pausados`} className={'rounded-full px-1.5 text-[11px] font-bold tabular-nums ' + (on ? 'bg-rs-on-lime/15 text-rs-on-lime' : 'bg-rs-warn/20 text-rs-warn')}>{pausados > 99 ? '99+' : pausados}</span>}
            </Link>
          )
        })}
      </div>
    </nav>
  )
}
