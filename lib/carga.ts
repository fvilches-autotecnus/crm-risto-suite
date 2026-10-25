/** Avisan a la barra de progreso (components/barra-progreso.tsx) que empezó o terminó una carga que no es un link común (selectores, filtros, botones de actualizar). */
export const iniciarCarga = () => { if (typeof window !== 'undefined') window.dispatchEvent(new Event('rs:carga-inicio')) }
export const terminarCarga = () => { if (typeof window !== 'undefined') window.dispatchEvent(new Event('rs:carga-fin')) }
