import Link from 'next/link'
import { BookOpen, Cake, CalendarCheck, Clapperboard, CornerUpRight, Megaphone, MessageCircleQuestion, MessagesSquare, ShoppingBag, Star, Ticket, Users, BarChart3 } from 'lucide-react'
import { MODULOS, type ModulosActivos } from '@/lib/modulos'

const ICONOS = { reservas: CalendarCheck, shows: Clapperboard, carta: BookOpen, pedidos: ShoppingBag, clientes: Users, consultas: MessageCircleQuestion, cumpleanos: Cake, vouchers: Ticket, resenas: Star, campanas: Megaphone, metricas: BarChart3, derivadas: CornerUpRight, conversaciones: MessagesSquare }
const RUTAS: Record<string, string> = { reservas: '/reservas', shows: '/shows', carta: '/carta', pedidos: '/pedidos', clientes: '/clientes', consultas: '/consultas', cumpleanos: '/cumpleanos', vouchers: '/vouchers', resenas: '/resenas', campanas: '/campanas', metricas: '/metricas', derivadas: '/derivadas', conversaciones: '/conversaciones' }

function saludo(): string {
  const h = Number(new Intl.DateTimeFormat('es-AR', { timeZone: 'America/Argentina/Buenos_Aires', hour: 'numeric', hour12: false }).format(new Date()))
  return h < 6 ? 'Buenas noches' : h < 13 ? 'Buen día' : h < 20 ? 'Buenas tardes' : 'Buenas noches'
}

/** Inicio de un negocio que no usa reservas (el dashboard clásico es de reservas): accesos directos a los módulos que tiene habilitados. */
export default function InicioModulos({ nombre, negocio, activos }: { nombre: string; negocio: string; activos: ModulosActivos }) {
  const lista = MODULOS.filter((m) => activos[m.clave])
  return (
    <div className="space-y-5">
      <div className="animate-fade-up">
        <p className="text-xl font-bold sm:text-2xl">{saludo()}, <span className="text-rs-lime">{nombre}</span></p>
        <p className="text-sm text-rs-muted">{negocio} · estos son los módulos habilitados</p>
      </div>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {lista.map((m, i) => {
          const Icono = ICONOS[m.clave]
          return (
            <Link key={m.clave} href={RUTAS[m.clave]} className="reveal card card-hover flex items-start gap-3 p-4" style={{ ['--i' as string]: i }}>
              <span className="rounded-lg bg-rs-raised p-2 text-rs-lime"><Icono size={18} /></span>
              <span><span className="block font-semibold">{m.titulo}{m.enPreparacion && <span className="ml-2 rounded-full bg-rs-raised px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-rs-muted">en preparación</span>}</span><span className="mt-0.5 block text-sm text-rs-muted">{m.texto}</span></span>
            </Link>
          )
        })}
      </div>
    </div>
  )
}
