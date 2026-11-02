import 'server-only'
import { createAdminClient } from '@/lib/supabase/server'

/**
 * Imágenes del local (fotos de la carta, imágenes de los shows) en el bucket público "carta": cada una vive en `<negocio>/<uuid>.<ext>`.
 * El navegador ya las achicó; acá se validan, se suben y se borran. Cada módulo guarda solo la ruta.
 */
export const IMAGEN_RE = /^[0-9a-f-]{36}\/[0-9a-f-]{36}\.(jpg|png|webp)$/i
const MAX_IMAGEN = 3 * 1024 * 1024
export type ResultadoSubida = { ok: true; path: string } | { ok: false; error: string }

/** ¿La ruta tiene la forma de una imagen subida y es de este negocio? */
export const imagenDelNegocio = (path: string, negocioId: string) => IMAGEN_RE.test(path) && path.startsWith(negocioId + '/')

/** Sube el archivo que vino en el formulario. `palabra` solo cambia los avisos (“la foto” de la carta, “la imagen” de un show). */
export async function subirImagenBucket(negocioId: string, archivo: FormDataEntryValue | null, palabra: 'foto' | 'imagen'): Promise<ResultadoSubida> {
  const el = `la ${palabra}`, un = `una ${palabra}`
  if (!(archivo instanceof File) || archivo.size === 0) return { ok: false, error: `No se recibió ${el}` }
  if (archivo.size > MAX_IMAGEN) return { ok: false, error: `${el[0].toUpperCase()}${el.slice(1)} pesa más de 3 MB` }
  const ext = ({ 'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp' } as Record<string, string>)[archivo.type]
  if (!ext) return { ok: false, error: `Usá ${un} JPG, PNG o WEBP` }
  const path = `${negocioId}/${crypto.randomUUID()}.${ext}`
  const { error } = await createAdminClient().storage.from('carta').upload(path, Buffer.from(await archivo.arrayBuffer()), { contentType: archivo.type, cacheControl: '31536000', upsert: false })
  if (error) return { ok: false, error: `No se pudo subir ${el}. Probá de nuevo.` }
  return { ok: true, path }
}

/** Borra una imagen del bucket (si no se pudo borrar queda huérfana: no afecta a nadie). */
export async function borrarImagenBucket(path: string | null | undefined) {
  if (!path || !IMAGEN_RE.test(path)) return
  try { await createAdminClient().storage.from('carta').remove([path]) } catch { /* huérfana */ }
}
