import { redirect } from 'next/navigation'
import CartaAdmin from '@/components/carta-ui'
import { CONFIG_POR_DEFECTO, leerVariantes, type CategoriaCarta, type ConfigCarta, type ProductoCarta } from '@/lib/carta'
import { getContexto } from '@/lib/context'

export default async function CartaPage() {
  const ctx = await getContexto()
  if (!ctx.modulosActivos.carta) redirect('/')
  const { supabase, negocio } = ctx
  const [{ data: cats }, { data: prods }, { data: cfg }] = await Promise.all([
    supabase.from('carta_categorias').select('id, nombre, descripcion, orden, visible').eq('negocio_id', negocio.id).order('orden').order('creado_en'),
    supabase.from('carta_productos').select('id, categoria_id, nombre, descripcion, precio, variantes, etiquetas, imagen_path, disponible, visible, destacado, orden').eq('negocio_id', negocio.id).order('orden').order('creado_en').limit(5000),
    supabase.from('carta_config').select('publica, titulo, mensaje, mostrar_precios, moneda').eq('negocio_id', negocio.id).maybeSingle(),
  ])
  const productos: ProductoCarta[] = (prods ?? []).map((p) => ({ ...p, precio: p.precio === null ? null : Number(p.precio), variantes: leerVariantes(p.variantes), etiquetas: p.etiquetas ?? [] }))
  return (
    <CartaAdmin
      categorias={(cats ?? []) as CategoriaCarta[]} productos={productos} config={{ ...CONFIG_POR_DEFECTO, ...(cfg ?? {}) } as ConfigCarta}
      slug={negocio.slug} negocio={negocio.nombre} puedeEscribir={ctx.puedeEscribir} puedeEliminar={ctx.puedeAdministrar} puedeAjustes={ctx.puedeAdministrar || ctx.rol === 'encargado'}
    />
  )
}
