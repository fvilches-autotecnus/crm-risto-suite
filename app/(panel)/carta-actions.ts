'use server'

import { revalidatePath } from 'next/cache'
import { getContexto } from '@/lib/context'
import { CLAVES_ETIQUETAS, MAX_VARIANTES, type Variante } from '@/lib/carta'
import { createAdminClient } from '@/lib/supabase/server'
import type { ActionResult } from './actions'

const fail = (error: string): ActionResult => ({ ok: false, error })
const text = (fd: FormData, k: string) => String(fd.get(k) ?? '').trim()
const UUID = /^[0-9a-f-]{36}$/i
const IMAGEN_RE = /^[0-9a-f-]{36}\/[0-9a-f-]{36}\.(jpg|png|webp)$/i
const MAX_PRECIO = 99_999_999
const MAX_IMAGEN = 3 * 1024 * 1024

async function permiso(opciones: { ajustes?: boolean } = {}) {
  const ctx = await getContexto()
  if (!ctx.modulosActivos.carta) return { ctx, error: 'Este negocio no tiene el módulo Carta' }
  if (!ctx.puedeEscribir) return { ctx, error: 'Tu usuario es de solo lectura' }
  if (opciones.ajustes && !(ctx.puedeAdministrar || ctx.rol === 'encargado')) return { ctx, error: 'Solo dueños, administradores y encargados pueden cambiar los ajustes de la carta' }
  return { ctx, error: null as string | null }
}
const refrescar = (slug: string) => { revalidatePath('/carta'); revalidatePath(`/carta/${slug}`) }

/** "12.500,50" (formato argentino), "12500.5" o "$ 12500" → número; vacío → null; inválido → NaN. */
function leerPrecio(t: string): number | null {
  const s = t.replace(/[$\s]/g, '')
  if (!s) return null
  const n = Number(s.includes(',') ? s.replace(/\./g, '').replace(',', '.') : s)
  return Number.isFinite(n) && n >= 0 && n <= MAX_PRECIO ? Math.round(n * 100) / 100 : NaN
}

async function borrarImagen(path: string | null | undefined) {
  if (!path || !IMAGEN_RE.test(path)) return
  try { await createAdminClient().storage.from('carta').remove([path]) } catch { /* si no se pudo borrar queda huérfana, no afecta a la carta */ }
}

// ---------------------------------------------------------------------------
// Categorías
// ---------------------------------------------------------------------------
export async function guardarCategoria(_prev: ActionResult | null, fd: FormData): Promise<ActionResult> {
  const { ctx, error } = await permiso(); if (error) return fail(error)
  const id = text(fd, 'id'), nombre = text(fd, 'nombre').replace(/\s+/g, ' '), descripcion = text(fd, 'descripcion')
  if (!nombre) return fail('Falta el nombre de la categoría')
  if (nombre.length > 60) return fail('El nombre puede tener hasta 60 letras')
  if (descripcion.length > 300) return fail('La descripción puede tener hasta 300 letras')
  const visible = fd.get('visible') === 'on'
  if (id) {
    if (!UUID.test(id)) return fail('Categoría no válida')
    const { error: e } = await ctx.supabase.from('carta_categorias').update({ nombre, descripcion: descripcion || null, visible }).eq('id', id).eq('negocio_id', ctx.negocio.id)
    if (e) return fail(e.code === '23505' ? 'Ya tenés una categoría con ese nombre' : 'No se pudo guardar la categoría')
  } else {
    const { data: ult } = await ctx.supabase.from('carta_categorias').select('orden').eq('negocio_id', ctx.negocio.id).order('orden', { ascending: false }).limit(1)
    const { error: e } = await ctx.supabase.from('carta_categorias').insert({ negocio_id: ctx.negocio.id, nombre, descripcion: descripcion || null, visible, orden: (ult?.[0]?.orden ?? -1) + 1 })
    if (e) return fail(e.code === '23505' ? 'Ya tenés una categoría con ese nombre' : 'No se pudo crear la categoría')
  }
  refrescar(ctx.negocio.slug)
  return { ok: true }
}

