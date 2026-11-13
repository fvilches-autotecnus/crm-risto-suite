/** Orden de un listado según ?orden=campo_asc|campo_desc: devuelve el pedido si es uno de los permitidos, o el valor por defecto. */
export function leerOrden(pedido: string | undefined, permitidos: readonly string[], porDefecto: string): string {
  return pedido && permitidos.includes(pedido) ? pedido : porDefecto
}

/** Los dos sentidos de cada campo ('alta' → ['alta_asc', 'alta_desc']), para armar la lista de órdenes permitidos. */
export const ambos = (...campos: string[]) => campos.flatMap((c) => [`${c}_asc`, `${c}_desc`])

type Ordenable = { order: (columna: string, opciones?: { ascending?: boolean; nullsFirst?: boolean }) => unknown }

/**
 * Ordena una consulta de Supabase según ?orden=campo_asc|campo_desc. `mapa` dice qué columnas de la base ordena cada campo
 * (la primera manda; las siguientes desempatan en el mismo sentido). Lo vacío (null) va siempre al final.
 */
export function ordenarPor<Q>(consulta: Q, orden: string, mapa: Record<string, string[]>): Q {
  const asc = orden.endsWith('_asc')
  let q: unknown = consulta
  for (const col of mapa[orden.slice(0, orden.lastIndexOf('_'))] ?? []) q = (q as Ordenable).order(col, { ascending: asc, nullsFirst: false })
  return q as Q
}
