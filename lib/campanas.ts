/**
 * Campañas: seguimiento de mensajes de marketing (solo lectura a futuro).
 * Se registra qué se envió y a quién. Cuántos se entregaron, leyeron, respondieron o fallaron sale de los avisos de WhatsApp (Meta)
 * que guardan los receptores de n8n (migración 0098, funciones interacciones_envios / resumen_interacciones); solo los envíos con
 * wamid tienen seguimiento (los anteriores no se pueden reconstruir).
 * Hoy se pueden crear, editar y borrar a mano; cuando los envíos los cargue solo la automatización
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

/** Automática: la dispara un flujo (ej. n8n). Manual: la hace una persona. */
export const MODOS_CAMPANA = [
  { value: 'automatica', label: 'Automática' },
  { value: 'manual', label: 'Manual' },
] as const
export type ModoCampana = (typeof MODOS_CAMPANA)[number]['value']
export const labelModoCampana = (v: string) => MODOS_CAMPANA.find((m) => m.value === v)?.label ?? 'Manual'

export interface Campana {
  id: string
  nombre: string
  tipo: string
  canal: string
  mensaje: string | null
  estado: EstadoCampana
  modo: ModoCampana
  fecha_inicio: string | null
  fecha_fin: string | null
  creado_en: string
}
export const CAMPANA_COLS = 'id, nombre, tipo, canal, mensaje, estado, modo, fecha_inicio, fecha_fin, creado_en'

/** enviados = mensajes enviados en el período · clientes = clientes distintos a los que se les envió */
export interface ResumenCampana { campana_id: string; enviados: number; clientes: number; ultimo_envio: string | null }

export interface Envio { id: string; campana_id: string; cliente_id: string | null; nombre: string | null; telefono: string | null; enviado_en: string; detalle: string | null }
export const ENVIO_COLS = 'id, campana_id, cliente_id, nombre, telefono, enviado_en, detalle'

/** Totales de interacciones por campaña (public.resumen_interacciones). Los porcentajes van sobre con_seguimiento, no sobre enviados. */
export interface ResumenInteracciones { campana_id: string; enviados: number; con_seguimiento: number; entregados: number; leidos: number; respondieron: number; fallaron: number }

/** Interacciones de un envío (public.interacciones_envios). */
export interface Interaccion { envio_id: string; seguimiento: boolean; entregado_en: string | null; leido_en: string | null; fallo: string | null; respondio_en: string | null; respuesta: string | null; reaccion: string | null }

export const pct = (n: number, de: number) => (de > 0 ? Math.round((n * 100) / de) : 0)

export const DIAS_PERIODO = [7, 14, 30, 90, 180]
