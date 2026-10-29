import Link from 'next/link'
import { redirect } from 'next/navigation'
import { BarChart3 } from 'lucide-react'
import { BarraApilada, BarrasHorizontales, GraficoColumnas, GraficoLinea, TarjetaGrafico } from '@/components/charts'
import { Tile } from '@/components/dashboard-ui'
import SelectorPeriodo from '@/components/selector-periodo'
import { getContexto } from '@/lib/context'
import { fechaCorta, hoyEn, sumarDias } from '@/lib/fechas'
import { agrupacionAuto, calcularMetricas, serieEvolucion, type Agrupacion, type FilaReserva } from '@/lib/metricas'
import { calcularMetricasPedidos, clavePedido, topProductos, type FilaItemPedido, type FilaPedido } from '@/lib/metricas-pedidos'
import { dinero, labelEstadoPedido, labelPago, labelTipo } from '@/lib/pedidos'
import { labelEstado } from '@/lib/reservas'

const COLOR_ESTADO: Record<string, string> = { nueva: '#a5b4fc', confirmada: '#5ecc6e', pendiente_pago: '#f5b942', revisar_pago: '#ffb86b', cancelada: '#f0706b', no_show: '#7a9050' }
const DIAS_VALIDOS = [7, 14, 30, 90, 180]

type Ctx = Awaited<ReturnType<typeof getContexto>>
interface Periodo { ctx: Ctx; dias: number; hoy: string; desde: string; modo: Agrupacion; nombreModo: string }

export default async function MetricasPage({ searchParams }: { searchParams: Promise<{ dias?: string; agrupar?: string; seccion?: string }> }) {
  const ctx = await getContexto()
  if (!ctx.modulosActivos.metricas) redirect('/')
  const { negocio, sede } = ctx
  const sp = await searchParams
  const dias = DIAS_VALIDOS.includes(Number(sp.dias)) ? Number(sp.dias) : 30
  const hoy = hoyEn(negocio.zona_horaria)
  const desde = sumarDias(hoy, -(dias - 1))
  const agrupar = ['dia', 'semana', 'mes'].includes(sp.agrupar ?? '') ? sp.agrupar! : 'auto'
  const modo: Agrupacion = agrupar === 'auto' ? agrupacionAuto(dias) : (agrupar as Agrupacion)
  const nombreModo = modo === 'dia' ? 'por día' : modo === 'semana' ? 'por semana' : 'por mes'
  // Un local puede tener reservas, pedidos o las dos cosas: se muestra lo que usa (con pestañas si usa las dos)
  const hayReservas = ctx.modulosActivos.reservas, hayPedidos = ctx.modulosActivos.pedidos
  const seccion = sp.seccion === 'pedidos' && hayPedidos ? 'pedidos' : sp.seccion === 'reservas' && hayReservas ? 'reservas' : hayReservas ? 'reservas' : 'pedidos'
  const periodo: Periodo = { ctx, dias, hoy, desde, modo, nombreModo }
  const hrefSeccion = (s: string) => `/metricas?${new URLSearchParams({ seccion: s, dias: String(dias), ...(agrupar !== 'auto' ? { agrupar } : {}) }).toString()}`

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div className="animate-fade-up">
          <h1 className="flex items-center gap-2 text-xl font-bold sm:text-2xl"><BarChart3 className="text-rs-lime" size={22} />Métricas</h1>
          <p className="text-sm text-rs-muted">{negocio.nombre}{sede ? ` · ${sede.nombre}` : ''} · {fechaCorta(desde)} al {fechaCorta(hoy)}</p>
        </div>
        <SelectorPeriodo dias={dias} agrupar={agrupar} seccion={seccion} />
      </div>

      {hayReservas && hayPedidos && (
        <nav aria-label="Qué métricas ver" className="flex gap-2">
          {[['reservas', 'Reservas'], ['pedidos', 'Pedidos']].map(([s, l]) => (
            <Link key={s} href={hrefSeccion(s)} aria-current={seccion === s ? 'page' : undefined} className={'inline-flex h-9 items-center rounded-full border px-4 text-sm font-semibold transition ' + (seccion === s ? 'border-rs-lime/70 bg-rs-lime/15 text-rs-lime' : 'border-rs-control text-rs-muted hover:border-rs-lime/40 hover:text-rs-text')}>{l}</Link>
          ))}
        </nav>
      )}

      {!hayReservas && !hayPedidos ? (
        <p className="card p-6 text-sm text-rs-muted">Las métricas se calculan con las reservas y los pedidos. Este negocio no tiene ninguno de los dos módulos encendidos.</p>
      ) : seccion === 'pedidos' ? <MetricasDePedidos p={periodo} /> : <MetricasDeReservas p={periodo} />}
    </div>
  )
}

