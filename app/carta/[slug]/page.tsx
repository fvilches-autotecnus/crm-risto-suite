import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { CONFIG_POR_DEFECTO, etiquetaDe, formatearPrecio, leerVariantes, textoPrecio, urlImagen, type CategoriaCarta, type ConfigCarta, type ProductoCarta } from '@/lib/carta'
import { resolverModulos } from '@/lib/modulos'
import { createAdminClient } from '@/lib/supabase/server'

// Carta pública (sin iniciar sesión). Se regenera sola cada minuto y al instante cuando el negocio edita algo.
export const revalidate = 60

async function cargar(slug: string) {
  if (!/^[a-z0-9-]{2,49}$/.test(slug)) return null
  const admin = createAdminClient()
  const { data: negocio } = await admin.from('negocios').select('id, nombre, modulos').eq('slug', slug).eq('activo', true).maybeSingle()
  if (!negocio || !resolverModulos(negocio.modulos as Record<string, unknown> | null).carta) return null
  const [{ data: cfg }, { data: cats }, { data: prods }] = await Promise.all([
    admin.from('carta_config').select('publica, titulo, mensaje, mostrar_precios, moneda').eq('negocio_id', negocio.id).maybeSingle(),
    admin.from('carta_categorias').select('id, nombre, descripcion, orden, visible').eq('negocio_id', negocio.id).eq('visible', true).order('orden').order('creado_en'),
    admin.from('carta_productos').select('id, categoria_id, nombre, descripcion, precio, variantes, etiquetas, imagen_path, disponible, visible, destacado, orden').eq('negocio_id', negocio.id).eq('visible', true).order('orden').order('creado_en').limit(5000),
  ])
  const config = { ...CONFIG_POR_DEFECTO, ...(cfg ?? {}) } as ConfigCarta
  if (!config.publica) return null
  const productos: ProductoCarta[] = (prods ?? []).map((p) => ({ ...p, precio: p.precio === null ? null : Number(p.precio), variantes: leerVariantes(p.variantes), etiquetas: p.etiquetas ?? [] }))
  const categorias = ((cats ?? []) as CategoriaCarta[]).map((c) => ({ ...c, productos: productos.filter((p) => p.categoria_id === c.id) })).filter((c) => c.productos.length > 0)
  return { nombre: negocio.nombre as string, config, categorias }
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const d = await cargar((await params).slug)
  if (!d) return { title: 'Carta no disponible' }
  return { title: `${d.config.titulo || d.nombre} · Carta`, description: `Carta digital de ${d.nombre}` }
}

export default async function CartaPublica({ params }: { params: Promise<{ slug: string }> }) {
  const d = await cargar((await params).slug)
  if (!d) notFound()
  const { config, categorias } = d
  return (
    <div className="min-h-screen">
      <header className="border-b border-rs-raised bg-rs-header px-4 pb-4 pt-8 text-center">
        <h1 className="text-2xl font-bold text-rs-lime">{config.titulo || d.nombre}</h1>
        <p className="mt-1 text-sm text-rs-muted">Carta digital</p>
        {config.mensaje && <p className="mx-auto mt-3 max-w-xl whitespace-pre-line text-sm">{config.mensaje}</p>}
      </header>

      {categorias.length > 1 && (
        <nav aria-label="Categorías" className="sticky top-0 z-10 border-b border-rs-raised bg-rs-header/95 backdrop-blur-md">
          <ul className="mx-auto flex max-w-2xl gap-2 overflow-x-auto px-4 py-2.5">
            {categorias.map((c) => <li key={c.id} className="shrink-0"><a href={`#c-${c.id}`} className="inline-flex h-8 items-center rounded-full border border-rs-control px-3.5 text-sm font-medium text-rs-muted transition hover:border-rs-lime/50 hover:text-rs-lime">{c.nombre}</a></li>)}
          </ul>
        </nav>
      )}

      <main className="mx-auto max-w-2xl px-4 pb-16">
        {categorias.length === 0 && <p className="py-16 text-center text-sm text-rs-muted">La carta se está actualizando. Volvé en un rato.</p>}
        {categorias.map((c) => (
          <section key={c.id} id={`c-${c.id}`} className="scroll-mt-16 pt-8">
            <h2 className="text-lg font-bold">{c.nombre}</h2>
            {c.descripcion && <p className="mt-0.5 text-sm text-rs-muted">{c.descripcion}</p>}
            <ul className="mt-3 space-y-3">
              {c.productos.map((p) => {
                const img = urlImagen(p.imagen_path), precio = config.mostrar_precios ? textoPrecio(p, config.moneda) : null
                return (
                  <li key={p.id} className={'card flex gap-3 p-3 ' + (p.disponible ? '' : 'opacity-55')}>
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                        <h3 className="font-semibold">{p.nombre}</h3>
                        {!p.disponible && <span className="badge bg-rs-danger/15 text-rs-danger">Agotado</span>}
                        {p.destacado && p.disponible && <span className="badge bg-rs-lime/15 text-rs-lime">Destacado</span>}
                      </div>
                      {p.descripcion && <p className="mt-1 whitespace-pre-line text-sm text-rs-muted">{p.descripcion}</p>}
                      {p.etiquetas.length > 0 && <div className="mt-2 flex flex-wrap gap-1.5">{p.etiquetas.map((e) => { const t = etiquetaDe(e); return t ? <span key={e} className={'badge ' + t.color}>{t.label}</span> : null })}</div>}
                      {config.mostrar_precios && p.variantes.length > 0 ? (
                        <ul className="mt-2 space-y-0.5 text-sm">{p.variantes.map((v) => <li key={v.nombre} className="flex justify-between gap-4 border-b border-rs-border/60 py-1 last:border-0"><span>{v.nombre}</span><span className="font-semibold text-rs-lime">{formatearPrecio(v.precio, config.moneda)}</span></li>)}</ul>
                      ) : precio && <p className="mt-2 font-semibold text-rs-lime">{precio}</p>}
                    </div>
                    {img && /* eslint-disable-next-line @next/next/no-img-element */ <img src={img} alt={p.nombre} loading="lazy" className="h-24 w-24 shrink-0 self-start rounded-md object-cover sm:h-28 sm:w-28" />}
                  </li>
                )
              })}
            </ul>
          </section>
        ))}
        <p className="mt-12 text-center text-xs text-rs-muted">Carta digital · RistoSuite</p>
      </main>
    </div>
  )
}
