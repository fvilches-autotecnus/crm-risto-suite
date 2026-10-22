export const TIPOS_RESERVA = [
  { value: 'comun', label: 'Común' },
  { value: 'cumpleanos', label: 'Cumpleaños' },
  { value: 'despedida', label: 'Despedida' },
  { value: 'evento_especial', label: 'Evento especial' },
] as const

const humanizar = (v: string) => { const t = v.replace(/_/g, ' ').trim(); return t ? t.charAt(0).toUpperCase() + t.slice(1) : v }
export const labelTipo = (v: string) => TIPOS_RESERVA.find((t) => t.value === v)?.label ?? humanizar(v)

export const ESTADOS = [
  { value: 'nueva', label: 'Nueva' },
  { value: 'confirmada', label: 'Confirmada' },
  { value: 'pendiente_pago', label: 'Pendiente de pago' },
  { value: 'revisar_pago', label: 'Revisar pago' },
  { value: 'no_show', label: 'No-show' },
  { value: 'cancelada', label: 'Cancelada' },
] as const

export type EstadoReserva = (typeof ESTADOS)[number]['value']
/** Estados en los que la reserva ocupa lugar (cuenta para aforo y para "hoy"). */
export const ESTADOS_OCUPAN: EstadoReserva[] = ['nueva', 'confirmada', 'pendiente_pago', 'revisar_pago']

export const labelEstado = (v: string) => ESTADOS.find((e) => e.value === v)?.label ?? v

export interface Reserva {
  id: string
  numero: number
  cliente_id: string | null
  sucursal_id: string | null
  ubicacion: string | null
  cliente_nombre: string | null
  cliente_telefono: string | null
  fecha: string | null
  hora: string | null
  cantidad_personas: number | null
  tipo_reserva: string
  observaciones: string | null
  estado: EstadoReserva
  es_manual: boolean
  cumpleanos_dia: number | null
  cumpleanos_mes: number | null
  texto_original: string | null
  motivo_cancelacion: string | null
  creado_en: string
}

export const RESERVA_COLS =
  'id, numero, cliente_id, sucursal_id, ubicacion, cliente_nombre, cliente_telefono, fecha, hora, cantidad_personas, tipo_reserva, observaciones, estado, es_manual, cumpleanos_dia, cumpleanos_mes, texto_original, motivo_cancelacion, creado_en'

/** Reservas que ocupan lugar (cuentan para aforo y para "hoy"). */
export const ocupaLugar = (r: Pick<Reserva, 'estado'>) => ESTADOS_OCUPAN.includes(r.estado)
