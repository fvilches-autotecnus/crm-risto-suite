'use server'

import { revalidatePath } from 'next/cache'
import { getContexto } from '@/lib/context'
import { CAMPANAS_EDITABLES } from '@/lib/campanas'
import {
  IDIOMAS_PLANTILLA, LIMITE_IA_DIARIO, MAX_VARIABLE_TOPE, OBJETIVOS_IA, OBJETIVOS_PLANTILLA, ESTADOS_PLANTILLA, TONOS_IA,
  leerSegmento, leerVariables, plantillaUsable, posicionesDeCuerpo,
  type ContextoIA, type ObjetivoIA, type ResultadoIA, type TonoIA,
} from '@/lib/campanas-ia'
import { cargarPlantillas, contarSegmento, promptIdeas, promptPlantilla, validarIdeas, validarPlantilla } from '@/lib/campanas-ia-servidor'
import { pedirJSON } from '@/lib/ia'
import { createAdminClient } from '@/lib/supabase/server'
import { UUID } from '@/lib/validar'
import type { ActionResult } from './actions'

const fail = (error: string): ActionResult => ({ ok: false, error })
const text = (fd: FormData, k: string) => String(fd.get(k) ?? '').trim()
const MAX_DETALLE = 700

/** Quién puede usar la IA de campañas: módulo encendido, campañas editables y usuario con permiso de escritura. */
async function contextoCampanas() {
  const ctx = await getContexto()
  if (!ctx.modulosActivos.campanas) return { ctx, error: 'Este negocio no tiene el módulo de campañas' }
  if (!CAMPANAS_EDITABLES) return { ctx, error: 'Las campañas son solo de consulta' }
  if (!ctx.puedeEscribir) return { ctx, error: 'Tu usuario es de solo lectura' }
  return { ctx, error: null }
}

async function usadasEn24h(negocioId: string): Promise<number> {
  const desde = new Date(Date.now() - 24 * 3600 * 1000).toISOString()
  const { count } = await createAdminClient().from('campanas_ia_uso').select('id', { count: 'exact', head: true }).eq('negocio_id', negocioId).gte('creado_en', desde)
  return count ?? 0
}

/** Lo que necesita la pantalla para ofrecer "Generar con IA": las plantillas del negocio, sus etiquetas y cuánto se usó hoy. `disponible: false` si todavía no está habilitado. */
export async function cargarContextoIA(): Promise<ContextoIA> {
  const vacio: ContextoIA = { disponible: false, plantillas: [], etiquetas: [], puedeAdministrar: false, usadasHoy: 0 }
  const { ctx, error } = await contextoCampanas()
  if (error) return vacio
  const plantillas = await cargarPlantillas(ctx)
  if (!plantillas) return vacio   // la tabla todavía no existe
  const [{ data: et }, usadasHoy] = await Promise.all([
    ctx.supabase.from('etiquetas').select('id, nombre').eq('negocio_id', ctx.negocio.id).order('nombre'),
    usadasEn24h(ctx.negocio.id),
  ])
  return { disponible: true, plantillas, etiquetas: (et ?? []) as { id: string; nombre: string }[], puedeAdministrar: ctx.puedeAdministrar, usadasHoy }
}

/**
 * Genera 3 variantes con IA.
 *  · modo "ideas": mensajes completos para inspirarse o pedirle a Meta una plantilla nueva.
 *  · modo "plantilla": solo el contenido de las variables de texto libre de una plantilla aprobada (el texto fijo no se toca).
 * A OpenAI solo van el objetivo, el tono, lo que escribió el negocio y la cantidad de clientes del segmento (nada de nombres ni teléfonos).
 */
export async function generarTextoCampana(entrada: unknown): Promise<ResultadoIA> {
  const { ctx, error } = await contextoCampanas()
  if (error) return { ok: false, error }
  const e = (entrada ?? {}) as Record<string, unknown>
  const modo = e.modo === 'plantilla' ? 'plantilla' : 'ideas'
  const objetivo = OBJETIVOS_IA.find((o) => o.value === e.objetivo)?.value as ObjetivoIA | undefined
  const tono = TONOS_IA.find((t) => t.value === e.tono)?.value as TonoIA | undefined
  if (!objetivo) return { ok: false, error: 'Elegí el objetivo del mensaje' }
  if (!tono) return { ok: false, error: 'Elegí el tono' }
  const detalle = String(e.detalle ?? '').replace(/\s+/g, ' ').trim()
  if (detalle.length > MAX_DETALLE) return { ok: false, error: `Los detalles pueden tener hasta ${MAX_DETALLE} caracteres` }

  const plantillas = await cargarPlantillas(ctx)
  if (!plantillas) return { ok: false, error: 'La función todavía no está habilitada en el sistema' }
  let plantilla = null
  if (modo === 'plantilla') {
    const id = String(e.plantillaId ?? '')
    plantilla = UUID.test(id) ? plantillas.find((p) => p.id === id) ?? null : null
    if (!plantilla) return { ok: false, error: 'Elegí una plantilla' }
    if (!plantillaUsable(plantilla)) return { ok: false, error: 'Esa plantilla no está aprobada por Meta: todavía no se puede usar para enviar' }
    if (!plantilla.cuerpo) return { ok: false, error: 'Cargá el texto de la plantilla para que la IA sepa dónde va cada variable' }
    if (!plantilla.variables.some((v) => v.tipo === 'texto')) return { ok: false, error: 'Esa plantilla no tiene variables de texto libre: no hay nada para que la IA proponga. Usá “Ideas de mensaje”.' }
  }

  const usadas = await usadasEn24h(ctx.negocio.id)
  if (usadas >= LIMITE_IA_DIARIO) return { ok: false, error: `Se llegó al límite de ${LIMITE_IA_DIARIO} generaciones por día para este negocio. Probá mañana.` }

  const segmento = await contarSegmento(ctx, leerSegmento(e.segmento))
  if (!segmento) return { ok: false, error: 'El segmento elegido no existe' }

  const pedido = { negocio: ctx.negocio.nombre, objetivo, tono, detalle, segmento }
  const { system, user } = plantilla ? promptPlantilla(pedido, plantilla) : promptIdeas(pedido)
  const r = await pedirJSON(system, user, { temperatura: 0.8, maxTokens: 1200, esperaMs: 45_000 })
  if (!r.ok) return r
  const variantes = plantilla ? validarPlantilla(r.json, plantilla) : validarIdeas(r.json)
  if (!variantes.length) return { ok: false, error: 'La IA no devolvió variantes que se puedan usar. Probá de nuevo.' }

  await createAdminClient().from('campanas_ia_uso').insert({ negocio_id: ctx.negocio.id, usuario_id: ctx.userId, modo, objetivo })
  return { ok: true, variantes, segmento, modelo: r.modelo, restantes: Math.max(0, LIMITE_IA_DIARIO - usadas - 1) }
}

