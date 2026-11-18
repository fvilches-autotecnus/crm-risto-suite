import 'server-only'
import type { Contexto } from '@/lib/context'
import type { HerramientaIA } from '@/lib/ia'
import { fechaCorta, hoyEn, sumarDias } from '@/lib/fechas'
import { claveNombre } from '@/lib/metricas-pedidos'
import { dinero } from '@/lib/pedidos'

/**
 * Las consultas que la IA puede pedir para responder preguntas del dueño. Son un catálogo CERRADO: la IA no escribe SQL, solo elige una
 * consulta y sus parámetros. Todas se resuelven con la sesión del usuario (respeta su negocio y su sede) y devuelven totales: los nombres
 * y teléfonos de clientes salen solo en una tabla que se muestra en pantalla; la IA nunca los recibe.
 */
export interface TablaIA { titulo: string; columnas: string[]; filas: string[][] }
interface Resultado { modelo: Record<string, unknown>; tabla?: TablaIA; fuente?: string }

const FECHA = /^\d{4}-\d{2}-\d{2}$/
const DIAS = ['domingo', 'lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado']
const MESES = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre']
const MAX_FILAS = 20_000
const MAX_DIAS = 800

const diaSemana = (fecha: string) => { const [y, m, d] = fecha.split('-').map(Number); return new Date(Date.UTC(y, m - 1, d)).getUTCDay() }
/** Un instante (UTC) visto en hora argentina: { fecha, hora, dow }. */
const enAR = (iso: string) => { const t = new Date(Date.parse(iso) - 3 * 3600_000); const f = t.toISOString(); return { fecha: f.slice(0, 10), hora: f.slice(11, 13), dow: t.getUTCDay() } }
const periodoTxt = (d: string, h: string) => `del ${fechaCorta(d)} al ${fechaCorta(h)}`

/** Lee todas las filas de una consulta paginando de a 1000 (el servidor devuelve como máximo 1000 por vez). */
async function leerTodo<T>(pagina: (desde: number, hasta: number) => PromiseLike<{ data: unknown[] | null; error: unknown }>): Promise<{ filas: T[]; truncado: boolean }> {
  const filas: T[] = []
  for (let i = 0; i < MAX_FILAS; i += 1000) {
    const { data, error } = await pagina(i, i + 999)
    if (error) throw new Error('No se pudieron leer los datos')
    filas.push(...((data ?? []) as T[]))
    if (!data || data.length < 1000) return { filas, truncado: false }
  }
  return { filas, truncado: true }
}

function periodo(a: Record<string, unknown>, hoy: string, obligatorio = true): { desde: string; hasta: string } | { error: string } {
  const desde = typeof a.desde === 'string' ? a.desde : '', hasta = typeof a.hasta === 'string' ? a.hasta : ''
  if (!desde && !hasta && !obligatorio) return { desde: sumarDias(hoy, -365), hasta: hoy }
  if (!FECHA.test(desde) || !FECHA.test(hasta)) return { error: 'Faltan "desde" y "hasta" (formato AAAA-MM-DD).' }
  if (desde > hasta) return { error: '"desde" no puede ser posterior a "hasta".' }
  if ((Date.parse(hasta) - Date.parse(desde)) / 86400000 > MAX_DIAS) return { error: `El período es demasiado largo (máximo ${MAX_DIAS} días).` }
  return { desde, hasta }
}

function agrupar<T>(filas: T[], clave: (f: T) => string | null, valores: (f: T) => Record<string, number>, orden: 'clave' | 'valor' = 'valor') {
  const m = new Map<string, Record<string, number>>()
  for (const f of filas) {
    const k = clave(f); if (k === null) continue
    const acc = m.get(k) ?? {}; for (const [n, v] of Object.entries(valores(f))) acc[n] = (acc[n] ?? 0) + v; m.set(k, acc)
  }
  const arr = [...m.entries()].map(([clave, v]) => ({ clave, v }))
  const principal = (v: Record<string, number>) => Object.values(v)[0] ?? 0   // se ordena por el primer valor (la cantidad de filas)
  arr.sort((x, y) => (orden === 'clave' ? x.clave.localeCompare(y.clave) : principal(y.v) - principal(x.v)))
  return arr.map(({ clave, v }) => ({ clave, ...v }))
}

