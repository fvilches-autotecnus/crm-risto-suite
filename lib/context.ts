import 'server-only'
import { cache } from 'react'
import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'

export type Rol = 'owner' | 'admin' | 'encargado' | 'staff' | 'solo_lectura'

export interface Negocio {
  id: string
  nombre: string
  slug: string
  whatsapp_nro: string | null
  zona_horaria: string
  aforo_maximo_reservas: number | null
  bot_activo: boolean
  modulos: { pedidos?: boolean; reservas?: boolean; crm?: boolean }
}

export interface Contexto {
  userId: string
  nombreUsuario: string
  esSuperadmin: boolean
  negocios: Negocio[]
  negocio: Negocio
  rol: Rol | 'superadmin'
  puedeEscribir: boolean
  puedeAdministrar: boolean
  puedeApagarBot: boolean
  supabase: Awaited<ReturnType<typeof createClient>>
}

export const NEGOCIO_COOKIE = 'rs_negocio'

/** Usuario + negocio activo + rol. Las páginas del panel arrancan siempre de acá. */
export const getContexto = cache(async (): Promise<Contexto> => {
  const supabase = await createClient()
  const { data: claims } = await supabase.auth.getClaims()
  const userId = claims?.claims?.sub
  if (!userId) redirect('/login')

  // En paralelo: RLS ya limita negocios/membresías a los del usuario (o todos si es superadmin)
  const [{ data: perfil }, { data: negocios }, { data: membresias }] = await Promise.all([
    supabase.from('perfiles').select('nombre, usuario, es_superadmin, activo').eq('id', userId).maybeSingle(),
    supabase.from('negocios').select('id, nombre, slug, whatsapp_nro, zona_horaria, aforo_maximo_reservas, bot_activo, modulos').eq('activo', true).order('nombre'),
    supabase.from('membresias').select('negocio_id, rol').eq('user_id', userId).eq('activo', true),
  ])
  if (!perfil || !perfil.activo || !negocios?.length) {
    await supabase.auth.signOut()
    redirect('/login')
  }

  const cookieStore = await cookies()
  const elegido = cookieStore.get(NEGOCIO_COOKIE)?.value
  const negocio = (negocios.find((n) => n.id === elegido) ?? negocios[0]) as Negocio

  const rol: Rol | 'superadmin' = perfil.es_superadmin
    ? 'superadmin'
    : ((membresias?.find((m) => m.negocio_id === negocio.id)?.rol as Rol | undefined) ?? 'solo_lectura')

  return {
    userId,
    nombreUsuario: perfil.nombre,
    esSuperadmin: perfil.es_superadmin,
    negocios: negocios as Negocio[],
    negocio,
    rol,
    puedeEscribir: rol !== 'solo_lectura',
    puedeAdministrar: rol === 'superadmin' || rol === 'owner' || rol === 'admin',
    puedeApagarBot: rol === 'superadmin' || rol === 'owner' || rol === 'admin' || rol === 'encargado',
    supabase,
  }
})