export async function eliminarCategoria(id: string): Promise<ActionResult> {
  const { ctx, error } = await permiso(); if (error) return fail(error)
  if (!UUID.test(id)) return fail('Categoría no válida')
  const { count } = await ctx.supabase.from('carta_productos').select('id', { count: 'exact', head: true }).eq('categoria_id', id).eq('negocio_id', ctx.negocio.id)
  if (count) return fail(`La categoría tiene ${count} producto${count === 1 ? '' : 's'}: pasalos a otra categoría o borralos primero`)
  const { error: e } = await ctx.supabase.from('carta_categorias').delete().eq('id', id).eq('negocio_id', ctx.negocio.id)
  if (e) return fail('No se pudo borrar la categoría (para borrar hace falta ser dueño o administrador)')
  refrescar(ctx.negocio.slug)
  return { ok: true }
}

/** Sube o baja una categoría un lugar. */
export async function moverCategoria(id: string, dir: 'arriba' | 'abajo'): Promise<ActionResult> {
  const { ctx, error } = await permiso(); if (error) return fail(error)
  const { data } = await ctx.supabase.from('carta_categorias').select('id, orden').eq('negocio_id', ctx.negocio.id).order('orden').order('creado_en')
  const lista = data ?? []
  const i = lista.findIndex((c) => c.id === id)
  const j = dir === 'arriba' ? i - 1 : i + 1
  if (i < 0 || j < 0 || j >= lista.length) return { ok: true }
  ;[lista[i], lista[j]] = [lista[j], lista[i]]
  for (const [k, c] of lista.entries()) if (c.orden !== k) await ctx.supabase.from('carta_categorias').update({ orden: k }).eq('id', c.id).eq('negocio_id', ctx.negocio.id)
  refrescar(ctx.negocio.slug)
  return { ok: true }
}

export async function alternarCategoria(id: string): Promise<ActionResult> {
  const { ctx, error } = await permiso(); if (error) return fail(error)
  if (!UUID.test(id)) return fail('Categoría no válida')
  const { data } = await ctx.supabase.from('carta_categorias').select('visible').eq('id', id).eq('negocio_id', ctx.negocio.id).maybeSingle()
  if (!data) return fail('Categoría no encontrada')
  const { error: e } = await ctx.supabase.from('carta_categorias').update({ visible: !data.visible }).eq('id', id).eq('negocio_id', ctx.negocio.id)
  if (e) return fail('No se pudo cambiar')
  refrescar(ctx.negocio.slug)
  return { ok: true }
}

