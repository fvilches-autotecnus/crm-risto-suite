/**
 * Promos por tipo de reserva (módulo "Promos de reservas"): cada tipo puede tener una descripción y promos con precio por persona o por reserva.
 * Si un tipo tiene promos activas, el sitio de reservas obliga a elegir una; queda anotada en la reserva con el precio de ese momento.
 */
export type ModoPrecio = 'persona' | 'reserva'
export interface PromoReserva { id: string; nombre: string; descripcion: string | null; precio: number | null; modo_precio: ModoPrecio; activa: boolean }
/** Lo que se guarda en reservas.opcion: la promo elegida con su precio de ese momento. */
export interface PromoElegida { id: string; nombre: string; precio: number | null; modo: ModoPrecio; personas: number; total: number | null }

const dinero = (n: number) => '$ ' + n.toLocaleString('es-AR', { minimumFractionDigits: 0, maximumFractionDigits: 2 })

/** "$ 15.000 por persona" · "$ 80.000 por reserva" · "Precio a consultar" */
export const textoPrecioPromo = (p: Pick<PromoReserva, 'precio' | 'modo_precio'>) => (p.precio === null ? 'Precio a consultar' : `${dinero(p.precio)} ${p.modo_precio === 'persona' ? 'por persona' : 'por reserva'}`)

/** Cuánto sale la promo para esa cantidad de personas (null si no tiene precio). */
export const totalPromo = (p: Pick<PromoReserva, 'precio' | 'modo_precio'>, personas: number) => (p.precio === null ? null : p.modo_precio === 'persona' ? Math.round(p.precio * personas * 100) / 100 : p.precio)

/** "Promo 2 · $ 60.000 en total (4 personas)" — para mostrar la promo ya elegida. */
export function resumenPromoElegida(o: Partial<PromoElegida> | null | undefined): string | null {
  if (!o?.nombre) return null
  const total = o.total === null || o.total === undefined ? null : Number(o.total)
  return total === null ? o.nombre : `${o.nombre} · ${dinero(total)}${o.modo === 'persona' && o.personas ? ` (${o.personas} personas)` : ''}`
}

/** Código de campaña del enlace (?c=…): solo letras, números, guion y guion bajo, hasta 40. Vacío si no sirve. */
export const limpiarCampana = (v: unknown) => String(v ?? '').toLowerCase().replace(/[^a-z0-9_-]/g, '').slice(0, 40)
