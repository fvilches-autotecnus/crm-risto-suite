import 'server-only'
import type { Metadata } from 'next'
import { CONFIG_POR_DEFECTO, leerVariantes, urlImagen, type CategoriaCarta, type ConfigCarta, type ProductoCarta } from '@/lib/carta'
import type { CategoriaPublica, PedidosPublicos } from '@/components/carta-publica'
import { normalizarMarca, urlAbsoluta, type Marca } from '@/lib/marca'
import { cargarConfigPedidos } from '@/lib/pedidos-servidor'
import { resolverModulos } from '@/lib/modulos'
import { createAdminClient } from '@/lib/supabase/server'

/**
 * La carta pública del negocio, en sus dos versiones (el catálogo es el mismo, así que están siempre sincronizadas):
 *  · 'pedir' → /carta/<negocio>: con carrito y pedidos, si el negocio tiene el módulo Pedidos y ya lo configuró (si no, se ve igual pero sin pedidos).
 *  · 'ver'   → /carta/<negocio>/ver: solo lectura, sin carrito. Hay que encenderla en los ajustes de la carta (carta_config.lectura).
 */
export type ModoCarta = 'pedir' | 'ver'
export type DatosCartaPublica = NonNullable<Awaited<ReturnType<typeof cargarCartaPublica>>>

export async function cargarCartaPublica(slug: string, modo: ModoCarta) {
  if (!/^[a-z0-9-]{2,49}$/.test(slug)) return null
  const admin = createAdminClient()
  const { data: negocio } = await admin.from('negocios').select('id, nombre, modulos').eq('slug', slug).eq('activo', true).maybeSingle()
  if (!negocio || !resolverModulos(negocio.modulos as Record<string, unknown> | null).carta) return null
  const modulos = resolverModulos(negocio.modulos as Record<string, unknown> | null)
  const [{ data: cfg }, { data: cats }, { data: prods }, { data: web }, ped] = await Promise.all([
    admin.from('carta_config').select('publica, titulo, mensaje, mostrar_precios, moneda, lectura').eq('negocio_id', negocio.id).maybeSingle(),
    admin.from('carta_categorias').select('id, nombre, descripcion, orden, visible').eq('negocio_id', negocio.id).eq('visible', true).order('orden').order('creado_en'),
    admin.from('carta_productos').select('id, categoria_id, nombre, descripcion, precio, variantes, etiquetas, imagen_path, disponible, visible, destacado, orden').eq('negocio_id', negocio.id).eq('visible', true).order('orden').order('creado_en').limit(5000),
    admin.from('reservas_web_config').select('marca').eq('negocio_id', negocio.id).maybeSingle(),
    modo === 'pedir' && modulos.pedidos ? cargarConfigPedidos(admin, negocio.id) : Promise.resolve(null),
  ])
  const config = { ...CONFIG_POR_DEFECTO, ...(cfg ?? {}) } as ConfigCarta
  if (!config.publica) return null
  if (modo === 'ver' && config.lectura !== true) return null   // la carta de solo lectura está apagada: el enlace deja de andar
  const productos: ProductoCarta[] = (prods ?? []).map((p) => ({ ...p, precio: p.precio === null ? null : Number(p.precio), variantes: leerVariantes(p.variantes), etiquetas: p.etiquetas ?? [] }))
  const categorias: CategoriaPublica[] = ((cats ?? []) as CategoriaCarta[]).map((c) => ({ id: c.id, nombre: c.nombre, descripcion: c.descripcion, productos: productos.filter((p) => p.categoria_id === c.id).map((p) => ({ ...p, img: urlImagen(p.imagen_path) })) })).filter((c) => c.productos.length > 0)
  // Pedidos: solo se ofrecen si el módulo está encendido y el negocio ya los configuró
  // (a los clientes no se les muestra lo que no es suyo: las formas de entrega y medios apagados, ni los datos para pagar hasta que confirman el pedido)
  const pedidos: PedidosPublicos | null = ped?.hayConfig ? (() => {
    const { aceptar_auto: _a, ...publico } = ped.config; void _a
    return { ...publico, entregas: ped.config.entregas.filter((e) => e.activo), medios: ped.config.medios.filter((m) => m.activo).map(({ datos, ...m }) => ({ ...m, tieneDatos: !!datos })), ahora: new Date().toISOString() }
  })() : null
  const m = normalizarMarca(web?.marca)
  // La marca del local (logo y colores) es la misma del sitio de reservas: se carga una sola vez, en Configuración
  const marca: Marca = { ...m, logo_url: urlAbsoluta(m.logo_url), ornamento_url: urlAbsoluta(m.ornamento_url) }
  return { nombre: negocio.nombre as string, config, categorias, pedidos, marca }
}

export async function metadataCarta(slug: string, modo: ModoCarta): Promise<Metadata> {
  const d = await cargarCartaPublica(slug, modo)
  if (!d) return { title: 'Carta no disponible' }
  return { title: `${d.config.titulo || d.nombre} · Carta`, description: `Carta digital de ${d.nombre}`, ...(d.marca.logo_url ? { icons: { icon: d.marca.logo_url } } : {}) }
}