// ---------------------------------------------------------------------------
// Productos
// ---------------------------------------------------------------------------
export async function guardarProducto(_prev: ActionResult | null, fd: FormData): Promise<ActionResult> {
  const { ctx, error } = await permiso(); if (error) return fail(error)
  const id = text(fd, 'id'), categoria = text(fd, 'categoria_id'), nombre = text(fd, 'nombre').replace(/\s+/g, ' '), descripcion = text(fd, 'descripcion')
  if (!UUID.test(categoria)) return fail('Elegí una categoría')
  if (!nombre) return fail('Falta el nombre del producto')
  if (nombre.length > 100) return fail('El nombre puede tener hasta 100 letras')
  if (descripcion.length > 600) return fail('La descripción puede tener hasta 600 letras')
  const precio = leerPrecio(text(fd, 'precio'))
  if (precio !== null && Number.isNaN(precio)) return fail('El precio no es válido (ej. 12500 o 12.500,50)')

  let variantes: Variante[] = []
  try {
    const crudas = JSON.parse(text(fd, 'variantes') || '[]') as { nombre?: unknown; precio?: unknown }[]
    if (!Array.isArray(crudas)) throw new Error()
    for (const v of crudas) {
      const n = String(v.nombre ?? '').trim().replace(/\s+/g, ' '), p = leerPrecio(String(v.precio ?? ''))
      if (!n && (p === null)) continue   // fila vacía
      if (!n) return fail('Cada opción de precio necesita un nombre (ej. Chica, Grande)')
      if (n.length > 40) return fail('El nombre de una opción puede tener hasta 40 letras')
      if (p === null || Number.isNaN(p)) return fail(`El precio de "${n}" no es válido`)
      variantes.push({ nombre: n, precio: p })
    }
  } catch { return fail('Las opciones de precio no son válidas') }
  if (variantes.length > MAX_VARIANTES) return fail(`Hasta ${MAX_VARIANTES} opciones de precio por producto`)

  const etiquetas = [...new Set(fd.getAll('etiquetas').map(String))].filter((e) => CLAVES_ETIQUETAS.includes(e))
  const imagen = text(fd, 'imagen_path') || null
  if (imagen && (!IMAGEN_RE.test(imagen) || !imagen.startsWith(ctx.negocio.id + '/'))) return fail('La foto no es válida: volvé a subirla')
  const datos = {
    categoria_id: categoria, nombre, descripcion: descripcion || null, precio, variantes, etiquetas, imagen_path: imagen,
    disponible: fd.get('disponible') === 'on', visible: fd.get('visible') === 'on', destacado: fd.get('destacado') === 'on',
  }

  if (id) {
    if (!UUID.test(id)) return fail('Producto no válido')
    const { data: previo } = await ctx.supabase.from('carta_productos').select('imagen_path').eq('id', id).eq('negocio_id', ctx.negocio.id).maybeSingle()
    if (!previo) return fail('Producto no encontrado')
    const { error: e } = await ctx.supabase.from('carta_productos').update(datos).eq('id', id).eq('negocio_id', ctx.negocio.id)
    if (e) return fail('No se pudo guardar el producto')
    if (previo.imagen_path && previo.imagen_path !== imagen) await borrarImagen(previo.imagen_path)
  } else {
    const { data: ult } = await ctx.supabase.from('carta_productos').select('orden').eq('categoria_id', categoria).eq('negocio_id', ctx.negocio.id).order('orden', { ascending: false }).limit(1)
    const { error: e } = await ctx.supabase.from('carta_productos').insert({ ...datos, negocio_id: ctx.negocio.id, orden: (ult?.[0]?.orden ?? -1) + 1 })
    if (e) return fail('No se pudo crear el producto')
  }
  refrescar(ctx.negocio.slug)
  return { ok: true }
}

export async function eliminarProducto(id: string): Promise<ActionResult> {
  const { ctx, error } = await permiso(); if (error) return fail(error)
  if (!UUID.test(id)) return fail('Producto no válido')
  const { data: p } = await ctx.supabase.from('carta_productos').select('imagen_path').eq('id', id).eq('negocio_id', ctx.negocio.id).maybeSingle()
  const { error: e } = await ctx.supabase.from('carta_productos').delete().eq('id', id).eq('negocio_id', ctx.negocio.id)
  if (e) return fail('No se pudo borrar el producto (para borrar hace falta ser dueño o administrador)')
  await borrarImagen(p?.imagen_path)
  refrescar(ctx.negocio.slug)
  return { ok: true }
}

/** Sube o baja un producto un lugar dentro de su categoría. */
export async function moverProducto(id: string, dir: 'arriba' | 'abajo'): Promise<ActionResult> {
  const { ctx, error } = await permiso(); if (error) return fail(error)
  const { data: p } = await ctx.supabase.from('carta_productos').select('categoria_id').eq('id', id).eq('negocio_id', ctx.negocio.id).maybeSingle()
  if (!p) return fail('Producto no encontrado')
  const { data } = await ctx.supabase.from('carta_productos').select('id, orden').eq('categoria_id', p.categoria_id).eq('negocio_id', ctx.negocio.id).order('orden').order('creado_en')
  const lista = data ?? []
  const i = lista.findIndex((c) => c.id === id), j = dir === 'arriba' ? i - 1 : i + 1
  if (i < 0 || j < 0 || j >= lista.length) return { ok: true }
  ;[lista[i], lista[j]] = [lista[j], lista[i]]
  for (const [k, c] of lista.entries()) if (c.orden !== k) await ctx.supabase.from('carta_productos').update({ orden: k }).eq('id', c.id).eq('negocio_id', ctx.negocio.id)
  refrescar(ctx.negocio.slug)
  return { ok: true }
}

