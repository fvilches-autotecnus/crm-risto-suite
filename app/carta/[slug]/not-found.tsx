import { BookOpen } from 'lucide-react'

export default function CartaNoDisponible() {
  return (
    <main className="mx-auto flex min-h-screen max-w-md flex-col items-center justify-center px-6 text-center">
      <div className="mb-4 rounded-full bg-rs-raised p-4 text-rs-lime"><BookOpen size={28} /></div>
      <h1 className="text-lg font-bold">Carta no disponible</h1>
      <p className="mt-1 text-sm text-rs-muted">Esta carta no está disponible por el momento. Consultá en el local o volvé a intentar más tarde.</p>
    </main>
  )
}
