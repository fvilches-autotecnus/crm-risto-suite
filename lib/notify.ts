import 'server-only'
import { createAdminClient } from '@/lib/supabase/server'
import { ESTADOS_AVISO, ESTADOS_AVISO_POR_DEFECTO, labelTipo, type EstadoAviso } from '@/lib/reservas'

/** A qué herramienta apunta el webhook: define el formato del JSON que se envía. */
export type DestinoWebhook = 'n8n' | 'botconversa'
export const DESTINOS: { value: DestinoWebhook; label: string }[] = [
  { value: 'n8n', label: 'n8n' },
  { value: 'botconversa', label: 'BotConversa' },
]
const esDestino = (v: unknown): v is DestinoWebhook => v === 'n8n' || v === 'botconversa'

export interface ResumenAviso {
  /** El aviso al cliente está listo para usar (hay URL y, si es n8n, secreto). */
  disponible: boolean
  /** Estados para los que se ofrece avisar (se eligen en Configuración). */
  estados: EstadoAviso[]
}

export interface ConfigAviso extends ResumenAviso {
  /** Sedes con configuración propia (estados propios y, si cargaron una, URL propia). Las demás usan la del negocio. */
  porSede: Record<string, ResumenAviso>
}

export interface WebhookSede { destino: DestinoWebhook; url: string; tieneSecreto: boolean; estados: EstadoAviso[] }

export interface WebhookCliente extends ResumenAviso {
  destino: DestinoWebhook
  url: string
  tieneSecreto: boolean
  /** Configuración propia de cada sede que la tiene: destino/url vacíos = usa los del negocio, con estados propios. */
  sedes: Record<string, WebhookSede>
}

interface Crudo { url: string | null; secreto: string | undefined; destino: DestinoWebhook; estados: EstadoAviso[] }
interface FilaSede { sucursal_id: string; destino: string | null; url: string | null; secreto: string | null; estados: string[] }

const filtrarEstados = (v: unknown) => ESTADOS_AVISO.filter((e) => Array.isArray(v) && v.includes(e))
const secretoPara = (destino: DestinoWebhook, propio: string | null | undefined) => propio || (destino === 'n8n' ? process.env.TOQUE_STATUS_WEBHOOK_SECRET : undefined) || undefined

async function leerNegocio(negocioId: string): Promise<Crudo> {
  const { data } = await createAdminClient().from('negocios').select('webhook_aviso_reserva_url, webhook_secret, modulos').eq('id', negocioId).maybeSingle()
  const modulos = (data?.modulos ?? {}) as { avisos_estados?: unknown; webhook_destino?: unknown }
  const destino = esDestino(modulos.webhook_destino) ? modulos.webhook_destino : 'n8n'
  // El secreto general del servidor solo vale para n8n (BotConversa no valida headers: su URL ya lleva el token)
  const estados = Array.isArray(modulos.avisos_estados) ? filtrarEstados(modulos.avisos_estados) : ESTADOS_AVISO_POR_DEFECTO
  return { url: data?.webhook_aviso_reserva_url || null, secreto: secretoPara(destino, data?.webhook_secret), destino, estados }
}

async function leerSedes(negocioId: string): Promise<FilaSede[]> {
  const { data } = await createAdminClient().from('sucursales_webhook').select('sucursal_id, destino, url, secreto, estados').eq('negocio_id', negocioId)
  return (data ?? []) as FilaSede[]
}

/** La sede con fila propia usa sus estados; si además cargó una URL, usa también su URL, destino y secreto (si no, los del negocio). */
function resolver(base: Crudo, fila: FilaSede | undefined): Crudo {
  if (!fila) return base
  const estados = filtrarEstados(fila.estados)
  if (!fila.url) return { ...base, estados }
  const destino = esDestino(fila.destino) ? fila.destino : 'n8n'
  return { url: fila.url, destino, secreto: secretoPara(destino, fila.secreto), estados }
}

async function leer(negocioId: string, sedeId?: string | null): Promise<Crudo> {
  const base = await leerNegocio(negocioId)
  if (!sedeId) return base
  const filas = await leerSedes(negocioId)
  return resolver(base, filas.find((f) => f.sucursal_id === sedeId))
}

// n8n necesita el secreto (su workflow lo valida); BotConversa no lo exige
const listo = (c: Crudo) => !!c.url && (c.destino !== 'n8n' || !!c.secreto)

/** Configuración resumida del aviso al cliente (la ve cualquier usuario del panel: no incluye URL ni secreto). */
export async function configuracionAviso(negocioId: string): Promise<ConfigAviso> {
  const [base, filas] = await Promise.all([leerNegocio(negocioId), leerSedes(negocioId)])
  const porSede: Record<string, ResumenAviso> = {}
  for (const f of filas) { const c = resolver(base, f); porSede[f.sucursal_id] = { disponible: listo(c), estados: c.estados } }
  return { disponible: listo(base), estados: base.estados, porSede }
}

/** Configuración completa para el formulario de Configuración (solo superadmin). */
export async function webhookCliente(negocioId: string): Promise<WebhookCliente> {
  const [base, filas] = await Promise.all([leerNegocio(negocioId), leerSedes(negocioId)])
  const sedes: Record<string, WebhookSede> = {}
  for (const f of filas) sedes[f.sucursal_id] = { destino: esDestino(f.destino) ? f.destino : 'n8n', url: f.url ?? '', tieneSecreto: !!f.secreto, estados: filtrarEstados(f.estados) }
  return { disponible: listo(base), estados: base.estados, destino: base.destino, url: base.url ?? '', tieneSecreto: !!base.secreto, sedes }
}

