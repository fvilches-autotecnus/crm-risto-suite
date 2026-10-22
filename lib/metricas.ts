import { fechaLarga, inicioSemana, sumarDias } from '@/lib/fechas'
import type { EstadoReserva } from '@/lib/reservas'

export interface FilaReserva {
  cliente_id: string | null
  fecha: string          // 'YYYY-MM-DD'
  hora: string | null    // 'HH:MM:SS'
  cantidad_personas: number | null
  estado: EstadoReserva
  sucursal_id: string | null
}

export interface Metricas {
  total: number                       // reservas del período, sin contar canceladas
  canceladas: number
  promPersonas: number
  horarioTop: string | null
  porDia: { fecha: string; valor: number }[]                 // un punto por día del período (con ceros)
  porDiaSemana: { etiqueta: string; valor: number }[]        // lun..dom
  porHorario: { etiqueta: string; valor: number }[]          // top 6
  porEstado: { estado: string; valor: number }[]
  porSede: { sucursal_id: string | null; valor: number }[]
  recurrentes: number
  nuevos: number
  pctRecurrentes: number
  topRecurrentes: { cliente_id: string; reservas: number; ultima: string }[]
}

const SEMANA = ['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom']

/** Métricas del período [hoy-dias+1, hoy] a partir de las reservas del período y de los clientes que ya reservaron antes. */
export function calcularMetricas(periodo: FilaReserva[], previos: Set<string>, dias: number, hoy: string): Metricas {
  const desde = sumarDias(hoy, -(dias - 1))
  const validas = periodo.filter((r) => r.estado !== 'cancelada')

  const porDiaMap = new Map<string, number>()
  for (let i = 0; i < dias; i++) porDiaMap.set(sumarDias(desde, i), 0)
  const semana = new Array(7).fill(0)
  const horas = new Map<string, number>()
  const sedes = new Map<string | null, number>()
  let personas = 0, conPersonas = 0

  for (const r of validas) {
    porDiaMap.set(r.fecha, (porDiaMap.get(r.fecha) ?? 0) + 1)
    const [y, m, d] = r.fecha.split('-').map(Number)
    semana[(new Date(Date.UTC(y, m - 1, d)).getUTCDay() + 6) % 7]++
    if (r.hora) { const h = r.hora.slice(0, 5); horas.set(h, (horas.get(h) ?? 0) + 1) }
    sedes.set(r.sucursal_id, (sedes.get(r.sucursal_id) ?? 0) + 1)
    if (r.cantidad_personas) { personas += r.cantidad_personas; conPersonas++ }
  }

  const porHorario = [...horas.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0])).slice(0, 6).map(([etiqueta, valor]) => ({ etiqueta, valor }))
  const estados = new Map<string, number>()
  for (const r of periodo) estados.set(r.estado, (estados.get(r.estado) ?? 0) + 1)

  // Clientes: recurrente = reservó 2 o más veces en el período, o ya había reservado antes del período.
  const porCliente = new Map<string, { n: number; ultima: string }>()
  for (const r of validas) {
    if (!r.cliente_id) continue
    const x = porCliente.get(r.cliente_id) ?? { n: 0, ultima: r.fecha }
    x.n++
    if (r.fecha > x.ultima) x.ultima = r.fecha
    porCliente.set(r.cliente_id, x)
  }
  const recurrentesLista = [...porCliente.entries()].filter(([id, x]) => x.n >= 2 || previos.has(id))
  const recurrentes = recurrentesLista.length
  const nuevos = porCliente.size - recurrentes

  return {
    total: validas.length,
    canceladas: estados.get('cancelada') ?? 0,
    promPersonas: conPersonas ? Math.round((personas / conPersonas) * 10) / 10 : 0,
    horarioTop: porHorario[0]?.etiqueta ?? null,
    porDia: [...porDiaMap.entries()].map(([fecha, valor]) => ({ fecha, valor })),
    porDiaSemana: SEMANA.map((etiqueta, i) => ({ etiqueta, valor: semana[i] })),
    porHorario,
    porEstado: [...estados.entries()].map(([estado, valor]) => ({ estado, valor })).sort((a, b) => b.valor - a.valor),
    porSede: [...sedes.entries()].map(([sucursal_id, valor]) => ({ sucursal_id, valor })).sort((a, b) => b.valor - a.valor),
    recurrentes,
    nuevos,
    pctRecurrentes: porCliente.size ? Math.round((recurrentes / porCliente.size) * 1000) / 10 : 0,
    topRecurrentes: recurrentesLista.map(([cliente_id, x]) => ({ cliente_id, reservas: x.n, ultima: x.ultima })).sort((a, b) => b.reservas - a.reservas || b.ultima.localeCompare(a.ultima)).slice(0, 10),
  }
}

// ---------------------------------------------------------------------------
// Serie de evolución agrupada (día / semana / mes), opcionalmente acumulada
// ---------------------------------------------------------------------------
export type Agrupacion = 'dia' | 'semana' | 'mes'
export interface PuntoSerie { x: string; valor: number; etiqueta: string; titulo: string }

/** Con períodos largos, un punto por día es ruido: se agrupa para que se vea la tendencia. */
export const agrupacionAuto = (dias: number): Agrupacion => (dias <= 31 ? 'dia' : 'semana')

const MESES = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre']
const dm = (f: string) => `${f.slice(8, 10)}/${f.slice(5, 7)}`

export function serieEvolucion(porDia: { fecha: string; valor: number }[], modo: Agrupacion, acumulado: boolean): PuntoSerie[] {
  if (!porDia.length) return []
  const desde = porDia[0].fecha, hasta = porDia[porDia.length - 1].fecha
  const cubetas = new Map<string, { inicio: string; fin: string; valor: number }>()
  for (const d of porDia) {
    const clave = modo === 'dia' ? d.fecha : modo === 'semana' ? inicioSemana(d.fecha) : d.fecha.slice(0, 7)
    const c = cubetas.get(clave) ?? { inicio: d.fecha, fin: d.fecha, valor: 0 }
    c.valor += d.valor
    if (d.fecha < c.inicio) c.inicio = d.fecha
    if (d.fecha > c.fin) c.fin = d.fecha
    cubetas.set(clave, c)
  }
  let acc = 0
  return [...cubetas.entries()].sort((a, b) => a[0].localeCompare(b[0])).map(([clave, c]) => {
    acc += c.valor
    const valor = acumulado ? acc : c.valor
    if (modo === 'dia') return { x: clave, valor, etiqueta: dm(clave), titulo: fechaLarga(clave) }
    if (modo === 'semana') return { x: clave, valor, etiqueta: dm(c.inicio), titulo: `Semana del ${dm(c.inicio)} al ${dm(c.fin)}` }
    const m = Number(clave.slice(5, 7)) - 1
    return { x: clave, valor, etiqueta: MESES[m].slice(0, 3), titulo: `${MESES[m][0].toUpperCase()}${MESES[m].slice(1)} ${clave.slice(0, 4)}${c.inicio === desde && c.fin === hasta ? '' : ''}` }
  })
}
