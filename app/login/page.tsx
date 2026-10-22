import Image from 'next/image'
import { hoyEn } from '@/lib/fechas'
import LoginForm from './login-form'

export default function LoginPage() {
  return (
    <main
      className="relative flex min-h-screen flex-col items-center justify-center overflow-hidden px-4"
      style={{
        backgroundColor: '#0a1100',
        backgroundImage:
          'radial-gradient(circle at 30% 20%, rgba(200,230,43,0.133) 0%, rgba(0,0,0,0) 60%), radial-gradient(circle at 70% 80%, rgba(200,230,43,0.067) 0%, rgba(0,0,0,0) 50%)',
      }}
    >
      <div aria-hidden className="pointer-events-none absolute -left-24 top-10 h-72 w-72 animate-drift rounded-full bg-rs-lime/10 blur-3xl" />
      <div aria-hidden className="pointer-events-none absolute -right-24 bottom-10 h-80 w-80 animate-drift rounded-full bg-rs-lime/5 blur-3xl [animation-delay:-7s]" />
      <Image src="/logo.jpeg" alt="Risto Suite" width={64} height={64} priority className="relative animate-scale-in rounded-2xl border border-rs-control shadow-[0_0_40px_-8px_rgba(200,230,43,.5)]" />
      <h1 className="relative mt-5 animate-fade-up text-2xl font-bold text-rs-lime">RistoSuite</h1>
      <p className="relative mt-1 animate-fade-up text-sm text-rs-muted [animation-delay:60ms]">Portal CRM</p>
      <LoginForm />
      <p className="mt-6 text-xs text-rs-muted/70">Risto Suite © {hoyEn().slice(0, 4)}</p>
    </main>
  )
}
