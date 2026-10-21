'use server'

import { redirect } from 'next/navigation'
import { createAdminClient, createClient } from '@/lib/supabase/server'

export interface LoginState {
  error?: string
  usuario?: string // se devuelve para que el formulario (que React 19 resetea tras la acción) no pierda lo tipeado
}

const ERROR_GENERICO = 'Usuario o contraseña incorrectos'

// El login es por "usuario" (ej. cornerpichincha), no por email: se resuelve el email interno
// con service_role y después se autentica con Supabase Auth. Mismo mensaje para usuario
// inexistente y clave incorrecta (no se revela cuáles usuarios existen).
export async function login(_prev: LoginState, formData: FormData): Promise<LoginState> {
  const usuario = String(formData.get('usuario') ?? '').trim().toLowerCase()
  const password = String(formData.get('password') ?? '')
  if (!usuario || !password) return { error: 'Ingresá usuario y contraseña', usuario }

  const admin = createAdminClient()
  const { data: perfil } = await admin.from('perfiles').select('id, activo').eq('usuario', usuario).maybeSingle()
  if (!perfil || !perfil.activo) return { error: ERROR_GENERICO, usuario }

  const { data: u } = await admin.auth.admin.getUserById(perfil.id)
  const email = u.user?.email
  if (!email) return { error: ERROR_GENERICO, usuario }

  const supabase = await createClient()
  const { error } = await supabase.auth.signInWithPassword({ email, password })
  if (error) return { error: ERROR_GENERICO, usuario }

  redirect('/')
}
