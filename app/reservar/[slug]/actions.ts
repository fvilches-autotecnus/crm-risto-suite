'use server'

import { createAdminClient } from '@/lib/supabase/server'

export interface SlotWeb { hora: string; disponible: boolean; motivo?: 'fuera_de_rango' | 'pasado' | 'bloqueado' | 'completo'; aviso?: string }
export interface MesaWeb { id: string; salon_id: string; tipo: 'mesa' | 'deco'; numero: string; x: number; y: number; w: number; h: number; forma: 'cuadrada' | 'redonda'; movil: boolean; capacidad_min: number; capacidad: number; rotacion?: number; sillas?: boolean; sillas_lados?: string[] | null; estado: 'disponible' | 'ocupada' | 'no_apta' | 'deco' }
export interface SedeWeb { id: string; nombre: string; direccion: string | null; maps_url: string | null; whatsapp: string; elegir_mesa: boolean; mensaje: string | null; tiene_plano: boolean }
export interface TipoWeb { value: string; label: string; modo: 'siempre' | 'semana' | 'fechas'; dias_semana: number[]; fechas: string[] }
export interface SalonWeb { id: string; nombre: string; ancho: number; alto: number; ubicacion: string | null; tema_sillas?: string; color_sillas?: string | null }
export type ResultadoReserva =
  | { ok: true; codigo: string; whatsapp: string; sede: string | null; mesas: string | null; fecha: string; hora: string; personas: number; ubicacion: string | null; mensaje: string | null }
  | { ok: false; error: string }

const SLUG = /^[a-z0-9-]{2,49}$/
const FECHA = /^\d{4}-\d{2}-\d{2}$/
const HORA = /^\d{2}:\d{2}$/
const rpc = async (fn: string, p: Record<string, unknown>) => { const { data, error } = await createAdminClient().rpc(fn, { p }); return error ? null : (data as Record<string, unknown>) }

/** Horarios de un día y si hay lugar (usa el aforo y las fechas bloqueadas del CRM). */
export async function consultarHorarios(slug: string, fecha: string, personas: number, ubicacion: string, sede = ''): Promise<{ ok: true; slots: SlotWeb[] } | { ok: false; error: string }> {
  if (!SLUG.test(slug) || !FECHA.test(fecha) || !Number.isInteger(personas)) return { ok: false, error: 'Datos no válidos' }
  const r = await rpc('web_horarios', { negocio: slug, fecha, personas, ubicacion, sede })
  if (!r) return { ok: false, error: 'No pudimos consultar los horarios. Probá de nuevo.' }
  if (r.ok !== true) return { ok: false, error: r.error === 'personas_invalidas' ? 'La cantidad de personas no está permitida para reservar por acá.' : r.error === 'sitio_apagado' ? 'Este sitio de reservas no está disponible.' : 'No pudimos consultar los horarios.' }
  return { ok: true, slots: r.slots as SlotWeb[] }
}

/** Plano con el estado de cada mesa a esa fecha y hora (solo confirmadas, pendientes de pago o en revisión de pago bloquean una mesa). */
export async function consultarPlano(slug: string, fecha: string, hora: string, personas: number, ubicacion: string, sede = '', reserva = ''): Promise<{ ok: true; salones: SalonWeb[]; mesas: MesaWeb[] } | { ok: false; error: string }> {
  if (!SLUG.test(slug) || !FECHA.test(fecha) || !HORA.test(hora) || !Number.isInteger(personas)) return { ok: false, error: 'Datos no válidos' }
  const r = await rpc('web_plano', { negocio: slug, fecha, hora, personas, ubicacion, sede, reserva: /^[a-z0-9]{6,20}$/i.test(reserva) ? reserva : '' })
  if (!r || r.ok !== true) return { ok: false, error: 'No pudimos cargar el plano. Podés pedir que un asesor elija tu mesa.' }
  return { ok: true, salones: r.salones as SalonWeb[], mesas: r.mesas as MesaWeb[] }
}

