import Link from 'next/link'
import { redirect } from 'next/navigation'
import { AlertTriangle, Crown, MessageCircle, Radar, Sparkles, TrendingUp } from 'lucide-react'
import { CeldaVista } from '@/components/prediccion-demanda'
import { getContexto } from '@/lib/context'
import { fechaCorta } from '@/lib/fechas'
import { dinero, linkWhatsApp } from '@/lib/pedidos'
import { cargarPrediccion } from '@/lib/prediccion-datos'
import FiltroPeriodo from '@/components/filtro-periodo'
import { diasEnRango, leerRango, rotuloRango } from '@/lib/periodo'
import { ticketTexto } from '@/lib/ticket'
import { hoyEn } from '@/lib/fechas'
import PreguntaIA from '@/components/pregunta-ia'
import { CUPOS, restantesHoy } from '@/lib/ia-cupo'
import { cargarResumen, type ClienteResumen, type Comparado } from '@/lib/resumen-datos'

const DIAS = ['domingo', 'lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado']
const INACTIVOS = [35, 60, 90]
const PERIODOS = [7, 14, 30, 90, 180]
const num = (n: number) => n.toLocaleString('es-AR')

/** "+12% vs período anterior" (sin datos previos no se inventa un porcentaje). */
function delta(c: Comparado): { texto: string; color: string } {
  if (c.antes === 0) return { texto: c.valor === 0 ? 'sin cambios' : 'sin datos del período anterior', color: 'text-rs-muted/80' }
  const p = Math.round(((c.valor - c.antes) / c.antes) * 100)
  return { texto: `${p >= 0 ? '+' : ''}${p}% vs el período anterior (${num(c.antes)})`, color: p >= 0 ? 'text-rs-ok' : 'text-rs-warn' }
}

function Logro({ valor, etiqueta, nota, cambio, ayuda }: { valor: string; etiqueta: string; nota?: string; cambio?: Comparado; ayuda: string }) {
  const d = cambio ? delta(cambio) : null
  return (
    <div className="card min-w-[11.5rem] flex-1 p-4 sm:p-5" title={ayuda}>
      <div className="text-2xl font-bold tabular-nums text-rs-lime sm:text-3xl">{valor}</div>
      <div className="card-title mt-3">{etiqueta}</div>
      {nota && <div className="mt-1 text-xs text-rs-muted">{nota}</div>}
      {d && <div className={'mt-1 text-xs ' + d.color}>{d.texto}</div>}
      <div className="mt-2 text-[11px] leading-snug text-rs-muted/70">{ayuda}</div>
    </div>
  )
}

const primerNombre = (n: string) => { const p = n.trim().split(/\s+/)[0] ?? ''; return !p || /^sin$/i.test(p) ? '' : p.charAt(0).toUpperCase() + p.slice(1).toLowerCase() }

function FilaCliente({ c, texto, boton }: { c: ClienteResumen; texto: string; boton: string }) {
  return (
    <li className="flex items-center justify-between gap-3 py-2">
      <div className="min-w-0">
        <Link href={`/clientes/${c.id}`} className="block truncate font-medium hover:text-rs-lime">{c.nombre}</Link>
        <div className="text-xs text-rs-muted">{texto}</div>
      </div>
      {c.telefono && <a href={linkWhatsApp(c.telefono, boton)} target="_blank" rel="noreferrer" className="btn shrink-0 text-xs"><MessageCircle size={14} />Escribirle</a>}
    </li>
  )
}

