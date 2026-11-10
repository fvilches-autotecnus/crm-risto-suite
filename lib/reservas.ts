import { fechaCorta, horaCorta } from '@/lib/fechas'

export const TIPOS_RESERVA = [
  { value: 'comun', label: 'Común' },
  { value: 'cumpleanos', label: 'Cumpleaños' },
  { value: 'despedida', label: 'Despedida' },
  { value: 'evento_especial', label: 'Evento especial' },
] as const

const humanizar = (v: string) => { const t = v.replace(/_/g, ' ').trim(); return t ? t.charAt(0).toUpperCase() + t.slice(1) : v }
// tipos que traen los negocios migrados (los que se escriben con tilde o con barra no salen bien de `humanizar`)
const ETIQUETAS_EXTRA: Record<string, string> = { salon: 'Salón', cena_show: 'Cena show', promo_del_dia: 'Promo del día', desayuno_merienda_libre: 'Desayuno / merienda libre', cena_de_pasos: 'Cena de pasos' }
/** Nombre de un tipo de reserva: el que configuró el negocio (si se pasa su catálogo) o, si no, el de siempre. */
export const labelTipo = (v: string, etiquetas?: Record<string, string>) => etiquetas?.[v] ?? TIPOS_RESERVA.find((t) => t.value === v)?.label ?? ETIQUETAS_EXTRA[v] ?? humanizar(v)

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

/** Lo guardado del pago de la seña con Mercado Pago (datos_origen.mp). `al_pagar` = con qué datos de reserva se pagó; `total_pagado` suma todos los pagos. */
export interface PagoSena {
  payment_id?: string
  monto_pagado?: number
  total_pagado?: number
  pagado_en?: string
  al_pagar?: { fecha?: string | null; hora?: string | null; personas?: number | null }
  /** El equipo marcó el aviso como resuelto. `firma` es el estado de la reserva en ese momento: si después cambia otra vez, el aviso vuelve a aparecer. */
  resuelta?: { firma?: string; en?: string }
}

export interface Reserva {
  id: string
  numero: number
  numero_sede?: number | null   // número propio de la sede (si la sede numera por su cuenta)
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
  asistio_en: string | null   // cuándo se marcó que el cliente llegó (Fidelización)
  monto_sena: number | null
  /** Pago de la seña ya acreditado (si lo hubo). Solo sirve para avisar en pantalla cuando la reserva se modifica o cancela con seña pagada. */
  pago?: PagoSena | null
  /** Promo elegida del tipo de reserva (con su precio de ese momento) y código del enlace de campaña con el que entró. */
  opcion?: { nombre?: string; total?: number | null; modo?: 'persona' | 'reserva'; personas?: number } | null
  campana?: string | null
  creado_en: string
}

/** El código de reserva que se muestra: el de la sede si numera aparte, si no el del negocio. */
export const numeroVisible = (r: { numero: number; numero_sede?: number | null }) => r.numero_sede ?? r.numero

export const RESERVA_COLS =
  'id, numero, numero_sede, cliente_id, sucursal_id, ubicacion, cliente_nombre, cliente_telefono, fecha, hora, cantidad_personas, tipo_reserva, observaciones, estado, es_manual, cumpleanos_dia, cumpleanos_mes, texto_original, motivo_cancelacion, monto_sena, asistio_en, opcion, campana, creado_en, pago:datos_origen->mp'

/** Huella de la situación de la reserva para el aviso de seña: cancelada, o día + hora + personas (el estado no cuenta: confirmarla de nuevo no reabre el aviso). */
export const firmaSena = (r: Pick<Reserva, 'estado' | 'fecha' | 'hora' | 'cantidad_personas'>) => (r.estado === 'cancelada' ? 'cancelada' : `${r.fecha ?? ''}|${r.hora ? r.hora.slice(0, 5) : ''}|${r.cantidad_personas ?? ''}`)

export interface AvisoSena { tipo: 'cancelada' | 'modificada'; corto: string; detalle: string }

