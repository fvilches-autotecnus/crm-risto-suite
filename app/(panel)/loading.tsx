// Esqueleto que se muestra mientras carga la página (se ve en cada navegación).
export default function Cargando() {
  return (
    <div className="space-y-6" aria-busy="true" aria-label="Cargando">
      <div className="flex justify-end gap-2"><div className="skeleton h-9 w-9" /><div className="skeleton h-9 w-40" /><div className="skeleton h-9 w-9" /></div>
      <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
        {[0, 1, 2, 3].map((i) => <div key={i} className="skeleton h-[118px] rounded-rs-lg" style={{ animationDelay: `${i * 80}ms` }} />)}
      </div>
      <div className="card overflow-hidden">
        <div className="skeleton h-12 rounded-none" />
        {[0, 1, 2, 3, 4].map((i) => <div key={i} className="mx-4 my-3"><div className="skeleton h-8" /></div>)}
      </div>
    </div>
  )
}