const esquemaPeriodo = { desde: { type: 'string', description: 'Fecha de inicio AAAA-MM-DD (inclusive).' }, hasta: { type: 'string', description: 'Fecha de fin AAAA-MM-DD (inclusive).' } }
const diasSemana = { type: 'array', items: { type: 'integer', minimum: 0, maximum: 6 }, description: 'Solo estos días de la semana (0 = domingo, 1 = lunes … 6 = sábado). Omitir para todos.' }

export function herramientasDisponibles(ctx: Contexto): HerramientaIA[] {
  const m = ctx.modulosActivos
  const h: HerramientaIA[] = []
  if (m.reservas) h.push({
    nombre: 'reservas',
    descripcion: 'Cuenta reservas de mesas (cantidad de reservas y de personas) de un período, con filtros y agrupadas. Por defecto no cuenta las canceladas.',
    parametros: { type: 'object', required: ['desde', 'hasta'], properties: { ...esquemaPeriodo, dia_semana: diasSemana,
      agrupar_por: { type: 'string', enum: ['ninguno', 'dia_semana', 'hora', 'mes', 'ubicacion', 'tipo', 'estado', 'tamano_grupo'], description: 'Cómo desglosar el resultado.' },
      min_personas: { type: 'integer', description: 'Solo reservas de al menos esta cantidad de personas.' }, max_personas: { type: 'integer', description: 'Solo reservas de hasta esta cantidad de personas.' },
      ubicacion: { type: 'string', description: 'Solo esta ubicación (por ejemplo SALON o TERRAZA).' }, estado: { type: 'string', enum: ['nueva', 'confirmada', 'pendiente_pago', 'revisar_pago', 'no_show', 'cancelada'], description: 'Solo este estado (si se omite: todas menos canceladas).' },
      incluir_canceladas: { type: 'boolean', description: 'Contar también las canceladas.' } } },
  })
  if (m.pedidos) h.push({
    nombre: 'pedidos',
    descripcion: 'Cuenta pedidos (delivery, retiro, salón) de un período: cantidad, ventas en pesos y ticket promedio, con filtros y agrupados. Por defecto no cuenta los cancelados.',
    parametros: { type: 'object', required: ['desde', 'hasta'], properties: { ...esquemaPeriodo, dia_semana: diasSemana,
      agrupar_por: { type: 'string', enum: ['ninguno', 'dia_semana', 'hora', 'mes', 'tipo', 'medio_pago', 'estado'] },
      tipo: { type: 'string', description: 'Solo este tipo de pedido (delivery, retiro, salon…).' }, incluir_cancelados: { type: 'boolean' } } },
  })
  if (m.pedidos) h.push({
    nombre: 'productos_mas_pedidos',
    descripcion: 'Los productos más pedidos de un período (unidades y ventas), agrupados por nombre sin importar mayúsculas.',
    parametros: { type: 'object', required: ['desde', 'hasta'], properties: { ...esquemaPeriodo, dia_semana: diasSemana, limite: { type: 'integer', minimum: 1, maximum: 15, description: 'Cuántos productos devolver (por defecto 10).' } } },
  })
  if (m.clientes) h.push({
    nombre: 'clientes',
    descripcion: 'Consultas sobre clientes. Devuelve cantidades; la lista con nombres y teléfonos se le muestra al usuario aparte (no la recibís). Tipos: "inactivos" = clientes con al menos N reservas que no vuelven hace X días; "mas_frecuentes" = los que más reservaron en el período; "nuevos" = clientes dados de alta en el período; "recurrentes" = clientes con 2 o más reservas en el período.',
    parametros: { type: 'object', required: ['consulta'], properties: { consulta: { type: 'string', enum: ['inactivos', 'mas_frecuentes', 'nuevos', 'recurrentes'] }, ...esquemaPeriodo,
      min_reservas: { type: 'integer', description: 'Para "inactivos" y "mas_frecuentes": mínimo de reservas (por defecto 2).' }, dias_sin_venir: { type: 'integer', description: 'Para "inactivos": días desde la última reserva (por defecto 60).' } } },
  })
  if (m.clientes) h.push({
    nombre: 'cumpleanos',
    descripcion: 'Cuántos clientes cumplen años en un mes. La lista se le muestra al usuario aparte.',
    parametros: { type: 'object', required: ['mes'], properties: { mes: { type: 'integer', minimum: 1, maximum: 12 } } },
  })
  if (m.resenas) h.push({
    nombre: 'resenas',
    descripcion: 'Cantidad de reseñas, puntaje promedio y distribución por estrellas de un período.',
    parametros: { type: 'object', required: ['desde', 'hasta'], properties: { ...esquemaPeriodo, puntaje: { type: 'integer', minimum: 1, maximum: 5, description: 'Solo reseñas con este puntaje.' } } },
  })
  if (m.consultas) h.push({
    nombre: 'consultas_y_reclamos',
    descripcion: 'Cantidad de consultas y reclamos que escribieron los clientes en un período, por tipo y estado (pendientes / resueltos).',
    parametros: { type: 'object', required: ['desde', 'hasta'], properties: { ...esquemaPeriodo } },
  })
  return h
}

