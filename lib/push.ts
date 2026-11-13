import 'server-only'
import webpush from 'web-push'
import { createAdminClient } from '@/lib/supabase/server'
import { diaMes } from '@/lib/fechas'

/**
 * Notificaciones push de la app instalada (solo superadmin, por ahora).
 * La base avisa a /api/push/evento cuando entra una reserva o un pedido; acá se arma el texto y se envía a los dispositivos
 * de los superadmin que activaron los avisos y no apagaron ese negocio.
 */
export interface AvisoPush { titulo: string; cuerpo: string; url: string; tag: string; prueba?: boolean }
export type TablaPush = 'reservas' | 'pedidos'

/** Cuánto tiempo guarda el servicio de push un aviso si el dispositivo está apagado: pasada una hora ya no sirve. */
const VIGENCIA_S = 3600
/** Lo que se carga a mano, lo sincronizado y lo viejo no se avisa (la base ya lo filtra; acá se vuelve a comprobar). */
const MAX_ANTIGUEDAD_MS = 15 * 60_000
const SUBJECT_DEFECTO = 'https://crm.ristosuite.app'

let configurado = false
/** Devuelve false si faltan las claves VAPID (sin ellas no se puede enviar). */
export function configurarVapid(): boolean {
  if (configurado) return true
  const publica = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY, privada = process.env.VAPID_PRIVATE_KEY
  if (!publica || !privada) return false
  webpush.setVapidDetails(process.env.VAPID_SUBJECT || SUBJECT_DEFECTO, publica, privada)
  configurado = true
  return true
}

const corto = (t: string | null | undefined, n: number) => { const s = (t ?? '').replace(/\s+/g, ' ').trim(); return s.length > n ? s.slice(0, n - 1) + '…' : s }

interface FilaReserva { id: string; negocio_id: string; numero: number; numero_sede: number | null; cliente_nombre: string | null; cantidad_personas: number | null; fecha: string | null; hora: string | null; sucursal_id: string | null; es_manual: boolean; eliminado_en: string | null; creado_en: string; datos_origen: Record<string, unknown> | null }
interface FilaPedido { id: string; negocio_id: string; numero: number; nombre: string; tipo: string; total: number; origen: string; creado_en: string }

/** El aviso de una reserva o pedido ya guardado (con la clave de servicio: lo llama la base, no una persona). Null si no corresponde avisar. */
export async function armarAviso(tabla: TablaPush, id: string): Promise<{ negocioId: string; aviso: AvisoPush } | null> {
  const sb = createAdminClient()
  const reciente = (iso: string) => Date.now() - new Date(iso).getTime() <= MAX_ANTIGUEDAD_MS
  if (tabla === 'reservas') {
    const { data } = await sb.from('reservas').select('id, negocio_id, numero, numero_sede, cliente_nombre, cantidad_personas, fecha, hora, sucursal_id, es_manual, eliminado_en, creado_en, datos_origen').eq('id', id).maybeSingle()
    const r = data as FilaReserva | null
    if (!r || r.es_manual || r.eliminado_en || !reciente(r.creado_en) || (r.datos_origen && 'sync_en' in r.datos_origen)) return null
    const [negocio, sede] = await Promise.all([nombreNegocio(r.negocio_id), r.sucursal_id ? nombreSede(r.sucursal_id) : null])
    const cuando = r.fecha ? `${diaMes(r.fecha)}${r.hora ? ' ' + r.hora.slice(0, 5) : ''}` : 'a coordinar'
    return {
      negocioId: r.negocio_id,
      aviso: {
        titulo: `Nueva reserva · ${negocio}`,
        cuerpo: [`#${r.numero_sede ?? r.numero}`, corto(r.cliente_nombre, 40) || 'Sin nombre', r.cantidad_personas ? `${r.cantidad_personas} ${r.cantidad_personas === 1 ? 'persona' : 'personas'}` : null, cuando, sede].filter(Boolean).join(' · '),
        url: `/api/push/ir?n=${r.negocio_id}&a=reservas`,
        tag: `reserva:${r.id}`,
      },
    }
  }
  const { data } = await sb.from('pedidos').select('id, negocio_id, numero, nombre, tipo, total, origen, creado_en').eq('id', id).maybeSingle()
  const p = data as FilaPedido | null
  if (!p || p.origen === 'manual' || !reciente(p.creado_en)) return null
  const negocio = await nombreNegocio(p.negocio_id)
  return {
    negocioId: p.negocio_id,
    aviso: {
      titulo: `Nuevo pedido · ${negocio}`,
      cuerpo: [`#${p.numero}`, p.tipo === 'delivery' ? 'Delivery' : p.tipo === 'mesa' ? 'Mesa' : 'Retiro', corto(p.nombre, 40), `$ ${Number(p.total).toLocaleString('es-AR')}`].join(' · '),
      url: `/api/push/ir?n=${p.negocio_id}&a=pedidos`,
      tag: `pedido:${p.id}`,
    },
  }
}

