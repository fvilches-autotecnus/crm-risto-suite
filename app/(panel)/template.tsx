// Se vuelve a montar en cada navegación: la página nueva entra con un fundido suave.
export default function Template({ children }: { children: React.ReactNode }) {
  return <div className="animate-fade-up">{children}</div>
}