/**
 * Marca para el equipo: la reserva tiene una seña YA pagada y después se canceló o se cambió (personas, día u hora).
 * Es solo un aviso en pantalla: no devuelve ni pide nada, la decisión (pedir más seña, mantenerla, devolverla) es de una persona.
 * El cambio se detecta contra los datos con los que se pagó (`pago.al_pagar`); los pagos anteriores a ese registro solo avisan al cancelar.
 */
export function avisoSenaPagada(r: Pick<Reserva, 'estado' | 'fecha' | 'hora' | 'cantidad_personas' | 'monto_sena' | 'pago'>): AvisoSena | null {
  const p = r.pago
  if (!p?.payment_id) return null
  if (p.resuelta?.firma && p.resuelta.firma === firmaSena(r)) return null   // ya lo revisó una persona y la reserva no cambió desde entonces
  const pagado = Number(p.total_pagado ?? p.monto_pagado ?? 0)
  const monto = formatoMonto(pagado)
  if (r.estado === 'cancelada') {
    return { tipo: 'cancelada', corto: `Seña pagada ${monto} · cancelada`, detalle: `Esta reserva tiene una seña pagada de ${monto}. No se hace nada automático con ese dinero: definí con el cliente si se devuelve o se conserva.` }
  }
  const a = p.al_pagar
  if (!a) return null
  const hora = (h: string | null | undefined) => (h ? h.slice(0, 5) : null)
  const cambio = (a.fecha ?? null) !== (r.fecha ?? null) || hora(a.hora) !== hora(r.hora) || (a.personas ?? null) !== (r.cantidad_personas ?? null)
  if (!cambio) return null
  const descr = (personas: number | null | undefined, fecha: string | null | undefined, h: string | null | undefined) =>
    [personas ? `${personas} ${personas === 1 ? 'persona' : 'personas'}` : null, fecha ? fechaCorta(fecha) : null, h ? horaCorta(h) : null].filter(Boolean).join(' · ') || 'sin datos'
  const mas = r.monto_sena != null && Number(r.monto_sena) > pagado ? ` La seña cargada hoy es de ${formatoMonto(Number(r.monto_sena))}.` : ''
  return {
    tipo: 'modificada', corto: `Seña pagada ${monto} · modificada`,
    detalle: `Pagó ${monto} cuando la reserva era de ${descr(a.personas, a.fecha, a.hora)}. Ahora figura ${descr(r.cantidad_personas, r.fecha, r.hora)}.${mas} Revisá si hay que pedir más seña, mantenerla o decidir otra cosa: es solo un aviso, no se hizo nada automático.`,
  }
}

/** Reservas que ocupan lugar (cuentan para aforo y para "hoy"). */
export const ocupaLugar = (r: Pick<Reserva, 'estado'>) => ESTADOS_OCUPAN.includes(r.estado)

/** Monto en pesos argentinos, sin decimales si es entero: "$ 5.000". */
export const formatoMonto = (n: number) => '$ ' + n.toLocaleString('es-AR', { minimumFractionDigits: 0, maximumFractionDigits: 2 })

/** Estados en los que se puede avisar al cliente por WhatsApp (nueva y revisar pago nunca se avisan). */
export const ESTADOS_AVISO = ['confirmada', 'pendiente_pago', 'no_show', 'cancelada'] as const
export type EstadoAviso = (typeof ESTADOS_AVISO)[number]
/** Lo que entienden hoy los workflows de aviso de los negocios. */
export const ESTADOS_AVISO_POR_DEFECTO: EstadoAviso[] = ['confirmada', 'cancelada']
/** Una reserva cargada a mano nunca se avisa por WhatsApp (el cliente ya habló con una persona), salvo el link de pago de la seña en los locales que la cobran con Mercado Pago. */
export const avisaReservaManual = (estado: string, cobroSena: boolean | undefined) => cobroSena === true && estado === 'pendiente_pago'
export const esEstadoAviso = (e: string): e is EstadoAviso => (ESTADOS_AVISO as readonly string[]).includes(e)
