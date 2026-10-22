const CAMPANAS: Record<string, string> = { cumpleanos: 'Cumpleaños', inactividad: 'Inactividad' }

export const labelCampana = (c: string | null) => (c ? CAMPANAS[c] ?? c : '—')
