import 'server-only'
import { createAdminClient } from '@/lib/supabase/server'

export interface IntegracionBC { activo: boolean; tieneClave: boolean }

/** ¿El negocio usa BotConversa? (sin la clave: es lo que ven las pantallas) */
export async function integracionBC(negocioId: string): Promise<IntegracionBC> {
  const { data } = await createAdminClient().from('negocios_integraciones').select('botconversa_activo, botconversa_api_key').eq('negocio_id', negocioId).maybeSingle()
  return { activo: !!data?.botconversa_activo, tieneClave: !!data?.botconversa_api_key }
}

/** Clave de la API de BotConversa del negocio (solo para usar en el servidor), o null si no está activa. */
export async function claveBC(negocioId: string): Promise<string | null> {
  const { data } = await createAdminClient().from('negocios_integraciones').select('botconversa_activo, botconversa_api_key').eq('negocio_id', negocioId).maybeSingle()
  return data?.botconversa_activo && data.botconversa_api_key ? data.botconversa_api_key : null
}
