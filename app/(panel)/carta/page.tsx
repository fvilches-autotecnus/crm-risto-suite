import { redirect } from 'next/navigation'
import { BookOpen } from 'lucide-react'
import ModuloPreparacion from '@/components/modulo-preparacion'
import { getContexto } from '@/lib/context'

export default async function CartaPage() {
  const ctx = await getContexto()
  if (!ctx.modulosActivos.carta) redirect('/')
  return (
    <ModuloPreparacion
      icono={<BookOpen size={22} />}
      titulo="Carta"
      subtitulo="Carta digital del local"
      vaA={['Categorías y productos con precio, descripción y foto', 'Disponibilidad y orden de cada producto', 'Carta pública para compartir con los clientes']}
    />
  )
}
