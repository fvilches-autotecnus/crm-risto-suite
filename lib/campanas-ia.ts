/**
 * Textos de campañas con IA + plantillas de WhatsApp (Meta) cargadas a mano. Sin dependencias de servidor: lo usan acciones, páginas y componentes.
 * Los mensajes de campaña salen siempre como plantilla aprobada de Meta; el CRM no envía nada: guarda las plantillas y ayuda a redactar
 *  · ideas de mensaje (para pensar o para pedirle a Meta una plantilla nueva) y
 *  · el contenido de las variables de texto libre de una plantilla ya aprobada (el texto fijo de la plantilla no se toca).
 */

export const OBJETIVOS_IA = [
  { value: 'reactivacion', label: 'Reactivación', ayuda: 'Volver a traer a clientes que hace tiempo no vienen' },
  { value: 'cumpleanos', label: 'Cumpleaños', ayuda: 'Saludo y regalo para los cumpleañeros' },
  { value: 'promocion', label: 'Promoción', ayuda: 'Una oferta, un menú o un beneficio' },
  { value: 'evento', label: 'Evento', ayuda: 'Un show, una noche especial o una fecha puntual' },
] as const
export type ObjetivoIA = (typeof OBJETIVOS_IA)[number]['value']
export const OBJETIVOS_PLANTILLA = [...OBJETIVOS_IA, { value: 'otro', label: 'Otro', ayuda: 'Cualquier otro uso' }] as const
export const labelObjetivo = (v: string) => OBJETIVOS_PLANTILLA.find((o) => o.value === v)?.label ?? 'Otro'

/** Del tipo de una campaña al objetivo que más se parece (para preseleccionarlo). */
export const objetivoDeTipo = (tipo: string | null | undefined): ObjetivoIA =>
  tipo === 'cumpleanos' ? 'cumpleanos' : tipo === 'inactividad' || tipo === 'retorno' || tipo === 'reactivacion' ? 'reactivacion' : tipo === 'evento' ? 'evento' : 'promocion'

export const TONOS_IA = [
  { value: 'cercano', label: 'Cercano y amistoso', pauta: 'Cercano y cálido, como un mozo que conoce al cliente de siempre. Tuteo rioplatense (vos).' },
  { value: 'formal', label: 'Formal y cordial', pauta: 'Formal, correcto y cordial. Sin modismos ni diminutivos. Trato de usted solo si queda natural; si no, un vos respetuoso.' },
  { value: 'divertido', label: 'Divertido', pauta: 'Divertido y canchero, con humor liviano. Vos rioplatense. Sin chistes que puedan ofender.' },
  { value: 'elegante', label: 'Elegante', pauta: 'Elegante y sobrio, de local cuidado. Frases cortas, sin exclamaciones de más.' },
  { value: 'entusiasta', label: 'Entusiasta', pauta: 'Entusiasta y con energía, que invite a venir. Algunas exclamaciones, sin exagerar.' },
] as const
export type TonoIA = (typeof TONOS_IA)[number]['value']

export const ESTADOS_PLANTILLA = [
  { value: 'aprobada', label: 'Aprobada' },
  { value: 'pendiente', label: 'En revisión' },
  { value: 'rechazada', label: 'Rechazada' },
] as const
export type EstadoPlantilla = (typeof ESTADOS_PLANTILLA)[number]['value']
export const labelEstadoPlantilla = (v: string) => ESTADOS_PLANTILLA.find((e) => e.value === v)?.label ?? v

export const IDIOMAS_PLANTILLA = ['es', 'es_AR', 'es_ES', 'es_MX', 'en', 'en_US', 'pt_BR']

/** "dato": lo completa el flujo de envío (nombre, fecha, código…). "texto": contenido libre que puede proponer la IA. */
export interface VariablePlantilla { pos: number; nombre: string; tipo: 'dato' | 'texto'; ejemplo: string; max: number }
export interface PlantillaCampana {
  id: string; nombre: string; idioma: string; objetivo: string; estado: string
  cuerpo: string | null; variables: VariablePlantilla[]; activa: boolean
}
export const COLS_PLANTILLA = 'id, nombre, idioma, objetivo, estado, cuerpo, variables, activa'

export const MAX_VARIABLE_DEFECTO = 60
export const MAX_VARIABLE_TOPE = 200
/** Tope de generaciones con IA por negocio en 24 horas (cuida el gasto). */
export const LIMITE_IA_DIARIO = 30

/** Una plantilla sirve para enviar solo si Meta la aprobó y está activa en el CRM. */
export const plantillaUsable = (p: Pick<PlantillaCampana, 'estado' | 'activa'>) => p.activa && p.estado === 'aprobada'

