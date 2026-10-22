import Link from 'next/link'
import { redirect } from 'next/navigation'
import { BarChart3 } from 'lucide-react'
import { BarraApilada, BarrasHorizontales, GraficoColumnas, GraficoLinea, TarjetaGrafico } from '@/components/charts'
import { Tile } from '@/components/dashboard-ui'
import SelectorPeriodo from '@/components/selector-periodo'
import { getContexto } from '@/lib/context'
import { fechaCorta, hoyEn, sumarDias } from '@/lib/fechas'
import { agrupacionAuto, calcularMetricas, serieEvolucion, type Agrupacion, type FilaReserva } from '@/lib/metricas'
import { labelEstado } from '@/lib/reservas'

const COLOR_ESTADO: Record<string, string> = { nueva: '#a5b4fc', confirmada: '#5ecc6e', pendiente_pago: '#f5b942', revisar_pago: '#ffb86b', cancelada: '#f0706b', no_show: '#7a9050' }
const DIAS_VALIDOS = [7, 14, 30, 90, 180]

export default async function MetricasPage({ searchParams }: { searchParams: Promise<{ dias?: string; agrupar?: string; acum?: string }> }) {
  const ctx = await getContexto()
  if (!ctx.modulosActivos.metricas) redirect('/')
  const { supabase, negocio, sede } = ctx
  const sp = await searchParams
  const dias = DIAS_VALIDOS.includes(Number(sp.dias)) ? Number(sp.dias) : 30
  const hoy = hoyEn(negocio.zona_horaria)
  const desde = sumarDias(hoy, -(dias - 1))
  const agrupar = ['dia', 'semana', 'mes'].includes(sp.agrupar ?? '') ? sp.agrupar! : 'auto'
  const modo: Agrupacion = agrupar === 'auto' ? agrupacionAuto(dias) : (agrupar as Agrupacion)
  const acumulado = sp.acum === '1'

  // Reservas del período (RLS + sede elegida)
  let q = supabase.from('reservas').select('cliente_id, fecha, hora, cantidad_personas, estado, sucursal_id').eq('negocio_id', negocio.id).is('eliminado_en', null).gte('fecha', desde).lte('fecha', hoy)
  if (sede) q = q.eq('sucursal_id', sede.id)
  const { data } = await q.limit(20000)
  const periodo = (data ?? []) as FilaReserva[]

  // Clientes del período que ya habían reservado antes (para distinguir recurrentes de nuevos)
  const ids = [...new Set(periodo.filter((r) => r.cliente_id && r.estado !== 'cancelada').map((r) => r.cliente_id!))]
  const previos = new Set<string>()
  for (let i = 0; i < ids.length; i += 100) {
    let p = supabase.from('reservas').select('cliente_id').eq('negocio_id', negocio.id).is('eliminado_en', null).neq('estado', 'cancelada').lt('fecha', desde).in('cliente_id', ids.slice(i, i + 100))
    if (sede) p = p.eq('sucursal_id', sede.id)
    const { data: prev } = await p.limit(5000)
    for (const r of prev ?? []) if (r.cliente_id) previos.add(r.cliente_id)
  }

  const m = calcularMetricas(periodo, previos, dias, hoy)
  const serie = serieEvolucion(m.porDia, modo, acumulado)
  const nombreModo = modo === 'dia' ? 'por día' : modo === 'semana' ? 'por semana' : 'por mes'

  const { data: top } = m.topRecurrentes.length
    ? await supabase.from('clientes').select('id, nombre, telefono').in('id', m.topRecurrentes.map((t) => t.cliente_id))
    : { data: [] as { id: string; nombre: string; telefono: string | null }[] }
  const cliente = new Map((top ?? []).map((c) => [c.id, c]))

  const nombresSede = new Map(ctx.sedesTodas.map((x) => [x.id, x.nombre]))
  const verSedes = ctx.sedesTodas.length > 0 && !sede
  const vacio = m.total === 0 && m.canceladas === 0

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div className="animate-fade-up">
          <h1 className="flex items-center gap-2 text-xl font-bold sm:text-2xl"><BarChart3 className="text-rs-lime" size={22} />Métricas</h1>
          <p className="text-sm text-rs-muted">{negocio.nombre}{sede ? ` · ${sede.nombre}` : ''} · {fechaCorta(desde)} al {fechaCorta(hoy)}</p>
        </div>
        <SelectorPeriodo dias={dias} agrupar={agrupar} acumulado={acumulado} />
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3 sm:gap-4">
        <Tile i={0} valor={m.total} etiqueta={`Reservas (${dias} días)`} color="text-rs-lav" sub={m.canceladas ? `${m.canceladas} cancelada${m.canceladas > 1 ? 's' : ''} aparte` : 'Sin cancelaciones'} />
        <div className="reveal card card-hover p-4 sm:p-5" style={{ ['--i' as string]: 1 }}>
          <div className="text-2xl font-bold tabular-nums text-rs-ok sm:text-3xl">{m.promPersonas.toLocaleString('es-AR')}</div>
          <div className="card-title mt-3">Prom. personas</div><div className="mt-1 text-xs text-rs-muted/80">por reserva</div>
        </div>
        <div className="reveal card card-hover p-4 sm:p-5" style={{ ['--i' as string]: 2 }}>
          <div className="text-2xl font-bold tabular-nums text-rs-ok sm:text-3xl">{m.horarioTop ?? '—'}</div>
          <div className="card-title mt-3">Horario top</div><div className="mt-1 text-xs text-rs-muted/80">el más reservado</div>
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <TarjetaGrafico i={3} titulo={`Evolución ${nombreModo}${acumulado ? ' (acumulada)' : ''} — últimos ${dias} días`} vacio={vacio} columnas={[modo === 'dia' ? 'Día' : modo === 'semana' ? 'Semana' : 'Mes', acumulado ? 'Reservas acumuladas' : 'Reservas']} filas={serie.map((d) => [d.titulo, d.valor])} ancho>
          <GraficoLinea puntos={serie} tendencia={!acumulado} />
        </TarjetaGrafico>
        <TarjetaGrafico i={4} titulo={`Días más fuertes — últimos ${dias} días`} vacio={vacio} columnas={['Día', 'Reservas']} filas={m.porDiaSemana.map((d) => [d.etiqueta, d.valor])}>
          <GraficoColumnas datos={m.porDiaSemana} />
        </TarjetaGrafico>
        <TarjetaGrafico i={5} titulo={`Horarios más reservados — últimos ${dias} días`} vacio={m.porHorario.length === 0} columnas={['Horario', 'Reservas']} filas={m.porHorario.map((d) => [d.etiqueta, d.valor])}>
          <BarrasHorizontales datos={m.porHorario} />
        </TarjetaGrafico>
        <TarjetaGrafico i={6} titulo={`Reservas por estado — últimos ${dias} días`} vacio={m.porEstado.length === 0} columnas={['Estado', 'Reservas']} filas={m.porEstado.map((d) => [labelEstado(d.estado), d.valor])}>
          <BarraApilada datos={m.porEstado.map((d) => ({ etiqueta: labelEstado(d.estado), valor: d.valor, color: COLOR_ESTADO[d.estado] ?? '#7a9050' }))} />
        </TarjetaGrafico>
        {verSedes && (
          <TarjetaGrafico i={7} titulo={`Reservas por sede — últimos ${dias} días`} vacio={m.porSede.length === 0} columnas={['Sede', 'Reservas']} filas={m.porSede.map((d) => [d.sucursal_id ? nombresSede.get(d.sucursal_id) ?? '—' : 'Sin sede', d.valor])}>
            <BarrasHorizontales datos={m.porSede.map((d) => ({ etiqueta: d.sucursal_id ? nombresSede.get(d.sucursal_id) ?? '—' : 'Sin sede', valor: d.valor }))} />
          </TarjetaGrafico>
        )}
      </div>

      <section className="reveal card p-5" style={{ ['--i' as string]: 8 }}>
        <h2 className="card-title">Clientes recurrentes — últimos {dias} días</h2>
        <div className="mt-4 grid gap-6 md:grid-cols-[minmax(0,1fr)_minmax(0,1.4fr)]">
          <div>
            <div className="text-4xl font-bold tabular-nums text-rs-lime">{m.pctRecurrentes.toLocaleString('es-AR', { minimumFractionDigits: 1 })}%</div>
            <p className="mt-1 text-sm text-rs-muted">de clientes son recurrentes</p>
            <div className="mt-5 grid grid-cols-2 gap-4 border-t border-rs-border pt-4">
              <div><div className="text-2xl font-bold tabular-nums text-rs-ok">{m.recurrentes}</div><div className="text-xs text-rs-muted">recurrentes</div></div>
              <div><div className="text-2xl font-bold tabular-nums">{m.nuevos}</div><div className="text-xs text-rs-muted">nuevos</div></div>
            </div>
            <p className="mt-4 text-xs text-rs-muted">Recurrente: reservó 2 o más veces en el período, o ya había reservado antes. Solo cuentan clientes con teléfono.</p>
          </div>
          <div>
            <h3 className="card-title mb-2">Los que más vuelven</h3>
            {m.topRecurrentes.length === 0 ? <p className="py-6 text-sm text-rs-muted">No hay clientes recurrentes en este período.</p> : (
              <ul className="divide-y divide-rs-border/60">
                {m.topRecurrentes.map((t) => {
                  const c = cliente.get(t.cliente_id)
                  return (
                    <li key={t.cliente_id} className="flex items-center justify-between gap-3 py-2.5 text-sm">
                      <Link href={`/clientes/${t.cliente_id}`} className="min-w-0 truncate font-medium transition-colors hover:text-rs-lime">{c?.nombre ?? 'Cliente'}<span className="ml-2 text-xs font-normal text-rs-muted">{c?.telefono}</span></Link>
                      <span className="shrink-0 tabular-nums"><span className="font-semibold">{t.reservas}</span> <span className="text-xs text-rs-muted">reservas · última {fechaCorta(t.ultima)}</span></span>
                    </li>
                  )
                })}
              </ul>
            )}
          </div>
        </div>
      </section>
    </div>
  )
}