export interface DatosReservaWeb { cumple_dia?: string; cumple_mes?: string; sede?: string; fecha: string; hora: string; personas: number; ubicacion: string; tipo: string; nombre: string; observaciones: string; mesas: string[]; web?: string }

const MENSAJES: Record<string, string> = {
  sitio_apagado: 'Este sitio de reservas no está disponible.', personas_invalidas: 'La cantidad de personas no está permitida.', falta_nombre: 'Escribí tu nombre.',
  cumple_invalido: 'Revisá el cumpleaños: tiene que tener día y mes válidos (o dejalo vacío).', tipo_no_disponible: 'Ese tipo de reserva no está disponible ese día. Elegí otro o cambiá el día.', falta_sede: 'Elegí en qué sede querés reservar.', sin_whatsapp: 'Este sitio todavía no está habilitado. Escribinos por WhatsApp.', tipo_invalido: 'Elegí un tipo de reserva.', ubicacion_invalida: 'Elegí una ubicación.',
  horario_no_disponible: 'Ese horario ya no está disponible. Elegí otro.', mesa_invalida: 'Alguna mesa ya no está disponible. Volvé a elegir.', mesas_fijas_no_se_juntan: 'Las mesas fijas no se pueden juntar.',
  mesa_no_apta: 'Las mesas elegidas no son para esa cantidad de personas.', mesa_ocupada: 'Alguna de las mesas ya fue reservada. Elegí otra.', eleccion_no_permitida: 'Por ahora no se puede elegir mesa: un asesor la va a elegir por vos.',
  demasiadas_solicitudes: 'Hay muchas solicitudes en este momento. Esperá unos minutos o escribinos por WhatsApp.', datos_invalidos: 'Revisá los datos de la reserva.',
}

/** Guarda la solicitud EN ESPERA y devuelve su código. La reserva real se crea cuando el cliente manda el mensaje por WhatsApp (el bot la registra con el teléfono de quien escribe). */
export async function crearReservaPublica(slug: string, d: DatosReservaWeb): Promise<ResultadoReserva> {
  if (!SLUG.test(slug)) return { ok: false, error: 'No encontramos este negocio.' }
  if (d?.web) return { ok: false, error: 'No pudimos registrar tu reserva. Probá de nuevo.' }   // campo trampa: robots
  const r = await rpc('crear_solicitud_web', {
    negocio: slug, sede: String(d.sede ?? '').slice(0, 40), fecha: d.fecha, hora: d.hora, personas: Math.trunc(Number(d.personas)), ubicacion: String(d.ubicacion ?? '').slice(0, 60), tipo: String(d.tipo ?? '').slice(0, 40),
    nombre: String(d.nombre ?? '').slice(0, 80), cumple_dia: String(d.cumple_dia ?? '').slice(0, 2), cumple_mes: String(d.cumple_mes ?? '').slice(0, 2), observaciones: String(d.observaciones ?? '').slice(0, 400), mesas: Array.isArray(d.mesas) ? d.mesas.slice(0, 6) : [],
  })
  if (!r) return { ok: false, error: 'No pudimos guardar tu solicitud. Probá de nuevo.' }
  if (r.ok !== true) {
    if (r.error === 'horario_no_disponible') return { ok: false, error: r.motivo === 'completo' ? 'Ese horario se completó. Elegí otro.' : MENSAJES.horario_no_disponible }
    if (r.error === 'mesa_no_apta') return { ok: false, error: `Las mesas elegidas son para ${r.minimo}–${r.maximo} personas.` }
    return { ok: false, error: MENSAJES[String(r.error)] ?? 'No pudimos registrar tu reserva. Probá de nuevo.' }
  }
  return { ok: true, codigo: String(r.codigo), whatsapp: String(r.whatsapp ?? ''), sede: (r.sede as string | null) ?? null, mesas: (r.mesas as string | null) ?? null, fecha: String(r.fecha), hora: String(r.hora), personas: Number(r.personas), ubicacion: (r.ubicacion as string | null) ?? null, mensaje: (r.mensaje as string | null) ?? null }
}

