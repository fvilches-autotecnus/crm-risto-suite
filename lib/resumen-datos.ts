import 'server-only'
import type { Contexto } from '@/lib/context'
import { hoyEn, sumarDias } from '@/lib/fechas'

/**
 * Datos de la pantalla "Resumen del dueño". Todo sale de lo que el CRM ya guarda (reservas, pedidos, clientes, reseñas): no hay POS, así que
 *  · el dinero SOLO aparece donde hay pedidos (cada pedido trae su total); en reservas no se inventa un ticket;
 *  · "lo que hizo el asistente" cuenta lo que entró sin carga manual (es_manual = false / origen bot o web).
 */

export interface Comparado { valor: number; antes: number }
export interface ClienteResumen { id: string; nombre: string; telefono: string | null; visitas: number; ultima: string; gasto: number }

export interface DatosResumen {
  dias: number
  inactivoDias: number
  hoy: string
  /** Primer y último día del período mirado (el último es hoy salvo que se haya elegido un rango). */
  desde: string
  hasta: string
  logros: {
    clientesNuevos: Comparado
    reservas: (Comparado & { personas: number }) | null
    pedidos: (Comparado & { ventas: number; ventasAntes: number }) | null
    resenas5: (Comparado & { quejasPrivadas: number }) | null
  }
  riesgo: { habituales: number; conPedidos: number; potencial: number | null; ticketPromedio: number | null; lista: ClienteResumen[] }
  mejores: ClienteResumen[]
}

const VISITAS_HABITUAL = 2     // un cliente "habitual" tiene al menos 2 visitas (días distintos con reserva confirmada o pedido)
const HISTORIAL_DIAS = 540     // cuánto historial se mira para saber quién es habitual y cuándo vino por última vez
const MAX_FILAS = 50000
const inicio = (f: string) => `${f}T00:00:00-03:00`
const fin = (f: string) => `${f}T23:59:59-03:00`

type Fila = Record<string, unknown>
const dia = (iso: string, zona: string) => hoyEn(zona, new Date(iso))

