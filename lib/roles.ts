import type { Rol } from '@/lib/context'

export const ROLES: { value: Rol; label: string; descripcion: string }[] = [
  { value: 'owner', label: 'Dueño', descripcion: 'Todo, incluida la gestión de usuarios y otros dueños' },
  { value: 'admin', label: 'Administrador', descripcion: 'Configura el negocio y gestiona encargados y staff' },
  { value: 'encargado', label: 'Encargado', descripcion: 'Opera reservas y puede apagar el bot' },
  { value: 'staff', label: 'Staff', descripcion: 'Carga y edita reservas' },
  { value: 'solo_lectura', label: 'Solo lectura', descripcion: 'Solo consulta' },
]

export const labelRol = (v: string) => ROLES.find((r) => r.value === v)?.label ?? v

/** Roles que un administrador puede asignar o modificar (nunca dueño ni administrador). */
export const ROLES_BAJOS: Rol[] = ['encargado', 'staff', 'solo_lectura']

export const USUARIO_RE = /^[a-z0-9._-]{3,40}$/
export const SLUG_RE = /^[a-z0-9][a-z0-9-]{1,48}$/
export const emailInterno = (usuario: string) => `${usuario}@usuarios.ristosuite.app`

export interface MembresiaUI {
  negocio_id: string
  negocio_nombre: string
  rol: Rol
  activo: boolean
  sucursal_ids: string[] // vacío = todas las sedes del negocio
}
export interface UsuarioUI {
  id: string
  usuario: string
  nombre: string
  activo: boolean
  es_superadmin: boolean
  membresias: MembresiaUI[]
}
