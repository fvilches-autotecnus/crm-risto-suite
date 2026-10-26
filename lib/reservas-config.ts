/** Parámetros de reservas que configura el dueño desde Configuración (nada de esto requiere tocar código). */

export interface Turno { nombre: string; hora: string }
export interface ConfigReservas { alerta_aforo_pct: number; turnos: Turno[]; estados_bloquean: string[] }
export interface TipoReservaCfg { clave: string; etiqueta: string; activo: boolean; orden: number }

export const CONFIG_RESERVAS_DEFECTO: ConfigReservas = {
  alerta_aforo_pct: 90,
  turnos: [{ nombre: 'Almuerzo', hora: '13:00' }, { nombre: 'Cena', hora: '21:00' }],
  estados_bloquean: ['confirmada', 'pendiente_pago', 'revisar_pago'],
}

/** Estados que pueden bloquear una mesa en el sitio de reservas. */
export const ESTADOS_BLOQUEO = [
  { value: 'nueva', label: 'Nueva', ayuda: 'Cualquier solicitud ya registrada, aunque nadie la haya revisado.' },
  { value: 'confirmada', label: 'Confirmada', ayuda: 'El local la aceptó.' },
  { value: 'pendiente_pago', label: 'Pendiente de pago', ayuda: 'Se pidió seña y falta pagar.' },
  { value: 'revisar_pago', label: 'Revisar pago', ayuda: 'El cliente mandó el comprobante.' },
] as const

/** Texto de la clave de un tipo a partir de su nombre ("Cena show" → cena_show). */
export const claveDeTipo = (nombre: string) =>
  nombre.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '').slice(0, 40) || 'tipo'

// ─────────────────────────── mensaje de WhatsApp del sitio de reservas

/** Mensaje que arma el sitio para que el cliente lo envíe. Cada línea con una {variable} vacía se omite. Tiene que llevar {codigo}. */
export const PLANTILLA_WA_DEFECTO = `SOLICITUD DE RESERVA - {negocio}
Código: {codigo}

Nombre: {nombre}
Sede: {sede}
Día: {dia}
Hora: {hora}
Personas: {personas}
Ubicación: {ubicacion}
Tipo: {tipo}
Mesa: {mesa}
Cumpleaños: {cumple}
Comentarios: {comentarios}`

export const VARIABLES_WA = [
  ['negocio', 'nombre del local'], ['codigo', 'código de la solicitud (obligatorio)'], ['nombre', 'nombre del cliente'], ['sede', 'sede elegida (vacío si el negocio no tiene sedes)'], ['dia', 'día elegido'], ['hora', 'horario'],
  ['personas', 'cantidad de personas'], ['ubicacion', 'ubicación'], ['tipo', 'tipo de reserva'], ['mesa', 'mesa elegida o “que la elija el local”'], ['cumple', 'día y mes de cumpleaños (si lo dejó)'], ['comentarios', 'comentarios del cliente'],
] as const

export function renderPlantillaWA(plantilla: string, vars: Record<string, string>): string {
  const lineas = plantilla.replace(/\r\n/g, '\n').split('\n').flatMap((l) => {
    const usadas = [...l.matchAll(/\{([a-z_]+)\}/g)].map((m) => m[1])
    if (usadas.some((k) => !(vars[k] ?? '').trim())) return []   // la línea depende de un dato vacío: se omite
    return [l.replace(/\{([a-z_]+)\}/g, (_, k: string) => vars[k] ?? '')]
  })
  // sin renglones vacíos repetidos ni al principio / al final
  return lineas.filter((l, i, a) => l.trim() !== '' || (i > 0 && i < a.length - 1 && a[i - 1].trim() !== '')).join('\n').trim()
}

// ─────────────────────────── mensajes que el bot le contesta al cliente

export interface MensajeBotDef { clave: string; titulo: string; cuando: string; variables: string[] }
export const MENSAJES_BOT: MensajeBotDef[] = [
  { clave: 'reserva_web_recibida', titulo: 'Reserva recibida', cuando: 'El cliente mandó su solicitud de reserva desde el sitio y se registró.', variables: ['nombre', 'numero', 'resumen', 'extra'] },
  { clave: 'reserva_web_ya_registrada', titulo: 'Reserva ya registrada', cuando: 'El cliente reenvía el mismo mensaje y su reserva ya estaba registrada.', variables: ['numero', 'resumen'] },
  { clave: 'reserva_web_no_encontrada', titulo: 'No se encontró la solicitud', cuando: 'El código no existe, venció o el mensaje no lo trae. El chat se deriva a una persona.', variables: ['validez_horas'] },
  { clave: 'reserva_web_aviso_mesa', titulo: 'Aviso: la mesa se ocupó', cuando: 'Se agrega al mensaje de “reserva recibida” si la mesa elegida se ocupó mientras el cliente escribía.', variables: [] },
  { clave: 'reserva_web_aviso_horario', titulo: 'Aviso: el horario se completó', cuando: 'Se agrega al mensaje de “reserva recibida” si el horario se completó mientras el cliente escribía.', variables: [] },
  { clave: 'reserva_web_error', titulo: 'Error al registrar', cuando: 'Algo falló al registrar la solicitud. El chat se deriva a una persona.', variables: [] },
]
