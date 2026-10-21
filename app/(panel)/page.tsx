import Link from 'next/link'
import { getContexto } from '@/lib/context'
import { fechaLarga, hoyEn, inicioSemana, sumarDias } from '@/lib/fechas'
import { RESERVA_COLS, ocupaLugar, type Reserva } from '@/lib/reservas'
import { NuevaReservaBtn, ReservasTabla } from '@/components/reservas-ui'
import { cargarOpciones } from '@/lib/sedes'

function Tile({ valor, etiqueta, sub, color, subColor }: { valor: string | number; etiqueta: string; sub: string; color: string; subColor?: string }) {
  return (
    <div className="card p-4 sm:p-5">
      <div className={'text-2xl font-bold sm:text-3xl ' + color}>{valor}</div>
      <div className="card-title mt-3">{etiqueta}</div>
      <div className={'mt-1 text-xs ' + (subColor ?? 'text-rs-muted/80')}>{sub}</div>
    </div>
  )
}

const delta = (n: number) => (n >= 0 ? `+${n}` : `${n}`)

export default async function Dashboard({ searchParams }: { searchParams: Promise<{ fecha?: string }> }) {
  const ctx = await getContexto()
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

  const [{ data: rango }, { data: delDia }, { count: pendientes }, { data: bloqueos }, { count: consultas }] = await Promise.all([
    porSede(supabase.from('reservas').select('fecha, estado, cantidad_personas').eq('negocio_id', negocio.id).is('eliminado_en', null).gte('fecha', semanaAnt).lte('fecha', finSemana)),
    porSede(supabase.from('reservas').select(RESERVA_COLS).eq('negocio_id', negocio.id).is('eliminado_en', null).eq('fecha', dia).order('hora')),
    porSede(supabase.from('reservas').select('id', { count: 'exact', head: true }).eq('negocio_id', negocio.id).is('eliminado_en', null).eq('estado', 'nueva').or(`fecha.gte.${hoy},fecha.is.null`)),
    (sede ? supabase.from('fechas_bloqueadas_reservas').select('id, hora_desde, hora_hasta, motivo').eq('negocio_id', negocio.id).eq('fecha', dia).or(`sucursal_id.is.null,sucursal_id.eq.${sede.id}`) : supabase.from('fechas_bloqueadas_reservas').select('id, hora_desde, hora_hasta, motivo').eq('negocio_id', negocio.id).eq('fecha', dia)),
    porSede(supabase.from('consultas_reclamos').select('id', { count: 'exact', head: true }).eq('negocio_id', negocio.id).eq('estado', 'pendiente')),
  ])

  const reservasDia = (delDia ?? []) as Reserva[]
  const activas = reservasDia.filter(ocupaLugar)
  const personasDia = activas.reduce((s, r) => s + (r.cantidad_personas ?? 0), 0)

  const filas = rango ?? []
  const contar = (desde: string, hasta: string) => filas.filter((f) => f.fecha! >= desde && f.fecha! <= hasta && (f.estado === 'nueva' || f.estado === 'confirmada'))
  const ayer = contar(sumarDias(dia, -1), sumarDias(dia, -1)).length
  const semanaActual = contar(semana, finSemana)
  const semanaPrevia = contar(semanaAnt, sumarDias(semana, -1))
  const personasSemana = semanaActual.reduce((s, f) => s + (f.cantidad_personas ?? 0), 0)

  const aforo = sede ? (sede.aforo_maximo_reservas ?? negocio.aforo_maximo_reservas) : negocio.aforo_maximo_reservas
  const personasConfirmadas = reservasDia.filter((r) => r.estado === 'confirmada').reduce((s, r) => s + (r.cantidad_personas ?? 0), 0)
  const pctAforo = aforo ? Math.round((personasConfirmadas / aforo) * 100) : null

  const alertas: { texto: string; tono: 'warn' | 'danger' }[] = []
  for (const b of bloqueos ?? []) {
    alertas.push({ tono: 'warn', texto: `Fecha bloqueada${b.hora_desde ? ` (${b.hora_desde.slice(0, 5)}–${b.hora_hasta?.slice(0, 5)})` : ''}${b.motivo ? `: ${b.motivo}` : ''}` })
  }
  if (pctAforo !== null && pctAforo >= 90) alertas.push({ tono: 'danger', texto: `Aforo al ${pctAforo}% (${personasConfirmadas} de ${aforo} personas confirmadas)` })
  const sinConfirmar = reservasDia.filter((r) => r.estado === 'nueva').length
  if (sinConfirmar) alertas.push({ tono: 'warn', texto: `${sinConfirmar} reserva${sinConfirmar > 1 ? 's' : ''} de este día sin confirmar` })
  if (consultas) alertas.push({ tono: 'warn', texto: `${consultas} consulta${consultas > 1 ? 's' : ''} pendiente${consultas > 1 ? 's' : ''} de respuesta` })

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-end gap-2">
        {dia !== hoy && <Link href="/" className="btn btn-sm">Hoy</Link>}
        <Link href={`/?fecha=${sumarDias(dia, -1)}`} className="btn h-9 w-9 px-0" aria-label="Día anterior">←</Link>
        <span className="inline-flex h-9 items-center rounded-rs border border-rs-control px-4 text-sm font-semibold">{fechaLarga(dia)}</span>
        <Link href={`/?fecha=${sumarDias(dia, 1)}`} className="btn h-9 w-9 px-0" aria-label="Día siguiente">→</Link>
      </div>

      <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
        <Tile valor={activas.length} etiqueta="Reservas hoy" color="text-rs-text" sub={`${delta(activas.length - ayer)} vs ayer`} subColor={activas.length - ayer >= 0 ? 'text-rs-ok' : 'text-rs-danger'} />
        <Tile valor={personasDia} etiqueta="Personas hoy" color="text-rs-lime" sub={`${personasSemana} esta semana`} />
        <Tile valor={pendientes ?? 0} etiqueta="Pendientes" color="text-rs-ok" sub={pendientes ? 'Por confirmar' : 'Al día'} />
        <Tile valor={semanaActual.length} etiqueta="Reservas semana" color="text-rs-lav" sub={`${delta(semanaActual.length - semanaPrevia.length)} vs semana ant.`} subColor={semanaActual.length - semanaPrevia.length >= 0 ? 'text-rs-ok' : 'text-rs-danger'} />
      </div>

      {aforo && (
        <div className="card p-5">
          <div className="flex items-center justify-between">
            <span className="card-title">Aforo del día (confirmadas)</span>
            <span className="text-xs text-rs-muted">{personasConfirmadas} / {aforo} personas</span>
          </div>
          <div className="mt-3 h-2 overflow-hidden rounded-full bg-rs-raised">
            <div className={'h-full rounded-full ' + (pctAforo! >= 100 ? 'bg-rs-danger' : pctAforo! >= 90 ? 'bg-rs-warn' : 'bg-rs-lime')} style={{ width: `${Math.min(pctAforo!, 100)}%` }} />
          </div>
        </div>
      )}

      <section>
        <div className="mb-3 flex items-center justify-between">
          <h2 className="card-title">Reservas de {dia === hoy ? 'hoy' : fechaLarga(dia)}</h2>
          <div className="flex items-center gap-3">
            <span className="text-xs text-rs-muted/80">{reservasDia.length} reserva{reservasDia.length === 1 ? '' : 's'}</span>
            {ctx.puedeEscribir && <NuevaReservaBtn fechaDefault={dia} op={op} />}
          </div>
        </div>
        <ReservasTabla reservas={reservasDia} puedeEscribir={ctx.puedeEscribir} op={op} vacio={dia === hoy ? 'No hay reservas para hoy' : 'No hay reservas para este día'} />
      </section>

      <section>
        <h2 className="card-title mb-3">Alertas activas — {dia === hoy ? 'hoy' : fechaLarga(dia)}</h2>
        {alertas.length === 0 ? (
          <div className="rounded-rs-lg border border-rs-ok/30 bg-rs-ok/10 px-4 py-3 text-sm text-rs-ok">Todo al día — sin alertas activas para {dia === hoy ? 'hoy' : 'este día'}.</div>
        ) : (
          <ul className="space-y-2">
            {alertas.map((a, i) => (
              <li key={i} className={'rounded-rs-lg border px-4 py-3 text-sm ' + (a.tono === 'danger' ? 'border-rs-danger/30 bg-rs-danger/10 text-rs-danger' : 'border-rs-warn/30 bg-rs-warn/10 text-rs-warn')}>{a.texto}</li>
            ))}
          </ul>
        )}
      </section>
    </div>
  )
}
