// Configuración propia de cada sede (tabla config_sedes). Lo que la sede no cambia lo hereda del negocio.

export interface TipoSedeOv { activo?: boolean; modo?: 'siempre' | 'semana' | 'fechas'; dias_semana?: number[]; fechas?: string[] }
export interface ConfigSede {
  sucursal_id: string
  modulos: Record<string, boolean>            // { clave: false } los módulos que la sede NO usa
  web: Record<string, unknown>                // claves de reservas_web_config que la sede pisa
  params: Record<string, unknown>             // alerta_aforo_pct, turnos, estados_bloquean, duracion_min
  tipos: Record<string, TipoSedeOv>
  mensajes: Record<string, string>
  estado_inicial: 'nueva' | 'confirmada' | null
}

export const CONFIG_SEDE_VACIA = (sucursal_id: string): ConfigSede => ({ sucursal_id, modulos: {}, web: {}, params: {}, tipos: {}, mensajes: {}, estado_inicial: null })

/** Grupos de ajustes del sitio de reservas que una sede puede personalizar (se pisan juntos o se heredan juntos). */
export const GRUPOS_WEB = [
  { id: 'reglas', titulo: 'Reglas de la reserva', claves: ['dias_adelante', 'horas_anticipacion', 'personas_min', 'personas_max', 'validez_horas', 'max_mesas'] },
  { id: 'textos', titulo: 'Textos del sitio', claves: ['titulo', 'subtitulo', 'texto_whatsapp'] },
  { id: 'cualquiera', titulo: 'Cualquier ubicación disponible', claves: ['cualquier_ubicacion', 'texto_cualquier_ubicacion'] },
  { id: 'cumple', titulo: 'Cumpleaños', claves: ['pedir_cumple'] },
  { id: 'escasez', titulo: 'Aviso de pocos lugares', claves: ['escasez_modo', 'escasez_umbral', 'escasez_texto'] },
  { id: 'tipos', titulo: 'Tipos de reserva que se ofrecen', claves: ['tipos'] },
  { id: 'marca', titulo: 'Marca del sitio (logo, colores, frase)', claves: ['marca'] },
] as const
export type GrupoWebId = (typeof GRUPOS_WEB)[number]['id']

/** Claves de `params` (parámetros de reservas) que la sede puede personalizar. */
export const CLAVES_PARAMS = ['alerta_aforo_pct', 'turnos', 'estados_bloquean'] as const

/** ¿La sede pisa ese grupo? (alcanza con que tenga una de sus claves) */
export const grupoPisado = (c: ConfigSede | undefined, id: GrupoWebId) => !!c && GRUPOS_WEB.find((g) => g.id === id)!.claves.some((k) => k in c.web)
export const paramsPisados = (c: ConfigSede | undefined) => !!c && CLAVES_PARAMS.some((k) => k in c.params)