/** Convierte lo guardado en jsonb a variables válidas (ignora basura). */
export function leerVariables(v: unknown): VariablePlantilla[] {
  if (!Array.isArray(v)) return []
  const vistas = new Set<number>()
  const salida: VariablePlantilla[] = []
  for (const x of v) {
    const o = (x ?? {}) as Record<string, unknown>
    const pos = Number(o.pos)
    if (!Number.isInteger(pos) || pos < 1 || pos > 20 || vistas.has(pos)) continue
    vistas.add(pos)
    const max = Number(o.max)
    salida.push({
      pos, nombre: String(o.nombre ?? '').replace(/\s+/g, ' ').trim().slice(0, 40) || `variable ${pos}`,
      tipo: o.tipo === 'texto' ? 'texto' : 'dato', ejemplo: String(o.ejemplo ?? '').replace(/\s+/g, ' ').trim().slice(0, 200),
      max: Number.isInteger(max) && max >= 5 && max <= MAX_VARIABLE_TOPE ? max : MAX_VARIABLE_DEFECTO,
    })
  }
  return salida.sort((a, b) => a.pos - b.pos)
}

/** Posiciones {{1}}, {{2}}… que aparecen en el texto de una plantilla, sin repetir y en orden. */
export function posicionesDeCuerpo(cuerpo: string | null | undefined): number[] {
  return [...new Set([...(cuerpo ?? '').matchAll(/\{\{\s*(\d{1,2})\s*\}\}/g)].map((m) => Number(m[1])))].sort((a, b) => a - b)
}

/** Meta no admite saltos de línea, tabulaciones ni más de 3 espacios seguidos dentro de una variable: se juntan los espacios y se recorta al largo máximo (sin cortar una palabra). */
export function sanearVariable(texto: unknown, max: number): string {
  const t = (typeof texto === 'string' ? texto : '').replace(/[{}]/g, '').replace(/\s+/g, ' ').trim()
  if (t.length <= max) return t
  const corte = t.slice(0, max)
  const ultimo = corte.lastIndexOf(' ')
  return (ultimo > max * 0.6 ? corte.slice(0, ultimo) : corte).replace(/[\s,;:.-]+$/, '')
}

/** El texto de la plantilla con cada {{n}} reemplazado por su valor (o por "{{n}}" si no hay valor). */
export function renderCuerpo(cuerpo: string, valores: Record<string, string>): string {
  return cuerpo.replace(/\{\{\s*(\d{1,2})\s*\}\}/g, (m, n) => valores[n] ?? m)
}

// ---------------------------------------------------------------------------
// Segmento de destinatarios
// ---------------------------------------------------------------------------
export type Segmento =
  | { tipo: 'todos' }
  | { tipo: 'inactivos'; desde: number; hasta: number }   // última reserva hace entre `desde` y `hasta` días
  | { tipo: 'cumple'; dias: number }                      // cumplen años dentro de los próximos `dias` días
  | { tipo: 'etiqueta'; id: string }

const entero = (v: unknown, min: number, max: number, def: number) => { const n = Math.floor(Number(v)); return Number.isFinite(n) ? Math.min(max, Math.max(min, n)) : def }

export function leerSegmento(v: unknown): Segmento {
  const o = (v ?? {}) as Record<string, unknown>
  if (o.tipo === 'inactivos') {
    const desde = entero(o.desde, 1, 1500, 30)
    return { tipo: 'inactivos', desde, hasta: Math.max(desde, entero(o.hasta, 1, 1500, 365)) }
  }
  if (o.tipo === 'cumple') return { tipo: 'cumple', dias: entero(o.dias, 0, 90, 30) }
  if (o.tipo === 'etiqueta' && typeof o.id === 'string') return { tipo: 'etiqueta', id: o.id }
  return { tipo: 'todos' }
}

/** Segmento que conviene proponer según el objetivo. */
export const segmentoSugerido = (objetivo: string): Segmento => objetivo === 'reactivacion' ? { tipo: 'inactivos', desde: 30, hasta: 365 } : objetivo === 'cumpleanos' ? { tipo: 'cumple', dias: 30 } : { tipo: 'todos' }

// ---------------------------------------------------------------------------
// Resultado de la generación
// ---------------------------------------------------------------------------
export interface VarianteIA {
  titulo: string
  /** Modo "ideas": el mensaje completo (con {{1}} para el nombre). */
  texto?: string
  /** Modo "plantilla": el texto de cada variable de texto libre, por posición. */
  variables?: Record<string, string>
  /** Modo "plantilla": cómo quedaría el mensaje (los datos van con su ejemplo). */
  vista?: string
}
export type ResultadoIA =
  | { ok: true; variantes: VarianteIA[]; segmento: { descripcion: string; cantidad: number }; modelo: string; restantes: number }
  | { ok: false; error: string }

export interface ContextoIA {
  disponible: boolean
  plantillas: PlantillaCampana[]
  etiquetas: { id: string; nombre: string }[]
  puedeAdministrar: boolean
  usadasHoy: number
}
