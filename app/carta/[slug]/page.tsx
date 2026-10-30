import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import CartaPublica, { type CategoriaPublica, type PedidosPublicos } from '@/components/carta-publica'
import { CONFIG_POR_DEFECTO, leerVariantes, urlImagen, type CategoriaCarta, type ConfigCarta, type ProductoCarta } from '@/lib/carta'
import { normalizarMarca, urlAbsoluta, variablesMarca, type Marca } from '@/lib/marca'
import { resolverModulos } from '@/lib/modulos'
import { createAdminClient } from '@/lib/supabase/server'

// Carta pública (sin iniciar sesión). Se regenera sola cada minuto y al instante cuando el negocio edita algo.
export const revalidate = 60

async function cargar(slug: string) {
  if (!/^[a-z0-9-]{2,49}$/.test(slug)) return null
  const admin = createAdminClient()
  const { data: negocio } = await admin.from('negocios').select('id, nombre, modulos').eq('slug', slug).eq('activo', true).maybeSingle()
  if (!negocio || !resolverModulos(negocio.modulos as Record<string, unknown> | null).carta) return null
  const modulos = resolverModulos(negocio.modulos as Record<string, unknown> | null)
  const [{ data: cfg }, { data: cats }, { data: prods }, { data: web }, { data: ped }] = await Promise.all([
    admin.from('carta_config').select('publica, titulo, mensaje, mostrar_precios, moneda').eq('negocio_id', negocio.id).maybeSingle(),
    admin.from('carta_categorias').select('id, nombre, descripcion, orden, visible').eq('negocio_id', negocio.id).eq('visible', true).order('orden').order('creado_en'),
    admin.from('carta_productos').select('id, categoria_id, nombre, descripcion, precio, variantes, etiquetas, imagen_path, disponible, visible, destacado, orden').eq('negocio_id', negocio.id).eq('visible', true).order('orden').order('creado_en').limit(5000),
    admin.from('reservas_web_config').select('marca').eq('negocio_id', negocio.id).maybeSingle(),
    modulos.pedidos ? admin.from('pedidos_config').select('recibe, retiro, delivery, mesa, costo_envio, pedido_minimo, tiempo_estimado, medios_pago, mensaje').eq('negocio_id', negocio.id).maybeSingle() : Promise.resolve({ data: null }),
  ])
  const config = { ...CONFIG_POR_DEFECTO, ...(cfg ?? {}) } as ConfigCarta
  if (!config.publica) return null
  const productos: ProductoCarta[] = (prods ?? []).map((p) => ({ ...p, precio: p.precio === null ? null : Number(p.precio), variantes: leerVariantes(p.variantes), etiquetas: p.etiquetas ?? [] }))
  const categorias: CategoriaPublica[] = ((cats ?? []) as CategoriaCarta[]).map((c) => ({ id: c.id, nombre: c.nombre, descripcion: c.descripcion, productos: productos.filter((p) => p.categoria_id === c.id).map((p) => ({ ...p, img: urlImagen(p.imagen_path) })) })).filter((c) => c.productos.length > 0)
  // Pedidos: solo se ofrecen si el módulo está encendido y el negocio ya los configuró
  const pedidos: PedidosPublicos | null = ped ? { recibe: ped.recibe === true, tipos: [ped.retiro && 'retiro', ped.delivery && 'delivery', ped.mesa && 'mesa'].filter(Boolean) as string[], costo_envio: Number(ped.costo_envio), pedido_minimo: Number(ped.pedido_minimo), medios_pago: ped.medios_pago ?? [], tiempo_estimado: ped.tiempo_estimado, mensaje: ped.mensaje } : null
  const m = normalizarMarca(web?.marca)
  // La marca del local (logo y colores) es la misma del sitio de reservas: se carga una sola vez, en Configuración
  const marca: Marca = { ...m, logo_url: urlAbsoluta(m.logo_url), ornamento_url: urlAbsoluta(m.ornamento_url) }
  return { nombre: negocio.nombre as string, config, categorias, pedidos, marca }
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const d = await cargar((await params).slug)
  if (!d) return { title: 'Carta no disponible' }
  return { title: `${d.config.titulo || d.nombre} · Carta`, description: `Carta digital de ${d.nombre}`, ...(d.marca.logo_url ? { icons: { icon: d.marca.logo_url } } : {}) }
}

export default async function CartaPublicaPage({ params }: { params: Promise<{ slug: string }> }) {
  const slug = (await params).slug
  const d = await cargar(slug)
  if (!d) notFound()
  const vars = variablesMarca(d.marca)
  return (
    <>
      {vars && <style>{`:root{${Object.entries(vars).map(([k, v]) => `${k}:${v}`).join(';')}}`}</style>}
      <CartaPublica slug={slug} nombre={d.nombre} config={d.config} categorias={d.categorias} pedidos={d.pedidos} marca={d.marca} />
    </>
  )
}
