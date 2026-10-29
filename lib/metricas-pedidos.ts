import { sumarDias } from '@/lib/fechas'

export interface FilaPedido { cliente_id: string | null; nombre: string; telefono: string | null; tipo: string; medio_pago: string; estado: string; total: number; creado_en: string }
export interface FilaItemPedido { nombre: string; variante: string | null; cantidad: number; subtotal: number }

export interface MetricasPedidos {
  total: number                         // pedidos del período, sin contar cancelados
  cancelados: number
  ventas: number                        // suma de los pedidos no cancelados
  ticket: number                        // venta promedio por pedido
  porDia: { fecha: string; valor: number }[]          // cantidad de pedidos, un punto por día (con ceros)
  ventasPorDia: { fecha: string; valor: number }[]    // plata vendida, un punto por día (con ceros)
  porDiaSemana: { etiqueta: string; valor: number }[] // lun..dom
  porHora: { etiqueta: string; valor: number }[]      // las 6 horas con más pedidos
  horaTop: string | null
  porEstado: { estado: string; valor: number }[]
  porTipo: { tipo: string; valor: number }[]
  porPago: { medio: string; valor: number }[]
  recurrentes: number
  nuevos: number
  pctRecurrentes: number
  topClientes: { clave: string; cliente_id: string | null; nombre: string; telefono: string | null; pedidos: number; gastado: number; ultima: string }[]
}

const SEMANA = ['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom']

/** Fecha (YYYY-MM-DD), hora (0-23) y día de la semana (0 = lunes) de un instante, en la zona horaria del negocio. */
function enZona(zona: string) {
  const f = new Intl.DateTimeFormat('en-CA', { timeZone: zona, year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', hourCycle: 'h23' })
  return (iso: string) => {
    const p = Object.fromEntries(f.formatToParts(new Date(iso)).map((x) => [x.type, x.value]))
    const fecha = `${p.year}-${p.month}-${p.day}`
    const [y, m, d] = fecha.split('-').map(Number)
    return { fecha, hora: Number(p.hour), diaSemana: (new Date(Date.UTC(y, m - 1, d)).getUTCDay() + 6) % 7 }
  }
}

/** Métricas de pedidos del período [hoy-dias+1, hoy] (los pedidos ya vienen filtrados por fecha). `previos`: claves de clientes que ya habían pedido antes. */
export function calcularMetricasPedidos(periodo: FilaPedido[], previos: Set<string>, dias: number, hoy: string, zona: string): MetricasPedidos {
  const local = enZona(zona)
  const desde = sumarDias(hoy, -(dias - 1))
  const validos = periodo.filter((p) => p.estado !== 'cancelado')
  const porDiaMap = new Map<string, number>(), ventasMap = new Map<string, number>()
  for (let i = 0; i < dias; i++) { const f = sumarDias(desde, i); porDiaMap.set(f, 0); ventasMap.set(f, 0) }
  const semana = new Array(7).fill(0)
  const horas = new Map<number, number>()
  const tipos = new Map<string, number>(), pagos = new Map<string, number>(), estados = new Map<string, number>()
  const clientes = new Map<string, { cliente_id: string | null; nombre: string; telefono: string | null; n: number; gastado: number; ultima: string }>()
  let ventas = 0

  for (const p of periodo) estados.set(p.estado, (estados.get(p.estado) ?? 0) + 1)
  for (const p of validos) {
    const l = local(p.creado_en), total = Number(p.total)
    porDiaMap.set(l.fecha, (porDiaMap.get(l.fecha) ?? 0) + 1)
    ventasMap.set(l.fecha, (ventasMap.get(l.fecha) ?? 0) + total)
    semana[l.diaSemana]++
    horas.set(l.hora, (horas.get(l.hora) ?? 0) + 1)
    tipos.set(p.tipo, (tipos.get(p.tipo) ?? 0) + 1)
    pagos.set(p.medio_pago, (pagos.get(p.medio_pago) ?? 0) + 1)
    ventas += total
    const clave = p.cliente_id ?? (p.telefono ? `tel:${p.telefono}` : null)
    if (clave) {
      const c = clientes.get(clave) ?? { cliente_id: p.cliente_id, nombre: p.nombre, telefono: p.telefono, n: 0, gastado: 0, ultima: l.fecha }
      c.n++; c.gastado += total; if (l.fecha > c.ultima) { c.ultima = l.fecha; c.nombre = p.nombre }
      clientes.set(clave, c)
    }
  }
  const porHora = [...horas.entries()].sort((a, b) => b[1] - a[1] || a[0] - b[0]).slice(0, 6).map(([h, valor]) => ({ etiqueta: `${String(h).padStart(2, '0')}:00`, valor }))
  const recurrentesLista = [...clientes.entries()].filter(([k, c]) => c.n >= 2 || previos.has(k))
  return {
    total: validos.length,
    cancelados: estados.get('cancelado') ?? 0,
    ventas,
    ticket: validos.length ? Math.round(ventas / validos.length) : 0,
    porDia: [...porDiaMap.entries()].map(([fecha, valor]) => ({ fecha, valor })),
    ventasPorDia: [...ventasMap.entries()].map(([fecha, valor]) => ({ fecha, valor })),
    porDiaSemana: SEMANA.map((etiqueta, i) => ({ etiqueta, valor: semana[i] })),
    porHora,
    horaTop: porHora[0]?.etiqueta ?? null,
    porEstado: [...estados.entries()].map(([estado, valor]) => ({ estado, valor })).sort((a, b) => b.valor - a.valor),
    porTipo: [...tipos.entries()].map(([tipo, valor]) => ({ tipo, valor })).sort((a, b) => b.valor - a.valor),
    porPago: [...pagos.entries()].map(([medio, valor]) => ({ medio, valor })).sort((a, b) => b.valor - a.valor),
    recurrentes: recurrentesLista.length,
    nuevos: clientes.size - recurrentesLista.length,
    pctRecurrentes: clientes.size ? Math.round((recurrentesLista.length / clientes.size) * 1000) / 10 : 0,
    topClientes: [...clientes.entries()].map(([clave, c]) => ({ clave, cliente_id: c.cliente_id, nombre: c.nombre, telefono: c.telefono, pedidos: c.n, gastado: c.gastado, ultima: c.ultima }))
      .sort((a, b) => b.pedidos - a.pedidos || b.gastado - a.gastado).slice(0, 10),
  }
}

/** Productos más pedidos (por unidades), juntando las variantes bajo el nombre del producto. */
export function topProductos(items: FilaItemPedido[], max = 8): { etiqueta: string; valor: number; ventas: number }[] {
  const m = new Map<string, { valor: number; ventas: number }>()
  for (const i of items) { const x = m.get(i.nombre) ?? { valor: 0, ventas: 0 }; x.valor += Number(i.cantidad); x.ventas += Number(i.subtotal); m.set(i.nombre, x) }
  return [...m.entries()].map(([etiqueta, x]) => ({ etiqueta, ...x })).sort((a, b) => b.valor - a.valor || b.ventas - a.ventas).slice(0, max)
}

/** Clave con la que se reconoce a un cliente entre períodos (la misma que usa calcularMetricasPedidos). */
export const clavePedido = (p: { cliente_id: string | null; telefono: string | null }) => p.cliente_id ?? (p.telefono ? `tel:${p.telefono}` : null)
