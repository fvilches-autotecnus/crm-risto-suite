'use server'

import { getContexto } from '@/lib/context'
import { fechaCorta, hoyEn, sumarDias } from '@/lib/fechas'
import { agrupacionAuto, serieEvolucion } from '@/lib/metricas'
import { cargarPedidos, cargarReservas, diasEntre } from '@/lib/metricas-datos'
import { dinero, labelEstadoPedido, labelPago, labelTipo } from '@/lib/pedidos'
import { labelEstado } from '@/lib/reservas'
import { REGLAS, pedirResumen, type ResumenIAResult } from '@/lib/ia'
import { ORIGENES_LISTA } from '@/lib/resenas'

const MAX_TEXTOS = 250   // textos que se mandan a la IA (los más recientes)
const MAX_CHARS = 350    // largo máximo de cada texto
const PUNTOS = ['1', '2', '3', '4', '5']

const limpio = (t: string | null) => (t ?? '').replace(/\s+/g, ' ').trim().slice(0, MAX_CHARS)
const sinTags = (t: string) => t.replace(/<\/?datos>/gi, '')   // que un cliente no pueda "cerrar" el bloque de datos

/** Resumen y conclusiones de las reseñas que se ven con los filtros actuales. A la IA solo van puntaje, origen, mes y comentario (nada de nombres ni teléfonos). */
export async function resumirResenas(f: { puntaje?: string; origen?: string; periodo?: string; q?: string }): Promise<ResumenIAResult> {
  const ctx = await getContexto()
  if (!ctx.modulosActivos.resenas) return { ok: false, error: 'Las reseñas no están habilitadas en este negocio.' }
  const { supabase, negocio, sede } = ctx
  const hoy = hoyEn(negocio.zona_horaria)
  const puntaje = PUNTOS.includes(f.puntaje ?? '') ? Number(f.puntaje) : 0
  const origen = ORIGENES_LISTA.some((o) => o.value === f.origen) ? f.origen! : ''
  const periodo = ['30', '90', '365'].includes(f.periodo ?? '') ? f.periodo! : 'todas'
  const q = (f.q ?? '').trim().replace(/[,()%*]/g, ' ')

  let consulta = supabase.from('resenas').select('puntaje, comentario, origen, fecha').eq('negocio_id', negocio.id)
  if (sede) consulta = consulta.eq('sucursal_id', sede.id)
  if (periodo !== 'todas') consulta = consulta.gte('fecha', sumarDias(hoy, -Number(periodo)))
  if (origen) consulta = consulta.eq('origen', origen)
  if (puntaje) consulta = consulta.eq('puntaje', puntaje)
  if (q) consulta = consulta.or(`nombre.ilike.%${q}%,telefono.ilike.%${q}%,comentario.ilike.%${q}%`)
  const { data, error } = await consulta.order('creado_en', { ascending: false }).limit(5000)
  if (error) return { ok: false, error: 'No se pudieron leer las reseñas.' }
  const todas = data ?? []
  if (!todas.length) return { ok: false, error: 'No hay reseñas con estos filtros para resumir.' }

  const conComentario = todas.filter((r) => limpio(r.comentario).length >= 3)
  if (!conComentario.length) return { ok: false, error: 'Ninguna de estas reseñas tiene comentario escrito; solo hay puntajes, no hay texto para analizar.' }
  const promedio = todas.reduce((s, r) => s + r.puntaje, 0) / todas.length
  const dist = [5, 4, 3, 2, 1].map((n) => `${n}★: ${todas.filter((r) => r.puntaje === n).length}`).join(' · ')
  const muestra = conComentario.slice(0, MAX_TEXTOS)
  const lineas = muestra.map((r) => `[${r.puntaje}★ · ${r.origen} · ${String(r.fecha).slice(0, 7)}] ${sinTags(limpio(r.comentario))}`).join('\n')

  const sistema = `Sos analista de reputación de un restaurante. Analizás reseñas de clientes y sacás conclusiones útiles.\n${REGLAS}\nSecciones a devolver (en este orden): "Lo que más valoran", "Lo que molesta o hay que mejorar". Si no hay nada negativo, la segunda puede decirlo en un ítem.`
  const usuario = `Negocio: ${negocio.nombre}${sede ? ` · sede ${sede.nombre}` : ''}.
Período: ${periodo === 'todas' ? 'todas las reseñas' : `últimos ${periodo} días`}${puntaje ? ` · solo de ${puntaje}★` : ''}${origen ? ` · origen ${origen}` : ''}.
Total de reseñas: ${todas.length} (promedio ${promedio.toFixed(1)}). Distribución: ${dist}. Con comentario escrito: ${conComentario.length}.
Comentarios (los más recientes primero${conComentario.length > muestra.length ? `; se muestran ${muestra.length} de ${conComentario.length}` : ''}):
<datos>
${lineas}
</datos>`
  const r = await pedirResumen(sistema, usuario, muestra.map((x) => limpio(x.comentario)))
  if (!r.ok) return r
  return { ok: true, ...r.datos, analizadas: muestra.length, total: todas.length, generado: new Date().toISOString(), modelo: r.modelo,
    nota: `Se analizaron ${conComentario.length > muestra.length ? `los ${muestra.length} comentarios más recientes de ${conComentario.length}` : `${muestra.length} comentarios escritos`} (de ${todas.length} reseñas${conComentario.length < todas.length ? '; las demás no tienen comentario' : ''}).` }
}

