import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import ReservarPublico from '@/components/reservar-publico'
import { hoyEn } from '@/lib/fechas'
import { resolverModulos } from '@/lib/modulos'
import { labelTipo } from '@/lib/reservas'
import { createAdminClient } from '@/lib/supabase/server'

// Sitio público de reservas (de prueba). Se regenera cada minuto y al guardar la configuración en el CRM.
export const revalidate = 60
export const metadata: Metadata = { title: 'Reservá tu mesa', robots: { index: false, follow: false } }

export default async function ReservarPage({ params }: { params: Promise<{ slug: string }> }) {
  const slug = (await params).slug
  if (!/^[a-z0-9-]{2,49}$/.test(slug)) notFound()
  const admin = createAdminClient()
  const { data: negocio } = await admin.from('negocios').select('id, nombre, whatsapp_nro, zona_horaria, modulos').eq('slug', slug).eq('activo', true).maybeSingle()
  if (!negocio || !resolverModulos(negocio.modulos as Record<string, unknown> | null).reservas) notFound()
  const [{ data: cfg }, { data: ubs }, { data: cat }] = await Promise.all([
    admin.from('reservas_web_config').select('activo, elegir_mesa, tipos, dias_adelante, personas_min, personas_max, mensaje, modo_prueba, titulo, subtitulo, texto_whatsapp, max_mesas, cualquier_ubicacion, texto_cualquier_ubicacion').eq('negocio_id', negocio.id).maybeSingle(),
    admin.from('ubicaciones').select('nombre').eq('negocio_id', negocio.id).eq('activo', true).order('orden').order('nombre'),
    admin.from('reserva_tipos').select('clave, etiqueta, activo, orden').eq('negocio_id', negocio.id).order('orden'),
  ])
  if (!cfg?.activo || !/\d{6,}/.test(String(negocio.whatsapp_nro ?? ''))) notFound()   // sin WhatsApp del negocio nadie podría confirmar la solicitud
  // los tipos que se ofrecen, con el nombre y el orden del catálogo del negocio (los desactivados no se ofrecen)
  const catalogo = (cat ?? []) as { clave: string; etiqueta: string; activo: boolean }[]
  const elegidos = (cfg.tipos as string[] | null)?.length ? (cfg.tipos as string[]) : ['comun']
  let tipos = catalogo.filter((t) => t.activo && elegidos.includes(t.clave)).map((t) => ({ value: t.clave, label: t.etiqueta }))
  if (tipos.length === 0) tipos = elegidos.filter((t) => !catalogo.some((c) => c.clave === t && !c.activo)).map((t) => ({ value: t, label: labelTipo(t) }))
  if (tipos.length === 0) tipos = [{ value: 'comun', label: 'Común' }]
  return (
    <ReservarPublico slug={slug} nombre={negocio.nombre as string} ubicaciones={(ubs ?? []).map((u) => u.nombre as string)} tipos={tipos}
      cfg={{ elegir_mesa: cfg.elegir_mesa === true, dias_adelante: cfg.dias_adelante, personas_min: cfg.personas_min, personas_max: cfg.personas_max, mensaje: cfg.mensaje, modo_prueba: cfg.modo_prueba !== false, titulo: cfg.titulo, subtitulo: cfg.subtitulo, texto_whatsapp: cfg.texto_whatsapp, max_mesas: cfg.max_mesas ?? 6, cualquier_ubicacion: cfg.cualquier_ubicacion !== false, texto_cualquier_ubicacion: cfg.texto_cualquier_ubicacion }}
      hoy={hoyEn(negocio.zona_horaria as string)} whatsapp={negocio.whatsapp_nro as string} />
  )
}