/** Cambia un interruptor del producto: disponible (agotado), visible (oculto) o destacado. */
export async function alternarProducto(id: string, campo: 'disponible' | 'visible' | 'destacado'): Promise<ActionResult> {
  const { ctx, error } = await permiso(); if (error) return fail(error)
  if (!UUID.test(id) || !['disponible', 'visible', 'destacado'].includes(campo)) return fail('Producto no válido')
  const { data } = await ctx.supabase.from('carta_productos').select(campo).eq('id', id).eq('negocio_id', ctx.negocio.id).maybeSingle()
  if (!data) return fail('Producto no encontrado')
  const { error: e } = await ctx.supabase.from('carta_productos').update({ [campo]: !(data as unknown as Record<string, boolean>)[campo] }).eq('id', id).eq('negocio_id', ctx.negocio.id)
  if (e) return fail('No se pudo cambiar')
  refrescar(ctx.negocio.slug)
  return { ok: true }
}

// ---------------------------------------------------------------------------
// Fotos
// ---------------------------------------------------------------------------
export type ResultadoSubida = { ok: true; path: string } | { ok: false; error: string }

/** Sube una foto al bucket público "carta" (el navegador ya la achicó). Devuelve la ruta para guardarla en el producto. */
export async function subirImagen(fd: FormData): Promise<ResultadoSubida> {
  const { ctx, error } = await permiso(); if (error) return { ok: false, error }
  const archivo = fd.get('archivo')
  if (!(archivo instanceof File) || archivo.size === 0) return { ok: false, error: 'No se recibió la foto' }
  if (archivo.size > MAX_IMAGEN) return { ok: false, error: 'La foto pesa más de 3 MB' }
  const ext = ({ 'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp' } as Record<string, string>)[archivo.type]
  if (!ext) return { ok: false, error: 'Usá una foto JPG, PNG o WEBP' }
  const path = `${ctx.negocio.id}/${crypto.randomUUID()}.${ext}`
  const { error: e } = await createAdminClient().storage.from('carta').upload(path, Buffer.from(await archivo.arrayBuffer()), { contentType: archivo.type, cacheControl: '31536000', upsert: false })
  if (e) return { ok: false, error: 'No se pudo subir la foto. Probá de nuevo.' }
  return { ok: true, path }
}

/** Borra una foto que se subió pero no se llegó a guardar en ningún producto (se cerró el diálogo). */
export async function descartarImagen(path: string): Promise<ActionResult> {
  const { ctx, error } = await permiso(); if (error) return fail(error)
  if (!IMAGEN_RE.test(path) || !path.startsWith(ctx.negocio.id + '/')) return fail('Foto no válida')
  const { count } = await ctx.supabase.from('carta_productos').select('id', { count: 'exact', head: true }).eq('imagen_path', path).eq('negocio_id', ctx.negocio.id)
  if (!count) await borrarImagen(path)
  return { ok: true }
}

// ---------------------------------------------------------------------------
// Ajustes de la carta pública
// ---------------------------------------------------------------------------
export async function guardarAjustesCarta(_prev: ActionResult | null, fd: FormData): Promise<ActionResult> {
  const { ctx, error } = await permiso({ ajustes: true }); if (error) return fail(error)
  const titulo = text(fd, 'titulo'), mensaje = text(fd, 'mensaje'), moneda = text(fd, 'moneda') || '$'
  if (titulo.length > 80) return fail('El título puede tener hasta 80 letras')
  if (mensaje.length > 400) return fail('El mensaje puede tener hasta 400 letras')
  if (moneda.length > 4) return fail('La moneda puede tener hasta 4 caracteres')
  const { error: e } = await ctx.supabase.from('carta_config').upsert({
    negocio_id: ctx.negocio.id, publica: fd.get('publica') === 'on', titulo: titulo || null, mensaje: mensaje || null, mostrar_precios: fd.get('mostrar_precios') === 'on', moneda,
  })
  if (e) return fail('No se pudieron guardar los ajustes')
  refrescar(ctx.negocio.slug)
  return { ok: true }
}

