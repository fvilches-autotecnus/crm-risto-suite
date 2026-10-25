import Link from 'next/link'
import InicioModulos from '@/components/inicio-modulos'
import { CalendarCheck2, ChevronLeft, ChevronRight } from 'lucide-react'
import { AforoLista, Tile } from '@/components/dashboard-ui'
import { NuevaReservaBtn, ReservasTabla } from '@/components/reservas-ui'
import { cargarReglas, usoPorRegla } from '@/lib/aforo'
import { getContexto } from '@/lib/context'
import { fechaLarga, hoyEn, inicioSemana, sumarDias } from '@/lib/fechas'
import { ESTADOS_OCUPAN, RESERVA_COLS, ocupaLugar, type EstadoReserva, type Reserva } from '@/lib/reservas'
import { cargarOpciones } from '@/lib/sedes'
import { usaAsistencia } from '@/lib/fidelidad-servidor'
import { mesasPorReserva } from '@/lib/mesas-servidor'
import { cargarConfigReservas } from '@/lib/config-reservas-servidor'

const delta = (n: number) => (n >= 0 ? `+${n}` : `${n}`)

function saludo(): string {
  const h = Number(new Intl.DateTimeFormat('es-AR', { timeZone: 'America/Argentina/Buenos_Aires', hour: 'numeric', hour12: false }).format(new Date()))
  return h < 6 ? 'Buenas noches' : h < 13 ? 'Buen día' : h < 20 ? 'Buenas tardes' : 'Buenas noches'
}

