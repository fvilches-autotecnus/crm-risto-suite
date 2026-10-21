'use server'

import { revalidatePath } from 'next/cache'
import { getContexto, type Contexto, type Rol } from '@/lib/context'
import { createAdminClient } from '@/lib/supabase/server'
import { ROLES, ROLES_BAJOS, SLUG_RE, USUARIO_RE, emailInterno } from '@/lib/roles'
import type { ActionResult } from './actions'

// Todo lo de acá escribe con service_role (RLS no deja crear usuarios de Auth ni negocios), así que
// los permisos se validan explícitamente en cada acción:
//   - superadmin: todo.
//   - owner: gestiona los usuarios de SU negocio activo, con cualquier rol.
//   - admin: gestiona solo encargado / staff / solo_lectura de SU negocio activo.
//   - el resto: nada.
const fail = (error: string): ActionResult => ({ ok: false, error })
const text = (fd: FormData, k: string) => String(fd.get(k) ?? '').trim()
const ROL_VALUES = ROLES.map((r) => r.value as string)

function puedeGestionar(ctx: Contexto, negocioId: string, rolObjetivo: Rol[]): boolean {
  if (ctx.esSuperadmin) return true
  if (negocioId !== ctx.negocio.id) return false
  if (ctx.rol === 'owner') return true
  if (ctx.rol === 'admin') return rolObjetivo.every((r) => ROLES_BAJOS.includes(r))
  return false
}

/** Un usuario con alcance limitado a algunas sedes solo puede gestionar usuarios que estén dentro de ese alcance. */
function dentroDeAlcance(ctx: Contexto, objetivoSedes: string[]): boolean {
  if (ctx.esSuperadmin || ctx.sinRestriccionSede) return true
  const mias = ctx.sedes.map((x) => x.id)
  return objetivoSedes.length > 0 && objetivoSedes.every((id) => mias.includes(id))
}

async function sedesValidas(negocioId: string, ids: string[]): Promise<boolean> {
  if (!ids.length) return true
  const { data } = await createAdminClient().from('sucursales').select('id').eq('negocio_id', negocioId).in('id', ids)
  return (data ?? []).length === new Set(ids).size
}

async function otrosDuenos(negocioId: string, excluirUserId: string): Promise<number> {
  const { count } = await createAdminClient()
    .from('membresias')
    .select('id', { count: 'exact', head: true })
    .eq('negocio_id', negocioId).eq('rol', 'owner').eq('activo', true).neq('user_id', excluirUserId)
  return count ?? 0
}

function refrescar() {
  revalidatePath('/', 'layout')
}

// ---------------------------------------------------------------------------
// Negocios (solo superadmin)
// ---------------------------------------------------------------------------

export async function crearNegocio(_prev: ActionResult | null, fd: FormData): Promise<ActionResult> {
  const ctx = await getContexto()
  if (!ctx.esSuperadmin) return fail('Solo un superadmin puede crear negocios')

  const nombre = text(fd, 'nombre')
  const slug = text(fd, 'slug').toLowerCase()
  const whatsapp = text(fd, 'whatsapp_nro').replace(/\D/g, '')
  const aforoRaw = text(fd, 'aforo')
  const aforo = aforoRaw ? Number(aforoRaw) : null
  if (!nombre) return fail('Falta el nombre')
  if (!SLUG_RE.test(slug)) return fail('El identificador debe tener 2 a 49 letras minúsculas, números o guiones (ej. mi-restaurante)')
  if (aforo !== null && (!Number.isInteger(aforo) || aforo <= 0)) return fail('El aforo debe ser un entero mayor a 0')

  const { error } = await createAdminClient().from('negocios').insert({
    nombre, slug, whatsapp_nro: whatsapp || null, aforo_maximo_reservas: aforo,
    modulos: { pedidos: false, reservas: true, crm: true, apagado_bot: fd.get('apagado_bot') === 'on' },
  })
  if (error) return fail(error.code === '23505' ? 'Ya existe un negocio con ese identificador' : 'No se pudo crear el negocio')
  refrescar()
  return { ok: true }
}

export async function actualizarNegocio(_prev: ActionResult | null, fd: FormData): Promise<ActionResult> {
  const ctx = await getContexto()
  if (!ctx.esSuperadmin) return fail('Solo un superadmin puede editar negocios')

  const id = text(fd, 'id')
  const nombre = text(fd, 'nombre')
  const aforoRaw = text(fd, 'aforo')
  const aforo = aforoRaw ? Number(aforoRaw) : null
  if (!id || !nombre) return fail('Falta el nombre')
  if (aforo !== null && (!Number.isInteger(aforo) || aforo <= 0)) return fail('El aforo debe ser un entero mayor a 0')

  const admin = createAdminClient()
  const { data: actual } = await admin.from('negocios').select('modulos').eq('id', id).maybeSingle()
  if (!actual) return fail('Negocio no encontrado')
  const { error } = await admin.from('negocios').update({
    nombre,
    whatsapp_nro: text(fd, 'whatsapp_nro').replace(/\D/g, '') || null,
    aforo_maximo_reservas: aforo,
    activo: fd.get('activo') === 'on',
    modulos: { ...(actual.modulos as Record<string, unknown>), apagado_bot: fd.get('apagado_bot') === 'on' },
  }).eq('id', id)
  if (error) return fail('No se pudo guardar el negocio')
  refrescar()
  return { ok: true }
}