// ───────── cancelar o modificar una reserva desde su link (se confirma por WhatsApp; el teléfono de quien escribe tiene que coincidir con el de la reserva)
const CODIGO_G = /^[a-z0-9]{6,20}$/i
const MENSAJES_ACCION: Record<string, string> = {
  reserva_no_encontrada: 'No encontramos esa reserva. Revisá el link.', reserva_no_modificable: 'Esta reserva ya no se puede cambiar por acá (está cancelada o ya pasó).',
  sin_cambios: 'Elegí algo distinto a lo que ya tenés para modificar.', personas_invalidas: 'Esa cantidad de personas no está permitida.', horario_invalido: 'Ese horario no está disponible.',
  sin_lugar: 'Ya no hay lugar en ese horario. Elegí otro.', modificacion_no_disponible: 'Por ahora esta reserva solo se puede cancelar por acá.', datos_invalidos: 'Revisá los datos.',
  eleccion_no_permitida: 'En esta sede no se puede elegir mesa: la asigna el local.', mesa_invalida: 'Alguna mesa ya no está disponible. Volvé a elegir.', mesas_fijas_no_se_juntan: 'Las mesas fijas no se juntan.', mesa_no_apta: 'Las mesas elegidas no son para esa cantidad de personas.', mesa_ocupada: 'Alguna mesa ya fue reservada. Elegí otra.',
  ubicacion_invalida: 'Esa ubicación no está disponible.', tipo_no_disponible: 'Ese tipo de reserva no está disponible ese día.',
  demasiados_pedidos: 'Hiciste varios pedidos seguidos. Esperá un rato o escribinos por WhatsApp.', sin_whatsapp: 'No pudimos armar el mensaje. Escribinos por WhatsApp.',
}
export type ResultadoAccion = { ok: true; codigo: string; tipo: 'cancelar' | 'modificar'; whatsapp: string; sede: string | null; numero: number } | { ok: false; error: string }

/** Guarda el pedido (todavía no cambia nada) y devuelve el código para el mensaje de WhatsApp con el que se confirma. */
export async function pedirAccionReserva(slug: string, codigo: string, d: { tipo: 'cancelar' | 'modificar'; fecha?: string; hora?: string; personas?: number; ubicacion?: string; mesas?: string[]; web?: string }): Promise<ResultadoAccion> {
  if (!SLUG.test(slug) || !CODIGO_G.test(codigo)) return { ok: false, error: MENSAJES_ACCION.reserva_no_encontrada }
  if (d?.web) return { ok: false, error: 'No pudimos procesar el pedido. Probá de nuevo.' }
  if (d.tipo !== 'cancelar' && d.tipo !== 'modificar') return { ok: false, error: MENSAJES_ACCION.datos_invalidos }
  const r = await rpc('web_reserva_accion_crear', { negocio: slug, codigo, tipo: d.tipo, fecha: d.fecha ?? null, hora: d.hora ?? null, personas: d.personas ?? null, ubicacion: String(d.ubicacion ?? '').slice(0, 60), mesas: Array.isArray(d.mesas) ? d.mesas.slice(0, 6) : [] })
  if (!r) return { ok: false, error: 'No pudimos procesar el pedido. Probá de nuevo.' }
  if (r.ok !== true) return { ok: false, error: MENSAJES_ACCION[String(r.error)] ?? 'No pudimos procesar el pedido. Probá de nuevo.' }
  return { ok: true, codigo: String(r.codigo), tipo: d.tipo, whatsapp: String(r.whatsapp ?? ''), sede: (r.sede as string | null) ?? null, numero: Number(r.numero) }
}
