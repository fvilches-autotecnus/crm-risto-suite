import { redirect } from 'next/navigation'
import ShowsAdmin from '@/components/shows-ui'
import { getContexto } from '@/lib/context'
import { hoyEn } from '@/lib/fechas'
import type { Show } from '@/lib/shows'

export default async function ShowsPage() {
  const ctx = await getContexto()
  if (!ctx.modulosActivos.shows) redirect('/')
  const { supabase, negocio } = ctx
  const [{ data: shows }, { data: ubic }] = await Promise.all([
    supabase.from('shows').select('id, titulo, descripcion, imagen_path, fecha, hora, ubicacion_id, modalidad, enlace, visible').eq('negocio_id', negocio.id).order('fecha').order('hora').limit(2000),
    supabase.from('ubicaciones').select('id, nombre').eq('negocio_id', negocio.id).eq('activo', true).order('orden').order('nombre'),
  ])
  return (
    <ShowsAdmin
      shows={(shows ?? []) as Show[]} ubicaciones={ubic ?? []} slug={negocio.slug} negocio={negocio.nombre} hoy={hoyEn(negocio.zona_horaria)}
      puedeEscribir={ctx.puedeEscribir} puedeEliminar={ctx.puedeAdministrar}
    />
  )
}