// ---------------------------------------------------------------------------
// Usuarios
// ---------------------------------------------------------------------------

export async function crearUsuario(_prev: ActionResult | null, fd: FormData): Promise<ActionResult> {
  const ctx = await getContexto()
  const usuario = text(fd, 'usuario').toLowerCase()
  const nombre = text(fd, 'nombre')
  const password = String(fd.get('password') ?? '')
  const rol = text(fd, 'rol') as Rol
  const esSuper = ctx.esSuperadmin && fd.get('es_superadmin') === 'on'
  const negocioId = ctx.esSuperadmin ? text(fd, 'negocio_id') : ctx.negocio.id
  const sedeIds = fd.getAll('sucursal_ids').map(String).filter(Boolean)

  if (!USUARIO_RE.test(usuario)) return fail('El usuario debe tener 3 a 40 caracteres: minúsculas, números, punto, guion o guion bajo')
  if (!nombre) return fail('Falta el nombre')
  if (password.length < 8) return fail('La contraseña debe tener al menos 8 caracteres')
  if (!esSuper) {
    if (!ROL_VALUES.includes(rol)) return fail('Elegí un rol')
    if (!negocioId) return fail('Elegí un negocio')
    if (!puedeGestionar(ctx, negocioId, [rol])) return fail('No tenés permiso para crear usuarios con ese rol')
    if (!(await sedesValidas(negocioId, sedeIds))) return fail('Alguna sede no pertenece al negocio')
    if (!dentroDeAlcance(ctx, sedeIds)) return fail('Solo podés dar acceso a las sedes que vos administrás')
  } else if (!ctx.esSuperadmin) {
    return fail('No tenés permiso')
  }

  const admin = createAdminClient()
  const { data: existe } = await admin.from('perfiles').select('id').eq('usuario', usuario).maybeSingle()
  if (existe) return fail('Ese usuario ya existe')

  const { data: creado, error: eAuth } = await admin.auth.admin.createUser({
    email: emailInterno(usuario), password, email_confirm: true, user_metadata: { usuario },
  })
  if (eAuth || !creado.user) return fail('No se pudo crear el usuario: ' + (eAuth?.message ?? 'error desconocido'))
  const uid = creado.user.id

  const { error: ePerfil } = await admin.from('perfiles').insert({ id: uid, usuario, nombre, es_superadmin: esSuper })
  if (ePerfil) { await admin.auth.admin.deleteUser(uid); return fail('No se pudo crear el perfil') }
  if (!esSuper) {
    const { error: eMem } = await admin.from('membresias').insert({ user_id: uid, negocio_id: negocioId, rol, sucursal_ids: sedeIds })
    if (eMem) { await admin.auth.admin.deleteUser(uid); return fail('No se pudo asignar el negocio') }
  }
  refrescar()
  return { ok: true }
}

/** Suma un usuario existente a otro negocio (solo superadmin: un dueño no puede "buscar" usuarios de otros negocios). */
export async function agregarMembresia(userId: string, negocioId: string, rol: Rol): Promise<ActionResult> {
  const ctx = await getContexto()
  if (!ctx.esSuperadmin) return fail('Solo un superadmin puede asignar usuarios a otros negocios')
  if (!ROL_VALUES.includes(rol)) return fail('Rol no válido')
  const { error } = await createAdminClient().from('membresias').upsert({ user_id: userId, negocio_id: negocioId, rol, activo: true }, { onConflict: 'user_id,negocio_id' })
  if (error) return fail('No se pudo asignar el negocio')
  refrescar()
  return { ok: true }
}

async function membresia(userId: string, negocioId: string) {
  const { data } = await createAdminClient().from('membresias').select('rol, activo, sucursal_ids').eq('user_id', userId).eq('negocio_id', negocioId).maybeSingle()
  return data as { rol: Rol; activo: boolean; sucursal_ids: string[] } | null
}

export async function cambiarRol(userId: string, negocioId: string, rol: Rol): Promise<ActionResult> {
  const ctx = await getContexto()
  if (!ROL_VALUES.includes(rol)) return fail('Rol no válido')
  const actual = await membresia(userId, negocioId)
  if (!actual) return fail('El usuario no pertenece a ese negocio')
  if (!puedeGestionar(ctx, negocioId, [actual.rol, rol]) || !dentroDeAlcance(ctx, actual.sucursal_ids)) return fail('No tenés permiso para cambiar ese rol')
  if (userId === ctx.userId) return fail('No podés cambiar tu propio rol')
  if (actual.rol === 'owner' && rol !== 'owner' && (await otrosDuenos(negocioId, userId)) === 0) return fail('El negocio no puede quedar sin dueño')
  const { error } = await createAdminClient().from('membresias').update({ rol }).eq('user_id', userId).eq('negocio_id', negocioId)
  if (error) return fail('No se pudo cambiar el rol')
  refrescar()
  return { ok: true }
}

