import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

/**
 * Cerrar sesión. Es una dirección propia (no una server action) a propósito: con la sesión vencida el proxy redirige
 * cualquier acción a /login y el botón "Salir" parecía no hacer nada. Esta ruta siempre termina en /login y deja las cookies de sesión borradas.
 */
export async function POST(request: NextRequest) {
  const response = NextResponse.redirect(new URL('/login', request.url), 303)
  const supabase = createServerClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, {
    cookies: {
      getAll: () => request.cookies.getAll(),
      setAll: (list) => list.forEach(({ name, value, options }) => response.cookies.set(name, value, options)),
    },
  })
  try { await supabase.auth.signOut() } catch { /* sesión ya vencida: igual se borran las cookies */ }
  // Si el cierre en el servidor no pudo completarse, se borran igual las cookies de sesión de este navegador.
  for (const c of request.cookies.getAll()) if (c.name.startsWith('sb-')) response.cookies.set(c.name, '', { path: '/', maxAge: 0 })
  response.headers.set('Cache-Control', 'no-store')
  return response
}
