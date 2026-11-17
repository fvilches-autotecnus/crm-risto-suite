'use server'

import { getContexto } from '@/lib/context'
import { fechaCorta, hoyEn, sumarDias } from '@/lib/fechas'
import { agrupacionAuto, serieEvolucion } from '@/lib/metricas'
import { cargarPedidos, cargarReservas, diasEntre } from '@/lib/metricas-datos'
import { ESTADOS_ACTIVOS, dinero, labelEstadoPedido, labelPago, labelTipo } from '@/lib/pedidos'
import { topProductos, type FilaItemPedido } from '@/lib/metricas-pedidos'
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

/**
 * Resumen y conclusiones de los pedidos que se ven con los filtros actuales de la pantalla de Pedidos (pestaña, período, búsqueda).
 * A la IA van cifras agregadas, los productos más pedidos y lo que escriben los clientes en las observaciones; nunca nombres, teléfonos ni direcciones de entrega.
 */
export async function resumirPedidos(f: { tab?: string; periodo?: string; q?: string }): Promise<ResumenIAResult> {
  const ctx = await getContexto()
  if (!ctx.modulosActivos.pedidos) return { ok: false, error: 'Los pedidos no están habilitados en este negocio.' }
  const { supabase, negocio } = ctx
  const tab = ['activos', 'entregados', 'cancelados', 'todos'].includes(f.tab ?? '') ? f.tab! : 'activos'
  const periodo = ['hoy', '7', '30', 'todos'].includes(f.periodo ?? '') ? f.periodo! : 'hoy'
  const q = (f.q ?? '').trim().replace(/[,()%*]/g, ' ')
  const hoy = hoyEn(negocio.zona_horaria)
  const desde = periodo === 'todos' ? null : `${periodo === 'hoy' ? hoy : sumarDias(hoy, -Number(periodo))}T00:00:00-03:00`

  let consulta = supabase.from('pedidos').select('id, numero, tipo, entrega_nombre, medio_pago, medio_pago_nombre, estado, total, observaciones, motivo_cancelacion, creado_en').eq('negocio_id', negocio.id)
  if (tab === 'activos') consulta = consulta.in('estado', ESTADOS_ACTIVOS)
  else if (tab === 'entregados') consulta = consulta.eq('estado', 'entregado')
  else if (tab === 'cancelados') consulta = consulta.eq('estado', 'cancelado')
  if (tab !== 'activos' && desde) consulta = consulta.gte('creado_en', desde)
  if (q) { const n = Number(q.replace('#', '')); consulta = Number.isInteger(n) && n > 0 ? consulta.or(`numero.eq.${n},nombre.ilike.%${q}%,telefono.ilike.%${q}%`) : consulta.or(`nombre.ilike.%${q}%,telefono.ilike.%${q}%`) }
  const { data, error } = await consulta.order('creado_en', { ascending: false }).limit(3000)
  if (error) return { ok: false, error: 'No se pudieron leer los pedidos.' }
  const filas = data ?? []
  if (!filas.length) return { ok: false, error: 'No hay pedidos con estos filtros para resumir.' }

  const validos = filas.filter((p) => p.estado !== 'cancelado')
  const ventas = validos.reduce((a, p) => a + Number(p.total), 0)
  const cuenta = (arr: typeof filas, clave: (p: (typeof filas)[number]) => string) => {
    const m = new Map<string, number>(); for (const p of arr) m.set(clave(p), (m.get(clave(p)) ?? 0) + 1)
    return [...m.entries()].sort((a, b) => b[1] - a[1]).map(([k, n]) => `${k}: ${n}`).join(' · ') || '—'
  }
  const horaDe = (iso: string) => Number(new Intl.DateTimeFormat('es-AR', { timeZone: negocio.zona_horaria, hour: '2-digit', hourCycle: 'h23' }).format(new Date(iso)))
  const porHora = new Map<number, number>(); for (const p of filas) porHora.set(horaDe(p.creado_en), (porHora.get(horaDe(p.creado_en)) ?? 0) + 1)
  const horas = [...porHora.entries()].sort((a, b) => b[1] - a[1]).slice(0, 4).map(([h, n]) => `${String(h).padStart(2, '0')} h: ${n}`).join(' · ')

  const items: FilaItemPedido[] = []
  const ids = validos.map((p) => p.id)
  for (let i = 0; i < ids.length; i += 150) {
    const { data: it } = await supabase.from('pedido_items').select('nombre, variante, cantidad, subtotal').eq('negocio_id', negocio.id).in('pedido_id', ids.slice(i, i + 150)).limit(10000)
    items.push(...((it ?? []) as FilaItemPedido[]))
  }
  const top = topProductos(items, 12).map((x) => `${x.etiqueta}: ${x.valor} u.`).join(' · ') || '—'

  // Lo que escriben los clientes (observaciones) y los motivos de cancelación; sin números largos (teléfonos) ni etiquetas que rompan el bloque de datos
  const sinNumeros = (t: string) => t.replace(/\d[\d\s().-]{5,}\d/g, '[nº]')
  const textos = filas.flatMap((p) => [
    p.observaciones ? { t: `[${labelTipo(p.tipo)} · ${labelEstadoPedido(p.estado)}] ${sinTags(sinNumeros(limpio(p.observaciones)))}`, crudo: limpio(p.observaciones) } : null,
    p.motivo_cancelacion ? { t: `[motivo de cancelación] ${sinTags(sinNumeros(limpio(p.motivo_cancelacion)))}`, crudo: limpio(p.motivo_cancelacion) } : null,
  ]).filter((x): x is { t: string; crudo: string } => !!x && x.crudo.length >= 3)
  const muestra = textos.slice(0, MAX_TEXTOS)

  const sistema = `Sos analista de ventas y operación de un restaurante con pedidos de retiro, delivery y mesa. Recibís cifras de los pedidos que el dueño está viendo y lo que los clientes escribieron en las observaciones, y sacás conclusiones útiles.\n${REGLAS}\nNo repitas direcciones de entrega ni datos que identifiquen a un cliente. Secciones a devolver (en este orden): "Qué se pidió y cómo", "Lo que dicen los clientes" (patrones en las observaciones: problemas de entrega, pedidos especiales, aclaraciones; si no hay observaciones, decilo en un ítem), "Para mejorar". En "temas" devolvé lo que más se repite en las observaciones con su cantidad aproximada (lista vacía si no hay observaciones). Con pocos pedidos, advertilo.`
  const usuario = `Negocio: ${negocio.nombre}.
Filtros: ${tab === 'activos' ? 'pedidos en curso' : tab === 'todos' ? 'todos los estados' : tab} · ${tab === 'activos' ? 'sin límite de fecha' : periodo === 'todos' ? 'todo el historial' : periodo === 'hoy' ? 'hoy' : `últimos ${periodo} días`}${q ? ' · con búsqueda' : ''}.
Pedidos: ${filas.length} (${filas.length - validos.length} cancelados). Ventas sin cancelados: ${dinero(ventas)}${validos.length ? ` · ticket promedio ${dinero(ventas / validos.length)}` : ''}.
Por estado: ${cuenta(filas, (p) => labelEstadoPedido(p.estado))}.
Por forma de entrega: ${cuenta(filas, (p) => p.entrega_nombre || labelTipo(p.tipo))}.
Por medio de pago: ${cuenta(validos, (p) => labelPago(p.medio_pago, p.medio_pago_nombre))}.
Horas con más pedidos: ${horas}.
Productos más pedidos (sin cancelados): ${top}.
Observaciones de los clientes${textos.length > muestra.length ? ` (las ${muestra.length} más recientes de ${textos.length})` : ` (${textos.length})`}:
<datos>
${muestra.map((x) => x.t).join('\n') || '(ninguna)'}
</datos>`
  const r = await pedirResumen(sistema, usuario, muestra.map((x) => x.crudo))
  if (!r.ok) return r
  return { ok: true, ...r.datos, analizadas: muestra.length || filas.length, total: filas.length, generado: new Date().toISOString(), modelo: r.modelo,
    nota: `Se resumieron ${filas.length} pedido${filas.length === 1 ? '' : 's'}${textos.length ? ` y ${muestra.length} observaciones de clientes` : ' (ninguno tiene observaciones)'}.` }
}

