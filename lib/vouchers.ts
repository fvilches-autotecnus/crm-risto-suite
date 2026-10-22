const CAMPANAS: Record<string, string> = { cumpleanos: 'Cumpleaños', inactividad: 'Inactividad', encuesta: 'Encuesta' }

export const labelCampana = (c: string | null) => (c ? CAMPANAS[c] ?? c : '—')