/** Resumen y conclusiones de las consultas y reclamos que se ven con los filtros actuales (sin teléfonos). */
export async function resumirConsultas(f: { estado?: string; tipo?: string; q?: string }): Promise<ResumenIAResult> {
  const ctx = await getContexto()
  const { supabase, negocio, sede } = ctx
  const estado = ['pendiente', 'resuelta'].includes(f.estado ?? '') ? f.estado! : 'todas'
  const tipo = ['consulta', 'reclamo'].includes(f.tipo ?? '') ? f.tipo! : 'todos'
  const q = (f.q ?? '').trim().replace(/[,()%*]/g, ' ')

  let consulta = supabase.from('consultas_reclamos').select('mensaje, estado, tipo, creado_en').eq('negocio_id', negocio.id)
  if (sede) consulta = consulta.eq('sucursal_id', sede.id)
  if (estado !== 'todas') consulta = consulta.eq('estado', estado)
  if (tipo !== 'todos') consulta = consulta.eq('tipo', tipo)
  if (q) consulta = consulta.or(`telefono.ilike.%${q}%,mensaje.ilike.%${q}%`)
  const { data, error } = await consulta.order('creado_en', { ascending: false }).limit(5000)
  if (error) return { ok: false, error: 'No se pudieron leer las consultas.' }
  const todas = (data ?? []).filter((c) => limpio(c.mensaje).length >= 3)
  if (!todas.length) return { ok: false, error: 'No hay consultas ni reclamos con estos filtros para resumir.' }

  const muestra = todas.slice(0, MAX_TEXTOS)
  const reclamos = todas.filter((c) => c.tipo === 'reclamo').length, pendientes = todas.filter((c) => c.estado === 'pendiente').length
  const lineas = muestra.map((c) => `[${c.tipo} · ${c.estado} · ${String(c.creado_en).slice(0, 10)}] ${sinTags(limpio(c.mensaje))}`).join('\n')

  const sistema = `Sos analista de atención al cliente de un restaurante. Analizás las consultas y reclamos que los clientes escriben por WhatsApp y sacás conclusiones útiles.\n${REGLAS}\nSecciones a devolver (en este orden): "Qué consultan más", "Reclamos principales", "Para atender primero" (lo urgente o pendiente que más conviene resolver ya). Si una sección no aplica, omitila.`
  const usuario = `Negocio: ${negocio.nombre}${sede ? ` · sede ${sede.nombre}` : ''}.
Filtros: estado ${estado === 'todas' ? 'todos' : estado} · tipo ${tipo === 'todos' ? 'consultas y reclamos' : tipo}.
Total: ${todas.length} (${reclamos} reclamos, ${todas.length - reclamos} consultas; ${pendientes} pendientes).
Mensajes (los más recientes primero${todas.length > muestra.length ? `; se muestran ${muestra.length} de ${todas.length}` : ''}):
<datos>
${lineas}
</datos>`
  const r = await pedirResumen(sistema, usuario, muestra.map((x) => limpio(x.mensaje)))
  if (!r.ok) return r
  return { ok: true, ...r.datos, analizadas: muestra.length, total: todas.length, generado: new Date().toISOString(), modelo: r.modelo,
    nota: `Se analizaron ${todas.length > muestra.length ? `los ${muestra.length} mensajes más recientes de ${todas.length}` : `${muestra.length} mensajes`}.` }
}

