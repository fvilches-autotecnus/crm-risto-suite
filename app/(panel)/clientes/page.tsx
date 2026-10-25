import Link from 'next/link'
import { redirect } from 'next/navigation'
import { ArrowDown, ArrowUp, ArrowUpDown, Search, Users } from 'lucide-react'
import OrdenSelect from '@/components/orden-select'
import Paginacion from '@/components/paginacion'
import { EstadoVacio } from '@/components/ui'
import EditarNombreCliente from '@/components/editar-nombre-cliente'
import { Chip, EtiquetarNumeroBtn } from '@/components/etiquetas-ui'
import { integracionBC } from '@/lib/etiquetas'
import { ORIGENES, labelOrigen } from '@/lib/origen'
import { getContexto } from '@/lib/context'
import { fechaCorta, fechaHoraLarga } from '@/lib/fechas'
import { numPagina, POR_PAGINA } from '@/lib/paginacion'

interface FilaCliente { id: string; nombre: string; telefono: string | null; canal_origen: string | null; ultima_interaccion: string | null; ultima_reserva: string | null; creado_en: string; chips: { etiquetas: { nombre: string } | null }[] }

const ORDENES = [
  { value: 'alta_desc', label: 'Alta: más recientes primero' },
  { value: 'alta_asc', label: 'Alta: más antiguos primero' },
  { value: 'ultima_desc', label: 'Última reserva: más reciente primero' },
  { value: 'ultima_asc', label: 'Última reserva: más antigua primero' },
  { value: 'actividad', label: 'Última actividad' },
  { value: 'nombre', label: 'Nombre (A–Z)' },
]