const variacion = (ahora: number, antes: number) => (antes === 0 ? (ahora === 0 ? 'igual' : 'sin datos del período anterior') : `${ahora >= antes ? '+' : ''}${Math.round(((ahora - antes) / antes) * 100)}% vs el período anterior (${antes})`)

/**
 * Resumen y conclusiones del período, UNO solo para todo lo que el negocio tiene habilitado (reservas, pedidos, reseñas, consultas y reclamos),
 * comparado con el período anterior de igual largo. Lo que el negocio no usa no se pide ni se menciona. A la IA solo van números agregados.
 */
export async function resumirMetricas(f: { desde: string; hasta: string }): Promise<ResumenIAResult> {
  const ctx = await getContexto()
  if (!ctx.modulosActivos.metricas) return { ok: false, error: 'Las métricas no están habilitadas en este negocio.' }
  const { supabase, negocio, sede } = ctx
  const hoyReal = hoyEn(negocio.zona_horaria)
  const FECHA = /^\d{4}-\d{2}-\d{2}$/
  if (!FECHA.test(f.desde) || !FECHA.test(f.hasta) || f.desde > f.hasta || f.hasta > hoyReal || diasEntre(f.desde, f.hasta) > 366) return { ok: false, error: 'El período no es válido.' }
  const mod = ctx.modulosActivos
  const dias = diasEntre(f.desde, f.hasta)
  const antHasta = sumarDias(f.desde, -1), antDesde = sumarDias(antHasta, -(dias - 1))
  const modo = agrupacionAuto(dias)
  const cadaUno = modo === 'dia' ? 'por día' : modo === 'semana' ? 'por semana' : 'por mes'
  const periodoTxt = `del ${fechaCorta(f.desde)} al ${fechaCorta(f.hasta)}`
  const anteriorTxt = `del ${fechaCorta(antDesde)} al ${fechaCorta(antHasta)}`
  const lista = (xs: { etiqueta: string; valor: number }[]) => xs.map((x) => `${x.etiqueta}: ${x.valor}`).join(' · ') || 'sin datos'
  const bloques: string[] = [], usados: string[] = []

  if (mod.reservas) {
    const [m, a] = await Promise.all([cargarReservas(ctx, f.desde, f.hasta), cargarReservas(ctx, antDesde, antHasta)])
    if (m.total > 0 || m.canceladas > 0) {
      usados.push('reservas')
      const nombresSede = new Map(ctx.sedesTodas.map((x) => [x.id, x.nombre]))
      const serie = serieEvolucion(m.porDia, modo).map((p) => ({ etiqueta: p.etiqueta, valor: p.valor }))
      bloques.push([`## RESERVAS`, `Reservas (sin canceladas): ${m.total} (${variacion(m.total, a.total)}). Canceladas: ${m.canceladas} (antes ${a.canceladas}).`,
        `Promedio de personas por reserva: ${m.promPersonas} (antes ${a.promPersonas}). Horario más reservado: ${m.horarioTop ?? '—'}.`,
        `Evolución ${cadaUno}: ${lista(serie)}`, `Por día de la semana: ${lista(m.porDiaSemana)}`, `Horarios más reservados: ${lista(m.porHorario)}`,
        `Por estado: ${m.porEstado.map((e) => `${labelEstado(e.estado)} ${e.valor}`).join(' · ') || 'sin datos'}`,
        ...(sede || ctx.sedesTodas.length === 0 ? [] : [`Por sede: ${m.porSede.map((s) => `${s.sucursal_id ? nombresSede.get(s.sucursal_id) ?? '—' : 'Sin sede'} ${s.valor}`).join(' · ') || 'sin datos'}`]),
        `Clientes: ${m.pctRecurrentes}% recurrentes (${m.recurrentes} recurrentes, ${m.nuevos} nuevos; antes ${a.pctRecurrentes}%).`].join('\n'))
    }
  }

  if (mod.pedidos) {
    const [{ m, productos }, { m: a }, { data: mediosCat }] = await Promise.all([cargarPedidos(ctx, f.desde, f.hasta), cargarPedidos(ctx, antDesde, antHasta), ctx.supabase.from('pedido_medios').select('clave, etiqueta').eq('negocio_id', ctx.negocio.id)])
    const nombresMedios = Object.fromEntries((mediosCat ?? []).map((x) => [x.clave as string, x.etiqueta as string]))
    if (m.total > 0 || m.cancelados > 0) {
      usados.push('pedidos')
      const serie = serieEvolucion(m.porDia, modo).map((p) => ({ etiqueta: p.etiqueta, valor: p.valor }))
      const ventas = serieEvolucion(m.ventasPorDia, modo).map((p) => ({ etiqueta: p.etiqueta, valor: Math.round(p.valor) }))
      bloques.push([`## PEDIDOS`, `Pedidos (sin cancelados): ${m.total} (${variacion(m.total, a.total)}). Cancelados: ${m.cancelados} (antes ${a.cancelados}).`,
        `Ventas: ${dinero(m.ventas)} (${variacion(m.ventas, a.ventas)}). Ticket promedio: ${m.total ? dinero(m.ticket) : '—'} (antes ${a.total ? dinero(a.ticket) : '—'}). Hora pico: ${m.horaTop ?? '—'}.`,
        `Pedidos ${cadaUno}: ${lista(serie)}`, `Ventas ${cadaUno} (en pesos): ${lista(ventas)}`, `Por día de la semana: ${lista(m.porDiaSemana)}`, `Horas con más pedidos: ${lista(m.porHora)}`,
        `Productos más pedidos (unidades): ${lista(productos.map((p) => ({ etiqueta: p.etiqueta, valor: p.valor })))}`,
        `Por tipo: ${m.porTipo.map((x) => `${labelTipo(x.tipo)} ${x.valor}`).join(' · ') || 'sin datos'}`, `Medios de pago: ${m.porPago.map((x) => `${labelPago(x.medio, null, nombresMedios)} ${x.valor}`).join(' · ') || 'sin datos'}`,
        `Por estado: ${m.porEstado.map((x) => `${labelEstadoPedido(x.estado)} ${x.valor}`).join(' · ') || 'sin datos'}`,
        `Clientes: ${m.pctRecurrentes}% recurrentes (${m.recurrentes} recurrentes, ${m.nuevos} nuevos; antes ${a.pctRecurrentes}%).`].join('\n'))
    }
  }

  if (mod.resenas) {
    const leer = async (d: string, h: string) => {
      let q = supabase.from('resenas').select('puntaje').eq('negocio_id', negocio.id).gte('fecha', d).lte('fecha', h)
      if (sede) q = q.eq('sucursal_id', sede.id)
      return ((await q.limit(5000)).data ?? []) as { puntaje: number }[]
    }
    const [r, ra] = await Promise.all([leer(f.desde, f.hasta), leer(antDesde, antHasta)])
    if (r.length > 0) {
      usados.push('reseñas')
      const prom = (xs: { puntaje: number }[]) => (xs.length ? Math.round((xs.reduce((s, x) => s + x.puntaje, 0) / xs.length) * 10) / 10 : null)
      bloques.push([`## RESEÑAS`, `Reseñas: ${r.length} (${variacion(r.length, ra.length)}). Puntaje promedio: ${prom(r)} (antes ${prom(ra) ?? 'sin reseñas'}).`,
        `Distribución: ${[5, 4, 3, 2, 1].map((n) => `${n}★ ${r.filter((x) => x.puntaje === n).length}`).join(' · ')}.`].join('\n'))
    }
  }

  if (mod.consultas) {
    const leer = async (d: string, h: string) => {
      let q = supabase.from('consultas_reclamos').select('tipo, estado').eq('negocio_id', negocio.id).gte('creado_en', `${d}T00:00:00-03:00`).lte('creado_en', `${h}T23:59:59-03:00`)
      if (sede) q = q.eq('sucursal_id', sede.id)
      return ((await q.limit(5000)).data ?? []) as { tipo: string; estado: string }[]
    }
    const [c, ca] = await Promise.all([leer(f.desde, f.hasta), leer(antDesde, antHasta)])
    if (c.length > 0) {
      usados.push('consultas y reclamos')
      const rec = (xs: { tipo: string }[]) => xs.filter((x) => x.tipo === 'reclamo').length
      bloques.push([`## CONSULTAS Y RECLAMOS`, `Mensajes: ${c.length} (${variacion(c.length, ca.length)}). Reclamos: ${rec(c)} (antes ${rec(ca)}). Consultas: ${c.length - rec(c)}. Sin resolver: ${c.filter((x) => x.estado === 'pendiente').length}.`].join('\n'))
    }
  }

  if (bloques.length === 0) return { ok: false, error: 'No hay datos en este período para resumir (o el negocio no tiene habilitados los módulos que se resumen).' }
  const sistema = `Sos analista de gestión de un restaurante. Recibís las métricas de un período de lo que el negocio usa (${usados.join(', ')}), comparadas con el período anterior de igual largo, y sacás conclusiones útiles para el dueño.\n${REGLAS}\nSecciones a devolver (en este orden): "Lo que anda bien", "Lo que hay que mirar de cerca". Hablá SOLO de las áreas que figuran en los datos; no menciones las que no aparecen. Basate solo en los números: si la diferencia con el período anterior es chica, decilo; no atribuyas causas que los datos no muestran. Con pocos datos, advertilo. En "temas" devolvé una lista vacía [].`
  const usuario = `Negocio: ${negocio.nombre}${sede ? ` · sede ${sede.nombre}` : ''}.\nPeríodo: ${periodoTxt} (${dias} días). Período anterior, para comparar: ${anteriorTxt}.\n<datos>\n${sinTags(bloques.join('\n\n'))}\n</datos>`
  const r = await pedirResumen(sistema, usuario, [])
  if (!r.ok) return r
  return { ok: true, ...r.datos, analizadas: dias, total: dias, generado: new Date().toISOString(), modelo: r.modelo,
    nota: `Se analizó ${usados.join(', ')} ${periodoTxt}, comparado con ${anteriorTxt}.` }
}