export default async function Dashboard({ searchParams }: { searchParams: Promise<{ fecha?: string }> }) {
  const ctx = await getContexto()
  if (!ctx.modulosActivos.reservas) return <InicioModulos nombre={ctx.nombreUsuario.split(' ')[0]} negocio={ctx.negocio.nombre} activos={ctx.modulosActivos} />
  const { supabase, negocio, sede } = ctx
  const op = await cargarOpciones(ctx)
  const sp = await searchParams
  const hoy = hoyEn(negocio.zona_horaria)
  const dia = sp.fecha && /^\d{4}-\d{2}-\d{2}$/.test(sp.fecha) ? sp.fecha : hoy

  // con una sede elegida (o un usuario limitado a una sede) todo se filtra por esa sede
  const porSede = <T,>(q: T): T => (sede ? (q as any).eq('sucursal_id', sede.id) : q)

  const semana = inicioSemana(dia)
  const semanaAnt = sumarDias(semana, -7)
  const finSemana = sumarDias(semana, 6)

  const [{ data: rango }, { data: delDia }, { count: pendientes }, { data: bloqueos }, { count: consultas }, reglasTodas, { count: cumplesHoy }] = await Promise.all([
    porSede(supabase.from('reservas').select('fecha, estado, cantidad_personas').eq('negocio_id', negocio.id).is('eliminado_en', null).gte('fecha', semanaAnt).lte('fecha', finSemana)),
    porSede(supabase.from('reservas').select(RESERVA_COLS).eq('negocio_id', negocio.id).is('eliminado_en', null).eq('fecha', dia).order('hora')),
    porSede(supabase.from('reservas').select('id', { count: 'exact', head: true }).eq('negocio_id', negocio.id).is('eliminado_en', null).eq('estado', 'nueva').or(`fecha.gte.${hoy},fecha.is.null`)),
    (sede ? supabase.from('fechas_bloqueadas_reservas').select('id, hora_desde, hora_hasta, motivo').eq('negocio_id', negocio.id).eq('fecha', dia).or(`sucursal_id.is.null,sucursal_id.eq.${sede.id}`) : supabase.from('fechas_bloqueadas_reservas').select('id, hora_desde, hora_hasta, motivo').eq('negocio_id', negocio.id).eq('fecha', dia)),
    porSede(supabase.from('consultas_reclamos').select('id', { count: 'exact', head: true }).eq('negocio_id', negocio.id).eq('estado', 'pendiente')),
    cargarReglas(ctx),
    ctx.modulosActivos.cumpleanos
      ? supabase.from('clientes').select('id', { count: 'exact', head: true }).eq('negocio_id', negocio.id).eq('cumple_dia', Number(hoy.slice(8, 10))).eq('cumple_mes', Number(hoy.slice(5, 7)))
      : Promise.resolve({ count: 0 }),
  ])

  const reservasDia = (delDia ?? []) as Reserva[]
  const activas = reservasDia.filter(ocupaLugar)
  const personasDia = activas.reduce((s, r) => s + (r.cantidad_personas ?? 0), 0)

  const filas = rango ?? []
  const contar = (desde: string, hasta: string) => filas.filter((f) => f.fecha! >= desde && f.fecha! <= hasta && ESTADOS_OCUPAN.includes(f.estado as EstadoReserva))
  const ayer = contar(sumarDias(dia, -1), sumarDias(dia, -1)).length
  const semanaActual = contar(semana, finSemana)
  const semanaPrevia = contar(semanaAnt, sumarDias(semana, -1))
  const personasSemana = semanaActual.reduce((s, f) => s + (f.cantidad_personas ?? 0), 0)

  // Aforo: reglas que corresponden a lo que el usuario está viendo (sede elegida + las generales)
  const reglas = reglasTodas.filter((g) => !sede || !g.sucursal_id || g.sucursal_id === sede.id)
  const uso = reglas.length ? await usoPorRegla(ctx, dia, reglas) : []
  const filasAforo = uso.map((u) => ({ etiqueta: u.etiqueta, usado: u.usado, maximo: u.maximo })).sort((a, b) => b.usado / b.maximo - a.usado / a.maximo)

  const alertaAforo = (await cargarConfigReservas(ctx)).alerta_aforo_pct
  const alertas: { texto: string; tono: 'warn' | 'danger' }[] = []
  for (const b of bloqueos ?? []) {
    alertas.push({ tono: 'warn', texto: `Fecha bloqueada${b.hora_desde ? ` (${b.hora_desde.slice(0, 5)}–${b.hora_hasta?.slice(0, 5)})` : ''}${b.motivo ? `: ${b.motivo}` : ''}` })
  }
  for (const f of filasAforo) {
    const pct = Math.round((f.usado / f.maximo) * 100)
    if (pct >= alertaAforo) alertas.push({ tono: 'danger', texto: `Aforo ${f.etiqueta}: ${pct}% (${f.usado} de ${f.maximo} personas)` })
  }
  const sinConfirmar = reservasDia.filter((r) => r.estado === 'nueva').length
  if (sinConfirmar) alertas.push({ tono: 'warn', texto: `${sinConfirmar} reserva${sinConfirmar > 1 ? 's' : ''} de este día sin confirmar` })
  if (dia === hoy && cumplesHoy) alertas.push({ tono: 'warn', texto: `${cumplesHoy} cumpleaños hoy — mirá la pestaña Cumpleaños para asignar el regalo` })
  if (consultas) alertas.push({ tono: 'warn', texto: `${consultas} consulta${consultas > 1 ? 's' : ''} pendiente${consultas > 1 ? 's' : ''} de respuesta` })

  const primerNombre = ctx.nombreUsuario.split(' ')[0]

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div className="animate-fade-up">
          <p className="text-xl font-bold sm:text-2xl">{saludo()}, <span className="text-rs-lime">{primerNombre}</span></p>
          <p className="text-sm text-rs-muted">{ctx.negocio.nombre}{sede ? ` · ${sede.nombre}` : ''}</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {dia !== hoy && <Link href="/" className="btn btn-sm">Ir a hoy</Link>}
          <Link href={`/?fecha=${sumarDias(dia, -1)}`} className="btn h-9 w-9 px-0" aria-label="Día anterior"><ChevronLeft size={16} /></Link>
          <span className="inline-flex h-9 items-center gap-2 rounded-rs border border-rs-control px-4 text-sm font-semibold"><CalendarCheck2 size={15} className="text-rs-lime" />{fechaLarga(dia)}</span>
          <Link href={`/?fecha=${sumarDias(dia, 1)}`} className="btn h-9 w-9 px-0" aria-label="Día siguiente"><ChevronRight size={16} /></Link>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
        <Tile i={0} valor={activas.length} etiqueta="Reservas hoy" color="text-rs-text" sub={`${delta(activas.length - ayer)} vs ayer`} subColor={activas.length - ayer >= 0 ? 'text-rs-ok' : 'text-rs-danger'} />
        <Tile i={1} valor={personasDia} etiqueta="Personas hoy" color="text-rs-lime" sub={`${personasSemana} esta semana`} />
        <Tile i={2} valor={pendientes ?? 0} etiqueta="Pendientes" color="text-rs-ok" sub={pendientes ? 'Por confirmar' : 'Al día'} />
        <Tile i={3} valor={semanaActual.length} etiqueta="Reservas semana" color="text-rs-lav" sub={`${delta(semanaActual.length - semanaPrevia.length)} vs semana ant.`} subColor={semanaActual.length - semanaPrevia.length >= 0 ? 'text-rs-ok' : 'text-rs-danger'} />
      </div>

      {filasAforo.length > 0 && <AforoLista filas={filasAforo} alerta={alertaAforo} />}

      <section>
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <h2 className="card-title">Reservas de {dia === hoy ? 'hoy' : fechaLarga(dia)}</h2>
          <div className="flex items-center gap-3">
            <span className="text-xs text-rs-muted/80">{reservasDia.length} reserva{reservasDia.length === 1 ? '' : 's'}</span>
            {ctx.puedeEscribir && <NuevaReservaBtn fechaDefault={dia} op={op} />}
          </div>
        </div>
        <ReservasTabla reservas={reservasDia} puedeEscribir={ctx.puedeEscribir} op={op} asistencia={await usaAsistencia(ctx)} mesas={await mesasPorReserva(ctx, reservasDia.map((r) => r.id))} vacio={dia === hoy ? 'No hay reservas para hoy' : 'No hay reservas para este día'} />
      </section>

      <section>
        <h2 className="card-title mb-3">Alertas activas — {dia === hoy ? 'hoy' : fechaLarga(dia)}</h2>
        {alertas.length === 0 ? (
          <div className="animate-fade-up rounded-rs-lg border border-rs-ok/30 bg-rs-ok/10 px-4 py-3 text-sm text-rs-ok">Todo al día — sin alertas activas para {dia === hoy ? 'hoy' : 'este día'}.</div>
        ) : (
          <ul className="space-y-2">
            {alertas.map((a, i) => (
              <li key={i} className={'reveal rounded-rs-lg border px-4 py-3 text-sm ' + (a.tono === 'danger' ? 'border-rs-danger/30 bg-rs-danger/10 text-rs-danger' : 'border-rs-warn/30 bg-rs-warn/10 text-rs-warn')} style={{ ['--i' as string]: i }}>{a.texto}</li>
            ))}
          </ul>
        )}
      </section>
    </div>
  )
}