async function nombreNegocio(id: string): Promise<string> {
  const { data } = await createAdminClient().from('negocios').select('nombre').eq('id', id).maybeSingle()
  return (data?.nombre as string | undefined) ?? 'Negocio'
}
async function nombreSede(id: string): Promise<string | null> {
  const { data } = await createAdminClient().from('sucursales').select('nombre').eq('id', id).maybeSingle()
  return (data?.nombre as string | undefined) ?? null
}

interface Suscripcion { id: string; usuario_id: string; endpoint: string; p256dh: string; auth: string }

/** Manda el aviso a esos dispositivos. Los que ya no existen (404/410) se borran; los que fallan por otra causa suman un fallo. Devuelve cuántos recibieron el aviso. */
export async function enviarAviso(subs: Suscripcion[], aviso: AvisoPush): Promise<number> {
  if (!subs.length || !configurarVapid()) return 0
  const sb = createAdminClient()
  const cuerpo = JSON.stringify(aviso)
  const resultados = await Promise.allSettled(subs.map((s) => webpush.sendNotification({ endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } }, cuerpo, { TTL: VIGENCIA_S, urgency: 'high', timeout: 8000 })))
  const ok: string[] = [], muertas: string[] = [], falla: Suscripcion[] = []
  resultados.forEach((r, i) => {
    if (r.status === 'fulfilled') ok.push(subs[i].id)
    else { const code = (r.reason as { statusCode?: number })?.statusCode; if (code === 404 || code === 410) muertas.push(subs[i].id); else falla.push(subs[i]) }
  })
  await Promise.allSettled([
    ok.length ? sb.from('push_suscripciones').update({ ultimo_envio_en: new Date().toISOString(), fallos: 0 }).in('id', ok) : null,
    muertas.length ? sb.from('push_suscripciones').delete().in('id', muertas) : null,
    // un dispositivo que falla muchas veces seguidas (sin ser "ya no existe") se da de baja para no insistir para siempre
    ...falla.map(async (s) => {
      const { data } = await sb.from('push_suscripciones').select('fallos').eq('id', s.id).maybeSingle()
      const fallos = ((data?.fallos as number | undefined) ?? 0) + 1
      if (fallos >= 10) await sb.from('push_suscripciones').delete().eq('id', s.id)
      else await sb.from('push_suscripciones').update({ fallos }).eq('id', s.id)
    }),
  ])
  return ok.length
}

/** Dispositivos que deben recibir el aviso de ese negocio: superadmin activos, con ese negocio encendido. */
export async function destinatarios(negocioId: string): Promise<Suscripcion[]> {
  const sb = createAdminClient()
  const [{ data: admins }, { data: apagados }] = await Promise.all([
    sb.from('perfiles').select('id').eq('es_superadmin', true).eq('activo', true),
    sb.from('push_negocios_apagados').select('usuario_id').eq('negocio_id', negocioId),
  ])
  const sinAvisos = new Set((apagados ?? []).map((a) => a.usuario_id as string))
  const ids = (admins ?? []).map((a) => a.id as string).filter((id) => !sinAvisos.has(id))
  if (!ids.length) return []
  const { data } = await sb.from('push_suscripciones').select('id, usuario_id, endpoint, p256dh, auth').in('usuario_id', ids)
  return (data ?? []) as Suscripcion[]
}