/** El webhook recibe solo dígitos: sin "+", espacios ni guiones. */
export const soloDigitos = (tel: string | null | undefined) => (tel ?? '').replace(/\D/g, '')

export interface DatosAviso {
  telefono: string | null
  numero: number
  estado: EstadoAviso
  clienteNombre: string | null
  cantidadPersonas: number | null
  fecha: string | null            // AAAA-MM-DD
  hora: string | null             // HH:MM[:SS]
  motivoCancelacion?: string | null
  monto?: number | null
  tipoReserva?: string | null
  ubicacion?: string | null
  observaciones?: string | null
  sede?: string | null
  prueba?: boolean
}

const fechaDMA = (f: string | null) => (f && /^\d{4}-\d{2}-\d{2}$/.test(f) ? f.split('-').reverse().join('-') : '')
const horaHM = (h: string | null) => (h ? h.slice(0, 5) : '')
/** "sábado" a partir de AAAA-MM-DD (se calcula al mediodía UTC para que ninguna zona horaria corra el día). */
const diaSemana = (f: string | null) => {
  const m = f && /^(\d{4})-(\d{2})-(\d{2})$/.exec(f)
  return m ? new Date(Date.UTC(+m[1], +m[2] - 1, +m[3], 12)).toLocaleDateString('es-AR', { weekday: 'long', timeZone: 'UTC' }) : ''
}

/** Arma el JSON según el destino. Para BotConversa, los nombres coinciden con los campos que ya tienen mapeados. */
export function armarPayload(destino: DestinoWebhook, d: DatosAviso): Record<string, unknown> {
  const telefono = soloDigitos(d.telefono)
  const extra = d.prueba ? { prueba: true } : {}
  if (destino === 'botconversa') {
    return {
      evento: 'reserva_estado',
      id_bot: d.numero,
      nombre: d.clienteNombre ?? '',
      telefono,
      estado_reserva: d.estado,
      sede: d.sede ?? '',
      fecha_reserva: fechaDMA(d.fecha),
      dia_semana: diaSemana(d.fecha),
      hora_reserva: horaHM(d.hora),
      cantidad_reserva: d.cantidadPersonas ?? '',
      tipo_reserva: d.tipoReserva ? labelTipo(d.tipoReserva).toUpperCase() : '',
      ubicacion_prefer: d.ubicacion ?? '',
      observaciones: d.observaciones ?? '',
      motivo_cancelacion: d.motivoCancelacion ?? '',
      sena: d.monto ?? 0,
      ...extra,
    }
  }
  // n8n: mismo formato de siempre (el workflow de Corner no cambia), con el teléfono limpio
  return {
    evento: 'reserva_estado',
    telefono,
    numero: d.numero,
    estado: d.estado,
    clienteNombre: d.clienteNombre,
    cantidadPersonas: d.cantidadPersonas,
    fecha: d.fecha,
    diaSemana: diaSemana(d.fecha),
    hora: d.hora,
    sede: d.sede ?? null,
    motivoCancelacion: d.motivoCancelacion ?? null,
    monto: d.monto ?? null,
    ...extra,
  }
}

async function llamar(c: Crudo, payload: Record<string, unknown>): Promise<{ ok: boolean; status?: number }> {
  try {
    const res = await fetch(c.url!, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...(c.secreto ? { 'X-Toque-Secret': c.secreto } : {}) },
      body: JSON.stringify(payload),
      signal: AbortSignal.timeout(8000),
    })
    if (!res.ok) console.error('[webhook cliente] respondió', res.status)
    return { ok: res.ok, status: res.status }
  } catch (e) {
    console.error('[webhook cliente] error llamando al webhook:', e)
    return { ok: false }
  }
}

/**
 * Avisa al cliente (por el webhook del negocio) que su reserva cambió de estado.
 * Solo se llama cuando la persona del equipo elige avisar. Si el webhook está caído, el cambio de estado igual queda guardado.
 */
export async function avisarCambioDeEstado(input: DatosAviso & { negocioId: string; sedeId?: string | null }): Promise<'enviado' | 'no_disponible' | 'fallo'> {
  if (!soloDigitos(input.telefono)) return 'no_disponible'
  const c = await leer(input.negocioId, input.sedeId)
  if (!listo(c) || !c.estados.includes(input.estado)) return 'no_disponible'
  return (await llamar(c, armarPayload(c.destino, input))).ok ? 'enviado' : 'fallo'
}

/** Envía un aviso de ejemplo (marcado con prueba: true) al teléfono indicado, para armar y probar el flujo del otro lado. */
export async function enviarPrueba(negocioId: string, telefono: string, sedeId: string | null, sede: string | null): Promise<{ ok: boolean; status?: number; error?: string }> {
  const c = await leer(negocioId, sedeId)
  if (!listo(c)) return { ok: false, error: c.url ? 'Falta el secreto: n8n lo necesita para validar el aviso' : 'Todavía no cargaste la URL del webhook' }
  const hoy = new Date(Date.now() - 3 * 3600_000).toISOString().slice(0, 10)   // Argentina, UTC-3
  const r = await llamar(c, armarPayload(c.destino, {
    telefono, numero: 0, estado: 'confirmada', clienteNombre: 'PRUEBA Risto Suite', cantidadPersonas: 2, fecha: hoy, hora: '21:00',
    tipoReserva: 'comun', ubicacion: '', sede: sede ?? null, observaciones: 'Aviso de prueba enviado desde Risto Suite', monto: 0, prueba: true,
  }))
  return r.ok ? { ok: true, status: r.status } : { ok: false, status: r.status, error: r.status ? `El webhook respondió ${r.status}` : 'No se pudo conectar con el webhook' }
}
