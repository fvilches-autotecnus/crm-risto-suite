import 'server-only'
import type { getContexto } from '@/lib/context'
import { sumarDias } from '@/lib/fechas'

/**
 * Panel de interacciones de campañas (solo superadmin): una "conversación" por teléfono con lo que se le envió en las campañas
 * (campanas_envios + avisos de entrega de whatsapp_eventos) y lo que el cliente contestó (mensajes entrantes).
 * Todo se calcula en memoria con los permisos de quien mira (RLS); el volumen de una campaña es de cientos de filas.
 * Una respuesta es cualquier mensaje entrante; las reacciones con emoji se muestran pero no cuentan como respuesta.
 */
type Ctx = Awaited<ReturnType<typeof getContexto>>

export const FILTROS_CHAT = [
  { v: 'todos', l: 'Todos' },
  { v: 'respondieron', l: 'Respondieron' },
  { v: 'leidos', l: 'Leídos sin respuesta' },
  { v: 'fallidos', l: 'No entregados' },
] as const
export type FiltroChat = (typeof FILTROS_CHAT)[number]['v']

export type EstadoEntrega = 'leido' | 'entregado' | 'fallido' | 'enviado' | 'sin_seguimiento'

export interface BurbujaEnvio {
  tipo: 'envio'; id: string; cuando: string; campana: string; detalle: string | null; estado: EstadoEntrega
  entregadoEn: string | null; leidoEn: string | null; fallo: string | null
}
export interface BurbujaEntrante { tipo: 'entrante'; id: string; cuando: string; clase: string; texto: string | null }
export type Burbuja = BurbujaEnvio | BurbujaEntrante

export interface ChatResumen {
  tel10: string; telefono: string; nombre: string | null; clienteId: string | null; campanaIds: string[]
  ultimaCampana: string | null; estado: EstadoEntrega | null; envios: number
  entrantes: number; respondio: boolean; ultimaActividad: string; vistaPrevia: string; deQuien: 'cliente' | 'campana'
}

interface Fila { id: string; campana_id: string; cliente_id: string | null; nombre: string | null; telefono: string | null; enviado_en: string; wamid: string | null; detalle: string | null }
interface Ev { wamid: string; estado: string; ocurrido_en: string; error: string | null }
interface Msg { id: string; telefono: string; tel10: string; estado: string; ocurrido_en: string; texto: string | null }

const t10 = (t: string | null | undefined) => String(t ?? '').replace(/\D/g, '').slice(-10)
const ts = (iso: string) => Date.parse(iso)

export const textoEntrante = (m: { clase: string; texto: string | null }) => {
  if (m.clase === 'reaction') return m.texto ? `Reaccionó con ${m.texto}` : 'Reaccionó'
  if (m.texto) return m.texto
  const t: Record<string, string> = { image: '📷 Imagen', audio: '🎤 Audio', video: '🎞️ Video', document: '📄 Documento', sticker: 'Sticker', location: '📍 Ubicación', contacts: 'Contacto' }
  return t[m.clase] ?? `[${m.clase}]`
}

