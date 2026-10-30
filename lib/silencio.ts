/**
 * Silenciar al bot de BotConversa para un cliente: el CRM le manda al suscriptor uno de cuatro flujos que se crean en BotConversa
 * (reactivar, silenciar 2 horas, silenciar 24 horas, silenciar indefinidamente). El tiempo lo cuenta el flujo; el CRM anota el estado.
 */
export const OPCIONES_SILENCIO = [
  { clave: 'silenciar_2h', etiqueta: '2 horas', horas: 2 as number | null },
  { clave: 'silenciar_24h', etiqueta: '24 horas', horas: 24 as number | null },
  { clave: 'silenciar_indef', etiqueta: 'Indefinidamente', horas: null as number | null },
  { clave: 'reactivar', etiqueta: 'Reactivar al bot', horas: 0 as number | null },
] as const

export type ClaveFlujo = (typeof OPCIONES_SILENCIO)[number]['clave']
export const CLAVES_FLUJO: ClaveFlujo[] = OPCIONES_SILENCIO.map((o) => o.clave)
export type FlujosSilencio = Partial<Record<ClaveFlujo, number>>

/** Nombre con el que se pide cada flujo en Configuración. */
export const TITULO_FLUJO: Record<ClaveFlujo, string> = {
  reactivar: 'Reactivar al bot',
  silenciar_2h: 'Silenciar 2 horas',
  silenciar_24h: 'Silenciar 24 horas',
  silenciar_indef: 'Silenciar indefinidamente',
}

/** Los ids de flujo guardados (solo enteros positivos de las cuatro claves conocidas). */
export function leerFlujos(raw: unknown): FlujosSilencio {
  const o = raw && typeof raw === 'object' && !Array.isArray(raw) ? (raw as Record<string, unknown>) : {}
  const out: FlujosSilencio = {}
  for (const c of CLAVES_FLUJO) { const n = Number(o[c]); if (Number.isSafeInteger(n) && n > 0) out[c] = n }
  return out
}

export interface EstadoSilencio { silenciado: boolean; /** Hasta cuándo (ISO); null = indefinidamente. */ hasta: string | null }

/** ¿El cliente figura silenciado ahora? Una fecha vencida ya no cuenta: el flujo de BotConversa lo reactivó solo. */
export function estadoSilencio(c: { bot_silenciado_en: string | null; bot_silenciado_hasta: string | null }, ahora: number = Date.now()): EstadoSilencio {
  if (!c.bot_silenciado_en) return { silenciado: false, hasta: null }
  if (c.bot_silenciado_hasta && Date.parse(c.bot_silenciado_hasta) <= ahora) return { silenciado: false, hasta: null }
  return { silenciado: true, hasta: c.bot_silenciado_hasta }
}
