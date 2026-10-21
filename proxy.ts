import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

// Refresca la sesión de Supabase en cada request y manda a /login si no hay usuario.
export async function proxy(request: NextRequest) {
  let response = NextResponse.next({ request })

  const supabase = createServerClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, {
    cookies: {
      getAll: () => request.cookies.getAll(),
      setAll: (list) => {
        list.forEach(({ name, value }) => request.cookies.set(name, value))
        response = NextResponse.next({ request })
        list.forEach(({ name, value, options }) => response.cookies.set(name, value, options))
      },
    },
  })

  // getClaims valida el JWT localmente (sin ir a la red) cuando el proyecto usa claves asimétricas
  const { data } = await supabase.auth.getClaims()
  const usuario = data?.claims?.sub
  const { pathname } = request.nextUrl

  if (!usuario && pathname !== '/login') {
    return NextResponse.redirect(new URL('/login', request.url))
  }
  if (usuario && pathname === '/login') {
    return NextResponse.redirect(new URL('/', request.url))
  }
  return response
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|logo.jpeg).*)'],
}
