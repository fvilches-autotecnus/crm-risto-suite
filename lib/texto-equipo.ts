// Mensaje de aviso para el EQUIPO del local ("qué acaba de pasar con esta reserva"), listo para reenviar por WhatsApp.
// Viaja como un campo más (`notificacion_equipo`) del webhook que el CRM manda a BotConversa / n8n. La base arma el mismo texto
// para las reservas nuevas, modificadas y canceladas por el cliente (función app.texto_equipo): si se cambia acá, cambiarlo allá.

export type EventoEquipo = 'nueva' | 'modificada' | 'cancelada_cliente' | 'confirmada' | 'pendiente_pago' | 'revisar_pago' | 'cancelada' | 'no_show'

const TITULOS: Record<EventoEquipo, [string, string]> = {
  nueva: ['🟢', 'NUEVA RESERVA'],
  modificada: ['🟡', 'RESERVA MODIFICADA'],
  cancelada_cliente: ['🔴', 'RESERVA CANCELADA POR EL CLIENTE'],
  confirmada: ['✅', 'RESERVA CONFIRMADA'],
  pendiente_pago: ['💰', 'PENDIENTE DE PAGO'],
  revisar_pago: ['🧾', 'REVISAR PAGO'],
  cancelada: ['🔴', 'RESERVA CANCELADA'],
  no_show: ['⚪', 'NO SE PRESENTÓ'],
}
const ESTADOS: Record<string, string> = {
  nueva: 'Nueva · falta confirmar', confirmada: 'Confirmada', pendiente_pago: 'Pendiente de pago', revisar_pago: 'Revisar pago', cancelada: 'Cancelada', no_show: 'No se presentó',
}
const DIAS = ['domingo', 'lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado']

export interface DatosEquipo {
  evento: EventoEquipo
  estado: string
  numero: number | string
  nombre: string | null
  sede?: string | null
  fecha: string | null          // AAAA-MM-DD
  hora: string | null           // HH:MM[:SS]
  personas: number | null
  ubicacion?: string | null
  tipo?: string | null          // etiqueta del tipo; "Común" no se muestra
  telefono?: string | null
  monto?: number | null         // seña
  observaciones?: string | null
  motivo?: string | null        // motivo de la cancelación
  antes?: string | null         // cómo era antes (reservas modificadas)
}

const limpiarObs = (t: string | null | undefined) => (t ?? '').replace(/^\s*\[Sitio de prueba\]\s*/i, '').replace(/\s+/g, ' ').trim().slice(0, 280)
const dma = (f: string) => f.split('-').reverse().join('-')
const diaNombre = (f: string) => { const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(f); return m ? DIAS[new Date(Date.UTC(+m[1], +m[2] - 1, +m[3], 12)).getUTCDay()] : '' }
const mayus = (t: string) => t.charAt(0).toUpperCase() + t.slice(1)

export function textoEquipo(d: DatosEquipo): string {
  const lineas: string[] = []
  const [emoji, titulo] = TITULOS[d.evento]
  lineas.push(`${emoji} *${titulo}*${d.sede ? ` · ${d.sede}` : ''}`)
  lineas.push(`#${d.numero} · *${(d.nombre ?? 'Sin nombre').trim() || 'Sin nombre'}*`)
  if (d.fecha) lineas.push(`📅 ${mayus(diaNombre(d.fecha))} ${dma(d.fecha)}${d.hora ? ` · ${d.hora.slice(0, 5)}` : ''}`)
  if (d.personas) lineas.push(`👥 ${d.personas} persona${d.personas === 1 ? '' : 's'}`)
  if (d.ubicacion?.trim()) lineas.push(`📍 ${d.ubicacion.trim()}`)
  if (d.tipo?.trim() && d.tipo.trim().toLowerCase() !== 'común' && d.tipo.trim().toLowerCase() !== 'comun') lineas.push(`🏷️ ${d.tipo.trim()}`)
  const tel = (d.telefono ?? '').replace(/\D/g, '')
  if (tel) lineas.push(`📞 +${tel}`)
  if (d.monto && d.monto > 0) lineas.push(`💲 Seña: $${Math.round(d.monto).toLocaleString('es-AR')}`)
  if (d.motivo?.trim()) lineas.push(`⚠️ Motivo: ${d.motivo.trim()}`)
  if (d.antes?.trim()) lineas.push(`↩️ Antes: ${d.antes.trim()}`)
  const obs = limpiarObs(d.observaciones)
  if (obs) lineas.push(`📝 ${obs}`)
  lineas.push(`Estado: *${ESTADOS[d.estado] ?? d.estado}*`)
  return lineas.join('\n')
}
