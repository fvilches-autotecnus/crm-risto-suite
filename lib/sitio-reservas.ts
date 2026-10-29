import { createAdminClient } from '@/lib/supabase/server'
import { nombreSitio, normalizarMarca, tieneMarca, type Marca } from '@/lib/marca'

export interface NegocioSitio { id: string; slug: string; nombre: string; whatsapp_nro: string | null; zona_horaria: string; modulos: Record<string, unknown> | null }
export interface SitioResuelto {
  negocio: NegocioSitio
  /** null = todas las sedes del negocio; si no, solo estas (una sede con dirección propia, o las de un sitio agrupado) */
  sedesIds: string[] | null
  /** nombre de la sede cuando la dirección es la de una sola sede */
  sedeFija: { id: string; nombre: string } | null
  /** título y subtítulo propios de esa sede o de ese sitio agrupado (si no tiene, valen los del negocio) */
  titulo: string | null; subtitulo: string | null
  marca: Marca
  /** título que encabeza el sitio, ya resuelto (sin contar el título de la configuración) */
  nombre: string
}

const COLS = 'id, slug, nombre, whatsapp_nro, zona_horaria, modulos'

/**
 * Qué muestra una dirección /reservar/<slug>:
 *  · el slug de un negocio → todas sus sedes;  · el alias de una sede → solo esa sede;  · el alias de un sitio agrupado → las sedes elegidas.
 * La marca es la del negocio, salvo que la sede o el sitio agrupado tengan la suya.
 */
export async function resolverSitio(slug: string): Promise<SitioResuelto | null> {
  if (!/^[a-z0-9-]{2,60}$/.test(slug)) return null
  const admin = createAdminClient()
  const marcaNegocio = async (negocioId: string) => normalizarMarca(((await admin.from('reservas_web_config').select('marca').eq('negocio_id', negocioId).maybeSingle()).data as { marca?: unknown } | null)?.marca)
  const negocioPor = async (id: string) => (await admin.from('negocios').select(COLS).eq('id', id).eq('activo', true).maybeSingle()).data as NegocioSitio | null

  const { data: directo } = await admin.from('negocios').select(COLS).eq('slug', slug).eq('activo', true).maybeSingle()
  if (directo) { const n = directo as NegocioSitio; return { negocio: n, sedesIds: null, sedeFija: null, titulo: null, subtitulo: null, marca: await marcaNegocio(n.id), nombre: n.nombre } }

  const { data: s } = await admin.from('sucursales').select('id, nombre, activa, negocio_id').eq('alias_web', slug).maybeSingle()
  if (s) {
    if (!s.activa) return null
    const n = await negocioPor(s.negocio_id as string); if (!n) return null
    const [base, { data: cs }] = await Promise.all([marcaNegocio(n.id), admin.from('config_sedes').select('web').eq('sucursal_id', s.id).maybeSingle()])
    const web = (cs?.web ?? {}) as Record<string, unknown>, propia = normalizarMarca(web.marca)
    const txt = (v: unknown) => (typeof v === 'string' && v.trim() ? v.trim() : null)
    return { negocio: n, sedesIds: [s.id as string], sedeFija: { id: s.id as string, nombre: s.nombre as string }, titulo: txt(web.titulo), subtitulo: txt(web.subtitulo), marca: tieneMarca(propia) ? propia : base, nombre: nombreSitio(n.nombre, s.nombre as string) }
  }

  const { data: w } = await admin.from('sitios_web').select('negocio_id, nombre, titulo, subtitulo, sedes, marca, activo').eq('alias', slug).maybeSingle()
  if (!w || !w.activo) return null
  const n = await negocioPor(w.negocio_id as string); if (!n) return null
  const propia = normalizarMarca(w.marca)
  return {
    negocio: n, sedesIds: (w.sedes as string[]) ?? [], sedeFija: null, titulo: (w.titulo as string | null) ?? null, subtitulo: (w.subtitulo as string | null) ?? null,
    marca: tieneMarca(propia) ? propia : await marcaNegocio(n.id), nombre: (w.titulo as string | null) || n.nombre,
  }
}

/** Lo mínimo para la ficha del sitio (título de la pestaña, ícono y miniatura al compartir el link). Null si la dirección no existe o el sitio está apagado. */
export async function cargarMarcaSitio(slug: string): Promise<{ nombre: string; subtitulo: string | null; marca: Marca } | null> {
  const r = await resolverSitio(slug)
  if (!r) return null
  const { data: cfg } = await createAdminClient().from('reservas_web_config').select('activo, titulo, subtitulo').eq('negocio_id', r.negocio.id).maybeSingle()
  if (!cfg?.activo) return null
  return { nombre: r.titulo || (cfg.titulo as string | null) || r.nombre, subtitulo: r.subtitulo || (cfg.subtitulo as string | null) || null, marca: r.marca }
}