export default async function ResumenPage({ searchParams }: { searchParams: Promise<{ inactivo?: string; dias?: string; desde?: string; hasta?: string }> }) {
  const ctx = await getContexto()
  if (!ctx.modulosActivos.resumen || !(ctx.puedeAdministrar || ctx.esMarketing)) redirect('/')
  const { negocio, sede } = ctx
  const mod = ctx.modulosActivos
  const sp = await searchParams
  const hoyReal = hoyEn(negocio.zona_horaria)
  const inact = Math.round(Number(sp.inactivo))
  const inactivoDias = Number.isFinite(inact) && inact >= 7 && inact <= 365 ? inact : 35   // los botones (35/60/90) o el número que se escriba (7 a 365)
  const rango = leerRango(sp, hoyReal)   // período personalizado (?desde=&hasta=): si viene, manda sobre el selector
  const dias = rango ? diasEnRango(rango) : PERIODOS.includes(Number(sp.dias)) ? Number(sp.dias) : 30
  const parametrosPeriodo: Record<string, string> = rango ? { desde: rango.desde, hasta: rango.hasta } : { dias: String(dias) }
  const [d, pr] = await Promise.all([cargarResumen(ctx, { dias, hasta: rango?.hasta, inactivoDias }), mod.reservas ? cargarPrediccion(ctx) : Promise.resolve(null)])
  const { logros } = d

  // Radar: hoy y mañana, con sugerencia para las franjas que vienen flojas
  const dosDias = pr ? pr.pred.dias.slice(0, 2) : []
  const flojas = pr ? dosDias.flatMap((dia) => pr.pred.franjas.flatMap((f) => { const c = dia.celdas[f.clave]; return c && c.banda === 'tranquilo' && c.pct !== null && c.esperado !== null && c.esperado > 0 && c.origen !== 'habitualmente_cerrado' ? [{ dia, f, pct: Math.round(c.pct * 100) }] : [] })) : []

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div className="animate-fade-up">
          <h1 className="flex items-center gap-2 text-xl font-bold sm:text-2xl"><Sparkles className="text-rs-lime" size={22} />Resumen del dueño</h1>
          <p className="text-sm text-rs-muted">{negocio.nombre}{sede ? ` · ${sede.nombre}` : ''} · {rango ? `${rotuloRango(rango)} (${d.dias} ${d.dias === 1 ? 'día' : 'días'})` : `últimos ${d.dias} días (${fechaCorta(d.desde)} al ${fechaCorta(d.hasta)})`}, comparados con los {d.dias} {d.dias === 1 ? 'día' : 'días'} anteriores</p>
        </div>
        <label className="flex flex-wrap items-center gap-2 text-xs font-semibold uppercase tracking-[0.05em] text-rs-muted">Período:
          <FiltroPeriodo ruta="/resumen" param="dias" variante="select" opciones={PERIODOS.map((n) => ({ v: String(n), l: `Últimos ${n} días` }))} actual={String(dias)} desde={rango?.desde} hasta={rango?.hasta} hoy={hoyReal} extra={{ inactivo: sp.inactivo ? String(inactivoDias) : undefined }} />
        </label>
      </div>

      <PreguntaIA restantesIniciales={await restantesHoy(negocio.id, 'pregunta')} tope={CUPOS.pregunta} />

      {/* 1. Lo que el sistema ya hizo por vos */}
      <section aria-labelledby="h-logros" className="space-y-3">
        <h2 id="h-logros" className="flex items-center gap-2 text-lg font-semibold"><TrendingUp size={18} className="text-rs-lime" />Lo que el sistema ya hizo por vos</h2>
        <div className="flex gap-3 overflow-x-auto pb-1">   {/* una sola fila, sean 3, 4 o 5: se reparten el ancho y, si no entran (celular), se desliza hacia el costado */}
          <Logro valor={num(logros.clientesNuevos.valor)} etiqueta="Clientes nuevos" cambio={logros.clientesNuevos} ayuda="Fichas de clientes creadas en el período (personas que escribieron o reservaron por primera vez)." />
          {logros.reservas && <Logro valor={num(logros.reservas.valor)} etiqueta="Reservas tomadas por el asistente" nota={`${num(logros.reservas.personas)} comensales`} cambio={logros.reservas} ayuda="Reservas que entraron solas (bot o sitio web), sin carga manual y sin contar las canceladas." />}
          {logros.reservas?.facturacion && d.ticketReservas && <Logro valor={dinero(logros.reservas.facturacion.valor)} etiqueta="Facturación estimada de reservas" nota={`Estimado: ${ticketTexto(d.ticketReservas)}`} cambio={logros.reservas.facturacion} ayuda="Reservas tomadas por el asistente multiplicadas por el ticket promedio que cargaste (el sistema no tiene un monto real por mesa)." />}
          {logros.pedidos && <Logro valor={dinero(logros.pedidos.ventas)} etiqueta="Ventas de pedidos del asistente" nota={`${num(logros.pedidos.valor)} pedidos`} cambio={{ valor: logros.pedidos.ventas, antes: logros.pedidos.ventasAntes }} ayuda="Suma del total de los pedidos que entraron por el bot o la carta web, sin contar los cancelados." />}
          {logros.resenas5 && <Logro valor={num(logros.resenas5.valor)} etiqueta={logros.resenas5.validadas ? 'Reseñas de 5★ validadas' : 'Reseñas de 5★ en Google'} nota={`${num(logros.resenas5.quejasPrivadas)} quejas recibidas en privado`} cambio={logros.resenas5} ayuda={(logros.resenas5.validadas ? 'Reseñas de 5 estrellas que generaron voucher: el sistema las validó.' : 'Reseñas de 5 estrellas con origen Google (sin validar: este negocio no usa vouchers).')} />}
        </div>
        {mod.reservas && !d.ticketReservas && <p className="text-xs text-rs-muted">Para ver una estimación en pesos de las reservas, cargá el ticket promedio en <Link href="/configuracion#ticket" className="underline">Configuración</Link>.</p>}
      </section>

      {/* 2. Dinero en riesgo */}
      <section aria-labelledby="h-riesgo" className="rounded-lg border border-rs-warn/40 bg-rs-warn/10 p-4 sm:p-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <h2 id="h-riesgo" className="flex items-center gap-2 text-lg font-semibold text-rs-warn"><AlertTriangle size={18} />Oportunidad detectada en tu base de clientes</h2>
          <nav aria-label="Cuántos días sin venir" className="flex items-center gap-1.5 text-xs">
            <span className="text-rs-muted">Sin venir hace más de</span>
            {INACTIVOS.map((n) => <Link key={n} href={`/resumen?${new URLSearchParams({ ...parametrosPeriodo, inactivo: String(n) }).toString()}`} aria-current={n === d.inactivoDias ? 'page' : undefined} className={'rounded-full border px-2.5 py-1 font-semibold ' + (n === d.inactivoDias ? 'border-rs-warn bg-rs-warn/20 text-rs-warn' : 'border-rs-control text-rs-muted')}>{n} días</Link>)}
            <form action="/resumen" className="ml-1 flex items-center gap-1">
              {Object.entries(parametrosPeriodo).map(([k, v]) => <input key={k} type="hidden" name={k} value={v} />)}
              <label htmlFor="inactivo_n" className="sr-only">Otra cantidad de días sin venir</label>
              <input id="inactivo_n" name="inactivo" type="number" min={7} max={365} step={1} placeholder="otro" defaultValue={INACTIVOS.includes(d.inactivoDias) ? '' : d.inactivoDias} className="input h-7 w-16 px-2 text-xs" />
              <button className="rounded-full border border-rs-control px-2.5 py-1 font-semibold text-rs-muted">Aplicar</button>
            </form>
          </nav>
        </div>
        {d.riesgo.habituales === 0 ? (
          <p className="mt-2 text-sm">No hay clientes habituales (con 2 o más visitas) que lleven más de {d.inactivoDias} días sin venir. 👏</p>
        ) : (
          <>
            <p className="mt-2 text-base">Tenés <strong>{num(d.riesgo.habituales)} {d.riesgo.habituales === 1 ? 'cliente habitual' : 'clientes habituales'}</strong> que no {d.riesgo.habituales === 1 ? 'viene ni pide' : 'vienen ni piden'} hace más de {d.inactivoDias} días.</p>
            {d.riesgo.potencial !== null && (
              <p className="mt-1 text-sm">De ellos, <strong>{num(d.riesgo.conPedidos)}</strong> {d.riesgo.conPedidos === 1 ? 'pedía' : 'pedían'} seguido: si cada uno volviera a pedir una vez, serían ≈ <strong>{dinero(d.riesgo.potencial)}</strong> en ventas
                <span className="text-rs-muted"> (con el ticket de cada uno{d.riesgo.ticketPromedio ? `; el ticket promedio del local es ${dinero(Math.round(d.riesgo.ticketPromedio))}` : ''}). Es un potencial, no plata perdida.</span></p>
            )}
            {d.riesgo.potencialReservas !== null && d.ticketReservas && (
              <p className="mt-1 text-sm">De los que reservaban, <strong>{num(d.riesgo.conReservas)}</strong>: si cada uno volviera a reservar una vez, serían ≈ <strong>{dinero(d.riesgo.potencialReservas)}</strong> <span className="text-rs-muted">(estimado: {ticketTexto(d.ticketReservas)}).</span></p>
            )}
            {d.riesgo.potencial === null && d.riesgo.potencialReservas === null && <p className="mt-1 text-xs text-rs-muted">No se calcula un monto: {mod.reservas ? <>cargá el ticket promedio de las reservas en <Link href="/configuracion#ticket" className="underline">Configuración</Link> para ver una estimación.</> : 'el sistema no conoce cuánto gasta cada cliente.'}</p>}
            <ul className="mt-3 divide-y divide-rs-warn/20 rounded-md bg-rs-bg/40 px-3">
              {d.riesgo.lista.map((c) => <FilaCliente key={c.id} c={c} texto={`${c.visitas} visitas · última ${fechaCorta(c.ultima)}${c.gasto > 0 ? ` · gastó ${dinero(c.gasto)}` : ''}`} boton={`Hola${primerNombre(c.nombre) ? ' ' + primerNombre(c.nombre) : ''}! Hace tiempo que no te vemos por ${negocio.nombre} y te extrañamos. ¿Te esperamos pronto? 🙌`} />)}
            </ul>
            <p className="mt-2 text-xs text-rs-muted">Son los 5 que más venían. Para llegar a todos podés armar una promo o un voucher de reactivación{mod.vouchers ? <> desde <Link href="/vouchers" className="underline">Vouchers</Link></> : ''}.</p>
          </>
        )}
      </section>

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_minmax(0,24rem)]">
        {/* 3. Radar de ocupación */}
        {pr && (
          <section aria-labelledby="h-radar" className="card space-y-3 p-4 sm:p-5">
            <h2 id="h-radar" className="flex items-center gap-2 text-lg font-semibold"><Radar size={18} className="text-rs-lime" />Radar de ocupación · próximas 48 h</h2>
            {pr.pred.aviso && <p className="rounded-md bg-rs-raised/50 px-3 py-2 text-xs text-rs-muted">{pr.pred.aviso}</p>}
            {pr.pred.nivel === 'desactualizado' ? null : (
              <div className="space-y-3">
                {dosDias.map((dia) => (
                  <div key={dia.fecha}>
                    <div className="mb-1 text-sm font-semibold capitalize">{dia.fecha === pr.hoy ? 'Hoy' : 'Mañana'} · {DIAS[dia.dow]} {fechaCorta(dia.fecha)}{dia.feriado ? ` · ${dia.feriado}` : ''}{dia.especial ? ` · ${dia.especial.tipo === 'cerrado' ? 'cerrado' : 'evento'}` : ''}</div>
                    <div className="flex flex-wrap gap-x-6 gap-y-3">
                      {pr.pred.franjas.map((f) => <div key={f.clave}><div className="mb-0.5 text-xs text-rs-muted">{f.etiqueta}</div><CeldaVista c={dia.celdas[f.clave]} /></div>)}
                    </div>
                  </div>
                ))}
              </div>
            )}
            {flojas.length > 0 && (
              <div className="rounded-md border border-rs-ok/40 bg-rs-ok/10 px-3 py-2 text-sm">
                <strong>Sugerencia:</strong> {flojas.map((x) => `${x.dia.fecha === pr.hoy ? 'hoy' : 'mañana'} ${x.f.etiqueta.split(' ')[0].toLowerCase()} (${x.pct}% del aforo)`).join(', ')}: {flojas.length > 1 ? 'vienen' : 'viene'} tranquilo{flojas.length > 1 ? 's' : ''}.
                Podés difundir una promo o un voucher para llenar esas mesas{mod.vouchers ? <> desde <Link href="/vouchers" className="underline">Vouchers</Link></> : ''}.
              </div>
            )}
            <p className="text-xs text-rs-muted">Es una estimación con lo ya reservado y lo que suele sumarse; solo cuenta reservas. El detalle de los próximos 14 días está en <Link href="/metricas" className="underline">Métricas</Link>.</p>
          </section>
        )}

        {/* 4. Mejores clientes */}
        <section aria-labelledby="h-top" className="card p-4 sm:p-5">
          <h2 id="h-top" className="flex items-center gap-2 text-lg font-semibold"><Crown size={18} className="text-rs-lime" />{rango || d.dias !== 30 ? 'Top 5 del período' : 'Top 5 del mes'}</h2>
          <p className="text-xs text-rs-muted">Quienes más vinieron o pidieron {rango ? rotuloRango(rango) : `en los últimos ${d.dias} días`}.</p>
          {d.mejores.length === 0 ? <p className="mt-3 text-sm text-rs-muted">Todavía no hay visitas registradas en el período.</p> : (
            <ul className="mt-2 divide-y divide-rs-border">
              {d.mejores.map((c, i) => <FilaCliente key={c.id} c={c} texto={`${i + 1}º · ${c.visitas} ${c.visitas === 1 ? 'visita' : 'visitas'}${c.gasto > 0 ? ` · ${dinero(c.gasto)} en pedidos` : ''}`} boton={`Hola${primerNombre(c.nombre) ? ' ' + primerNombre(c.nombre) : ''}! Gracias por elegir ${negocio.nombre}, nos encanta tenerte como cliente. 🙌`} />)}
            </ul>
          )}
          <p className="mt-2 text-[11px] text-rs-muted/70">Visitas = días distintos con reserva confirmada o pedido. El gasto es solo de pedidos. «Escribirle» abre WhatsApp con el mensaje armado.</p>
        </section>
      </div>
    </div>
  )
}
