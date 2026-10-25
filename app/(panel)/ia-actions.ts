'use server'

import { getContexto } from '@/lib/context'
import { hoyEn, sumarDias } from '@/lib/fechas'
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
