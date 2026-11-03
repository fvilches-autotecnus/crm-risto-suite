import CartaPublica from '@/components/carta-publica'
import type { DatosCartaPublica } from '@/lib/carta-publica'
import { origenCrm, variablesMarca } from '@/lib/marca'

/** La página de la carta pública (con pedidos o de solo lectura): los colores del local y la carta. */
export default function PaginaCartaPublica({ slug, d }: { slug: string; d: DatosCartaPublica }) {
  const vars = variablesMarca(d.marca)
  return (
    <>
      {vars && <style>{`:root{${Object.entries(vars).map(([k, v]) => `${k}:${v}`).join(';')}}`}</style>}
      <CartaPublica slug={slug} nombre={d.nombre} config={d.config} categorias={d.categorias} pedidos={d.pedidos} marca={d.marca} logoRisto={`${origenCrm()}/logo.jpeg`} />
    </>
  )
}
