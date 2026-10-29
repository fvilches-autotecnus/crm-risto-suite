import type { MesaWeb } from '@/app/reservar/[slug]/actions'

/**
 * Si TODAS las mesas libres de un salón piden más personas que las de la reserva (por ejemplo, reservás para 2 y las mesas libres son de 3 como mínimo),
 * ninguna sirve y el plano solo muestra mesas que no se pueden elegir: acá se explica por qué y qué se puede hacer. Null si no corresponde avisar.
 */
export function avisoCapacidadMinima(mesas: Pick<MesaWeb, 'tipo' | 'estado' | 'capacidad' | 'capacidad_min'>[], personas: number): string | null {
  const libres = mesas.filter((m) => m.tipo === 'mesa' && m.estado !== 'ocupada')
  if (libres.length === 0 || libres.some((m) => m.capacidad_min <= personas)) return null
  const min = Math.min(...libres.map((m) => m.capacidad_min))
  return `Las mesas libres de este salón son para ${min} personas o más, y tu reserva es para ${personas}. Podés reservar para ${min} o más, probar otro horario u otra ubicación, o pedir que un asesor te busque la mejor opción.`
}
