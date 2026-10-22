export const POR_PAGINA = 50

export const numPagina = (s?: string) => Math.max(1, parseInt(s ?? '1', 10) || 1)

/** Corta una lista ya filtrada y ordenada en páginas. */
export function paginar<T>(items: T[], pagina: number, por = POR_PAGINA) {
  const total = items.length
  const paginas = Math.max(1, Math.ceil(total / por))
  const p = Math.min(Math.max(1, pagina), paginas)
  return { items: items.slice((p - 1) * por, p * por), pagina: p, paginas, total, desde: total ? (p - 1) * por + 1 : 0, hasta: Math.min(total, p * por) }
}
