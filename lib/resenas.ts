const ORIGENES: Record<string, string> = { google: 'Google', encuesta: 'Encuesta', manual: 'Manual', otro: 'Otro' }

export const labelOrigen = (o: string) => ORIGENES[o] ?? o
export const ORIGENES_LISTA = Object.entries(ORIGENES).map(([value, label]) => ({ value, label }))
