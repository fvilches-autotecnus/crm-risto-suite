import { EstadoVacio } from '@/components/ui'

/** Pantalla de un módulo que ya está habilitado para el negocio pero todavía no tiene su contenido (la carpeta del módulo ya existe). */
export default function ModuloPreparacion({ icono, titulo, subtitulo, vaA, nota }: { icono: React.ReactNode; titulo: string; subtitulo: string; vaA: string[]; nota?: string }) {
  return (
    <div className="space-y-5">
      <div className="animate-fade-up">
        <h1 className="flex items-center gap-2 text-xl font-bold sm:text-2xl"><span className="text-rs-lime">{icono}</span>{titulo}</h1>
        <p className="text-sm text-rs-muted">{subtitulo}</p>
      </div>
      <div className="card">
        <EstadoVacio icono={icono} titulo="Módulo habilitado, en preparación" texto="Este negocio ya tiene el módulo encendido. Las pantallas se están armando y van a aparecer acá.">
          <ul className="mx-auto max-w-sm list-disc space-y-1 pl-5 text-left text-sm text-rs-muted marker:text-rs-lime">{vaA.map((v) => <li key={v}>{v}</li>)}</ul>
          {nota && <p className="mx-auto mt-4 max-w-sm text-xs text-rs-muted">{nota}</p>}
        </EstadoVacio>
      </div>
    </div>
  )
}
