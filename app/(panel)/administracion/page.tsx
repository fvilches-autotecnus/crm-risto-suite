import Link from 'next/link'
import { redirect } from 'next/navigation'
import { getContexto } from '@/lib/context'
import GestionNegocios, { type NegocioAdmin } from '@/components/negocios-ui'
import GestionUsuarios from '@/components/usuarios-ui'
import type { UsuarioUI } from '@/lib/roles'

export default async function Administracion({ searchParams }: { searchParams: Promise<{ tab?: string }> }) {
  const ctx = await getContexto()
  if (!ctx.esSuperadmin) redirect('/')
  const { tab } = await searchParams
  const activa = tab === 'usuarios' ? 'usuarios' : 'negocios'

  // Superadmin: RLS devuelve todo (incluye negocios inactivos). Solo se leen columnas permitidas.
  const [{ data: negocios }, { data: perfiles }, { data: membresias }] = await Promise.all([
    ctx.supabase.from('negocios').select('id, nombre, slug, whatsapp_nro, aforo_maximo_reservas, activo, modulos').order('nombre'),
    ctx.supabase.from('perfiles').select('id, usuario, nombre, activo, es_superadmin').order('nombre'),
    ctx.supabase.from('membresias').select('user_id, negocio_id, rol, activo'),
  ])

  const nombreNegocio = new Map((negocios ?? []).map((n) => [n.id, n.nombre]))
  const conteo = new Map<string, number>()
  for (const m of membresias ?? []) conteo.set(m.negocio_id, (conteo.get(m.negocio_id) ?? 0) + 1)

  const listaNegocios: NegocioAdmin[] = (negocios ?? []).map((n) => ({
    id: n.id, nombre: n.nombre, slug: n.slug, whatsapp_nro: n.whatsapp_nro, aforo_maximo_reservas: n.aforo_maximo_reservas,
    activo: n.activo, apagado_bot: (n.modulos as { apagado_bot?: boolean } | null)?.apagado_bot === true, usuarios: conteo.get(n.id) ?? 0,
  }))
  const usuarios: UsuarioUI[] = (perfiles ?? []).map((p) => ({
    ...p,
    membresias: (membresias ?? []).filter((m) => m.user_id === p.id).map((m) => ({ negocio_id: m.negocio_id, negocio_nombre: nombreNegocio.get(m.negocio_id) ?? '—', rol: m.rol, activo: m.activo })),
  }))

  const tabBtn = (v: string, label: string) => <Link href={`/administracion?tab=${v}`} className={'btn btn-sm ' + (activa === v ? 'btn-primary' : '')}>{label}</Link>

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">{tabBtn('negocios', 'Negocios')}{tabBtn('usuarios', 'Usuarios')}</div>
      {activa === 'negocios' ? (
        <GestionNegocios negocios={listaNegocios} />
      ) : (
        <GestionUsuarios
          usuarios={usuarios}
          negocios={(negocios ?? []).map((n) => ({ id: n.id, nombre: n.nombre }))}
          modo="global" negocioActual={ctx.negocio.id} esSuperadmin miRol="superadmin" yoId={ctx.userId}
        />
      )}
    </div>
  )
}
