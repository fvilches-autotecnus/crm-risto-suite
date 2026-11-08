'use server'

import { headers } from 'next/headers'
import { redirect } from 'next/navigation'
import { createAdminClient, createClient } from '@/lib/supabase/server'

export interface LoginState {
  error?: string
  usuario?: string // se devuelve para que el formulario (que React 19 resetea tras la acción) no pierda lo tipeado
}

const ERROR_GENERICO = 'Usuario o contraseña incorrectos'

/** IP de quien llama: Vercel pisa estos encabezados con la dirección real, así que no los puede falsificar quien llama desde afuera. */
async function ipDeLlamada(): Promise<string> {
  const h = await headers()
  return (h.get('x-real-ip') ?? h.get('x-forwarded-for')?.split(',')[0] ?? '').trim() || 'desconocida'
}

// El login es por "usuario" (ej. cornerpichincha), no por email: se resuelve el email interno
// con service_role y después se autentica con Supabase Auth. Mismo mensaje para usuario
// inexistente y clave incorrecta (no se revela cuáles usuarios existen).
// Anti fuerza bruta: los intentos fallidos se anotan (usuario + IP) y, pasado el límite, se bloquea un rato (migración 0095).
// Un intento bloqueado no se anota ni se revisa su clave. Si la base de bloqueos no responde, se deja pasar (no se corta el login).
export async function login(_prev: LoginState, formData: FormData): Promise<LoginState> {
  const usuario = String(formData.get('usuario') ?? '').trim().toLowerCase()
  const password = String(formData.get('password') ?? '')
  if (!usuario || !password) return { error: 'Ingresá usuario y contraseña', usuario }

  const admin = createAdminClient()
  const ip = await ipDeLlamada()
  const { data: segundos } = await admin.rpc('login_bloqueado', { p_usuario: usuario, p_ip: ip })
  if (typeof segundos === 'number' && segundos > 0) {
    return { error: `Demasiados intentos. Probá de nuevo en ${Math.max(1, Math.ceil(segundos / 60))} minuto${segundos > 60 ? 's' : ''}.`, usuario }
  }
  const fallo = async (): Promise<LoginState> => {
    await admin.rpc('login_fallido', { p_usuario: usuario, p_ip: ip })
    return { error: ERROR_GENERICO, usuario }
  }

  const { data: perfil } = await admin.from('perfiles').select('id, activo').eq('usuario', usuario).maybeSingle()
  if (!perfil || !perfil.activo) return fallo()

  const { data: u } = await admin.auth.admin.getUserById(perfil.id)
  const email = u.user?.email
  if (!email) return fallo()

  const supabase = await createClient()
  const { error } = await supabase.auth.signInWithPassword({ email, password })
  if (error) return fallo()

  await admin.rpc('login_exitoso', { p_usuario: usuario, p_ip: ip })
  redirect('/')
}