// ---------------------------------------------------------------------------
// Plantillas de WhatsApp (se cargan a mano)
// ---------------------------------------------------------------------------
async function permisoPlantillas() {
  const { ctx, error } = await contextoCampanas()
  if (error) return { ctx, error }
  if (!ctx.puedeAdministrar) return { ctx, error: 'Solo un dueño o administrador puede cargar plantillas' }
  return { ctx, error: null }
}

export async function guardarPlantilla(_prev: ActionResult | null, fd: FormData): Promise<ActionResult> {
  const { ctx, error } = await permisoPlantillas()
  if (error) return fail(error)
  const id = text(fd, 'id')
  const nombre = text(fd, 'nombre').toLowerCase()
  const idioma = text(fd, 'idioma') || 'es'
  const objetivo = text(fd, 'objetivo') || 'otro'
  const estado = text(fd, 'estado') || 'aprobada'
  const cuerpo = String(fd.get('cuerpo') ?? '').replace(/\r\n/g, '\n').trim()
  if (id && !UUID.test(id)) return fail('Plantilla no válida')
  if (!/^[a-z0-9_]{1,120}$/.test(nombre)) return fail('El nombre de la plantilla va tal como está en Meta: minúsculas, números y guion bajo (sin espacios ni tildes)')
  if (!IDIOMAS_PLANTILLA.includes(idioma)) return fail('Idioma no válido')
  if (!OBJETIVOS_PLANTILLA.some((o) => o.value === objetivo)) return fail('Objetivo no válido')
  if (!ESTADOS_PLANTILLA.some((s) => s.value === estado)) return fail('Estado no válido')
  if (cuerpo.length > 1024) return fail('El texto de la plantilla puede tener hasta 1024 caracteres')

  // Las variables salen del texto ({{1}}, {{2}}…): tienen que ser consecutivas desde 1, como pide Meta
  const pos = posicionesDeCuerpo(cuerpo)
  if (pos.some((n, i) => n !== i + 1)) return fail('Las variables del texto tienen que ser {{1}}, {{2}}, {{3}}… en orden y sin saltear números')
  let crudas: unknown = []
  try { crudas = JSON.parse(text(fd, 'variables') || '[]') } catch { return fail('Las variables no son válidas') }
  const definidas = leerVariables(crudas)
  const variables = pos.map((n) => {
    const v = definidas.find((x) => x.pos === n)
    return v ? { ...v, max: Math.min(v.max, MAX_VARIABLE_TOPE) } : { pos: n, nombre: `variable ${n}`, tipo: 'dato' as const, ejemplo: '', max: 60 }
  })

  const fila = { nombre, idioma, objetivo, estado, cuerpo: cuerpo || null, variables, activa: fd.get('activa') === 'on' }
  const { error: e } = id
    ? await ctx.supabase.from('campanas_plantillas').update(fila).eq('id', id).eq('negocio_id', ctx.negocio.id)
    : await ctx.supabase.from('campanas_plantillas').insert({ ...fila, negocio_id: ctx.negocio.id })
  if (e) return fail(e.code === '23505' ? 'Ya cargaste esa plantilla en ese idioma' : 'No se pudo guardar la plantilla')
  revalidatePath('/', 'layout')
  return { ok: true }
}

export async function eliminarPlantilla(id: string): Promise<ActionResult> {
  const { ctx, error } = await permisoPlantillas()
  if (error) return fail(error)
  if (!UUID.test(id)) return fail('Plantilla no válida')
  const { error: e } = await ctx.supabase.from('campanas_plantillas').delete().eq('id', id).eq('negocio_id', ctx.negocio.id)
  if (e) return fail('No se pudo eliminar la plantilla')
  revalidatePath('/', 'layout')
  return { ok: true }
}