export async function cargarResumen(ctx: Contexto, opt: { dias: number; hasta?: string; inactivoDias: number }): Promise<DatosResumen> {
  const { supabase, negocio, sede } = ctx
  const mod = ctx.modulosActivos
  const hoy = hoyEn(negocio.zona_horaria)
  const hasta = opt.hasta && opt.hasta <= hoy ? opt.hasta : hoy   // último día del período (hoy, o el final de un rango elegido)
  const desde = sumarDias(hasta, -(opt.dias - 1))
  const antDesde = sumarDias(desde, -opt.dias)
  const enPeriodo = (f: string) => f >= desde && f <= hasta
  const enAnterior = (f: string) => f >= antDesde && f < desde
  const limiteInactivo = sumarDias(hoy, -opt.inactivoDias)
  const histDesde = sumarDias(hoy, -HISTORIAL_DIAS)

  // ───────── Lo que hizo el asistente (período y período anterior)
  const nuevos = async (d: string, h: string) => (await supabase.from('clientes').select('id', { count: 'exact', head: true }).eq('negocio_id', negocio.id)
    .or('es_demo.is.null,es_demo.eq.false').gte('creado_en', inicio(d)).lte('creado_en', fin(h))).count ?? 0

  const [cNuevos, cNuevosAnt, resRows, pedAsist, resenasRows, resHist, pedHist] = await Promise.all([
    nuevos(desde, hasta), nuevos(antDesde, sumarDias(desde, -1)),
    mod.reservas
      ? (async () => { let q = supabase.from('reservas').select('estado, cantidad_personas, creado_en').eq('negocio_id', negocio.id).eq('es_manual', false).is('eliminado_en', null).gte('creado_en', inicio(antDesde)).lte('creado_en', fin(hasta)); if (sede) q = q.eq('sucursal_id', sede.id); return ((await q.limit(MAX_FILAS)).data ?? []) as Fila[] })()
      : Promise.resolve([] as Fila[]),
    mod.pedidos
      ? (async () => ((await supabase.from('pedidos').select('estado, total, creado_en').eq('negocio_id', negocio.id).in('origen', ['bot', 'web']).gte('creado_en', inicio(antDesde)).lte('creado_en', fin(hasta)).limit(MAX_FILAS)).data ?? []) as Fila[])()
      : Promise.resolve([] as Fila[]),
    mod.resenas
      ? (async () => { let q = supabase.from('resenas').select('puntaje, origen, fecha').eq('negocio_id', negocio.id).gte('fecha', antDesde).lte('fecha', hasta); if (sede) q = q.eq('sucursal_id', sede.id); return ((await q.limit(MAX_FILAS)).data ?? []) as Fila[] })()
      : Promise.resolve([] as Fila[]),
    // historial de visitas para "habituales" y "mejores clientes"
    mod.reservas
      ? (async () => { let q = supabase.from('reservas').select('cliente_id, fecha').eq('negocio_id', negocio.id).eq('estado', 'confirmada').is('eliminado_en', null).not('cliente_id', 'is', null).gte('fecha', histDesde).lte('fecha', hoy); if (sede) q = q.eq('sucursal_id', sede.id); return ((await q.limit(MAX_FILAS)).data ?? []) as Fila[] })()
      : Promise.resolve([] as Fila[]),
    mod.pedidos
      ? (async () => ((await supabase.from('pedidos').select('cliente_id, total, creado_en').eq('negocio_id', negocio.id).neq('estado', 'cancelado').gte('creado_en', inicio(histDesde)).lte('creado_en', fin(hoy)).limit(MAX_FILAS)).data ?? []) as Fila[])()
      : Promise.resolve([] as Fila[]),
  ])

  const porPeriodo = <T,>(filas: Fila[], fecha: (f: Fila) => string, sumar: (f: Fila) => T, cero: T, suma: (a: T, b: T) => T) => {
    let a = cero, p = cero
    for (const f of filas) { const d = fecha(f); if (enPeriodo(d)) a = suma(a, sumar(f)); else if (enAnterior(d)) p = suma(p, sumar(f)) }
    return { a, p }
  }

  const reservas = mod.reservas ? (() => {
    const v = resRows.filter((r) => r.estado !== 'cancelada')
    const c = porPeriodo(v, (f) => dia(String(f.creado_en), negocio.zona_horaria), () => 1, 0, (x, y) => x + y)
    const pe = porPeriodo(v, (f) => dia(String(f.creado_en), negocio.zona_horaria), (f) => Number(f.cantidad_personas) || 0, 0, (x, y) => x + y)
    return { valor: c.a, antes: c.p, personas: pe.a }
  })() : null

  const pedidos = mod.pedidos ? (() => {
    const v = pedAsist.filter((r) => r.estado !== 'cancelado')
    const c = porPeriodo(v, (f) => dia(String(f.creado_en), negocio.zona_horaria), () => 1, 0, (x, y) => x + y)
    const t = porPeriodo(v, (f) => dia(String(f.creado_en), negocio.zona_horaria), (f) => Number(f.total) || 0, 0, (x, y) => x + y)
    return { valor: c.a, antes: c.p, ventas: t.a, ventasAntes: t.p }
  })() : null

  const resenas5 = mod.resenas ? (() => {
    const g5 = resenasRows.filter((r) => r.origen === 'google' && Number(r.puntaje) === 5)
    const q = resenasRows.filter((r) => r.origen === 'encuesta' && Number(r.puntaje) <= 3)
    const a = porPeriodo(g5, (f) => String(f.fecha), () => 1, 0, (x, y) => x + y)
    const b = porPeriodo(q, (f) => String(f.fecha), () => 1, 0, (x, y) => x + y)
    return { valor: a.a, antes: a.p, quejasPrivadas: b.a }
  })() : null

  // ───────── Historial por cliente: visitas (días distintos), última visita, gasto (solo pedidos) y ticket propio
  interface Acum { dias: Set<string>; ultima: string; gasto: number; pedidosDias: Set<string>; gastoPeriodo: number; diasPeriodo: Set<string> }
  const por = new Map<string, Acum>()
  const acum = (id: string) => { let a = por.get(id); if (!a) { a = { dias: new Set(), ultima: '', gasto: 0, pedidosDias: new Set(), gastoPeriodo: 0, diasPeriodo: new Set() }; por.set(id, a) } return a }
  for (const r of resHist) { const id = String(r.cliente_id), f = String(r.fecha); const a = acum(id); a.dias.add(f); if (f > a.ultima) a.ultima = f; if (enPeriodo(f)) a.diasPeriodo.add(f) }
  let sumaTickets = 0, nTickets = 0
  const desde90 = sumarDias(hoy, -89)
  for (const p of pedHist) {
    const f = dia(String(p.creado_en), negocio.zona_horaria), total = Number(p.total) || 0
    if (f >= desde90) { sumaTickets += total; nTickets++ }
    if (!p.cliente_id) continue
    const a = acum(String(p.cliente_id)); a.dias.add(f); a.pedidosDias.add(f); a.gasto += total; if (f > a.ultima) a.ultima = f
    if (enPeriodo(f)) { a.diasPeriodo.add(f); a.gastoPeriodo += total }
  }
  const ticketPromedio = nTickets >= 10 ? sumaTickets / nTickets : null

  const dormidos = [...por.entries()].filter(([, a]) => a.dias.size >= VISITAS_HABITUAL && a.ultima < limiteInactivo && a.ultima >= sumarDias(hoy, -365))
  const conPedidos = dormidos.filter(([, a]) => a.pedidosDias.size >= VISITAS_HABITUAL)
  // Dinero: solo de quienes piden (cada uno con SU ticket promedio: lo que gastó dividido sus pedidos); a quienes solo reservan no se les inventa un monto
  const potencial = mod.pedidos && conPedidos.length ? Math.round(conPedidos.reduce((s, [, a]) => s + a.gasto / a.pedidosDias.size, 0)) : null
  const topDormidos = [...dormidos].sort((x, y) => y[1].dias.size - x[1].dias.size || y[1].gasto - x[1].gasto).slice(0, 5)
  const topMes = [...por.entries()].filter(([, a]) => a.diasPeriodo.size > 0).sort((x, y) => y[1].diasPeriodo.size - x[1].diasPeriodo.size || y[1].gastoPeriodo - x[1].gastoPeriodo).slice(0, 5)

  const ids = [...new Set([...topDormidos, ...topMes].map(([id]) => id))]
  const fichas = new Map<string, { nombre: string; telefono: string | null }>()
  for (let i = 0; i < ids.length; i += 150) {
    const { data } = await supabase.from('clientes').select('id, nombre, telefono').eq('negocio_id', negocio.id).in('id', ids.slice(i, i + 150))
    for (const c of (data ?? []) as { id: string; nombre: string | null; telefono: string | null }[]) fichas.set(c.id, { nombre: c.nombre ?? 'Sin nombre', telefono: c.telefono })
  }
  const armar = (id: string, a: Acum, delPeriodo: boolean): ClienteResumen => ({ id, nombre: fichas.get(id)?.nombre ?? 'Sin nombre', telefono: fichas.get(id)?.telefono ?? null,
    visitas: delPeriodo ? a.diasPeriodo.size : a.dias.size, ultima: a.ultima, gasto: delPeriodo ? a.gastoPeriodo : a.gasto })

  return {
    dias: opt.dias, inactivoDias: opt.inactivoDias, hoy, desde, hasta,
    logros: { clientesNuevos: { valor: cNuevos, antes: cNuevosAnt }, reservas, pedidos, resenas5 },
    riesgo: { habituales: dormidos.length, conPedidos: conPedidos.length, potencial, ticketPromedio, lista: topDormidos.map(([id, a]) => armar(id, a, false)) },
    mejores: topMes.map(([id, a]) => armar(id, a, true)),
  }
}
