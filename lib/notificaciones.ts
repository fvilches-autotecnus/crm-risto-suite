import 'server-only'
import type { Contexto } from '@/lib/context'
import { diaMes } from '@/lib/fechas'

/**
 * Campanita de notificaciones. No hay una tabla de avisos: salen de lo que ya existe (reservas que toma el bot o el sitio,
 * consultas y reclamos, pedidos), leídas con la sesión del usuario, así que las políticas de cada tabla ya limitan por sede.
 * Lo único que se guarda es qué leyó cada persona (notificaciones_lectura: "todo hasta tal momento"; notificaciones_vistas: avisos sueltos).
 */
export type TipoNotificacion = 'reserva' | 'consulta' | 'reclamo' | 'pedido'
export interface Notificacion {
  /** "reserva:<id>" | "consulta:<id>" | "pedido:<id>": identifica el aviso para marcarlo como leído. */
  clave: string
  tipo: TipoNotificacion
  titulo: string
  detalle: string
  /** Solo si el usuario maneja más de una sede. */
  sede: string | null
  creadoEn: string
  href: string
  leida: boolean
}
export interface Notificaciones { items: Notificacion[]; sinLeer: number }

/** Cuántos días hacia atrás se muestran y cuántos avisos como máximo. */
const DIAS = 14
const MAXIMO = 40
const POR_TABLA = 50
const NINGUNA = '00000000-0000-0000-0000-000000000000'
const CLAVE = /^(reserva|consulta|pedido):[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/

const corto = (t: string | null, n: number) => { const s = (t ?? '').replace(/\s+/g, ' ').trim(); return s.length > n ? s.slice(0, n - 1) + '…' : s }

interface FilaReserva { id: string; numero: number; numero_sede: number | null; cliente_nombre: string | null; cantidad_personas: number | null; fecha: string | null; hora: string | null; sucursal_id: string | null; creado_en: string }
interface FilaConsulta { id: string; telefono: string | null; mensaje: string | null; tipo: string; sucursal_id: string | null; creado_en: string }
interface FilaPedido { id: string; numero: number; nombre: string; tipo: string; total: number; creado_en: string }

export async function cargarNotificaciones(ctx: Contexto): Promise<Notificaciones> {
  const sb = ctx.supabase
  const negocioId = ctx.negocio.id
  const desde = new Date(Date.now() - DIAS * 86_400_000).toISOString()
  // Con sedes limitadas solo cuenta lo de esas sedes (lo que no tiene sede es para quien no tiene restricción)
  const alcance = ctx.sinRestriccionSede ? null : ctx.sedesGestion.map((s) => s.id)
  const sedesDelAlcance = alcance ? (alcance.length ? alcance : [NINGUNA]) : null
  const nombreSede = (id: string | null) => (ctx.sedesGestion.length > 1 && id ? (ctx.sedesGestion.find((s) => s.id === id)?.nombre ?? null) : null)
  const m = ctx.modulosActivos

  let reservas = m.reservas ? sb.from('reservas').select('id, numero, numero_sede, cliente_nombre, cantidad_personas, fecha, hora, sucursal_id, creado_en').eq('negocio_id', negocioId).eq('es_manual', false).is('eliminado_en', null).gte('creado_en', desde) : null
  let consultas = m.consultas ? sb.from('consultas_reclamos').select('id, telefono, mensaje, tipo, sucursal_id, creado_en').eq('negocio_id', negocioId).gte('creado_en', desde) : null
  if (sedesDelAlcance) { reservas = reservas?.in('sucursal_id', sedesDelAlcance) ?? null; consultas = consultas?.in('sucursal_id', sedesDelAlcance) ?? null }
  const pedidos = m.pedidos ? sb.from('pedidos').select('id, numero, nombre, tipo, total, creado_en').eq('negocio_id', negocioId).neq('origen', 'manual').gte('creado_en', desde) : null

  const [lectura, rRes, rCon, rPed, vistas] = await Promise.all([
    sb.from('notificaciones_lectura').select('leido_hasta').eq('user_id', ctx.userId).eq('negocio_id', negocioId).maybeSingle(),
    reservas ? reservas.order('creado_en', { ascending: false }).limit(POR_TABLA) : null,
    consultas ? consultas.order('creado_en', { ascending: false }).limit(POR_TABLA) : null,
    pedidos ? pedidos.order('creado_en', { ascending: false }).limit(POR_TABLA) : null,
    sb.from('notificaciones_vistas').select('tipo, ref_id').eq('user_id', ctx.userId).eq('negocio_id', negocioId).gte('creado_en', desde).limit(2000),
  ])

  // Primera vez de esta persona en este negocio: lo que ya había no cuenta como "sin leer"
  let leidoHasta = lectura.data?.leido_hasta as string | undefined
  if (!leidoHasta) {
    // sin leido_hasta: la base pone su propia hora
    const { data: creada } = await sb.from('notificaciones_lectura').upsert({ user_id: ctx.userId, negocio_id: negocioId }, { onConflict: 'user_id,negocio_id', ignoreDuplicates: true }).select('leido_hasta').maybeSingle()
    leidoHasta = (creada?.leido_hasta as string | undefined) ?? new Date().toISOString()
  }
  const marca = new Date(leidoHasta).getTime()
  const vistasSet = new Set((vistas.data ?? []).map((v) => `${v.tipo}:${v.ref_id}`))
  const hecha = (clave: string, creadoEn: string) => new Date(creadoEn).getTime() <= marca || vistasSet.has(clave)

  const items: Notificacion[] = []
  for (const r of (rRes?.data ?? []) as FilaReserva[]) {
    const clave = `reserva:${r.id}`
    const cuando = r.fecha ? `${diaMes(r.fecha)}${r.hora ? ' ' + r.hora.slice(0, 5) : ''}` : 'a coordinar'
    items.push({
      clave, tipo: 'reserva', titulo: `Nueva reserva #${r.numero_sede ?? r.numero}`,
      detalle: [r.cliente_nombre ?? 'Sin nombre', r.cantidad_personas ? `${r.cantidad_personas} personas` : null, cuando].filter(Boolean).join(' · '),
      sede: nombreSede(r.sucursal_id), creadoEn: r.creado_en, href: `/reservas?rango=todas&q=${r.numero_sede ?? r.numero}`, leida: hecha(clave, r.creado_en),
    })
  }
  for (const c of (rCon?.data ?? []) as FilaConsulta[]) {
    const clave = `consulta:${c.id}`, reclamo = c.tipo === 'reclamo'
    items.push({
      clave, tipo: reclamo ? 'reclamo' : 'consulta', titulo: reclamo ? 'Nuevo reclamo' : 'Nueva consulta',
      detalle: [c.telefono, c.mensaje ? `“${corto(c.mensaje, 110)}”` : null].filter(Boolean).join(' · '),
      sede: nombreSede(c.sucursal_id), creadoEn: c.creado_en, href: '/consultas?estado=pendiente', leida: hecha(clave, c.creado_en),
    })
  }
  for (const p of (rPed?.data ?? []) as FilaPedido[]) {
    const clave = `pedido:${p.id}`
    items.push({
      clave, tipo: 'pedido', titulo: `Nuevo pedido #${p.numero}`,
      detalle: `${p.tipo === 'delivery' ? 'Delivery' : p.tipo === 'mesa' ? 'Mesa' : 'Retiro'} · ${p.nombre} · $ ${Number(p.total).toLocaleString('es-AR')}`,
      sede: null, creadoEn: p.creado_en, href: '/pedidos', leida: hecha(clave, p.creado_en),
    })
  }
  items.sort((a, b) => (a.creadoEn < b.creadoEn ? 1 : a.creadoEn > b.creadoEn ? -1 : 0))
  return { items: items.slice(0, MAXIMO), sinLeer: items.filter((i) => !i.leida).length }
}

/** Marca avisos sueltos como leídos (claves "tipo:id"; las que no tienen ese formato se ignoran). */
export async function marcarLeidas(ctx: Contexto, claves: string[]): Promise<void> {
  const filas = [...new Set(claves.filter((c) => CLAVE.test(c)))].slice(0, 100).map((c) => { const [tipo, ref_id] = c.split(':'); return { user_id: ctx.userId, negocio_id: ctx.negocio.id, tipo, ref_id } })
  if (!filas.length) return
  await ctx.supabase.from('notificaciones_vistas').upsert(filas, { onConflict: 'user_id,tipo,ref_id', ignoreDuplicates: true })
}

/** Todo lo que llegó hasta ahora pasa a leído. Los avisos sueltos ya no hacen falta: los cubre la marca. */
export async function marcarTodasLeidas(ctx: Contexto): Promise<void> {
  // La marca se pone con la hora de la base de datos (la misma con la que se fecha cada aviso)
  await ctx.supabase.rpc('marcar_notificaciones_leidas', { p_negocio: ctx.negocio.id })
}
