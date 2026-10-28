import 'server-only'
import { cache } from 'react'
import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { TZ_AR } from '@/lib/fechas'
import { aplicarSede, resolverModulos, unionModulos, type ModulosActivos } from '@/lib/modulos'
import { CONFIG_SEDE_VACIA, type ConfigSede } from '@/lib/config-sedes'

export type Rol = 'owner' | 'admin' | 'encargado' | 'staff' | 'solo_lectura'

export interface Negocio {
  id: string
  nombre: string
  slug: string
  whatsapp_nro: string | null
  zona_horaria: string
  aforo_maximo_reservas: number | null
  bot_activo: boolean
  modulos: { mesas?: boolean; fidelizacion?: boolean; shows?: boolean; carta?: boolean; clientes?: boolean; consultas?: boolean; pedidos?: boolean; reservas?: boolean; crm?: boolean; apagado_bot?: boolean; metricas?: boolean; cumpleanos?: boolean; vouchers?: boolean; resenas?: boolean; conversaciones?: boolean; derivadas?: boolean; campanas?: boolean }
}

export interface Sede {
  id: string
  nombre: string
  whatsapp_nro: string | null
  aforo_maximo_reservas: number | null
  activa: boolean
  direccion: string | null
  telefono: string | null
  maps_url: string | null
  numeracion_propia: boolean
  alias_web: string | null   // dirección propia del sitio de reservas de la sede (/reservar/<alias>)
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
  /** Módulos habilitados para lo que el usuario está viendo: los del negocio, menos los que apagó la sede elegida (con varias sedes a la vista, los que usa alguna). */
  modulosActivos: ModulosActivos
  /** Módulos del negocio (lo que contrató), sin tener en cuenta las sedes. */
  modulosNegocio: ModulosActivos
  /** Lo propio de cada sede (módulos que apagó, ajustes del sitio, parámetros, tipos y mensajes), por id de sede. Lo que no figura se hereda del negocio. */
  configSedes: Record<string, ConfigSede>
  tieneApagadoBot: boolean // el negocio tiene habilitado el botón de apagado (lo configura Autotecnus)
  puedeApagarBot: boolean
  /** Sedes del negocio a las que el usuario tiene alcance (todas si no tiene restricción). Vacío = negocio de una sola sede. */
  sedes: Sede[]
  /** Todas las sedes del negocio, activas o no (para mostrar nombres de datos viejos). */
  sedesTodas: Sede[]
  /** Sedes que el usuario puede administrar en Configuración (su alcance), incluidas las desactivadas. */
  sedesGestion: Sede[]
  /** Sede elegida en el selector (null = todas las del alcance). Si el usuario tiene una sola sede, es esa. */
  sede: Sede | null
  /** El usuario no tiene restricción de sedes (ve todo el negocio, incluido lo que no tiene sede). */
  sinRestriccionSede: boolean
  supabase: Awaited<ReturnType<typeof createClient>>
}

export const NEGOCIO_COOKIE = 'rs_negocio'
export const SEDE_COOKIE = 'rs_sede'

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
    supabase.from('membresias').select('negocio_id, rol, sucursal_ids').eq('user_id', userId).eq('activo', true),
  ])
  if (!perfil || !perfil.activo || !negocios?.length) {
    await supabase.auth.signOut()
    redirect('/login')
  }

  const cookieStore = await cookies()
  const elegido = cookieStore.get(NEGOCIO_COOKIE)?.value
  // Horario de Argentina para todo, sin importar lo que diga la columna zona_horaria.
  const lista = (negocios as Negocio[]).map((n) => ({ ...n, zona_horaria: TZ_AR }))
  const negocio = lista.find((n) => n.id === elegido) ?? lista[0]
  const tieneApagadoBot = negocio.modulos?.apagado_bot === true

  const rol: Rol | 'superadmin' = perfil.es_superadmin
    ? 'superadmin'
    : ((membresias?.find((m) => m.negocio_id === negocio.id)?.rol as Rol | undefined) ?? 'solo_lectura')

  // Sedes: la lista completa (RLS deja ver los nombres) y el alcance del usuario.
  const [{ data: sedesData }, { data: cfgSedesData }] = await Promise.all([supabase.from('sucursales').select('id, nombre, whatsapp_nro, aforo_maximo_reservas, activa, direccion, telefono, maps_url, numeracion_propia, alias_web').eq('negocio_id', negocio.id).order('orden').order('nombre'),
    supabase.from('config_sedes').select('sucursal_id, modulos, web, params, tipos, mensajes, estado_inicial').eq('negocio_id', negocio.id)])
  const sedesTodas = (sedesData ?? []) as Sede[]
  const configSedes: Record<string, ConfigSede> = Object.fromEntries(sedesTodas.map((x) => [x.id, CONFIG_SEDE_VACIA(x.id)]))
  for (const c of (cfgSedesData ?? []) as ConfigSede[]) configSedes[c.sucursal_id] = { ...CONFIG_SEDE_VACIA(c.sucursal_id), ...c }
  const alcance = perfil.es_superadmin ? [] : ((membresias?.find((m) => m.negocio_id === negocio.id)?.sucursal_ids as string[] | undefined) ?? [])
  const sinRestriccionSede = alcance.length === 0
  const sedesGestion = sinRestriccionSede ? sedesTodas : sedesTodas.filter((x) => alcance.includes(x.id))
  const sedes = sedesGestion.filter((x) => x.activa)
  const sedeCookie = cookieStore.get(SEDE_COOKIE)?.value
  const sede = sedes.length === 1 ? sedes[0] : (sedes.find((x) => x.id === sedeCookie) ?? null)
  const modulosNegocio = resolverModulos(negocio.modulos as Record<string, unknown> | null)
  const modulosActivos = sede ? aplicarSede(modulosNegocio, configSedes[sede.id]?.modulos) : unionModulos(modulosNegocio, sedes.map((x) => aplicarSede(modulosNegocio, configSedes[x.id]?.modulos)))

  return {
    userId,
    nombreUsuario: perfil.nombre,
    esSuperadmin: perfil.es_superadmin,
    negocios: lista,
    negocio,
    rol,
    puedeEscribir: rol !== 'solo_lectura',
    puedeAdministrar: rol === 'superadmin' || rol === 'owner' || rol === 'admin',
    modulosActivos,
    modulosNegocio,
    configSedes,
    tieneApagadoBot,
    puedeApagarBot: tieneApagadoBot && (rol === 'superadmin' || rol === 'owner' || rol === 'admin' || rol === 'encargado'),
    sedes,
    sedesTodas,
    sedesGestion,
    sede,
    sinRestriccionSede,
    supabase,
  }
})
