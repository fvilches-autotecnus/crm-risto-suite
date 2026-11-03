/** Carta digital: tipos, etiquetas y formato de precios (sin dependencias de servidor: se usa en el panel y en la carta pública). */

export interface Variante { nombre: string; precio: number }

export interface CategoriaCarta {
  id: string; nombre: string; descripcion: string | null; orden: number; visible: boolean
}

export interface ProductoCarta {
  id: string; categoria_id: string; nombre: string; descripcion: string | null; precio: number | null
  variantes: Variante[]; etiquetas: string[]; imagen_path: string | null
  disponible: boolean; visible: boolean; destacado: boolean; orden: number
}

export interface ConfigCarta {
  publica: boolean; titulo: string | null; mensaje: string | null; mostrar_precios: boolean; moneda: string
  /** Carta de solo lectura encendida: /carta/<negocio>/ver, el mismo catálogo sin carrito. */
  lectura: boolean
  /** Etiquetas propias del negocio (nombre y color), además de las de siempre. */
  etiquetas: EtiquetaPropia[]
}

export const CONFIG_POR_DEFECTO: ConfigCarta = { publica: true, titulo: null, mensaje: null, mostrar_precios: true, moneda: '$', lectura: false, etiquetas: [] }

export const ETIQUETAS: { clave: string; label: string; color: string }[] = [
  { clave: 'recomendado', label: 'Recomendado', color: 'bg-rs-lime/15 text-rs-lime' },
  { clave: 'nuevo', label: 'Nuevo', color: 'bg-rs-lav/15 text-rs-lav' },
  { clave: 'vegetariano', label: 'Vegetariano', color: 'bg-rs-ok/15 text-rs-ok' },
  { clave: 'vegano', label: 'Vegano', color: 'bg-rs-ok/15 text-rs-ok' },
  { clave: 'sin_tacc', label: 'Sin TACC', color: 'bg-rs-warn/15 text-rs-warn' },
  { clave: 'picante', label: 'Picante', color: 'bg-rs-danger/15 text-rs-danger' },
]
export const CLAVES_ETIQUETAS = ETIQUETAS.map((e) => e.clave)

/** Etiqueta propia del negocio: la clave empieza con "x_" para no chocar con las de siempre; el color es un #rrggbb de la paleta. */
export interface EtiquetaPropia { clave: string; label: string; color: string }
export const MAX_ETIQUETAS_PROPIAS = 20
export const PALETA_ETIQUETAS: { nombre: string; hex: string }[] = [
  { nombre: 'Rojo', hex: '#dc2626' }, { nombre: 'Naranja', hex: '#ea580c' }, { nombre: 'Amarillo', hex: '#ca8a04' }, { nombre: 'Verde', hex: '#16a34a' },
  { nombre: 'Turquesa', hex: '#0d9488' }, { nombre: 'Azul', hex: '#2563eb' }, { nombre: 'Violeta', hex: '#7c3aed' }, { nombre: 'Rosa', hex: '#db2777' }, { nombre: 'Gris', hex: '#6b7280' },
]
const RE_COLOR_ETIQUETA = /^#[0-9a-f]{6}$/i
/** Convierte lo guardado en jsonb a etiquetas propias válidas (ignora basura). */
export function leerEtiquetasPropias(v: unknown): EtiquetaPropia[] {
  if (!Array.isArray(v)) return []
  return v.map((x) => ({ clave: String((x as EtiquetaPropia)?.clave ?? ''), label: String((x as EtiquetaPropia)?.label ?? '').trim().slice(0, 24), color: String((x as EtiquetaPropia)?.color ?? '').toLowerCase() }))
    .filter((x) => /^x_[a-z0-9_]{1,30}$/.test(x.clave) && x.label && RE_COLOR_ETIQUETA.test(x.color)).slice(0, MAX_ETIQUETAS_PROPIAS)
}
/** Fondo, letra y borde de una etiqueta de color: el color mezclado con el fondo y con el texto de la página, para que se lea en temas claros y oscuros. */
export const estiloEtiqueta = (hex: string) => ({
  backgroundColor: `color-mix(in srgb, ${hex} 20%, transparent)`,
  color: `color-mix(in srgb, ${hex} 62%, rgb(var(--rs-text)))`,
  boxShadow: `inset 0 0 0 1px color-mix(in srgb, ${hex} 40%, transparent)`,
})
/** Una etiqueta (de siempre o propia) lista para dibujar: o bien `color` (clases) o bien `hex` (propia). */
export function etiquetaDe(clave: string, propias: EtiquetaPropia[] = []): { clave: string; label: string; color?: string; hex?: string } | undefined {
  const fija = ETIQUETAS.find((e) => e.clave === clave)
  if (fija) return fija
  const p = propias.find((e) => e.clave === clave)
  return p ? { clave: p.clave, label: p.label, hex: p.color } : undefined
}

export const MAX_VARIANTES = 10

/** "$ 12.500" / "$ 12.500,50": sin decimales cuando son cero. */
export function formatearPrecio(n: number, moneda = '$'): string {
  const entero = Math.round(n * 100) % 100 === 0
  return `${moneda} ${n.toLocaleString('es-AR', { minimumFractionDigits: entero ? 0 : 2, maximumFractionDigits: 2 })}`
}

/** Texto de precio de un producto: precio fijo, "Desde $X" con variantes, o nada si no tiene. */
export function textoPrecio(p: Pick<ProductoCarta, 'precio' | 'variantes'>, moneda = '$'): string | null {
  if (p.variantes.length) {
    const min = Math.min(...p.variantes.map((v) => v.precio), p.precio ?? Infinity)
    return Number.isFinite(min) ? `Desde ${formatearPrecio(min, moneda)}` : null
  }
  return p.precio === null ? null : formatearPrecio(p.precio, moneda)
}

/** Dirección pública de una foto del bucket "carta". */
export const urlImagen = (path: string | null | undefined): string | null =>
  path ? `${(process.env.NEXT_PUBLIC_SUPABASE_URL ?? '').replace(/^﻿/, '').trim().replace(/\/$/, '')}/storage/v1/object/public/carta/${path}` : null   // la variable en Vercel puede traer un carácter invisible (BOM) al principio

/** Convierte lo guardado en jsonb a variantes válidas (ignora basura). */
export function leerVariantes(v: unknown): Variante[] {
  if (!Array.isArray(v)) return []
  return v.map((x) => ({ nombre: String((x as Variante)?.nombre ?? '').trim().slice(0, 40), precio: Number((x as Variante)?.precio) }))
    .filter((x) => x.nombre && Number.isFinite(x.precio) && x.precio >= 0).slice(0, MAX_VARIANTES)
}
