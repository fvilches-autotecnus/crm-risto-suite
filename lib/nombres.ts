/** Nombre y apellido: en los formularios van en dos campos para que queden ordenados, pero en la base se guardan juntos en el mismo campo de siempre. */

/** "Ana", "Pérez" → "Ana Pérez" (espacios de más afuera y adentro, sacados). */
export const unirNombre = (nombre: string, apellido: string) => [nombre, apellido].map((t) => t.replace(/\s+/g, ' ').trim()).filter(Boolean).join(' ')

/** Para editar un nombre ya guardado: la última palabra es el apellido y el resto el nombre ("Ana María Pérez" → "Ana María" + "Pérez"). */
export function separarNombre(completo: string | null | undefined): { nombre: string; apellido: string } {
  const t = (completo ?? '').replace(/\s+/g, ' ').trim().split(' ').filter(Boolean)
  if (t.length <= 1) return { nombre: t[0] ?? '', apellido: '' }
  return { nombre: t.slice(0, -1).join(' '), apellido: t[t.length - 1] }
}