async function MetricasDeReservas({ p }: { p: Periodo }) {
  const { ctx, dias, hoy, desde, modo, nombreModo } = p
  const { supabase, negocio, sede } = ctx
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
  const serie = serieEvolucion(m.porDia, modo)

  const { data: top } = m.topRecurrentes.length
    ? await supabase.from('clientes').select('id, nombre, telefono').in('id', m.topRecurrentes.map((t) => t.cliente_id))
    : { data: [] as { id: string; nombre: string; telefono: string | null }[] }
  const cliente = new Map((top ?? []).map((c) => [c.id, c]))

  const nombresSede = new Map(ctx.sedesTodas.map((x) => [x.id, x.nombre]))
  const verSedes = ctx.sedesTodas.length > 0 && !sede
  const vacio = m.total === 0 && m.canceladas === 0


  return (
    <>
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
        <TarjetaGrafico i={3} titulo={`Evolución ${nombreModo} — últimos ${dias} días`} vacio={vacio} columnas={[modo === 'dia' ? 'Día' : modo === 'semana' ? 'Semana' : 'Mes', 'Reservas']} filas={serie.map((d) => [d.titulo, d.valor])} ancho>
          <GraficoLinea puntos={serie} tendencia />
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
    </>
  )
}

const COLOR_ESTADO_PEDIDO: Record<string, string> = { nuevo: '#a5b4fc', aceptado: '#c8e62b', preparando: '#f5b942', listo: '#5ecc6e', en_camino: '#5ecc6e', entregado: '#7a9050', cancelado: '#f0706b' }
const COLOR_TIPO: Record<string, string> = { retiro: '#a5b4fc', delivery: '#f5b942', mesa: '#5ecc6e' }
const COLOR_PAGO: Record<string, string> = { efectivo: '#5ecc6e', transferencia: '#a5b4fc', tarjeta: '#f5b942' }

