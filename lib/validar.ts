/** Validaciones y limpiezas chicas que usan muchas pantallas y acciones (sin dependencias: sirven en el servidor y en el navegador). */

/** Un uuid (8-4-4-4-12). */
export const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

/** Texto de un campo numérico → entero entre `min` y `max`, o null si no lo es (ojo: '' vale 0). */
export const entero = (v: string, min: number, max: number) => { const n = Number(v); return Number.isInteger(n) && n >= min && n <= max ? n : null }

/** Minúsculas, sin tildes y con guiones donde había otros símbolos: sirve para comparar nombres y armar códigos ("PLANTA ALTA" → "planta-alta"). */
export const sinTildes = (t: string) => t.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '')
