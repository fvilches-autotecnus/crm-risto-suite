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

export interface ConfigCarta { publica: boolean; titulo: string | null; mensaje: string | null; mostrar_precios: boolean; moneda: string }

export const CONFIG_POR_DEFECTO: ConfigCarta = { publica: true, titulo: null, mensaje: null, mostrar_precios: true, moneda: '$' }

export const ETIQUETAS: { clave: string; label: string; color: string }[] = [
  { clave: 'recomendado', label: 'Recomendado', color: 'bg-rs-lime/15 text-rs-lime' },
  { clave: 'nuevo', label: 'Nuevo', color: 'bg-rs-lav/15 text-rs-lav' },
  { clave: 'vegetariano', label: 'Vegetariano', color: 'bg-rs-ok/15 text-rs-ok' },
  { clave: 'vegano', label: 'Vegano', color: 'bg-rs-ok/15 text-rs-ok' },
  { clave: 'sin_tacc', label: 'Sin TACC', color: 'bg-rs-warn/15 text-rs-warn' },
  { clave: 'picante', label: 'Picante', color: 'bg-rs-danger/15 text-rs-danger' },
]
export const CLAVES_ETIQUETAS = ETIQUETAS.map((e) => e.clave)
export const etiquetaDe = (clave: string) => ETIQUETAS.find((e) => e.clave === clave)

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