async function MetricasDePedidos({ p }: { p: Periodo }) {
  const { ctx, dias, hoy, desde, modo, nombreModo } = p
  const { supabase, negocio, sede } = ctx
  // Pedidos del período (un día de margen: el corte por día se hace en la zona horaria del negocio)
  const { data } = await supabase.from('pedidos').select('id, cliente_id, nombre, telefono, tipo, medio_pago, estado, total, creado_en').eq('negocio_id', negocio.id).gte('creado_en', `${sumarDias(desde, -1)}T00:00:00Z`).limit(20000)
  const crudos = ((data ?? []) as (FilaPedido & { id: string })[]).map((r) => ({ ...r, total: Number(r.total) }))
  const fechaLocal = new Intl.DateTimeFormat('en-CA', { timeZone: negocio.zona_horaria, year: 'numeric', month: '2-digit', day: '2-digit' })
  const filas = crudos.filter((r) => { const f = fechaLocal.format(new Date(r.creado_en)); return f >= desde && f <= hoy })

  // Clientes del período que ya habían pedido antes (para distinguir recurrentes de nuevos)
  const claves = [...new Set(filas.filter((r) => r.estado !== 'cancelado').map((r) => clavePedido(r)).filter((k): k is string => !!k))]
  const previos = new Set<string>()
  const ids = claves.filter((k) => !k.startsWith('tel:')), tels = claves.filter((k) => k.startsWith('tel:')).map((k) => k.slice(4))
  for (let i = 0; i < ids.length; i += 100) {
    const { data: prev } = await supabase.from('pedidos').select('cliente_id').eq('negocio_id', negocio.id).neq('estado', 'cancelado').lt('creado_en', `${desde}T00:00:00-03:00`).in('cliente_id', ids.slice(i, i + 100)).limit(5000)
    for (const r of prev ?? []) if (r.cliente_id) previos.add(r.cliente_id as string)
  }
  for (let i = 0; i < tels.length; i += 100) {
    const { data: prev } = await supabase.from('pedidos').select('telefono').eq('negocio_id', negocio.id).neq('estado', 'cancelado').is('cliente_id', null).lt('creado_en', `${desde}T00:00:00-03:00`).in('telefono', tels.slice(i, i + 100)).limit(5000)
    for (const r of prev ?? []) if (r.telefono) previos.add(`tel:${r.telefono}`)
  }

  const m = calcularMetricasPedidos(filas, previos, dias, hoy, negocio.zona_horaria)
  const serie = serieEvolucion(m.porDia, modo)
  const serieVentas = serieEvolucion(m.ventasPorDia, modo)

  // Productos más pedidos del período (sin los cancelados)
  const idsValidos = filas.filter((r) => r.estado !== 'cancelado').map((r) => r.id)
  const items: FilaItemPedido[] = []
  for (let i = 0; i < idsValidos.length; i += 150) {
    const { data: it } = await supabase.from('pedido_items').select('nombre, variante, cantidad, subtotal').eq('negocio_id', negocio.id).in('pedido_id', idsValidos.slice(i, i + 150)).limit(10000)
    items.push(...((it ?? []) as FilaItemPedido[]))
  }
  const productos = topProductos(items)
  const vacio = m.total === 0 && m.cancelados === 0
  const etapa = modo === 'dia' ? 'Día' : modo === 'semana' ? 'Semana' : 'Mes'

  return (
    <>
      {sede && <p className="rounded-md bg-rs-raised/50 px-3 py-2 text-xs text-rs-muted">Los pedidos no se registran por sede: acá ves los de todo el negocio.</p>}
      <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
        <Tile i={0} valor={m.total} etiqueta={`Pedidos (${dias} días)`} color="text-rs-lav" sub={m.cancelados ? `${m.cancelados} cancelado${m.cancelados > 1 ? 's' : ''} aparte` : 'Sin cancelaciones'} />
        <div className="reveal card card-hover p-4 sm:p-5" style={{ ['--i' as string]: 1 }}>
          <div className="text-2xl font-bold tabular-nums text-rs-ok sm:text-3xl">{dinero(m.ventas)}</div>
          <div className="card-title mt-3">Ventas</div><div className="mt-1 text-xs text-rs-muted/80">sin contar cancelados</div>
        </div>
        <div className="reveal card card-hover p-4 sm:p-5" style={{ ['--i' as string]: 2 }}>
          <div className="text-2xl font-bold tabular-nums text-rs-ok sm:text-3xl">{m.total ? dinero(m.ticket) : '—'}</div>
          <div className="card-title mt-3">Ticket promedio</div><div className="mt-1 text-xs text-rs-muted/80">por pedido</div>
        </div>
        <div className="reveal card card-hover p-4 sm:p-5" style={{ ['--i' as string]: 3 }}>
          <div className="text-2xl font-bold tabular-nums text-rs-ok sm:text-3xl">{m.horaTop ?? '—'}</div>
          <div className="card-title mt-3">Hora pico</div><div className="mt-1 text-xs text-rs-muted/80">la que más pedidos recibe</div>
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <TarjetaGrafico i={4} titulo={`Pedidos ${nombreModo} — últimos ${dias} días`} vacio={vacio} columnas={[etapa, 'Pedidos']} filas={serie.map((d) => [d.titulo, d.valor])}>
          <GraficoLinea puntos={serie} unidad="pedidos" tendencia />
        </TarjetaGrafico>
        <TarjetaGrafico i={5} titulo={`Ventas ${nombreModo} — últimos ${dias} días`} vacio={vacio} columnas={[etapa, 'Ventas']} filas={serieVentas.map((d) => [d.titulo, dinero(d.valor)])}>
          <GraficoLinea puntos={serieVentas} unidad="en ventas" tendencia formato="dinero" />
        </TarjetaGrafico>
        <TarjetaGrafico i={6} titulo={`Días más fuertes — últimos ${dias} días`} vacio={vacio} columnas={['Día', 'Pedidos']} filas={m.porDiaSemana.map((d) => [d.etiqueta, d.valor])}>
          <GraficoColumnas datos={m.porDiaSemana} unidad="pedidos" titulo="Pedidos por día de la semana" />
        </TarjetaGrafico>
        <TarjetaGrafico i={7} titulo={`Horas con más pedidos — últimos ${dias} días`} vacio={m.porHora.length === 0} columnas={['Hora', 'Pedidos']} filas={m.porHora.map((d) => [d.etiqueta, d.valor])}>
          <BarrasHorizontales datos={m.porHora} unidad="pedidos" />
        </TarjetaGrafico>
        <TarjetaGrafico i={8} titulo={`Productos más pedidos — últimos ${dias} días`} vacio={productos.length === 0} columnas={['Producto', 'Unidades', 'Ventas']} filas={productos.map((d) => [d.etiqueta, d.valor, dinero(d.ventas)])}>
          <BarrasHorizontales datos={productos} unidad="unidades" anchoEtiqueta="9rem" />
        </TarjetaGrafico>
        <TarjetaGrafico i={9} titulo={`Pedidos por tipo — últimos ${dias} días`} vacio={m.porTipo.length === 0} columnas={['Tipo', 'Pedidos']} filas={m.porTipo.map((d) => [labelTipo(d.tipo), d.valor])}>
          <BarraApilada datos={m.porTipo.map((d) => ({ etiqueta: labelTipo(d.tipo), valor: d.valor, color: COLOR_TIPO[d.tipo] ?? '#7a9050' }))} />
        </TarjetaGrafico>
        <TarjetaGrafico i={10} titulo={`Medios de pago — últimos ${dias} días`} vacio={m.porPago.length === 0} columnas={['Medio', 'Pedidos']} filas={m.porPago.map((d) => [labelPago(d.medio), d.valor])}>
          <BarraApilada datos={m.porPago.map((d) => ({ etiqueta: labelPago(d.medio), valor: d.valor, color: COLOR_PAGO[d.medio] ?? '#7a9050' }))} />
        </TarjetaGrafico>
        <TarjetaGrafico i={11} titulo={`Pedidos por estado — últimos ${dias} días`} vacio={m.porEstado.length === 0} columnas={['Estado', 'Pedidos']} filas={m.porEstado.map((d) => [labelEstadoPedido(d.estado), d.valor])}>
          <BarraApilada datos={m.porEstado.map((d) => ({ etiqueta: labelEstadoPedido(d.estado), valor: d.valor, color: COLOR_ESTADO_PEDIDO[d.estado] ?? '#7a9050' }))} />
        </TarjetaGrafico>
      </div>

      <section className="reveal card p-5" style={{ ['--i' as string]: 12 }}>
        <h2 className="card-title">Clientes que piden — últimos {dias} días</h2>
        <div className="mt-4 grid gap-6 md:grid-cols-[minmax(0,1fr)_minmax(0,1.4fr)]">
          <div>
            <div className="text-4xl font-bold tabular-nums text-rs-lime">{m.pctRecurrentes.toLocaleString('es-AR', { minimumFractionDigits: 1 })}%</div>
            <p className="mt-1 text-sm text-rs-muted">de clientes son recurrentes</p>
            <div className="mt-5 grid grid-cols-2 gap-4 border-t border-rs-border pt-4">
              <div><div className="text-2xl font-bold tabular-nums text-rs-ok">{m.recurrentes}</div><div className="text-xs text-rs-muted">recurrentes</div></div>
              <div><div className="text-2xl font-bold tabular-nums">{m.nuevos}</div><div className="text-xs text-rs-muted">nuevos</div></div>
            </div>
            <p className="mt-4 text-xs text-rs-muted">Recurrente: pidió 2 o más veces en el período, o ya había pedido antes. Solo cuentan pedidos con cliente o teléfono.</p>
          </div>
          <div>
            <h3 className="card-title mb-2">Los que más piden</h3>
            {m.topClientes.length === 0 ? <p className="py-6 text-sm text-rs-muted">No hay pedidos de clientes identificados en este período.</p> : (
              <ul className="divide-y divide-rs-border/60">
                {m.topClientes.map((c) => (
                  <li key={c.clave} className="flex items-center justify-between gap-3 py-2.5 text-sm">
                    {c.cliente_id
                      ? <Link href={`/clientes/${c.cliente_id}`} className="min-w-0 truncate font-medium transition-colors hover:text-rs-lime">{c.nombre || 'Cliente'}<span className="ml-2 text-xs font-normal text-rs-muted">{c.telefono}</span></Link>
                      : <span className="min-w-0 truncate font-medium">{c.nombre || 'Cliente'}<span className="ml-2 text-xs font-normal text-rs-muted">{c.telefono}</span></span>}
                    <span className="shrink-0 tabular-nums"><span className="font-semibold">{c.pedidos}</span> <span className="text-xs text-rs-muted">pedidos · {dinero(c.gastado)} · último {fechaCorta(c.ultima)}</span></span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      </section>
    </>
  )
}
