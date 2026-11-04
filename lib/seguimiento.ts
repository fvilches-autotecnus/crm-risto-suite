// Seguimiento público del pedido: el cliente ve en qué estado está con un link o poniendo el número de pedido.

/** Dónde vive la carta pública de cada negocio. Los que tienen dominio propio de pedidos se listan acá; el resto usa la dirección del CRM. */
const BASES_CARTA: Record<string, string> = { olgasana: 'https://pedidos.ristosuite.app/olgasana' }
const DOMINIO_CRM = 'https://crm.ristosuite.app'

export const baseCarta = (slug: string) => BASES_CARTA[slug] ?? `${DOMINIO_CRM}/carta/${slug}`

/** Link para ver el estado del pedido (con el número, abre directo ese pedido; sin número, pide el número). */
export const linkSeguimiento = (slug: string, numero?: number | null) => `${baseCarta(slug)}/pedido${numero ? `?numero=${numero}` : ''}`

/** Los pasos que ve el cliente: "En camino" solo existe en delivery. */
export const PASOS_SEGUIMIENTO = [
  { estado: 'nuevo', label: 'Recibido' },
  { estado: 'aceptado', label: 'Confirmado' },
  { estado: 'preparando', label: 'En preparación' },
  { estado: 'listo', label: 'Listo' },
  { estado: 'en_camino', label: 'En camino', soloDelivery: true },
  { estado: 'entregado', label: 'Entregado' },
] as const
