import 'server-only'

/**
 * Cliente mínimo de la API de BotConversa (https://backend.botconversa.com.br/swagger/, header API-KEY).
 * Solo lo que usa el CRM: listar etiquetas, buscar un suscriptor por teléfono y ponerle / sacarle una etiqueta.
 * La API no permite crear etiquetas: las del negocio se importan desde BotConversa.
 * BOTCONVERSA_API_BASE existe solo para pruebas (apuntar a un servidor simulado); en producción no se define.
 */
const base = () => (process.env.BOTCONVERSA_API_BASE || 'https://backend.botconversa.com.br/api/v1/webhook').replace(/\/$/, '')

export type ErrorBC = 'clave' | 'no_encontrado' | 'conexion' | 'rechazado'
export interface ResultadoBC<T = unknown> { ok: boolean; datos?: T; error?: ErrorBC; detalle?: string }

async function llamar(clave: string, metodo: string, ruta: string, cuerpo?: unknown): Promise<{ status: number; json: unknown } | null> {
  try {
    const res = await fetch(`${base()}${ruta}`, {
      method: metodo,
      headers: { 'API-KEY': clave, 'Content-Type': 'application/json', Accept: 'application/json' },
      body: cuerpo === undefined ? undefined : JSON.stringify(cuerpo),
      signal: AbortSignal.timeout(10000),
      cache: 'no-store',
    })
    const texto = await res.text()
    let json: unknown = null
    try { json = texto ? JSON.parse(texto) : null } catch { /* respuesta sin cuerpo JSON */ }
    return { status: res.status, json }
  } catch (e) {
    console.error('[botconversa] error de conexión:', e)
    return null
  }
}

const mensaje = (json: unknown) => String((json as { error_message?: unknown } | null)?.error_message ?? '').slice(0, 200)

function fallo(r: { status: number; json: unknown } | null): ResultadoBC<never> {
  if (!r) return { ok: false, error: 'conexion' }
  if (r.status === 401 || r.status === 403) return { ok: false, error: 'clave', detalle: mensaje(r.json) }
  if (r.status === 404) return { ok: false, error: 'no_encontrado' }
  return { ok: false, error: 'rechazado', detalle: mensaje(r.json) || `HTTP ${r.status}` }
}

export async function etiquetasBC(clave: string): Promise<ResultadoBC<{ id: number; name: string }[]>> {
  const r = await llamar(clave, 'GET', '/tags/')
  if (!r || r.status !== 200 || !Array.isArray(r.json)) return fallo(r)
  return { ok: true, datos: (r.json as { id: number; name: string }[]).filter((t) => Number.isInteger(t.id) && typeof t.name === 'string') }
}

/** Variantes del número tal como puede estar en BotConversa (Argentina: con o sin el 9 después del 54). */
function variantes(telefono: string): string[] {
  const d = telefono.replace(/\D/g, '')
  const v = [d]
  if (d.startsWith('549')) v.push('54' + d.slice(3))
  else if (d.startsWith('54')) v.push('549' + d.slice(2))
  return v
}

export async function buscarSuscriptor(clave: string, telefono: string): Promise<ResultadoBC<number>> {
  let ultimo: ResultadoBC<never> = { ok: false, error: 'no_encontrado' }
  for (const tel of variantes(telefono)) {
    const r = await llamar(clave, 'GET', `/subscriber/get_by_phone/${encodeURIComponent(tel)}/`)
    if (r && r.status === 200 && typeof (r.json as { id?: unknown })?.id === 'number') return { ok: true, datos: (r.json as { id: number }).id }
    ultimo = fallo(r)
    if (ultimo.error !== 'no_encontrado') return ultimo
  }
  return ultimo
}

export async function agregarEtiquetaBC(clave: string, suscriptorId: number, etiquetaId: number): Promise<ResultadoBC> {
  const r = await llamar(clave, 'POST', `/subscriber/${suscriptorId}/tags/${etiquetaId}/`, {})
  return r && (r.status === 200 || r.status === 201 || r.status === 204) ? { ok: true } : fallo(r)
}

export async function quitarEtiquetaBC(clave: string, suscriptorId: number, etiquetaId: number): Promise<ResultadoBC> {
  const r = await llamar(clave, 'DELETE', `/subscriber/${suscriptorId}/tags/${etiquetaId}/`)
  return r && (r.status === 200 || r.status === 204) ? { ok: true } : fallo(r)
}

export function textoErrorBC(e: { error?: ErrorBC; detalle?: string }): string {
  switch (e.error) {
    case 'clave': return 'BotConversa rechazó la clave de la API (revisala en Configuración)'
    case 'no_encontrado': return 'Ese número no está en BotConversa'
    case 'conexion': return 'No se pudo conectar con BotConversa, probá de nuevo'
    default: return `BotConversa no aceptó el cambio${e.detalle ? `: ${e.detalle}` : ''}`
  }
}