export default async function ClientesPage({ searchParams }: { searchParams: Promise<{ q?: string; orden?: string; pagina?: string; etiqueta?: string; origen?: string }> }) {
  const ctx = await getContexto()
  if (!ctx.modulosActivos.clientes) redirect('/')
  const { supabase, negocio } = ctx
  const sp = await searchParams
  const { q, orden: ordenParam } = sp
  const orden = ['alta_asc', 'actividad', 'nombre', 'ultima_desc', 'ultima_asc'].includes(ordenParam ?? '') ? ordenParam! : 'alta_desc'
  
  // la búsqueda se hace en la base (hay negocios con miles de clientes) y se pagina con range()
  const pagina = numPagina(sp.pagina)
  const desdeFila = (pagina - 1) * POR_PAGINA
  const texto = (q ?? '').trim().replace(/[,()%*\\]/g, ' ').trim()
  const digitos = texto.replace(/\D/g, '')
  const [{ data: catalogoDb }, bc] = await Promise.all([supabase.from('etiquetas').select('id, nombre').eq('negocio_id', negocio.id).order('nombre'), integracionBC(negocio.id)])
  const catalogo = (catalogoDb ?? []) as { id: string; nombre: string }[]
  const etiquetaSel = catalogo.some((e) => e.id === sp.etiqueta) ? sp.etiqueta! : ''
  const origenSel = ORIGENES.some((o) => o.value === sp.origen) ? sp.origen! : ''
  // 'filtro' deja solo los clientes con esa etiqueta (join interno); 'chips' trae todas sus etiquetas para mostrarlas
  const columnas: string = `id, nombre, telefono, canal_origen, ultima_interaccion, ultima_reserva, creado_en, chips:cliente_etiquetas(etiquetas(nombre))${etiquetaSel ? ', filtro:cliente_etiquetas!inner(etiqueta_id)' : ''}`
  let cq = supabase.from('clientes').select(columnas, { count: 'exact' }).eq('negocio_id', negocio.id)
  if (etiquetaSel) cq = cq.eq('filtro.etiqueta_id', etiquetaSel)
  if (origenSel) cq = cq.eq('canal_origen', origenSel)
  if (texto) cq = cq.or([`nombre.ilike.%${texto}%`, ...(digitos ? [`telefono.like.%${digitos}%`] : [])].join(','))
  const { data: clientes, count: totalClientes } = await cq.order(orden.startsWith('ultima_') ? 'ultima_reserva' : orden === 'actividad' ? 'ultima_interaccion' : orden === 'nombre' ? 'nombre' : 'creado_en', { ascending: orden === 'alta_asc' || orden === 'nombre' || orden === 'ultima_asc', nullsFirst: false }).order('id').range(desdeFila, desdeFila + POR_PAGINA - 1)
  const { data: filas } = await supabase.rpc('resumen_reservas_clientes', { p_negocio: negocio.id })

  const resumen = new Map<string, { total: number; ultima: string | null }>(((filas ?? []) as { cliente_id: string; total: number; ultima: string | null }[]).map((f) => [f.cliente_id, { total: Number(f.total), ultima: f.ultima }] as const))

  const lista = (clientes ?? []) as unknown as FilaCliente[]
  // enlace del encabezado: conserva búsqueda y etiqueta, cambia el orden y vuelve a la primera página
  const hrefOrden = (o: string) => { const u = new URLSearchParams(); if (texto) u.set('q', texto); if (etiquetaSel) u.set('etiqueta', etiquetaSel); u.set('orden', o); return `/clientes?${u.toString()}` }

  return (
    <div className="space-y-4">
      <form className="flex gap-2">
        <div className="relative w-full max-w-sm">
          <Search size={14} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-rs-muted" />
          <input name="q" defaultValue={q ?? ''} placeholder="Buscar nombre o teléfono" className="input w-full pl-9" />
        </div>
        {orden !== 'alta_desc' && <input type="hidden" name="orden" value={orden} />}
        {catalogo.length > 0 && (
          <select name="etiqueta" defaultValue={etiquetaSel} aria-label="Filtrar por etiqueta" className="input">
            <option value="">Todas las etiquetas</option>
            {catalogo.map((e) => <option key={e.id} value={e.id}>{e.nombre}</option>)}
          </select>
        )}
        <select name="origen" defaultValue={origenSel} aria-label="Filtrar por origen" className="input">
          <option value="">Todos los orígenes</option>
          {ORIGENES.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
        </select>
        <button className="btn">Buscar</button>
        {(q || etiquetaSel || origenSel) && <Link href="/clientes" className="btn">Limpiar</Link>}
        <div className="ml-auto flex items-center gap-2">{ctx.puedeEscribir && <EtiquetarNumeroBtn catalogo={catalogo} esBotconversa={bc.activo} />}<OrdenSelect opciones={ORDENES} /></div>
      </form>

      <div className="card overflow-x-auto">
        <table className="w-full min-w-[760px]">
          <thead className="border-b border-rs-border">
            <tr><th className="th">Nombre</th><th className="th">Teléfono</th><th className="th">Etiquetas</th><th className="th">Reservas</th><th className="th" aria-sort={orden === 'ultima_desc' ? 'descending' : orden === 'ultima_asc' ? 'ascending' : 'none'}><Link href={hrefOrden(orden === 'ultima_desc' ? 'ultima_asc' : 'ultima_desc')} title={orden === 'ultima_desc' ? 'Ordenar de más antigua a más reciente' : 'Ordenar de más reciente a más antigua'} className="inline-flex items-center gap-1 uppercase transition-colors hover:text-rs-lime">Última reserva{orden === 'ultima_desc' ? <ArrowDown size={12} className="text-rs-lime" /> : orden === 'ultima_asc' ? <ArrowUp size={12} className="text-rs-lime" /> : <ArrowUpDown size={12} className="opacity-60" />}</Link></th><th className="th">Origen</th><th className="th">Alta</th></tr>
          </thead>
          <tbody>
            {lista.length === 0 && <tr><td colSpan={7}><EstadoVacio icono={<Users size={26} />} titulo={texto ? 'Ningún cliente coincide con la búsqueda' : 'Todavía no hay clientes'} texto={texto ? 'Probá con otro nombre o con los últimos dígitos del teléfono.' : 'Aparecen solos cuando se carga una reserva con teléfono.'} /></td></tr>}
            {lista.map((c, i) => {
              const r = resumen.get(c.id)
              return (
                <tr key={c.id} className="reveal border-b border-rs-border/60 transition-colors last:border-0 hover:bg-rs-raised/50" style={{ ['--i' as string]: Math.min(i, 12) }}>
                  <td className="td font-medium"><Link href={`/clientes/${c.id}`} className="transition-colors hover:text-rs-lime">{c.nombre}</Link>{ctx.puedeEscribir && <EditarNombreCliente id={c.id} nombre={c.nombre} />}</td>
                  <td className="td text-rs-muted">{c.telefono ?? '—'}</td>
                  <td className="td"><div className="flex flex-wrap gap-1">{(c.chips ?? []).slice(0, 3).map((x, k) => x.etiquetas && <Chip key={k} nombre={x.etiquetas.nombre} />)}{(c.chips ?? []).length > 3 && <span className="text-xs text-rs-muted">+{c.chips.length - 3}</span>}</div></td>
                  <td className="td">{r?.total ?? 0}</td>
                  <td className="td text-rs-muted">{(c.ultima_reserva ?? r?.ultima) ? fechaCorta((c.ultima_reserva ?? r?.ultima)!) : '—'}</td>
                  <td className="td text-rs-muted">{labelOrigen(c.canal_origen)}</td>
                  <td className="td whitespace-nowrap text-xs text-rs-muted">{fechaHoraLarga(c.creado_en)}</td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
      <Paginacion ruta="/clientes" params={sp} pagina={pagina} paginas={Math.max(1, Math.ceil((totalClientes ?? 0) / POR_PAGINA))} total={totalClientes ?? 0} desde={totalClientes ? desdeFila + 1 : 0} hasta={desdeFila + lista.length} />
    </div>
  )
}
