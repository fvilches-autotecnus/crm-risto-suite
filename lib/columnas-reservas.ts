/** Columnas de la tabla de reservas: algunas son fijas (siempre se ven) y las demás las elige cada persona. La elección se guarda en una cookie. */

export const COLUMNAS_COOKIE = 'rs_cols'

/** Siempre visibles: el número, el cliente (con su observación en letra chica), el estado y las acciones. */
export const COLUMNAS_OPCIONALES = [
  { clave: 'telefono', etiqueta: 'Teléfono' },
  { clave: 'sede', etiqueta: 'Sede' },
  { clave: 'fecha', etiqueta: 'Fecha' },
  { clave: 'hora', etiqueta: 'Hora' },
  { clave: 'personas', etiqueta: 'Personas y mesa' },
  { clave: 'tipo', etiqueta: 'Tipo' },
  { clave: 'ubicacion', etiqueta: 'Ubicación' },
  { clave: 'observaciones', etiqueta: 'Observaciones (columna aparte)' },
  { clave: 'alta', etiqueta: 'Fecha de alta' },
] as const
export type ColumnaClave = (typeof COLUMNAS_OPCIONALES)[number]['clave']

/** Lo que se ve si la persona todavía no eligió: lo esencial. Las observaciones salen en letra chica debajo del nombre. */
export const COLUMNAS_DEFECTO: ColumnaClave[] = ['telefono', 'sede', 'fecha', 'hora', 'personas', 'ubicacion']

/** Lee la cookie ("telefono,fecha,…"); si no hay o no sirve, usa las de siempre. */
export function leerColumnas(valor: string | undefined | null): ColumnaClave[] {
  if (valor === undefined || valor === null) return COLUMNAS_DEFECTO
  const validas = new Set<string>(COLUMNAS_OPCIONALES.map((c) => c.clave))
  return valor.split(',').map((c) => c.trim()).filter((c): c is ColumnaClave => validas.has(c))
}
