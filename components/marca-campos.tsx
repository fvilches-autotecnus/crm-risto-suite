import type { Marca } from '@/lib/marca'

/** Campos de la marca de un sitio de reservas (logo, adorno, colores y frase). Los nombres son marca_* y se leen con leerMarca (lib/marca.ts). */
export default function MarcaCampos({ marca, prefijo }: { marca?: Partial<Marca> | null; prefijo: string }) {
  return (
    <>
      <div className="grid gap-3 sm:grid-cols-2">
        <div><label className="label" htmlFor={`${prefijo}_logo`}>Logo (dirección de la imagen)</label><input id={`${prefijo}_logo`} name="marca_logo_url" defaultValue={marca?.logo_url ?? ''} maxLength={300} placeholder="https://… (mejor si es redondo o cuadrado)" className="input w-full" /></div>
        <div><label className="label" htmlFor={`${prefijo}_orn`}>Adorno (dirección, PNG con fondo transparente)</label><input id={`${prefijo}_orn`} name="marca_ornamento_url" defaultValue={marca?.ornamento_url ?? ''} maxLength={300} placeholder="https://… (líneas claras con fondo transparente)" className="input w-full" /></div>
        <div><label className="label" htmlFor={`${prefijo}_cfondo`}>Color de fondo</label><input id={`${prefijo}_cfondo`} name="marca_color_fondo" defaultValue={marca?.color_fondo ?? ''} maxLength={7} placeholder="#3a442c" className="input w-full" /></div>
        <div><label className="label" htmlFor={`${prefijo}_cacento`}>Color de acento (botones y títulos)</label><input id={`${prefijo}_cacento`} name="marca_color_acento" defaultValue={marca?.color_acento ?? ''} maxLength={7} placeholder="#cfd03a" className="input w-full" /></div>
        <div className="sm:col-span-2"><label className="label" htmlFor={`${prefijo}_lema`}>Frase del local</label><input id={`${prefijo}_lema`} name="marca_lema" defaultValue={marca?.lema ?? ''} maxLength={120} placeholder="Algo bueno está por pasar" className="input w-full" /></div>
      </div>
      <p className="text-xs text-rs-muted">Los colores se escriben como #RRGGBB. El fondo se oscurece solo si hace falta para que el texto se lea. El logo y los colores también se usan en la miniatura que se ve al compartir el link.</p>
    </>
  )
}
