import type { Marca } from '@/lib/marca'

/** Campos de la marca de un sitio de reservas (logo, adorno, colores y frase). Los nombres son marca_* y se leen con leerMarca (lib/marca.ts). */
export default function MarcaCampos({ marca, prefijo }: { marca?: Partial<Marca> | null; prefijo: string }) {
  return (
    <>
      <div className="grid gap-3 sm:grid-cols-2">
        <div><label className="label" htmlFor={`${prefijo}_logo`}>Logo (dirección de la imagen)</label><input id={`${prefijo}_logo`} name="marca_logo_url" defaultValue={marca?.logo_url ?? ''} maxLength={300} placeholder="https://… (mejor si es redondo o cuadrado)" className="input w-full" /></div>
        <div><label className="label" htmlFor={`${prefijo}_forma`}>Forma del logo</label>
          <select id={`${prefijo}_forma`} name="marca_logo_forma" defaultValue={marca?.logo_forma ?? ''} className="input w-full"><option value="">Redondo (se recorta en círculo)</option><option value="libre">Libre (se ve entero, con su forma)</option></select></div>
        <div><label className="label" htmlFor={`${prefijo}_orn`}>Adorno (dirección, PNG con fondo transparente)</label><input id={`${prefijo}_orn`} name="marca_ornamento_url" defaultValue={marca?.ornamento_url ?? ''} maxLength={300} placeholder="https://… (líneas claras con fondo transparente)" className="input w-full" /></div>
        <div><label className="label" htmlFor={`${prefijo}_cfondo`}>Color de fondo</label><input id={`${prefijo}_cfondo`} name="marca_color_fondo" defaultValue={marca?.color_fondo ?? ''} maxLength={7} placeholder="#3a442c" className="input w-full" /></div>
        <div><label className="label" htmlFor={`${prefijo}_cacento`}>Color de acento (botones y títulos)</label><input id={`${prefijo}_cacento`} name="marca_color_acento" defaultValue={marca?.color_acento ?? ''} maxLength={7} placeholder="#cfd03a" className="input w-full" /></div>
        <div className="sm:col-span-2"><label className="label" htmlFor={`${prefijo}_video1`}>Video de portada (dirección del .mp4, sin sonido)</label><input id={`${prefijo}_video1`} name="marca_video_1" defaultValue={marca?.videos?.[0] ?? ''} maxLength={300} placeholder="https://… (vertical u horizontal, de 2 a 4 MB)" className="input w-full" /></div>
        <div><label className="label" htmlFor={`${prefijo}_video2`}>Segundo video (opcional)</label><input id={`${prefijo}_video2`} name="marca_video_2" defaultValue={marca?.videos?.[1] ?? ''} maxLength={300} placeholder="https://… (se pasa después del primero)" className="input w-full" /></div>
        <div><label className="label" htmlFor={`${prefijo}_video3`}>Tercer video (opcional)</label><input id={`${prefijo}_video3`} name="marca_video_3" defaultValue={marca?.videos?.[2] ?? ''} maxLength={300} className="input w-full" /></div>
        <div className="sm:col-span-2"><label className="label" htmlFor={`${prefijo}_vposter`}>Imagen mientras carga el video (opcional)</label><input id={`${prefijo}_vposter`} name="marca_video_poster" defaultValue={marca?.video_poster ?? ''} maxLength={300} placeholder="https://… (un cuadro del video; también se ve si el celular ahorra datos)" className="input w-full" /></div>
        <div className="sm:col-span-2"><label className="label" htmlFor={`${prefijo}_lema`}>Frase del local</label><input id={`${prefijo}_lema`} name="marca_lema" defaultValue={marca?.lema ?? ''} maxLength={120} placeholder="Algo bueno está por pasar" className="input w-full" /></div>
      </div>
      <p className="text-xs text-rs-muted">Los colores se escriben como #RRGGBB. El fondo se oscurece solo si hace falta para que el texto se lea. El logo y los colores también se usan en la miniatura que se ve al compartir el link.</p>
    </>
  )
}
