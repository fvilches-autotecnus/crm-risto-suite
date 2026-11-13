import { ambos, leerOrden } from '@/lib/orden'
import Link from 'next/link'
import { resolverModulos } from '@/lib/modulos'
import { redirect } from 'next/navigation'
import { getContexto } from '@/lib/context'
import GestionNegocios, { type NegocioAdmin } from '@/components/negocios-ui'
import OrdenSelect from '@/components/orden-select'
import GestionUsuarios from '@/components/usuarios-ui'
import type { UsuarioUI } from '@/lib/roles'

const ORDEN_NEGOCIOS = ambos('alta', 'nombre', 'usuarios', 'sedes', 'estado')
const ORDEN_USUARIOS = ambos('alta', 'usuario', 'accesos', 'estado')
const OPCIONES_NEGOCIOS = [
  { value: 'alta_desc', label: 'Alta: más recientes primero' },
  { value: 'alta_asc', label: 'Alta: más antiguas primero' },
  { value: 'nombre_asc', label: 'Nombre (A–Z)' },
  { value: 'nombre_desc', label: 'Nombre (Z–A)' },
]
const OPCIONES_USUARIOS = [
  { value: 'alta_desc', label: 'Alta: más recientes primero' },
  { value: 'alta_asc', label: 'Alta: más antiguas primero' },
  { value: 'usuario_asc', label: 'Usuario (A–Z)' },
  { value: 'usuario_desc', label: 'Usuario (Z–A)' },
]

export default async function Administracion({ searchParams }: { searchParams: Promise<{ tab?: string; orden?: string }> }) {
  const ctx = await getContexto()
  if (!ctx.esSuperadmin) redirect('/')
  const { tab, orden: ordenParam } = await searchParams
  const activa = tab === 'usuarios' ? 'usuarios' : 'negocios'
  // la columna 'accesos' / 'usuarios' / 'sedes' se ordena acá (son totales armados abajo); el resto lo ordena la base
  const orden = leerOrden(ordenParam, activa === 'usuarios' ? ORDEN_USUARIOS : ORDEN_NEGOCIOS, 'alta_desc')
  const desc = orden.endsWith('_desc')
  const campoOrden = orden.slice(0, orden.lastIndexOf('_'))

  // Superadmin: RLS devuelve todo (incluye negocios inactivos). Solo se leen columnas permitidas.
  const [{ data: negocios }, { data: perfiles }, { data: membresias }, { data: sedes }] = await Promise.all([
    ctx.supabase.from('negocios').select('id, nombre, slug, whatsapp_nro, aforo_maximo_reservas, activo, modulos, creado_en').order('creado_en', { ascending: false }),
    ctx.supabase.from('perfiles').select('id, usuario, nombre, activo, es_superadmin, creado_en').order('creado_en', { ascending: false }),
    ctx.supabase.from('membresias').select('user_id, negocio_id, rol, activo, sucursal_ids'),
    ctx.supabase.from('sucursales').select('id, negocio_id, nombre').eq('activa', true).order('orden').order('nombre'),
  ])
  const sedesPorNegocio: Record<string, { id: string; nombre: string }[]> = {}
  const nombresSede: Record<string, string> = {}
  for (const x of sedes ?? []) { (sedesPorNegocio[x.negocio_id] ||= []).push({ id: x.id, nombre: x.nombre }); nombresSede[x.id] = x.nombre }

  const nombreNegocio = new Map((negocios ?? []).map((n) => [n.id, n.nombre]))
  const conteo = new Map<string, number>()
  for (const m of membresias ?? []) conteo.set(m.negocio_id, (conteo.get(m.negocio_id) ?? 0) + 1)

  const listaNegocios: NegocioAdmin[] = (negocios ?? []).map((n) => ({
    id: n.id, nombre: n.nombre, slug: n.slug, whatsapp_nro: n.whatsapp_nro, aforo_maximo_reservas: n.aforo_maximo_reservas,
    activo: n.activo, creado_en: n.creado_en, apagado_bot: (n.modulos as { apagado_bot?: boolean } | null)?.apagado_bot === true, modulos: resolverModulos(n.modulos as Record<string, unknown> | null), usuarios: conteo.get(n.id) ?? 0, sedes: (sedesPorNegocio[n.id] ?? []).length,
  }))
  const usuarios: UsuarioUI[] = (perfiles ?? []).map((p) => ({
    ...p,
    membresias: (membresias ?? []).filter((m) => m.user_id === p.id).map((m) => ({ negocio_id: m.negocio_id, negocio_nombre: nombreNegocio.get(m.negocio_id) ?? '—', rol: m.rol, activo: m.activo, sucursal_ids: m.sucursal_ids ?? [] })),
  }))

  // orden pedido (el de la base ya viene por alta descendente: el sort es estable, así que los empates quedan por alta)
  const sentido = desc ? -1 : 1
  const txt = (a: string, b: string) => a.localeCompare(b, 'es')
  if (campoOrden === 'alta') { if (!desc) { listaNegocios.reverse(); usuarios.reverse() } }
  else if (activa === 'negocios') listaNegocios.sort((a, b) => sentido * (campoOrden === 'nombre' ? txt(a.nombre, b.nombre) : campoOrden === 'usuarios' ? a.usuarios - b.usuarios : campoOrden === 'sedes' ? a.sedes - b.sedes : campoOrden === 'estado' ? Number(a.activo) - Number(b.activo) : 0))
  else usuarios.sort((a, b) => sentido * (campoOrden === 'usuario' ? txt(a.usuario, b.usuario) : campoOrden === 'accesos' ? a.membresias.length - b.membresias.length : campoOrden === 'estado' ? Number(a.activo) - Number(b.activo) : 0))
  const ordenTabla = { ruta: '/administracion', params: { tab: activa }, actual: orden }

  const tabBtn = (v: string, label: string) => <Link href={`/administracion?tab=${v}`} className={'btn btn-sm ' + (activa === v ? 'btn-primary' : '')}>{label}</Link>

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">{tabBtn('negocios', 'Negocios')}{tabBtn('usuarios', 'Usuarios')}<div className="ml-auto"><OrdenSelect opciones={activa === 'usuarios' ? OPCIONES_USUARIOS : OPCIONES_NEGOCIOS} /></div></div>
      {activa === 'negocios' ? (
        <GestionNegocios negocios={listaNegocios} orden={ordenTabla} />
      ) : (
        <GestionUsuarios
          usuarios={usuarios}
          negocios={(negocios ?? []).map((n) => ({ id: n.id, nombre: n.nombre }))}
          sedesPorNegocio={sedesPorNegocio} nombresSede={nombresSede}
          modo="global" negocioActual={ctx.negocio.id} esSuperadmin miRol="superadmin" yoId={ctx.userId} orden={ordenTabla}
        />
      )}
    </div>
  )
}