const variacion = (ahora: number, antes: number) => (antes === 0 ? (ahora === 0 ? 'igual' : 'sin datos del período anterior') : `${ahora >= antes ? '+' : ''}${Math.round(((ahora - antes) / antes) * 100)}% vs el período anterior (${antes})`)

/** Resumen y conclusiones de las métricas del período (reservas o pedidos), comparadas con el período anterior de igual largo. A la IA solo van números agregados. */
export async function resumirMetricas(f: { seccion: string; desde: string; hasta: string }): Promise<ResumenIAResult> {
  const ctx = await getContexto()
  if (!ctx.modulosActivos.metricas) return { ok: false, error: 'Las métricas no están habilitadas en este negocio.' }
  const { negocio, sede } = ctx
  const hoyReal = hoyEn(negocio.zona_horaria)
  const FECHA = /^\d{4}-\d{2}-\d{2}$/
  if (!FECHA.test(f.desde) || !FECHA.test(f.hasta) || f.desde > f.hasta || f.hasta > hoyReal || diasEntre(f.desde, f.hasta) > 366) return { ok: false, error: 'El período no es válido.' }
  const seccion = f.seccion === 'pedidos' && ctx.modulosActivos.pedidos ? 'pedidos' : ctx.modulosActivos.reservas ? 'reservas' : 'pedidos'
  if (seccion === 'pedidos' && !ctx.modulosActivos.pedidos) return { ok: false, error: 'Este negocio no tiene reservas ni pedidos para resumir.' }
  const dias = diasEntre(f.desde, f.hasta)
  const antHasta = sumarDias(f.desde, -1), antDesde = sumarDias(antHasta, -(dias - 1))
  const modo = agrupacionAuto(dias)
  const periodoTxt = `del ${fechaCorta(f.desde)} al ${fechaCorta(f.hasta)} (${dias} días)`
  const lista = (xs: { etiqueta: string; valor: number }[]) => xs.map((x) => `${x.etiqueta}: ${x.valor}`).join(' · ') || 'sin datos'
  let datos: string, total: number
  if (seccion === 'reservas') {
    const [m, a] = await Promise.all([cargarReservas(ctx, f.desde, f.hasta), cargarReservas(ctx, antDesde, antHasta)])
    total = m.total
    if (m.total === 0 && m.canceladas === 0) return { ok: false, error: 'No hay reservas en este período para resumir.' }
    const nombresSede = new Map(ctx.sedesTodas.map((x) => [x.id, x.nombre]))
    const serie = serieEvolucion(m.porDia, modo).map((p) => ({ etiqueta: p.etiqueta, valor: p.valor }))
    datos = [`Reservas (sin canceladas): ${m.total} (${variacion(m.total, a.total)}). Canceladas: ${m.canceladas} (antes ${a.canceladas}).`,
      `Promedio de personas por reserva: ${m.promPersonas} (antes ${a.promPersonas}). Horario más reservado: ${m.horarioTop ?? '—'}.`,
      `Evolución ${modo === 'dia' ? 'por día' : modo === 'semana' ? 'por semana' : 'por mes'}: ${lista(serie)}`,
      `Por día de la semana: ${lista(m.porDiaSemana)}`, `Horarios más reservados: ${lista(m.porHorario)}`,
      `Por estado: ${m.porEstado.map((e) => `${labelEstado(e.estado)} ${e.valor}`).join(' · ') || 'sin datos'}`,
      ...(sede || ctx.sedesTodas.length === 0 ? [] : [`Por sede: ${m.porSede.map((s) => `${s.sucursal_id ? nombresSede.get(s.sucursal_id) ?? '—' : 'Sin sede'} ${s.valor}`).join(' · ') || 'sin datos'}`]),
      `Clientes: ${m.pctRecurrentes}% recurrentes (${m.recurrentes} recurrentes, ${m.nuevos} nuevos; antes ${a.pctRecurrentes}%).`].join('\n')
  } else {
    const [{ m, productos }, { m: a }] = await Promise.all([cargarPedidos(ctx, f.desde, f.hasta), cargarPedidos(ctx, antDesde, antHasta)])
    total = m.total
    if (m.total === 0 && m.cancelados === 0) return { ok: false, error: 'No hay pedidos en este período para resumir.' }
    const serie = serieEvolucion(m.porDia, modo).map((p) => ({ etiqueta: p.etiqueta, valor: p.valor }))
    const ventas = serieEvolucion(m.ventasPorDia, modo).map((p) => ({ etiqueta: p.etiqueta, valor: Math.round(p.valor) }))
    datos = [`Pedidos (sin cancelados): ${m.total} (${variacion(m.total, a.total)}). Cancelados: ${m.cancelados} (antes ${a.cancelados}).`,
      `Ventas: ${dinero(m.ventas)} (${variacion(m.ventas, a.ventas)}). Ticket promedio: ${m.total ? dinero(m.ticket) : '—'} (antes ${a.total ? dinero(a.ticket) : '—'}). Hora pico: ${m.horaTop ?? '—'}.`,
      `Pedidos ${modo === 'dia' ? 'por día' : modo === 'semana' ? 'por semana' : 'por mes'}: ${lista(serie)}`, `Ventas ${modo === 'dia' ? 'por día' : modo === 'semana' ? 'por semana' : 'por mes'} (en pesos): ${lista(ventas)}`,
      `Por día de la semana: ${lista(m.porDiaSemana)}`, `Horas con más pedidos: ${lista(m.porHora)}`,
      `Productos más pedidos (unidades): ${lista(productos.map((p) => ({ etiqueta: p.etiqueta, valor: p.valor })))}`,
      `Por tipo: ${m.porTipo.map((x) => `${labelTipo(x.tipo)} ${x.valor}`).join(' · ') || 'sin datos'}`, `Medios de pago: ${m.porPago.map((x) => `${labelPago(x.medio)} ${x.valor}`).join(' · ') || 'sin datos'}`,
      `Por estado: ${m.porEstado.map((x) => `${labelEstadoPedido(x.estado)} ${x.valor}`).join(' · ') || 'sin datos'}`,
      `Clientes: ${m.pctRecurrentes}% recurrentes (${m.recurrentes} recurrentes, ${m.nuevos} nuevos; antes ${a.pctRecurrentes}%).`].join('\n')
  }
  const sistema = `Sos analista de gestión de un restaurante. Recibís las métricas de ${seccion === 'reservas' ? 'reservas' : 'pedidos'} de un período, comparadas con el período anterior de igual largo, y sacás conclusiones útiles para el dueño.
${REGLAS}
Secciones a devolver (en este orden): "Lo que anda bien", "Lo que hay que mirar de cerca". Basate solo en los números: si la diferencia con el período anterior es chica, decilo; no atribuyas causas que los datos no muestran. Con pocos datos, advertilo. En "temas" devolvé una lista vacía [].`
  const usuario = `Negocio: ${negocio.nombre}${sede && seccion === 'reservas' ? ` · sede ${sede.nombre}` : ''}.
Período: ${periodoTxt}. Período anterior para comparar: del ${fechaCorta(antDesde)} al ${fechaCorta(antHasta)}.
<datos>
${sinTags(datos)}
</datos>`
  const r = await pedirResumen(sistema, usuario, [])
  if (!r.ok) return r
  return { ok: true, ...r.datos, analizadas: dias, total, generado: new Date().toISOString(), modelo: r.modelo, nota: `Se analizaron las métricas de ${seccion} ${periodoTxt}, comparadas con los ${dias} días anteriores.` }
}
