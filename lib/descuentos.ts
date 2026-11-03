/** Descuentos de pedidos (sin dependencias de servidor: se usan en el panel y en la carta pública). */
import { DIAS_SEMANA } from '@/lib/pedidos-horarios'
import { dinero } from '@/lib/pedidos'

export type TipoDescuento = 'porcentaje' | 'monto'
export type AlcanceDescuento = 'todo' | 'categorias' | 'productos'
/** Un día suelto (hasta = null) o un rango, ambos inclusive. */
export interface FechaDescuento { desde: string; hasta: string | null }

/**
 * Regla de descuento. Sin código es automática; con código es un cupón (el cliente lo escribe).
 * Las condiciones se suman (todas tienen que cumplirse): medios, días de la semana y fechas; vacío = sin restricción.
 * No se acumulan: a cada pedido se le aplica el descuento que más le conviene al cliente.
 */
export interface DescuentoPedido {
  id: string; nombre: string; activo: boolean
  tipo: TipoDescuento; valor: number
  alcance: AlcanceDescuento; categoria_ids: string[]; producto_ids: string[]
  medios: string[] | null; dias: number[] | null; fechas: FechaDescuento[]
  codigo: string | null; usos_max: number | null
  /** Pedidos (no cancelados) que lo usaron. */
  usos: number
}

export const COLS_DESCUENTOS = 'id, nombre, activo, tipo, valor, alcance, categoria_ids, producto_ids, medios, dias, fechas, codigo, usos_max, orden'
export const MAX_DESCUENTOS = 40
export const MAX_FECHAS_DESCUENTO = 30

type Fila = Record<string, unknown>
const lista = (v: unknown) => (Array.isArray(v) ? v.map(String) : [])
export function leerDescuentos(filas: Fila[] | null | undefined, usos: Record<string, number> = {}): DescuentoPedido[] {
  return (filas ?? []).map((f) => ({
    id: String(f.id), nombre: String(f.nombre ?? ''), activo: f.activo !== false,
    tipo: f.tipo === 'monto' ? 'monto' : 'porcentaje', valor: Number(f.valor ?? 0),
    alcance: f.alcance === 'categorias' || f.alcance === 'productos' ? f.alcance : 'todo',
    categoria_ids: lista(f.categoria_ids), producto_ids: lista(f.producto_ids),
    medios: Array.isArray(f.medios) ? lista(f.medios) : null,
    dias: Array.isArray(f.dias) ? (f.dias as unknown[]).map(Number).filter((d) => Number.isInteger(d) && d >= 0 && d <= 6) : null,
    fechas: (Array.isArray(f.fechas) ? (f.fechas as Fila[]) : []).map((x) => ({ desde: String(x.desde ?? ''), hasta: x.hasta ? String(x.hasta) : null })).filter((x) => /^\d{4}-\d{2}-\d{2}$/.test(x.desde)),
    codigo: (f.codigo as string | null) || null, usos_max: f.usos_max === null || f.usos_max === undefined ? null : Number(f.usos_max), usos: usos[String(f.id)] ?? 0,
  }))
}

const corta = (iso: string) => { const [, m, d] = iso.split('-'); return `${d}/${m}` }
const nombres = (ids: string[], mapa: Map<string, string>, max = 3) => {
  const n = ids.map((i) => mapa.get(i)).filter(Boolean) as string[]
  return n.length === 0 ? 'ninguno (ya no existen)' : n.length <= max ? n.join(', ') : `${n.slice(0, max).join(', ')} y ${n.length - max} más`
}

/** Frases legibles de lo que hace una regla: el beneficio y cada condición. */
export function resumenDescuento(d: DescuentoPedido, ctx: { categorias: Map<string, string>; productos: Map<string, string>; medios: Map<string, string>; moneda?: string }): { beneficio: string; condiciones: string[] } {
  const beneficio = d.tipo === 'porcentaje' ? `${d.valor.toLocaleString('es-AR')}% de descuento` : `${dinero(d.valor, ctx.moneda)} de descuento`
  const condiciones: string[] = []
  condiciones.push(d.alcance === 'todo' ? 'Sobre todo el pedido' : d.alcance === 'categorias' ? `Solo en las categorías: ${nombres(d.categoria_ids, ctx.categorias)}` : `Solo en los productos: ${nombres(d.producto_ids, ctx.productos)}`)
  if (d.medios) condiciones.push(`Pagando con: ${nombres(d.medios, ctx.medios, 5)}`)
  if (d.dias) condiciones.push(`Los ${[...d.dias].sort((a, b) => ((a + 6) % 7) - ((b + 6) % 7)).map((n) => DIAS_SEMANA.find((x) => x.n === String(n))?.largo).join(', ')}`)
  if (d.fechas.length) condiciones.push(d.fechas.map((f) => (f.hasta && f.hasta !== f.desde ? `del ${corta(f.desde)} al ${corta(f.hasta)}` : `el ${corta(f.desde)}`)).join(' · ').replace(/^./, (c) => c.toUpperCase()))
  if (d.codigo) condiciones.push(`Con el cupón ${d.codigo}${d.usos_max ? ` · ${d.usos} de ${d.usos_max} usos` : d.usos ? ` · ${d.usos} uso${d.usos === 1 ? '' : 's'}` : ''}`)
  else if (d.usos_max) condiciones.push(`${d.usos} de ${d.usos_max} usos`)
  return { beneficio, condiciones }
}