export async function quitarMembresia(userId: string, negocioId: string): Promise<ActionResult> {
  const ctx = await getContexto()
  const actual = await membresia(userId, negocioId)
  if (!actual) return fail('El usuario no pertenece a ese negocio')
  if (!puedeGestionar(ctx, negocioId, [actual.rol]) || !dentroDeAlcance(ctx, actual.sucursal_ids)) return fail('No tenés permiso para quitar a ese usuario')
  if (userId === ctx.userId) return fail('No podés quitarte a vos mismo')
  if (actual.rol === 'owner' && (await otrosDuenos(negocioId, userId)) === 0) return fail('El negocio no puede quedar sin dueño')
  const { error } = await createAdminClient().from('membresias').delete().eq('user_id', userId).eq('negocio_id', negocioId)
  if (error) return fail('No se pudo quitar al usuario')
  refrescar()
  return { ok: true }
}

/** Activa/desactiva el acceso de un usuario a UN negocio. */
export async function activarMembresia(userId: string, negocioId: string, activo: boolean): Promise<ActionResult> {
  const ctx = await getContexto()
  const actual = await membresia(userId, negocioId)
  if (!actual) return fail('El usuario no pertenece a ese negocio')
  if (!puedeGestionar(ctx, negocioId, [actual.rol]) || !dentroDeAlcance(ctx, actual.sucursal_ids)) return fail('No tenés permiso para cambiar a ese usuario')
  if (userId === ctx.userId) return fail('No podés desactivarte a vos mismo')
  if (!activo && actual.rol === 'owner' && (await otrosDuenos(negocioId, userId)) === 0) return fail('El negocio no puede quedar sin dueño')
  const { error } = await createAdminClient().from('membresias').update({ activo }).eq('user_id', userId).eq('negocio_id', negocioId)
  if (error) return fail('No se pudo actualizar')
  refrescar()
  return { ok: true }
}

/** Activa/desactiva un usuario en TODOS los negocios (solo superadmin). */
export async function activarUsuario(userId: string, activo: boolean): Promise<ActionResult> {
  const ctx = await getContexto()
  if (!ctx.esSuperadmin) return fail('Solo un superadmin puede hacer esto')
  if (userId === ctx.userId) return fail('No podés desactivarte a vos mismo')
  const { error } = await createAdminClient().from('perfiles').update({ activo }).eq('id', userId)
  if (error) return fail('No se pudo actualizar el usuario')
  refrescar()
  return { ok: true }
}

export async function resetearPassword(userId: string, password: string): Promise<ActionResult> {
  const ctx = await getContexto()
  if (password.length < 8) return fail('La contraseña debe tener al menos 8 caracteres')
  const admin = createAdminClient()
  if (!ctx.esSuperadmin) {
    // Solo si el usuario pertenece ÚNICAMENTE a este negocio (si no, un dueño podría tomar su acceso a otros negocios).
    const { data: ms } = await admin.from('membresias').select('negocio_id, rol, sucursal_ids').eq('user_id', userId)
    const lista = (ms ?? []) as { negocio_id: string; rol: Rol; sucursal_ids: string[] }[]
    const { data: p } = await admin.from('perfiles').select('es_superadmin').eq('id', userId).maybeSingle()
    if (!lista.length || p?.es_superadmin || lista.some((m) => m.negocio_id !== ctx.negocio.id)) return fail('No tenés permiso para cambiar la contraseña de ese usuario')
    if (!puedeGestionar(ctx, ctx.negocio.id, lista.map((m) => m.rol)) || !lista.every((m) => dentroDeAlcance(ctx, m.sucursal_ids))) return fail('No tenés permiso para cambiar la contraseña de ese usuario')
  }
  const { error } = await admin.auth.admin.updateUserById(userId, { password })
  if (error) return fail('No se pudo cambiar la contraseña')
  return { ok: true }
}

/** Define a qué sedes puede acceder un usuario en un negocio (lista vacía = todas). */
export async function guardarSedesMembresia(userId: string, negocioId: string, sucursalIds: string[]): Promise<ActionResult> {
  const ctx = await getContexto()
  const actual = await membresia(userId, negocioId)
  if (!actual) return fail('El usuario no pertenece a ese negocio')
  if (!puedeGestionar(ctx, negocioId, [actual.rol]) || !dentroDeAlcance(ctx, actual.sucursal_ids)) return fail('No tenés permiso para cambiar los accesos de ese usuario')
  if (userId === ctx.userId) return fail('No podés cambiar tus propios accesos')
  const ids = [...new Set(sucursalIds)]
  if (!(await sedesValidas(negocioId, ids))) return fail('Alguna sede no pertenece al negocio')
  if (!dentroDeAlcance(ctx, ids)) return fail('Solo podés dar acceso a las sedes que vos administrás')
  const { error } = await createAdminClient().from('membresias').update({ sucursal_ids: ids }).eq('user_id', userId).eq('negocio_id', negocioId)
  if (error) return fail('No se pudieron guardar los accesos')
  refrescar()
  return { ok: true }
}