/** Carga y arma todo lo necesario (lista + hilos) de los últimos `dias` días. */
export async function cargarChatsCampanas(ctx: Ctx, dias: number) {
  const { supabase, negocio } = ctx
  const desde = `${sumarDias(new Intl.DateTimeFormat('en-CA', { timeZone: negocio.zona_horaria }).format(new Date()), -dias)}T00:00:00-03:00`
  const [{ data: env }, { data: camp }, { data: evs }, { data: msgs }] = await Promise.all([
    supabase.from('campanas_envios').select('id, campana_id, cliente_id, nombre, telefono, enviado_en, wamid, detalle').eq('negocio_id', negocio.id).neq('estado', 'fallido').not('telefono', 'is', null).gte('enviado_en', desde).order('enviado_en', { ascending: true }).limit(30000),
    supabase.from('campanas').select('id, nombre').eq('negocio_id', negocio.id),
    supabase.from('whatsapp_eventos').select('wamid, estado, ocurrido_en, error').eq('negocio_id', negocio.id).eq('tipo', 'estado').gte('ocurrido_en', desde).limit(100000),
    supabase.from('whatsapp_eventos').select('id, telefono, tel10, estado, ocurrido_en, texto').eq('negocio_id', negocio.id).eq('tipo', 'mensaje').gte('ocurrido_en', desde).order('ocurrido_en', { ascending: true }).limit(30000),
  ])
  const nombreCampana = new Map((camp ?? []).map((c) => [c.id as string, c.nombre as string]))
  const porWamid = new Map<string, Ev[]>()
  for (const e of (evs ?? []) as Ev[]) { const l = porWamid.get(e.wamid); if (l) l.push(e); else porWamid.set(e.wamid, [e]) }

  const estadoDe = (wamid: string | null): { estado: EstadoEntrega; entregadoEn: string | null; leidoEn: string | null; fallo: string | null } => {
    if (!wamid) return { estado: 'sin_seguimiento', entregadoEn: null, leidoEn: null, fallo: null }
    const l = porWamid.get(wamid) ?? []
    const primero = (...ee: string[]) => l.filter((x) => ee.includes(x.estado)).map((x) => x.ocurrido_en).sort()[0] ?? null
    const leidoEn = primero('read'), entregadoEn = primero('delivered', 'read'), fallo = l.find((x) => x.estado === 'failed')?.error ?? (l.some((x) => x.estado === 'failed') ? 'No se pudo entregar' : null)
    return { estado: leidoEn ? 'leido' : entregadoEn ? 'entregado' : fallo ? 'fallido' : 'enviado', entregadoEn, leidoEn, fallo }
  }

  const envios = (env ?? []) as Fila[], mensajes = (msgs ?? []) as Msg[]
  const tels = new Set<string>([...envios.map((e) => t10(e.telefono)), ...mensajes.map((m) => m.tel10)].filter(Boolean))
  const enviosPorTel = new Map<string, Fila[]>(), msgsPorTel = new Map<string, Msg[]>()
  for (const e of envios) { const k = t10(e.telefono); const l = enviosPorTel.get(k); if (l) l.push(e); else enviosPorTel.set(k, [e]) }
  for (const m of mensajes) { const l = msgsPorTel.get(m.tel10); if (l) l.push(m); else msgsPorTel.set(m.tel10, [m]) }

  const chats: ChatResumen[] = []
  for (const k of tels) {
    const es = enviosPorTel.get(k) ?? [], ms = msgsPorTel.get(k) ?? []
    const ultEnvio = es[es.length - 1], ultMsg = ms[ms.length - 1]
    const ultEst = ultEnvio ? estadoDe(ultEnvio.wamid).estado : null
    const entrantesReales = ms.filter((m) => m.estado !== 'reaction')
    const msgMasNuevo = !!ultMsg && (!ultEnvio || ts(ultMsg.ocurrido_en) > ts(ultEnvio.enviado_en))
    chats.push({
      tel10: k, telefono: ultEnvio?.telefono ?? ultMsg?.telefono ?? k,
      nombre: [...es].reverse().find((e) => e.nombre)?.nombre ?? null, clienteId: [...es].reverse().find((e) => e.cliente_id)?.cliente_id ?? null,
      campanaIds: [...new Set(es.map((e) => e.campana_id))],
      ultimaCampana: ultEnvio ? nombreCampana.get(ultEnvio.campana_id) ?? null : null, estado: ultEst, envios: es.length,
      entrantes: ms.length, respondio: entrantesReales.length > 0,
      ultimaActividad: msgMasNuevo ? ultMsg.ocurrido_en : ultEnvio.enviado_en,
      vistaPrevia: msgMasNuevo ? textoEntrante({ clase: ultMsg.estado, texto: ultMsg.texto }) : `Campaña «${nombreCampana.get(ultEnvio.campana_id) ?? 'Campaña'}»`,
      deQuien: msgMasNuevo ? 'cliente' : 'campana',
    })
  }
  chats.sort((a, b) => b.ultimaActividad.localeCompare(a.ultimaActividad))

  const hilo = (k: string): Burbuja[] => {
    const b: Burbuja[] = []
    for (const e of enviosPorTel.get(k) ?? []) { const s = estadoDe(e.wamid); b.push({ tipo: 'envio', id: e.id, cuando: e.enviado_en, campana: nombreCampana.get(e.campana_id) ?? 'Campaña', detalle: e.detalle, ...s }) }
    for (const m of msgsPorTel.get(k) ?? []) b.push({ tipo: 'entrante', id: m.id, cuando: m.ocurrido_en, clase: m.estado, texto: m.texto })
    return b.sort((x, y) => ts(x.cuando) - ts(y.cuando))
  }
  return { chats, hilo, campanas: (camp ?? []) as { id: string; nombre: string }[], enviosPorTel }
}

export function filtrarChats(chats: ChatResumen[], filtro: FiltroChat, q: string, campana = ''): ChatResumen[] {
  const busca = q.trim().toLowerCase()
  return chats.filter((c) => {
    if (campana && !c.campanaIds.includes(campana)) return false
    if (filtro === 'respondieron' && !c.respondio) return false
    if (filtro === 'leidos' && !(c.estado === 'leido' && !c.respondio)) return false
    if (filtro === 'fallidos' && c.estado !== 'fallido') return false
    if (busca && !((c.nombre ?? '').toLowerCase().includes(busca) || c.telefono.includes(busca.replace(/\D/g, '') || '\u0000'))) return false
    return true
  })
}
