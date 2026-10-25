import { redirect } from 'next/navigation'
import { Clapperboard } from 'lucide-react'
import ModuloPreparacion from '@/components/modulo-preparacion'
import { getContexto } from '@/lib/context'

export default async function ShowsPage() {
  const ctx = await getContexto()
  if (!ctx.modulosActivos.shows) redirect('/')
  return (
    <ModuloPreparacion
      icono={<Clapperboard size={22} />}
      titulo="Shows"
      subtitulo="Shows y eventos del local"
      vaA={['Cartelera de shows con fecha, horario y artista', 'Cupos y entradas por show', 'Reservas de mesa asociadas a cada show']}
    />
  )
}
