'use client'

import { useActionState, useState } from 'react'
import { Eye, EyeOff } from 'lucide-react'
import { Spinner } from '@/components/ui'
import { login, type LoginState } from './actions'

export default function LoginForm() {
  const [state, action, pending] = useActionState<LoginState, FormData>(login, {})
  const [ver, setVer] = useState(false)

  return (
    <form action={action} className="mt-8 w-full max-w-[336px] animate-fade-up rounded-rs-lg border border-rs-raised bg-rs-card/80 p-6 shadow-2xl shadow-black/40 backdrop-blur">
      <label className="label" htmlFor="usuario">Usuario</label>
      <input id="usuario" name="usuario" defaultValue={state.usuario} autoComplete="username" autoCapitalize="none" placeholder="Ingresa tu usuario" className="input h-11 w-full bg-rs-input" required />

      <label className="label mt-5" htmlFor="password">Contraseña</label>
      <div className="relative">
        <input id="password" name="password" type={ver ? 'text' : 'password'} autoComplete="current-password" placeholder="Ingresa tu contraseña" className="input h-11 w-full bg-rs-input pr-10" required />
        <button type="button" onClick={() => setVer(!ver)} aria-label={ver ? 'Ocultar contraseña' : 'Mostrar contraseña'} className="absolute right-3 top-1/2 -translate-y-1/2 text-rs-muted hover:text-rs-text">
          {ver ? <EyeOff size={16} /> : <Eye size={16} />}
        </button>
      </div>

      {state.error && <p role="alert" className="mt-4 animate-fade-in text-sm text-rs-danger">{state.error}</p>}

      <button type="submit" disabled={pending} className="btn btn-primary mt-6 h-11 w-full rounded-[10px]">
        {pending && <Spinner size={16} />}{pending ? 'Ingresando…' : 'Ingresar'}
      </button>
    </form>
  )
}
