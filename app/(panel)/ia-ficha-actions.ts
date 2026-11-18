'use server'

import { getContexto } from '@/lib/context'
import { pedirJSON } from '@/lib/ia'
import { SISTEMA_FICHA, armarDatosCliente, type FichaIA } from '@/lib/ia-ficha'
import { CUPOS, devolverCupo, reservarCupo } from '@/lib/ia-cupo'
import { createAdminClient } from '@/lib/supabase/server'

export type FichaResultado =
  | { ok: true; ficha: FichaIA; generado: string; reutilizada: boolean }
  | { ok: false; error: string }

const texto = (v: unknown, max: number) => (typeof v === 'string' ? v.replace(/\s+/g, ' ').trim().slice(0, max) : '')
const lista = (v: unknown, max: number, largo: number) => (Array.isArray(v) ? v.map((x) => texto(x, largo)).filter(Boolean).slice(0, max) : [])

/**
 * Arma (o devuelve la guardada) la ficha con IA de un cliente. Si los datos del cliente no cambiaron desde la última vez, devuelve la guardada
 * sin llamar a OpenAI y sin gastar del tope diario. Si cambiaron, gasta un lugar del tope del negocio.
 */
export async function fichaDeCliente(clienteId: string): Promise<FichaResultado> {
  const ctx = await getContexto()
  if (!ctx.modulosActivos.clientes) return { ok: false, error: 'Los clientes no están habilitados en este negocio.' }
  if (!/^[0-9a-f-]{36}$/i.test(clienteId)) return { ok: false, error: 'Cliente no válido.' }
  const datos = await armarDatosCliente(ctx, clienteId)
  if (!datos) return { ok: false, error: 'No se encontró el cliente.' }
  const admin = createAdminClient()
  const { data: previa } = await admin.from('ia_fichas_cliente').select('huella, ficha, generado_en').eq('cliente_id', clienteId).eq('negocio_id', ctx.negocio.id).maybeSingle()
  if (previa && previa.huella === datos.huella) return { ok: true, ficha: previa.ficha as FichaIA, generado: previa.generado_en as string, reutilizada: true }

  const uso = await reservarCupo(ctx.negocio.id, 'ficha_cliente', ctx.userId, { cliente_id: clienteId })
  if (!uso.ok) return { ok: false, error: `Ya se usaron las ${CUPOS.ficha_cliente} fichas con IA de hoy. Mañana se renuevan.` }
  const r = await pedirJSON(SISTEMA_FICHA, `Negocio: ${ctx.negocio.nombre}.\n<datos>\n${datos.texto}\n</datos>`, { temperatura: 0.2, maxTokens: 700, esperaMs: 60_000 })
  if (!r.ok) { await devolverCupo(uso.id); return r }
  const ficha: FichaIA = { resumen: texto(r.json.resumen, 600), claves: lista(r.json.claves, 5, 220), alertas: lista(r.json.alertas, 3, 220) }
  if (!ficha.resumen) { await devolverCupo(uso.id); return { ok: false, error: 'La IA devolvió una respuesta incompleta. Probá de nuevo.' } }
  const generado = new Date().toISOString()
  await admin.from('ia_fichas_cliente').upsert({ cliente_id: clienteId, negocio_id: ctx.negocio.id, huella: datos.huella, ficha, generado_en: generado })
  return { ok: true, ficha, generado, reutilizada: false }
}
