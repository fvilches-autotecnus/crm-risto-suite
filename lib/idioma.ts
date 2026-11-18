import { TZ_AR, zonaOk } from '@/lib/fechas'

/**
 * Variante del español que se le habla al CLIENTE de un negocio (sitio de reservas, mensajes del bot), según su país:
 *  · voseo (Argentina, Uruguay): "Reservá", "elegí", "tenés"
 *  · tuteo (Perú, Colombia, México…): "Reserva", "elige", "tienes"
 * Se deduce de la zona horaria del negocio. El panel del equipo no cambia.
 */
export type Variante = 'voseo' | 'tuteo'

const ZONAS_VOSEO = new Set([TZ_AR, 'America/Montevideo'])
export const varianteDe = (zona: string | null | undefined): Variante => (ZONAS_VOSEO.has(zonaOk(zona)) ? 'voseo' : 'tuteo')

/** Código de país con el que arranca el teléfono de un negocio (Argentina móvil = 549). */
const PAIS_TEL: Record<string, string> = { [TZ_AR]: '549', 'America/Lima': '51', 'America/Bogota': '57', 'America/Montevideo': '598', 'America/Mexico_City': '52' }
export const paisTelefonoDe = (zona: string | null | undefined) => PAIS_TEL[zonaOk(zona)] ?? '549'

// voseo → tuteo: solo las formas que aparecen en los textos para clientes (se amplía acá si se suman textos nuevos)
const PALABRAS: Record<string, string> = {
  reservá: 'reserva', elegí: 'elige', escribí: 'escribe', escribinos: 'escríbenos', escribilo: 'escríbelo', completá: 'completa', esperá: 'espera', guardá: 'guarda',
  probá: 'prueba', recibí: 'recibe', revisá: 'revisa', sacá: 'saca', sumá: 'suma', tocá: 'toca', volvé: 'vuelve', cambiá: 'cambia', dejá: 'deja', dejalo: 'déjalo',
  confirmalo: 'confírmalo', enviála: 'envíala', enviálo: 'envíalo', mandá: 'manda', cargá: 'carga', comunicate: 'comunícate', contanos: 'cuéntanos', avisanos: 'avísanos',
  podés: 'puedes', querés: 'quieres', necesitás: 'necesitas', ponés: 'pones', mandás: 'mandas', tenés: 'tienes', sos: 'eres', acá: 'aquí', vos: 'tú',
}
// frases que cambian enteras (van antes que las palabras sueltas)
const FRASES: [RegExp, string][] = [
  [/con el código de área, sin 0 ni 15 \(por ejemplo 341 5551234\)/gi, 'con el código de país (por ejemplo 51 987 654 321)'],
  [/con el código de área, sin 0 ni 15\./gi, 'con el código de país, sin 0 inicial.'],
  [/\b341 5551234\b/g, '987 654 321'],
  [/\bcon vos\b/gi, 'contigo'], [/\bpor vos\b/gi, 'por ti'], [/\bde vos\b/gi, 'de ti'], [/\ba vos\b/gi, 'a ti'],
]

const igualaMayuscula = (orig: string, nueva: string) => (orig[0] !== orig[0].toLowerCase() ? nueva[0].toUpperCase() + nueva.slice(1) : nueva)

/** Pasa un texto en voseo a tuteo. Lo que no está en la lista queda igual. */
export function aTuteo(texto: string): string {
  let t = texto
  for (const [re, nuevo] of FRASES) t = t.replace(re, (m) => (m[0] !== m[0].toLowerCase() ? nuevo[0].toUpperCase() + nuevo.slice(1) : nuevo))
  return t.replace(/\p{L}+/gu, (w) => { const n = PALABRAS[w.toLowerCase()]; return n ? igualaMayuscula(w, n) : w })
}

/** El texto en la variante del negocio (sin cambios para voseo). */
export const traducir = (variante: Variante, texto: string) => (variante === 'tuteo' ? aTuteo(texto) : texto)
