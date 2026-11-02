/** Clases de los "chips" con casilla (se marcan al tocarlos) que se repiten en varias pantallas. Van como constantes para no cambiar el marcado de cada una. */

/** Píldora con casilla chica: tipos de reserva, formas de entrega… */
export const CHIP_CHECK = 'flex cursor-pointer items-center gap-1.5 rounded-full border border-rs-control px-3 py-1 text-sm has-[:checked]:border-rs-lime/60 has-[:checked]:bg-rs-lime/10'
/** Lo mismo, más chica (etiquetas de la carta). */
export const CHIP_CHECK_CHICO = 'flex cursor-pointer items-center gap-1.5 rounded-full border border-rs-control px-2.5 py-1 text-xs has-[:checked]:border-rs-lime/60 has-[:checked]:bg-rs-lime/10'
/** Botón redondo de día de la semana (la casilla va oculta con sr-only). */
export const CHIP_DIA = 'inline-flex h-9 cursor-pointer items-center rounded-full border border-rs-control px-3.5 text-sm font-medium text-rs-muted transition hover:border-rs-lime/40 has-[:checked]:border-rs-lime/70 has-[:checked]:bg-rs-lime/15 has-[:checked]:font-semibold has-[:checked]:text-rs-lime'
/** Lo mismo, más chico (editor de turnos). */
export const CHIP_DIA_CHICO = 'inline-flex h-8 cursor-pointer items-center rounded-full border border-rs-control px-3 text-xs font-medium text-rs-muted transition hover:border-rs-lime/40 has-[:checked]:border-rs-lime/70 has-[:checked]:bg-rs-lime/15 has-[:checked]:font-semibold has-[:checked]:text-rs-lime'
