import Link from 'next/link'
import { ArrowDown, ArrowUp, ArrowUpDown } from 'lucide-react'

/** Lo que necesita una tabla de un componente de cliente para armar los enlaces de orden de sus encabezados. */
export interface OrdenTabla { ruta: string; params: Record<string, string | undefined>; actual: string }

/**
 * Encabezado de columna ordenable: un clic ordena por esa columna y otro clic invierte el sentido.
 * El orden vive en la dirección (?orden=campo_asc | campo_desc), así que sirve para páginas del servidor y para tablas de componentes de cliente.
 * `orden` es el orden vigente ya resuelto (con el valor por defecto de la página); `primero` es el sentido de la primera vez que se hace clic
 * (texto y fechas viejas→nuevas: 'asc'; cantidades y "más reciente": 'desc').
 */
export function ThOrden({ ruta, params, campo, orden, primero = 'asc', className = '', children }: {
  ruta: string
  params: Record<string, string | string[] | undefined>
  campo: string
  orden: string
  primero?: 'asc' | 'desc'
  className?: string
  children: React.ReactNode
}) {
  const activo = orden.startsWith(campo + '_')
  const dir = activo ? (orden.endsWith('_desc') ? 'desc' : 'asc') : null
  const siguiente = dir ? (dir === 'asc' ? 'desc' : 'asc') : primero
  const u = new URLSearchParams()
  for (const [k, v] of Object.entries(params)) if (typeof v === 'string' && v && k !== 'orden' && k !== 'pagina') u.set(k, v)
  u.set('orden', `${campo}_${siguiente}`)
  const Icono = dir === 'asc' ? ArrowUp : dir === 'desc' ? ArrowDown : ArrowUpDown
  const titulo = siguiente === 'asc' ? 'Ordenar de menor a mayor (A–Z)' : 'Ordenar de mayor a menor (Z–A)'
  return (
    <th className={('th ' + className).trim()} aria-sort={dir === 'asc' ? 'ascending' : dir === 'desc' ? 'descending' : 'none'}>
      <Link href={`${ruta}?${u.toString()}`} title={titulo} className={'inline-flex items-center gap-1 uppercase transition-colors hover:text-rs-lime' + (className.includes('text-right') ? ' flex-row-reverse' : '')}>
        {children}<Icono size={12} className={dir ? 'text-rs-lime' : 'opacity-60'} />
      </Link>
    </th>
  )
}
