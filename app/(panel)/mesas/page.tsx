import { redirect } from 'next/navigation'
import { Armchair } from 'lucide-react'
import SalonUI from '@/components/mesas-ui'
import { getContexto } from '@/lib/context'
import { hoyEn } from '@/lib/fechas'
import type { Mesa, ReservaSalon, Salon } from '@/lib/mesas'

/** Minutos desde la medianoche en Argentina, ahora. */
const ahoraAR = () => { const [h, m] = new Intl.DateTimeFormat('en-GB', { timeZone: 'America/Argentina/Buenos_Aires', hour: '2-digit', minute: '2-digit', hour12: false }).format(new Date()).split(':').map(Number); return (h % 24) * 60 + m }

export default async function MesasPage({ searchParams }: { searchParams: Promise<{ fecha?: string; modo?: string }> }) {
  const ctx = await getContexto()
  if (!ctx.modulosActivos.mesas) redirect('/')
  const { supabase, negocio, sede } = ctx
  const sp = await searchParams
  const hoy = hoyEn(negocio.zona_horaria)
  const fecha = sp.fecha && /^\d{4}-\d{2}-\d{2}$/.test(sp.fecha) ? sp.fecha : hoy
  const puedeEstructura = ctx.puedeAdministrar || ctx.rol === 'encargado'
  const modo = sp.modo === 'editar' && puedeEstructura ? 'editar' : 'servicio'

  let qSalones = supabase.from('salones').select('id, nombre, orden, ancho, alto, sucursal_id').eq('negocio_id', negocio.id).order('orden').order('creado_en')
  if (sede) qSalones = qSalones.or(`sucursal_id.is.null,sucursal_id.eq.${sede.id}`)
  let qReservas = supabase.from('reservas').select('id, numero, cliente_nombre, cliente_telefono, hora, cantidad_personas, estado, ubicacion, observaciones, asistio_en, sentada_en, liberada_en, sucursal_id')
    .eq('negocio_id', negocio.id).is('eliminado_en', null).eq('fecha', fecha).not('estado', 'in', '(cancelada,no_show)').order('hora')
  if (sede) qReservas = qReservas.eq('sucursal_id', sede.id)
  const [{ data: salones }, { data: mesas }, { data: reservas }, { data: asign }, { data: cfg }] = await Promise.all([
    qSalones,
    supabase.from('mesas').select('id, salon_id, tipo, numero, capacidad, x, y, w, h, forma, activa, ocupada_desde, ocupada_pax').eq('negocio_id', negocio.id).order('creado_en').limit(2000),
    qReservas,
    supabase.from('reserva_mesas').select('reserva_id, mesa_id').eq('negocio_id', negocio.id).limit(10000),
    supabase.from('mesas_config').select('duracion_min').eq('negocio_id', negocio.id).maybeSingle(),
  ])
  const idsSalon = new Set((salones ?? []).map((s) => s.id))
  const porReserva = new Map<string, string[]>()
  for (const a of asign ?? []) porReserva.set(a.reserva_id, [...(porReserva.get(a.reserva_id) ?? []), a.mesa_id])
  const reservasSalon: ReservaSalon[] = (reservas ?? []).map((r) => ({ ...r, mesas: porReserva.get(r.id) ?? [] }))

  return (
    <div className="space-y-5">
      <div className="animate-fade-up">
        <h1 className="flex items-center gap-2 text-xl font-bold sm:text-2xl"><Armchair className="text-rs-lime" size={22} />Salón y mesas</h1>
        <p className="text-sm text-rs-muted">{modo === 'editar' ? 'Armá el plano del local' : 'Plano del salón: asigná mesas a las reservas y seguí el servicio en vivo'}</p>
      </div>
      <SalonUI salones={(salones ?? []) as Salon[]} mesas={((mesas ?? []) as Mesa[]).filter((m) => idsSalon.has(m.salon_id))} reservas={reservasSalon} duracion={cfg?.duracion_min ?? 120} fecha={fecha} hoy={hoy} modo={modo}
        puedeEscribir={ctx.puedeEscribir} puedeEstructura={puedeEstructura} puedeAdministrar={ctx.puedeAdministrar} negocioId={negocio.id} ahoraInicial={ahoraAR()} />
    </div>
  )
}
