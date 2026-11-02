'use client'

import { useRef, useState } from 'react'
import { ImageIcon, Upload, X } from 'lucide-react'
import { useToast } from '@/components/feedback'
import { Spinner } from '@/components/ui'
import { achicarImagen } from '@/lib/achicar-imagen'
import { urlImagen } from '@/lib/carta'
import type { ResultadoSubida } from '@/lib/imagenes-bucket'

interface Opciones {
  /** La imagen que ya tiene el registro que se edita (null si no tiene). */
  inicial: string | null | undefined
  subir: (fd: FormData) => Promise<ResultadoSubida>
  descartar: (path: string) => Promise<unknown>
  /** “foto” (carta) o “imagen” (shows): solo cambia los textos. */
  palabra: 'foto' | 'imagen'
  /** Lado más largo al achicar, en píxeles. */
  lado?: number
}

/**
 * Estado de una imagen que se elige dentro de un diálogo: la sube apenas se elige (achicada en el navegador) y, si el diálogo se cierra sin guardar,
 * borra lo que se subió. Usarlo con <CampoImagen campo={...} /> y avisar `campo.guardado.current = true` cuando el formulario se guardó.
 */
export function useCampoImagen({ inicial, subir, descartar, palabra, lado = 1100 }: Opciones) {
  const toast = useToast()
  const [imagen, setImagen] = useState<string | null>(inicial ?? null)
  const [subidas, setSubidas] = useState<string[]>([])   // subidas en este diálogo: si no se guarda, se descartan
  const [subiendo, setSubiendo] = useState(false)
  const guardado = useRef(false)

  const elegir = async (f: File | undefined) => {
    if (!f) return
    setSubiendo(true)
    try {
      const fd = new FormData(); fd.set('archivo', await achicarImagen(f, lado))
      const r = await subir(fd)
      if (!r.ok) { toast({ tipo: 'error', texto: r.error }); return }
      if (imagen && subidas.includes(imagen)) void descartar(imagen)   // la anterior de este mismo diálogo ya no sirve
      setSubidas((s) => [...s, r.path]); setImagen(r.path)
    } catch { toast({ tipo: 'error', texto: `No se pudo procesar la ${palabra}. Probá con otra (JPG, PNG o WEBP).` }) }
    finally { setSubiendo(false) }
  }
  /** Al cerrar el diálogo: si no se guardó, borra las subidas que no quedaron en ningún registro. */
  const descartarPendientes = () => { if (!guardado.current) for (const p of subidas) if (p !== inicial) void descartar(p) }
  return { imagen, setImagen, subiendo, elegir, guardado, descartarPendientes, palabra }
}

/** La imagen con su vista previa y los botones para subirla, cambiarla o quitarla. Manda la ruta en un campo oculto (`nombre`). */
export function CampoImagen({ campo, nombre = 'imagen_path', etiqueta, vista = 'cuadrada', ayuda }: { campo: ReturnType<typeof useCampoImagen>; nombre?: string; etiqueta: string; vista?: 'cuadrada' | 'apaisada'; ayuda?: string }) {
  const archivo = useRef<HTMLInputElement>(null)
  const img = urlImagen(campo.imagen), { palabra } = campo
  return (
    <>
      <input type="hidden" name={nombre} value={campo.imagen ?? ''} />
      <span className="label">{etiqueta}</span>
      <div className="flex items-center gap-3">
        <div className={'shrink-0 overflow-hidden rounded-md bg-rs-raised ' + (vista === 'apaisada' ? 'h-20 w-32' : 'h-16 w-16')}>
          {img ? /* eslint-disable-next-line @next/next/no-img-element */ <img src={img} alt="Vista previa" className="h-full w-full object-cover" /> : <div className="grid h-full w-full place-items-center text-rs-muted"><ImageIcon size={vista === 'apaisada' ? 22 : 20} /></div>}
        </div>
        <div className="flex flex-wrap gap-2">
          <input ref={archivo} type="file" accept="image/jpeg,image/png,image/webp" className="sr-only" aria-label={`Elegir ${palabra}`}
            onChange={(e) => { void campo.elegir(e.target.files?.[0]).then(() => { if (archivo.current) archivo.current.value = '' }) }} />
          <button type="button" disabled={campo.subiendo} onClick={() => archivo.current?.click()} className="btn btn-sm">{campo.subiendo ? <Spinner /> : <Upload size={13} />}{campo.subiendo ? 'Subiendo…' : img ? 'Cambiar' : `Subir ${palabra}`}</button>
          {img && <button type="button" onClick={() => campo.setImagen(null)} className="btn btn-sm btn-danger"><X size={13} />Quitar</button>}
        </div>
      </div>
      {ayuda && <p className="mt-1 text-xs text-rs-muted">{ayuda}</p>}
    </>
  )
}
