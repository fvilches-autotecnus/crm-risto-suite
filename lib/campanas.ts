/**
 * Campañas automáticas: seguimiento de mensajes de marketing (solo lectura a futuro).
 * Hoy se pueden crear, editar y borrar a mano; cuando los envíos los cargue la automatización
 * (función bot_registrar_envio_campana), pasar CAMPANAS_EDITABLES a false: las pantallas quedan solo de consulta.
 */
export const CAMPANAS_EDITABLES = true

export const TIPOS_CAMPANA = [
  { value: 'cumpleanos', label: 'Cumpleaños' },
  { value: 'inactividad', label: 'Inactividad' },
  { value: 'encuesta', label: 'Encuesta' },
  { value: 'promocion', label: 'Promoción' },
  { value: 'otra', label: 'Otra' },
]
export const labelTipoCampana = (v: string | null) => TIPOS_CAMPANA.find((t) => t.value === v)?.label ?? (v ? v.charAt(0).toUpperCase() + v.slice(1).replace(/_/g, ' ') : 'Otra')

export const ESTADOS_CAMPANA = [
  { value: 'activa', label: 'Activa' },
  { value: 'pausada', label: 'Pausada' },
  { value: 'finalizada', label: 'Finalizada' },
] as const
export type EstadoCampana = (typeof ESTADOS_CAMPANA)[number]['value']
export const labelEstadoCampana = (v: string) => ESTADOS_CAMPANA.find((e) => e.value === v)?.label ?? v

/** De "salió" a "respondió": cada estado incluye a los anteriores al contar (entregados = entregado + leído + respondido). */
export const ESTADOS_ENVIO = [
  { value: 'enviado', label: 'Enviado' },
  { value: 'entregado', label: 'Entregado' },
  { value: 'leido', label: 'Leído' },
  { value: 'respondido', label: 'Respondió' },
  { value: 'fallido', label: 'Fallido' },
] as const
export type EstadoEnvio = (typeof ESTADOS_ENVIO)[number]['value']
export const labelEstadoEnvio = (v: string) => ESTADOS_ENVIO.find((e) => e.value === v)?.label ?? v

export interface Campana {
  id: string
  nombre: string
  tipo: string
  canal: string
  mensaje: string | null
  estado: EstadoCampana
  fecha_inicio: string | null
  fecha_fin: string | null
  creado_en: string
}
export const CAMPANA_COLS = 'id, nombre, tipo, canal, mensaje, estado, fecha_inicio, fecha_fin, creado_en'

export interface ResumenCampana { campana_id: string; enviados: number; entregados: number; leidos: number; respondidos: number; fallidos: number; ultimo_envio: string | null }

export interface Envio { id: string; campana_id: string; nombre: string | null; telefono: string | null; estado: EstadoEnvio; enviado_en: string; detalle: string | null }
export const ENVIO_COLS = 'id, campana_id, nombre, telefono, estado, enviado_en, detalle'

export const DIAS_PERIODO = [7, 14, 30, 90, 180]
export const pct = (parte: number, total: number) => (total > 0 ? Math.round((parte / total) * 100) : 0)
