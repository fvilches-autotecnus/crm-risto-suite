'use client'

import Image from 'next/image'
import Link from 'next/link'

export default function ErrorGeneral({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <main className="flex min-h-screen items-center justify-center px-4">
      <div role="alert" className="card w-full max-w-sm animate-fade-up p-8 text-center">
        <Image src="/logo.jpeg" alt="Risto Suite" width={44} height={44} className="mx-auto rounded-xl" />
        <h1 className="mt-4 text-lg font-bold">Algo salió mal</h1>
        <p className="mt-1 text-sm text-rs-muted">No pudimos cargar esta pantalla. Probá de nuevo; si sigue pasando, avisanos.</p>
        <div className="mt-5 flex justify-center gap-2">
          <button onClick={reset} className="btn btn-primary">Reintentar</button>
          <Link href="/" className="btn">Ir al inicio</Link>
        </div>
      </div>
    </main>
  )
}