// ---------------------------------------------------------------------------
// Importar desde texto
// ---------------------------------------------------------------------------
export type ResultadoImportacion = ActionResult & { omitidas?: number; categorias?: number }

/**
 * Carga varios productos de una vez. Una línea por producto: Categoría | Producto | Precio | Descripción
 * (separador "|", ";" o tabulación; precio y descripción opcionales). Las categorías que no existen se crean.
 */
export async function importarCarta(_prev: ResultadoImportacion | null, fd: FormData): Promise<ResultadoImportacion> {
  const { ctx, error } = await permiso(); if (error) return fail(error)
  const lineas = text(fd, 'texto').split(/\r?\n/).map((l) => l.trim()).filter(Boolean)
  if (!lineas.length) return fail('Pegá al menos una línea')
  if (lineas.length > 300) return fail('Hasta 300 productos por vez')

  const { data: cats } = await ctx.supabase.from('carta_categorias').select('id, nombre, orden').eq('negocio_id', ctx.negocio.id)
  const porNombre = new Map((cats ?? []).map((c) => [c.nombre.trim().toLowerCase(), c.id as string]))
  let ordenCat = Math.max(-1, ...(cats ?? []).map((c) => c.orden)) + 1
  const { data: prods } = await ctx.supabase.from('carta_productos').select('categoria_id, orden').eq('negocio_id', ctx.negocio.id)
  const ordenProd = new Map<string, number>()
  for (const p of prods ?? []) ordenProd.set(p.categoria_id, Math.max(ordenProd.get(p.categoria_id) ?? -1, p.orden))

  let omitidas = 0, categoriasNuevas = 0
  const filas: Record<string, unknown>[] = []
  for (const l of lineas) {
    const [cat, nom, pre, ...resto] = l.split(/\s*[|;\t]\s*/)
    const nombreCat = (cat ?? '').replace(/\s+/g, ' ').trim(), nombre = (nom ?? '').replace(/\s+/g, ' ').trim()
    const precio = leerPrecio(pre ?? ''), descripcion = resto.join(' ').trim()
    if (!nombreCat || !nombre || nombreCat.length > 60 || nombre.length > 100 || (precio !== null && Number.isNaN(precio)) || descripcion.length > 600) { omitidas++; continue }
    let catId = porNombre.get(nombreCat.toLowerCase())
    if (!catId) {
      const { data: nueva, error: e } = await ctx.supabase.from('carta_categorias').insert({ negocio_id: ctx.negocio.id, nombre: nombreCat, orden: ordenCat++ }).select('id').single()
      if (e || !nueva) { omitidas++; continue }
      catId = nueva.id as string; porNombre.set(nombreCat.toLowerCase(), catId); categoriasNuevas++
    }
    const orden = (ordenProd.get(catId) ?? -1) + 1; ordenProd.set(catId, orden)
    filas.push({ negocio_id: ctx.negocio.id, categoria_id: catId, nombre, precio, descripcion: descripcion || null, orden })
  }
  if (!filas.length) return { ok: false, error: `Ninguna línea se pudo leer (${omitidas} omitidas). El formato es: Categoría | Producto | Precio | Descripción`, omitidas }
  for (let i = 0; i < filas.length; i += 100) {
    const { error: e } = await ctx.supabase.from('carta_productos').insert(filas.slice(i, i + 100))
    if (e) return fail('No se pudieron cargar todos los productos')
  }
  refrescar(ctx.negocio.slug)
  return { ok: true, cantidad: filas.length, omitidas, categorias: categoriasNuevas }
}
