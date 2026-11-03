import { estiloEtiqueta, etiquetaDe, type EtiquetaPropia } from '@/lib/carta'

/** Etiqueta de un producto (las de siempre y las propias del negocio, con su color). Una clave desconocida (borrada) no se dibuja. */
export default function EtiquetaCarta({ clave, propias }: { clave: string; propias: EtiquetaPropia[] }) {
  const t = etiquetaDe(clave, propias)
  if (!t) return null
  return <span className={'badge ' + (t.color ?? '')} style={t.hex ? estiloEtiqueta(t.hex) : undefined}>{t.label}</span>
}
