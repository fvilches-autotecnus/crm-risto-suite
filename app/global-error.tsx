'use client'

import './globals.css'

// Último recurso: falló hasta el layout principal. Mismo estilo que el resto de Risto Suite.
export default function ErrorGlobal({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <html lang="es">
      <body>
        <main className="flex min-h-screen items-center justify-center px-4">
          <div role="alert" className="card w-full max-w-sm p-8 text-center">
            <h1 className="text-lg font-bold">Algo salió mal</h1>
            <p className="mt-1 text-sm text-rs-muted">No pudimos cargar la aplicación. Probá de nuevo en unos segundos.</p>
            <button onClick={reset} className="btn btn-primary mt-5">Reintentar</button>
          </div>
        </main>
      </body>
    </html>
  )
}