export async function ejecutarHerramienta(ctx: Contexto, nombre: string, a: Record<string, unknown>): Promise<Resultado> {
  const { supabase, negocio, sede } = ctx
  const hoy = hoyEn(negocio.zona_horaria)
  const dias = Array.isArray(a.dia_semana) ? (a.dia_semana as unknown[]).map(Number).filter((n) => n >= 0 && n <= 6) : null
  const entero = (v: unknown) => (typeof v === 'number' && Number.isFinite(v) ? Math.trunc(v) : null)

  if (nombre === 'reservas') {
    const p = periodo(a, hoy); if ('error' in p) return { modelo: { error: p.error } }
    const { filas, truncado } = await leerTodo<{ fecha: string; hora: string | null; cantidad_personas: number | null; estado: string; ubicacion: string | null; tipo_reserva: string | null }>((i, j) => {
      let q = supabase.from('reservas').select('fecha, hora, cantidad_personas, estado, ubicacion, tipo_reserva').eq('negocio_id', negocio.id).is('eliminado_en', null).gte('fecha', p.desde).lte('fecha', p.hasta).order('fecha').order('id').range(i, j)
      if (sede) q = q.eq('sucursal_id', sede.id)
      if (typeof a.estado === 'string') q = q.eq('estado', a.estado); else if (a.incluir_canceladas !== true) q = q.neq('estado', 'cancelada')
      if (typeof a.ubicacion === 'string' && a.ubicacion) q = q.ilike('ubicacion', a.ubicacion)
      return q
    })
    const min = entero(a.min_personas), max = entero(a.max_personas)
    const f = filas.filter((r) => (!dias?.length || dias.includes(diaSemana(r.fecha))) && (min === null || (r.cantidad_personas ?? 0) >= min) && (max === null || (r.cantidad_personas ?? 0) <= max))
    const valores = (r: (typeof f)[number]) => ({ reservas: 1, personas: r.cantidad_personas ?? 0 })
    const por = String(a.agrupar_por ?? 'ninguno')
    const claves: Record<string, (r: (typeof f)[number]) => string | null> = {
      dia_semana: (r) => DIAS[diaSemana(r.fecha)], hora: (r) => (r.hora ? r.hora.slice(0, 2) + ':00' : 'a coordinar'), mes: (r) => r.fecha.slice(0, 7), ubicacion: (r) => r.ubicacion ?? 'sin ubicación',
      tipo: (r) => r.tipo_reserva ?? 'sin tipo', estado: (r) => r.estado, tamano_grupo: (r) => { const n = r.cantidad_personas ?? 0; return n <= 2 ? '1-2 personas' : n <= 4 ? '3-4 personas' : n <= 6 ? '5-6 personas' : '7 o más personas' },
    }
    const grupos = claves[por] ? agrupar(f, claves[por], valores, por === 'mes' || por === 'hora' ? 'clave' : 'valor') : undefined
    const total = { reservas: f.length, personas: f.reduce((s, r) => s + (r.cantidad_personas ?? 0), 0) }
    return { modelo: { periodo: periodoTxt(p.desde, p.hasta), ...total, ...(grupos ? { agrupado_por: por, grupos } : {}), ...(truncado ? { aviso: `Se leyeron solo las primeras ${MAX_FILAS} reservas: el total puede ser mayor.` } : {}) }, fuente: `Reservas ${periodoTxt(p.desde, p.hasta)}: ${total.reservas} reservas` }
  }

  if (nombre === 'pedidos' || nombre === 'productos_mas_pedidos') {
    const p = periodo(a, hoy); if ('error' in p) return { modelo: { error: p.error } }
    const ini = `${p.desde}T00:00:00-03:00`, fin = `${p.hasta}T23:59:59-03:00`
    if (nombre === 'pedidos') {
      const { filas, truncado } = await leerTodo<{ creado_en: string; tipo: string; estado: string; total: number | string; medio_pago_nombre: string | null; medio_pago: string | null }>((i, j) => {
        let q = supabase.from('pedidos').select('creado_en, tipo, estado, total, medio_pago_nombre, medio_pago').eq('negocio_id', negocio.id).gte('creado_en', ini).lte('creado_en', fin).order('creado_en').order('id').range(i, j)
        if (typeof a.tipo === 'string' && a.tipo) q = q.eq('tipo', a.tipo)
        if (a.incluir_cancelados !== true) q = q.neq('estado', 'cancelado')
        return q
      })
      const f = filas.filter((r) => !dias?.length || dias.includes(enAR(r.creado_en).dow))
      const valores = (r: (typeof f)[number]) => ({ pedidos: 1, ventas: Math.round(Number(r.total) || 0) })
      const por = String(a.agrupar_por ?? 'ninguno')
      const claves: Record<string, (r: (typeof f)[number]) => string | null> = { dia_semana: (r) => DIAS[enAR(r.creado_en).dow], hora: (r) => enAR(r.creado_en).hora + ':00', mes: (r) => enAR(r.creado_en).fecha.slice(0, 7), tipo: (r) => r.tipo, medio_pago: (r) => r.medio_pago_nombre ?? r.medio_pago ?? 'sin dato', estado: (r) => r.estado }
      const grupos = claves[por] ? agrupar(f, claves[por], valores, por === 'mes' || por === 'hora' ? 'clave' : 'valor') : undefined
      const ventas = f.reduce((s, r) => s + (Number(r.total) || 0), 0)
      return { modelo: { periodo: periodoTxt(p.desde, p.hasta), pedidos: f.length, ventas_pesos: Math.round(ventas), ventas_texto: dinero(ventas), ticket_promedio_pesos: f.length ? Math.round(ventas / f.length) : null, ...(grupos ? { agrupado_por: por, grupos } : {}), ...(truncado ? { aviso: 'Se leyó solo una parte de los pedidos: los totales pueden ser mayores.' } : {}) }, fuente: `Pedidos ${periodoTxt(p.desde, p.hasta)}: ${f.length} pedidos` }
    }
    const { filas, truncado } = await leerTodo<{ creado_en: string; items: { nombre: string; cantidad: number | string; subtotal: number | string }[] | null }>((i, j) =>
      supabase.from('pedidos').select('creado_en, items:pedido_items(nombre, cantidad, subtotal)').eq('negocio_id', negocio.id).neq('estado', 'cancelado').gte('creado_en', ini).lte('creado_en', fin).order('creado_en').order('id').range(i, j))
    const g = new Map<string, { nombre: string; unidades: number; ventas: number; usos: Map<string, number> }>()
    for (const pd of filas) {
      if (dias?.length && !dias.includes(enAR(pd.creado_en).dow)) continue
      for (const it of pd.items ?? []) {
        const k = claveNombre(it.nombre); if (!k) continue
        const x = g.get(k) ?? { nombre: it.nombre, unidades: 0, ventas: 0, usos: new Map() }
        x.unidades += Number(it.cantidad); x.ventas += Number(it.subtotal); x.usos.set(it.nombre.trim(), (x.usos.get(it.nombre.trim()) ?? 0) + Number(it.cantidad)); g.set(k, x)
      }
    }
    const top = [...g.values()].sort((x, y) => y.unidades - x.unidades || y.ventas - x.ventas).slice(0, Math.min(15, entero(a.limite) ?? 10))
      .map((x) => ({ producto: [...x.usos.entries()].sort((u, v) => v[1] - u[1])[0][0], unidades: x.unidades, ventas_pesos: Math.round(x.ventas) }))
    return { modelo: { periodo: periodoTxt(p.desde, p.hasta), productos: top, ...(truncado ? { aviso: 'Se leyó solo una parte de los pedidos.' } : {}) }, fuente: `Pedidos ${periodoTxt(p.desde, p.hasta)}: productos más pedidos` }
  }

  if (nombre === 'clientes') {
    const tipo = String(a.consulta ?? '')
    const minRes = Math.max(1, entero(a.min_reservas) ?? 2)
    if (tipo === 'nuevos') {
      const p = periodo(a, hoy); if ('error' in p) return { modelo: { error: p.error } }
      const { count } = await supabase.from('clientes').select('id', { count: 'exact', head: true }).eq('negocio_id', negocio.id).gte('creado_en', `${p.desde}T00:00:00-03:00`).lte('creado_en', `${p.hasta}T23:59:59-03:00`)
      const { data } = await supabase.from('clientes').select('nombre, telefono, creado_en').eq('negocio_id', negocio.id).gte('creado_en', `${p.desde}T00:00:00-03:00`).lte('creado_en', `${p.hasta}T23:59:59-03:00`).order('creado_en', { ascending: false }).limit(25)
      return { modelo: { periodo: periodoTxt(p.desde, p.hasta), clientes_nuevos: count ?? 0, lista_en_pantalla: (data ?? []).length > 0 }, fuente: `Clientes nuevos ${periodoTxt(p.desde, p.hasta)}: ${count ?? 0}`,
        tabla: { titulo: `Clientes nuevos ${periodoTxt(p.desde, p.hasta)}${(count ?? 0) > 25 ? ' (los 25 más recientes)' : ''}`, columnas: ['Cliente', 'Teléfono', 'Alta'], filas: (data ?? []).map((c) => [c.nombre as string, (c.telefono as string) ?? '—', fechaCorta((c.creado_en as string).slice(0, 10))]) } }
    }
    // el resto se calcula sobre las reservas por cliente
    const p = tipo === 'inactivos' ? { desde: '2000-01-01', hasta: hoy } : periodo(a, hoy, false)
    if ('error' in p) return { modelo: { error: p.error } }
    const { filas, truncado } = await leerTodo<{ cliente_id: string; fecha: string }>((i, j) => {
      let q = supabase.from('reservas').select('cliente_id, fecha').eq('negocio_id', negocio.id).is('eliminado_en', null).not('cliente_id', 'is', null).neq('estado', 'cancelada').gte('fecha', p.desde).lte('fecha', p.hasta).order('fecha').order('id').range(i, j)
      if (sede) q = q.eq('sucursal_id', sede.id)
      return q
    })
    const por = new Map<string, { n: number; ultima: string }>()
    for (const r of filas) { const x = por.get(r.cliente_id) ?? { n: 0, ultima: '' }; x.n++; if (r.fecha > x.ultima) x.ultima = r.fecha; por.set(r.cliente_id, x) }
    let elegidos = [...por.entries()]
    let titulo = ''
    if (tipo === 'inactivos') {
      const dsv = Math.max(1, entero(a.dias_sin_venir) ?? 60), corte = sumarDias(hoy, -dsv)
      elegidos = elegidos.filter(([, x]) => x.n >= minRes && x.ultima < corte); titulo = `Clientes con ${minRes} o más reservas que no vienen hace más de ${dsv} días`
    } else if (tipo === 'recurrentes') { elegidos = elegidos.filter(([, x]) => x.n >= 2); titulo = `Clientes con 2 o más reservas ${periodoTxt(p.desde, p.hasta)}` }
    else if (tipo === 'mas_frecuentes') { elegidos = elegidos.filter(([, x]) => x.n >= minRes); titulo = `Clientes con más reservas ${periodoTxt(p.desde, p.hasta)}` }
    else return { modelo: { error: 'Tipo de consulta de clientes no válido.' } }
    elegidos.sort((x, y) => y[1].n - x[1].n || y[1].ultima.localeCompare(x[1].ultima))
    const mostrar = elegidos.slice(0, 25)
    const { data: datos } = mostrar.length ? await supabase.from('clientes').select('id, nombre, telefono').eq('negocio_id', negocio.id).in('id', mostrar.map(([id]) => id)) : { data: [] }
    const porId = new Map((datos ?? []).map((c) => [c.id as string, c]))
    return { modelo: { consulta: tipo, clientes: elegidos.length, ...(tipo === 'inactivos' ? { dias_sin_venir: Math.max(1, entero(a.dias_sin_venir) ?? 60), min_reservas: minRes } : {}), lista_en_pantalla: mostrar.length > 0, ...(truncado ? { aviso: 'Se leyó solo una parte de las reservas.' } : {}) }, fuente: `${titulo}: ${elegidos.length}`,
      tabla: { titulo: titulo + (elegidos.length > 25 ? ` (los 25 con más reservas, de ${elegidos.length})` : ''), columnas: ['Cliente', 'Teléfono', 'Reservas', 'Última reserva'], filas: mostrar.map(([id, x]) => [(porId.get(id)?.nombre as string) ?? '—', (porId.get(id)?.telefono as string) ?? '—', String(x.n), fechaCorta(x.ultima)]) } }
  }

  if (nombre === 'cumpleanos') {
    const mes = entero(a.mes); if (!mes || mes < 1 || mes > 12) return { modelo: { error: 'Mes no válido.' } }
    const { data, count } = await supabase.from('clientes').select('nombre, telefono, cumple_dia', { count: 'exact' }).eq('negocio_id', negocio.id).eq('cumple_mes', mes).order('cumple_dia').limit(30)
    return { modelo: { mes: MESES[mes - 1], clientes_que_cumplen: count ?? 0, lista_en_pantalla: (data ?? []).length > 0 }, fuente: `Cumpleaños de ${MESES[mes - 1]}: ${count ?? 0}`,
      tabla: { titulo: `Cumpleaños de ${MESES[mes - 1]}`, columnas: ['Cliente', 'Teléfono', 'Día'], filas: (data ?? []).map((c) => [c.nombre as string, (c.telefono as string) ?? '—', String(c.cumple_dia)]) } }
  }

  if (nombre === 'resenas') {
    const p = periodo(a, hoy); if ('error' in p) return { modelo: { error: p.error } }
    const { filas } = await leerTodo<{ puntaje: number }>((i, j) => {
      let q = supabase.from('resenas').select('puntaje').eq('negocio_id', negocio.id).gte('fecha', p.desde).lte('fecha', p.hasta).order('id').range(i, j)
      if (sede) q = q.eq('sucursal_id', sede.id)
      const pt = entero(a.puntaje); if (pt) q = q.eq('puntaje', pt)
      return q
    })
    const prom = filas.length ? Math.round((filas.reduce((s, r) => s + r.puntaje, 0) / filas.length) * 10) / 10 : null
    return { modelo: { periodo: periodoTxt(p.desde, p.hasta), resenas: filas.length, puntaje_promedio: prom, distribucion: [5, 4, 3, 2, 1].map((n) => ({ estrellas: n, cantidad: filas.filter((r) => r.puntaje === n).length })) }, fuente: `Reseñas ${periodoTxt(p.desde, p.hasta)}: ${filas.length}` }
  }

  if (nombre === 'consultas_y_reclamos') {
    const p = periodo(a, hoy); if ('error' in p) return { modelo: { error: p.error } }
    const { filas } = await leerTodo<{ tipo: string; estado: string }>((i, j) => {
      let q = supabase.from('consultas_reclamos').select('tipo, estado').eq('negocio_id', negocio.id).gte('creado_en', `${p.desde}T00:00:00-03:00`).lte('creado_en', `${p.hasta}T23:59:59-03:00`).order('id').range(i, j)
      if (sede) q = q.eq('sucursal_id', sede.id)
      return q
    })
    return { modelo: { periodo: periodoTxt(p.desde, p.hasta), total: filas.length, consultas: filas.filter((r) => r.tipo !== 'reclamo').length, reclamos: filas.filter((r) => r.tipo === 'reclamo').length, pendientes: filas.filter((r) => r.estado === 'pendiente').length, resueltos: filas.filter((r) => r.estado !== 'pendiente').length }, fuente: `Consultas y reclamos ${periodoTxt(p.desde, p.hasta)}: ${filas.length}` }
  }

  return { modelo: { error: 'Herramienta desconocida.' } }
}
