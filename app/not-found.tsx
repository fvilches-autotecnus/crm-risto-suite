import Image from 'next/image'
import Link from 'next/link'

export default function NoEncontrada() {
  return (
    <main className="flex min-h-screen items-center justify-center px-4">
      <div className="card w-full max-w-sm animate-fade-up p-8 text-center">
        <Image src="/logo.jpeg" alt="Risto Suite" width={44} height={44} className="mx-auto rounded-xl" />
        <p className="mt-4 text-4xl font-bold tabular-nums text-rs-lime">404</p>
        <h1 className="mt-1 text-lg font-bold">Esta página no existe</h1>
        <p className="mt-1 text-sm text-rs-muted">Puede que el enlace esté mal o que ya no esté disponible.</p>
        <Link href="/" className="btn btn-primary mt-5">Volver al inicio</Link>
      </div>
    </main>
  )
}
