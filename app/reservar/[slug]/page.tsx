import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import ReservarPublico from '@/components/reservar-publico'
import { hoyEn } from '@/lib/fechas'
import { resolverModulos } from '@/lib/modulos'
import { cargarMarcaSitio, nombreSitio, normalizarMarca, origenCrm, urlAbsoluta, variablesMarca } from '@/lib/marca'
import { labelTipo } from '@/lib/reservas'
import { createAdminClient } from '@/lib/supabase/server'
import type { SedeWeb, TipoWeb } from './actions'

const esComodin = (n: string) => n.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().startsWith('cualquier')

// Sitio público de reservas (de prueba). Se regenera cada minuto y al guardar la configuración en el CRM.
export const revalidate = 60

/** Pestaña, ícono y miniatura al compartir el link: con la marca del local y la de Risto Suite (la miniatura la arma ./opengraph-image). */
export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const s = await cargarMarcaSitio((await params).slug)
  const base = origenCrm() || undefined
  const ico = urlAbsoluta(s?.marca.logo_url ?? null) ?? `${origenCrm()}/logo.jpeg`
  if (!s) return { title: 'Reservá tu mesa', robots: { index: false, follow: false } }
  const desc = s.subtitulo || `Reservá tu mesa en ${s.nombre}`
  return {
    metadataBase: base ? new URL(base) : undefined,
    title: `Reservá tu mesa · ${s.nombre}`, description: desc, robots: { index: false, follow: false },
    icons: { icon: ico, apple: ico },
    openGraph: { title: `Reservá tu mesa · ${s.nombre}`, description: desc, siteName: 'Risto Suite', type: 'website', locale: 'es_AR' },
  }
}

