/**
 * Ajustes del sitio público de reservas que llegan al navegador del cliente. Está todo acá en un solo lugar:
 * para sumar un ajuste nuevo se agrega a CfgSitio, a COLUMNAS_CFG_SITIO, a CLAVES_CFG_SEDE (si una sede puede pisarlo) y a cfgSitio().
 * (Además de su columna en reservas_web_config, su campo en Configuración y, si la sede lo pisa, su grupo en lib/config-sedes.ts.)
 */
export interface CfgSitio {
  elegir_mesa: boolean; dias_adelante: number; personas_min: number; personas_max: number; mensaje: string | null; modo_prueba: boolean
  titulo: string | null; subtitulo: string | null; texto_whatsapp: string | null; max_mesas: number
  cualquier_ubicacion: boolean; texto_cualquier_ubicacion: string | null; pedir_cumple: boolean; tolerancia_min: number | null
}

/** Columnas de reservas_web_config que lee el sitio público (activo y tipos se usan del lado del servidor). */
export const COLUMNAS_CFG_SITIO = 'activo, tipos, elegir_mesa, dias_adelante, personas_min, personas_max, mensaje, modo_prueba, titulo, subtitulo, texto_whatsapp, max_mesas, cualquier_ubicacion, texto_cualquier_ubicacion, pedir_cumple, tolerancia_min'

/** Los ajustes que una sede puede pisar con los suyos (config_sedes.web); el resto es siempre del negocio. */
export const CLAVES_CFG_SEDE = ['dias_adelante', 'personas_min', 'personas_max', 'titulo', 'subtitulo', 'texto_whatsapp', 'max_mesas', 'cualquier_ubicacion', 'texto_cualquier_ubicacion', 'pedir_cumple', 'tolerancia_min'] as const satisfies readonly (keyof CfgSitio)[]

/** Una fila de reservas_web_config → los ajustes del sitio, con los valores por defecto de lo que puede venir vacío. */
export function cfgSitio(c: Record<string, unknown>): CfgSitio {
  return {
    elegir_mesa: c.elegir_mesa === true, dias_adelante: c.dias_adelante as number, personas_min: c.personas_min as number, personas_max: c.personas_max as number,
    mensaje: c.mensaje as string | null, modo_prueba: c.modo_prueba !== false, titulo: c.titulo as string | null, subtitulo: c.subtitulo as string | null,
    texto_whatsapp: c.texto_whatsapp as string | null, max_mesas: (c.max_mesas as number | null) ?? 6, cualquier_ubicacion: c.cualquier_ubicacion !== false,
    texto_cualquier_ubicacion: c.texto_cualquier_ubicacion as string | null, pedir_cumple: c.pedir_cumple !== false, tolerancia_min: (c.tolerancia_min as number | null) ?? null,
  }
}
