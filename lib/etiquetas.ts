import 'server-only'
import { createAdminClient } from '@/lib/supabase/server'
import { leerFlujos, type FlujosSilencio } from '@/lib/silencio'

export interface IntegracionBC { activo: boolean; tieneClave: boolean }

/** ¿El negocio usa BotConversa? (sin la clave: es lo que ven las pantallas) */
export async function integracionBC(negocioId: string): Promise<IntegracionBC> {
  const { data } = await createAdminClient().from('negocios_integraciones').select('botconversa_activo, botconversa_api_key').eq('negocio_id', negocioId).maybeSingle()
  return { activo: !!data?.botconversa_activo, tieneClave: !!data?.botconversa_api_key }
}

/** Ids de los flujos de silencio de BotConversa que el negocio tiene configurados (los que faltan no aparecen). */
export async function flujosSilencio(negocioId: string): Promise<FlujosSilencio> {
  const { data } = await createAdminClient().from('negocios_integraciones').select('botconversa_flujos').eq('negocio_id', negocioId).maybeSingle()
  return leerFlujos(data?.botconversa_flujos)
}

/** Una cuenta de BotConversa (la del negocio o la de una sede), sin la clave: lo que ven las pantallas. */
export interface CuentaBC { activo: boolean; tieneClave: boolean; flujos: FlujosSilencio }
const SIN_CUENTA: CuentaBC = { activo: false, tieneClave: false, flujos: {} }

/** La cuenta de BotConversa del negocio y la propia de cada sede (por id de sede; las sedes sin cuenta propia no aparecen). */
export async function cuentasBC(negocioId: string): Promise<{ negocio: CuentaBC; sedes: Record<string, CuentaBC> }> {
  const admin = createAdminClient()
  const [{ data: n }, { data: s }] = await Promise.all([
    admin.from('negocios_integraciones').select('botconversa_activo, botconversa_api_key, botconversa_flujos').eq('negocio_id', negocioId).maybeSingle(),
    admin.from('sedes_integraciones').select('sucursal_id, botconversa_activo, botconversa_api_key, botconversa_flujos').eq('negocio_id', negocioId),
  ])
  return {
    negocio: n ? { activo: !!n.botconversa_activo, tieneClave: !!n.botconversa_api_key, flujos: leerFlujos(n.botconversa_flujos) } : SIN_CUENTA,
    sedes: Object.fromEntries((s ?? []).map((x) => [x.sucursal_id as string, { activo: !!x.botconversa_activo, tieneClave: !!x.botconversa_api_key, flujos: leerFlujos(x.botconversa_flujos) }])),
  }
}

/** Clave y flujos de la cuenta de BotConversa que corresponde (la de la sede o, con sucursalId null, la del negocio); null si no está activa. Solo servidor. */
export async function cuentaBCUsable(negocioId: string, sucursalId: string | null): Promise<{ clave: string; flujos: FlujosSilencio } | null> {
  const admin = createAdminClient()
  const { data } = sucursalId
    ? await admin.from('sedes_integraciones').select('botconversa_activo, botconversa_api_key, botconversa_flujos').eq('negocio_id', negocioId).eq('sucursal_id', sucursalId).maybeSingle()
    : await admin.from('negocios_integraciones').select('botconversa_activo, botconversa_api_key, botconversa_flujos').eq('negocio_id', negocioId).maybeSingle()
  return data?.botconversa_activo && data.botconversa_api_key ? { clave: data.botconversa_api_key as string, flujos: leerFlujos(data.botconversa_flujos) } : null
}

/** Clave de la API de BotConversa del negocio (solo para usar en el servidor), o null si no está activa. */
export async function claveBC(negocioId: string): Promise<string | null> {
  const { data } = await createAdminClient().from('negocios_integraciones').select('botconversa_activo, botconversa_api_key').eq('negocio_id', negocioId).maybeSingle()
  return data?.botconversa_activo && data.botconversa_api_key ? data.botconversa_api_key : null
}