export default async function ReservarPage({ params }: { params: Promise<{ slug: string }> }) {
  const slug = (await params).slug
  if (!/^[a-z0-9-]{2,49}$/.test(slug)) notFound()
  const admin = createAdminClient()
  const COLS = 'id, slug, nombre, whatsapp_nro, zona_horaria, modulos'
  // La dirección puede ser la de un negocio (todas sus sedes) o la propia de una sede (solo esa sede)
  let { data: negocio } = await admin.from('negocios').select(COLS).eq('slug', slug).eq('activo', true).maybeSingle()
  let sedeFija: { id: string; nombre: string } | null = null
  if (!negocio) {
    const { data: s } = await admin.from('sucursales').select('id, nombre, activa, negocio_id').eq('alias_web', slug).maybeSingle()
    if (!s || !s.activa) notFound()
    sedeFija = { id: s.id as string, nombre: s.nombre as string }
    negocio = (await admin.from('negocios').select(COLS).eq('id', s.negocio_id).eq('activo', true).maybeSingle()).data
  }
  if (!negocio || !resolverModulos(negocio.modulos as Record<string, unknown> | null).reservas) notFound()
  const slugNegocio = negocio.slug as string   // las consultas a la base siempre van con el slug del negocio
  const [{ data: cfg }, { data: ubs }, { data: cat }, { data: cal }, { data: cfgSedes }] = await Promise.all([
    admin.from('reservas_web_config').select('activo, marca, elegir_mesa, tipos, dias_adelante, personas_min, personas_max, mensaje, modo_prueba, titulo, subtitulo, texto_whatsapp, max_mesas, cualquier_ubicacion, texto_cualquier_ubicacion, pedir_cumple').eq('negocio_id', negocio.id).maybeSingle(),
    admin.from('ubicaciones').select('nombre, sucursal_id').eq('negocio_id', negocio.id).eq('activo', true).order('orden').order('nombre'),
    admin.from('reserva_tipos').select('clave, etiqueta, activo, orden, modo, dias_semana, fechas').eq('negocio_id', negocio.id).order('orden'),
    admin.rpc('web_calendario', { p: { negocio: slugNegocio } }),
    admin.from('config_sedes').select('sucursal_id, web, tipos').eq('negocio_id', negocio.id),
  ])
  if (!cfg?.activo) notFound()
  // Sedes: si el negocio tiene, el cliente elige una y todo sale de lo que esa sede tiene activo (su WhatsApp, ubicaciones, plano, horarios)
  const { data: info } = await admin.rpc('web_sedes_info', { p: { negocio: slugNegocio } })
  let sedes = ((info as { sedes?: SedeWeb[] } | null)?.sedes ?? []) as SedeWeb[]
  if (sedeFija) { sedes = sedes.filter((s) => s.id === sedeFija!.id); if (sedes.length === 0) notFound() }   // dirección de una sede: solo esa sede (si no se ofrece, no hay sitio)
  const tieneSedes = (info as { tiene_sedes?: boolean } | null)?.tiene_sedes === true
  // sin ningún WhatsApp al que escribir (el de la sede o el del negocio) nadie podría confirmar la solicitud
  if (tieneSedes ? sedes.length === 0 : !/\d{6,}/.test(String(negocio.whatsapp_nro ?? ''))) notFound()
  // los tipos que se ofrecen, con el nombre y el orden del catálogo del negocio (los desactivados no se ofrecen)
  const catalogo = (cat ?? []) as { clave: string; etiqueta: string; activo: boolean; modo: 'siempre' | 'semana' | 'fechas'; dias_semana: number[] | null; fechas: string[] | null }[]
  // una sede puede ofrecer otros tipos y en otros días (lo que no cambia lo hereda del negocio)
  const armarTipos = (lista: string[] | null | undefined, cat2: typeof catalogo): TipoWeb[] => {
    const elegidos = lista?.length ? lista : ['comun']
    let r: TipoWeb[] = cat2.filter((t) => t.activo && elegidos.includes(t.clave)).map((t) => ({ value: t.clave, label: t.etiqueta, modo: t.modo, dias_semana: t.dias_semana ?? [], fechas: t.fechas ?? [] }))
    if (r.length === 0) r = elegidos.filter((t) => !cat2.some((c) => c.clave === t && !c.activo)).map((t) => ({ value: t, label: labelTipo(t), modo: 'siempre' as const, dias_semana: [], fechas: [] }))
    if (r.length === 0) r = [{ value: 'comun', label: 'Común', modo: 'siempre', dias_semana: [], fechas: [] }]
    return r
  }
  const tipos = armarTipos(cfg.tipos as string[] | null, catalogo)
  const porSede: Record<string, { cfg: Record<string, unknown>; tipos: TipoWeb[] }> = {}
  const CLAVES_CFG = ['dias_adelante', 'personas_min', 'personas_max', 'titulo', 'subtitulo', 'texto_whatsapp', 'max_mesas', 'cualquier_ubicacion', 'texto_cualquier_ubicacion', 'pedir_cumple']
  for (const c of (cfgSedes ?? []) as { sucursal_id: string; web: Record<string, unknown> | null; tipos: Record<string, { activo?: boolean; modo?: 'siempre' | 'semana' | 'fechas'; dias_semana?: number[]; fechas?: string[] }> | null }[]) {
    const w = c.web ?? {}, ovT = c.tipos ?? {}
    const cfgPropia = Object.fromEntries(CLAVES_CFG.filter((k) => k in w).map((k) => [k, w[k]]))
    const catSede = catalogo.map((t) => { const o = ovT[t.clave]; return o ? { ...t, activo: o.activo === false ? false : t.activo, modo: o.modo ?? t.modo, dias_semana: o.dias_semana ?? t.dias_semana, fechas: o.fechas ?? t.fechas } : t })
    if (Object.keys(cfgPropia).length > 0 || 'tipos' in w || Object.keys(ovT).length > 0) porSede[c.sucursal_id] = { cfg: cfgPropia, tipos: armarTipos('tipos' in w ? (w.tipos as string[]) : (cfg.tipos as string[] | null), catSede) }
  }
  const marca = normalizarMarca(cfg.marca)
  const vars = variablesMarca(marca)
  return (
    <>
    {vars && <style>{`:root{${Object.entries(vars).map(([k, v]) => `${k}:${v}`).join(';')}}`}</style>}
    <ReservarPublico slug={slugNegocio} marca={{ ...marca, logo_url: urlAbsoluta(marca.logo_url), ornamento_url: urlAbsoluta(marca.ornamento_url) }} logoRisto={`${origenCrm()}/logo.jpeg`} nombre={nombreSitio(negocio.nombre as string, sedeFija?.nombre)} ubicaciones={(ubs ?? []).filter((u) => !esComodin(u.nombre as string)).map((u) => ({ nombre: u.nombre as string, sucursal_id: (u.sucursal_id as string | null) ?? null }))} sedes={tieneSedes ? sedes : []} tipos={tipos} porSede={porSede} cerrados={((cal as { cerrados?: Record<string, string[]> } | null)?.cerrados) ?? {}}
      cfg={{ elegir_mesa: cfg.elegir_mesa === true, dias_adelante: cfg.dias_adelante, personas_min: cfg.personas_min, personas_max: cfg.personas_max, mensaje: cfg.mensaje, modo_prueba: cfg.modo_prueba !== false, titulo: cfg.titulo, subtitulo: cfg.subtitulo, texto_whatsapp: cfg.texto_whatsapp, max_mesas: cfg.max_mesas ?? 6, cualquier_ubicacion: cfg.cualquier_ubicacion !== false, texto_cualquier_ubicacion: cfg.texto_cualquier_ubicacion, pedir_cumple: cfg.pedir_cumple !== false }}
      hoy={hoyEn(negocio.zona_horaria as string)} whatsapp={String(negocio.whatsapp_nro ?? '')} />
    </>
  )
}
