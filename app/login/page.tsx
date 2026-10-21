import Image from 'next/image'
import LoginForm from './login-form'

export default function LoginPage() {
  return (
    <main
      className="flex min-h-screen flex-col items-center justify-center px-4"
      style={{
        backgroundColor: '#0a1100',
        backgroundImage:
          'radial-gradient(circle at 30% 20%, rgba(200,230,43,0.133) 0%, rgba(0,0,0,0) 60%), radial-gradient(circle at 70% 80%, rgba(200,230,43,0.067) 0%, rgba(0,0,0,0) 50%)',
      }}
    >
      <Image src="/logo.jpeg" alt="Risto Suite" width={64} height={64} priority className="rounded-2xl border border-rs-control" />
      <h1 className="mt-5 text-2xl font-bold text-rs-lime">RistoSuite</h1>
      <p className="mt-1 text-sm text-rs-muted">Portal CRM</p>
      <LoginForm />
      <p className="mt-6 text-xs text-rs-muted/70">Risto Suite © {new Date().getFullYear()}</p>
    </main>
  )
}
