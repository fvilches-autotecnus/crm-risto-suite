import { createHash, timingSafeEqual } from 'node:crypto'
import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

// Webhook de reservas para bots externos (BotConversa, n8n...). Crea una reserva en el negocio indicado por la URL.
//   POST /api/webhooks/reservas/<slug-del-negocio>
//   Header:  X-Webhook-Secret: <secreto generado en Administración>   (o  Authorization: Bearer <secreto>)
//   Body (JSON o form): titular_reserva | cliente_nombre | nombre, telefono, cantidad | cantidad_personas, fecha (YYYY-MM-DD o DD-MM-YYYY),
//   hora (HH:MM), sede (nombre), tipo_reserva, ubicacion, observaciones, estado (opcional), nombre_whatsapp, id_bot, ocasion.
// El secreto se guarda hasheado (sha256); no hay forma de recuperarlo, solo de generar uno nuevo.

const sinTildes = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '')
const norm = (s: unknown) => sinTildes(String(s ?? '').trim().toLowerCase())
const str = (...v: unknown[]) => { for (const x of v) { const t = String(x ?? '').trim(); if (t) return t } return '' }

function fechaISO(v: unknown): string | null {
  const t = String(v ?? '').trim()
  let y: number, m: number, d: number
  let r = t.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/)
  if (r) { y = +r[1]; m = +r[2]; d = +r[3] } else if ((r = t.match(/^(\d{1,2})[-/.](\d{1,2})[-/.](\d{4})$/))) { d = +r[1]; m = +r[2]; y = +r[3] } else return null
  const dt = new Date(Date.UTC(y, m - 1, d))
  if (y < 2000 || dt.getUTCFullYear() !== y || dt.getUTCMonth() !== m - 1 || dt.getUTCDate() !== d) return null
  return `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`
}

function horaHHMM(v: unknown): string | null {
  const r = String(v ?? '').trim().match(/^(\d{1,2})[:.hH](\d{2})/)
  if (!r || +r[1] > 23 || +r[2] > 59) return null
  return `${r[1].padStart(2, '0')}:${r[2]}`
}

const TIPOS: Record<string, string> = { comun: 'comun', cumpleanos: 'cumpleanos', despedida: 'despedida', 'evento especial': 'evento_especial', evento_especial: 'evento_especial' }

export async function POST(req: Request, { params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params
  const admin = createAdminClient()
  const { data: negocio } = await admin.from('negocios').select('id, activo, webhook_secret, reserva_estado_inicial').eq('slug', slug).maybeSingle()

  // Mismo error para negocio inexistente / sin secreto / secreto incorrecto: no se revela qué negocios existen.
  const dado = req.headers.get('x-webhook-secret') ?? req.headers.get('authorization')?.replace(/^Bearer\s+/i, '') ?? ''
  const hash = createHash('sha256').update(dado).digest()
  const esperado = negocio?.webhook_secret ? Buffer.from(negocio.webhook_secret, 'hex') : null
  if (!negocio || !negocio.activo || !esperado || esperado.length !== hash.length || !timingSafeEqual(hash, esperado)) {
    return NextResponse.json({ ok: false, error: 'no_autorizado' }, { status: 401 })
  }

  let b: Record<string, unknown> = {}
  try {
    const tipo = req.headers.get('content-type') ?? ''
    b = tipo.includes('application/json') ? await req.json() : Object.fromEntries((await req.formData()).entries())
  } catch {
    return NextResponse.json({ ok: false, error: 'cuerpo_invalido' }, { status: 400 })
  }

  const titular = str(b.titular_reserva, b.cliente_nombre, b.nombre, b.nombre_whatsapp)
  const telefono = str(b.telefono, b.cliente_telefono, b.whatsapp).replace(/\D/g, '')
  const cantidad = Number(str(b.cantidad, b.cantidad_personas))
  const faltan = [!titular && 'titular_reserva', !(Number.isInteger(cantidad) && cantidad > 0) && 'cantidad'].filter(Boolean)
  if (faltan.length) return NextResponse.json({ ok: false, error: 'datos_incompletos', faltan }, { status: 422 })

  // Sede: obligatoria si el negocio tiene sedes
  const { data: sedes } = await admin.from('sucursales').select('id, nombre').eq('negocio_id', negocio.id).eq('activa', true)
  let sucursalId: string | null = null
  if (sedes?.length) {
    const pedida = norm(str(b.sede, b.sucursal))
    const hit = sedes.find((x) => norm(x.nombre) === pedida || x.id === str(b.sucursal_id))
    if (!hit) return NextResponse.json({ ok: false, error: 'sede_requerida', sedes: sedes.map((x) => x.nombre) }, { status: 422 })
    sucursalId = hit.id
  }

  const fecha = fechaISO(b.fecha)
  const estadoPedido = norm(b.estado)
  const estado = ['nueva', 'confirmada', 'cancelada'].includes(estadoPedido) ? estadoPedido : negocio.reserva_estado_inicial
  const ub = str(b.ubicacion).toUpperCase()
  const { data: reserva, error } = await admin.from('reservas').insert({
    negocio_id: negocio.id, sucursal_id: sucursalId, cliente_nombre: titular, cliente_telefono: telefono || null,
    fecha, hora: horaHHMM(b.hora), cantidad_personas: cantidad, tipo_reserva: TIPOS[norm(b.tipo_reserva)] ?? 'comun',
    ubicacion: ub || null, observaciones: str(b.observaciones) || null, estado, es_manual: false,
    datos_origen: { origen: 'webhook', fecha_recibida: fecha ? undefined : str(b.fecha) || undefined, nombre_whatsapp: str(b.nombre_whatsapp) || undefined, id_bot: str(b.id_bot, b.suscriber_id, b.subscriber_id) || undefined, ocasion: str(b.ocasion) || undefined },
  }).select('id, numero, estado').single()
  if (error || !reserva) return NextResponse.json({ ok: false, error: 'no_se_pudo_guardar' }, { status: 500 })

  return NextResponse.json({ ok: true, id: reserva.id, numero: reserva.numero, estado: reserva.estado, sede: sedes?.find((x) => x.id === sucursalId)?.nombre ?? null, fecha_a_coordinar: !fecha }, { status: 201 })
}
