import { BookOpenText } from 'lucide-react'
import ManualUI, { type SeccionVista } from '@/components/manual-ui'
import { getContexto } from '@/lib/context'
import { GRUPOS_MANUAL, MANUAL } from '@/lib/manual'

export const metadata = { title: 'Ayuda · RistoSuite' }

/** Manual de usuario. Muestra todo lo que le sirve a quien lo lee: las secciones de administración solo las ven quienes administran,
 *  y las de un módulo apagado se muestran igual pero marcadas ("No activo en este negocio"). */
export default async function AyudaPage() {
  const ctx = await getContexto()
  const secciones: SeccionVista[] = MANUAL
    .filter((s) => (s.solo === 'superadmin' ? ctx.esSuperadmin : s.solo === 'admin' ? ctx.puedeAdministrar : true))
    .map((s) => ({ ...s, inactivo: !!s.modulo && ctx.modulosActivos[s.modulo] !== true }))
  return (
    <div className="space-y-4">
      <div>
        <h1 className="flex items-center gap-2 text-xl font-bold sm:text-2xl"><BookOpenText className="text-rs-lime" size={22} />Manual de usuario</h1>
        <p className="mt-1 text-sm text-rs-muted">Cómo manejarte en RistoSuite, módulo por módulo. Vas a ver lo que corresponde a tu rol; lo que dice “No activo en este negocio” se enciende desde Administración.</p>
      </div>
      <ManualUI secciones={secciones} grupos={GRUPOS_MANUAL} />
    </div>
  )
}
