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
  const [{ data: cfg }, { data: ubs }] = await Promise.all([
    admin.from('reservas_web_config').select('activo, elegir_mesa, tipos, dias_adelante, personas_min, personas_max, mensaje').eq('negocio_id', negocio.id).maybeSingle(),
    admin.from('ubicaciones').select('nombre').eq('negocio_id', negocio.id).eq('activo', true).order('orden').order('nombre'),
  ])
  if (!cfg?.activo) notFound()
  const tipos = ((cfg.tipos as string[] | null)?.length ? (cfg.tipos as string[]) : ['comun']).map((t) => ({ value: t, label: labelTipo(t) }))
  return (
    <ReservarPublico slug={slug} nombre={negocio.nombre as string} ubicaciones={(ubs ?? []).map((u) => u.nombre as string)} tipos={tipos}
      cfg={{ elegir_mesa: cfg.elegir_mesa === true, dias_adelante: cfg.dias_adelante, personas_min: cfg.personas_min, personas_max: cfg.personas_max, mensaje: cfg.mensaje }}
      hoy={hoyEn(negocio.zona_horaria as string)} whatsapp={negocio.whatsapp_nro as string | null} />
  )
}
