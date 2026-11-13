import Link from 'next/link'
import { redirect } from 'next/navigation'
import { Search, Users } from 'lucide-react'
import { ThOrden } from '@/components/th-orden'
import { ambos, leerOrden } from '@/lib/orden'
import OrdenSelect from '@/components/orden-select'
import Paginacion from '@/components/paginacion'
import { EstadoVacio } from '@/components/ui'
import EditarNombreCliente from '@/components/editar-nombre-cliente'
import CompletarNombresBC from '@/components/completar-nombres-bc'
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
  { value: 'reservas_desc', label: 'Reservas: de más a menos' },
  { value: 'reservas_asc', label: 'Reservas: de menos a más' },
  { value: 'actividad', label: 'Última actividad' },
  { value: 'nombre_asc', label: 'Nombre (A–Z)' },
  { value: 'nombre_desc', label: 'Nombre (Z–A)' },
]
const ORDENES_VALIDOS = [...ambos('alta', 'ultima', 'reservas', 'nombre', 'telefono', 'origen'), 'actividad']
// columna de la base por la que se ordena (las reservas se ordenan aparte: el total no es una columna de clientes)
const COLUMNA_ORDEN: Record<string, string> = { alta: 'creado_en', ultima: 'ultima_reserva', nombre: 'nombre', telefono: 'telefono', origen: 'canal_origen' }
const LOTE_IDS = 1000

export default async function ClientesPage({ searchParams }: { searchParams: Promise<{ q?: string; orden?: string; pagina?: string; etiqueta?: string; origen?: string; sede?: string }> }) {
  const ctx = await getContexto()
  if (!ctx.modulosActivos.clientes) redirect('/')
  const { supabase, negocio } = ctx
  const sp = await searchParams
  const { q, orden: ordenParam } = sp
  const orden = leerOrden(ordenParam === 'nombre' ? 'nombre_asc' : ordenParam, ORDENES_VALIDOS, 'alta_desc')
  // la búsqueda se hace en la base (hay negocios con miles de clientes) y se pagina con range()
  const pagina = numPagina(sp.pagina)
  const desdeFila = (pagina - 1) * POR_PAGINA
  const texto = (q ?? '').trim().replace(/[,()%*\\]/g, ' ').trim()
  const digitos = texto.replace(/\D/g, '')
  const [{ data: catalogoDb }, bc] = await Promise.all([supabase.from('etiquetas').select('id, nombre').eq('negocio_id', negocio.id).order('nombre'), integracionBC(negocio.id)])
  const catalogo = (catalogoDb ?? []) as { id: string; nombre: string }[]
  // fichas que dicen "Sin nombre" y tienen teléfono: se pueden completar desde BotConversa
  const sinNombreBC = ctx.esSuperadmin && bc.activo ? ((await supabase.from('clientes').select('id', { count: 'exact', head: true }).eq('negocio_id', negocio.id).not('telefono', 'is', null).or('nombre.ilike."sin nombre",nombre.eq.""')).count ?? 0) : 0
  const etiquetaSel = catalogo.some((e) => e.id === sp.etiqueta) ? sp.etiqueta! : ''
  const origenSel = ORIGENES.some((o) => o.value === sp.origen) ? sp.origen! : ''
  // sede: la elegida acá, o la del selector de arriba; "todas" ignora el selector. Un cliente es de una sede si tiene reservas (no canceladas) en ella.
  const sedesFiltro = ctx.sedes
  const sedeSel = sp.sede === 'todas' ? '' : sedesFiltro.some((s) => s.id === sp.sede) ? sp.sede! : ctx.sede?.id ?? ''
  // 'filtro' deja solo los clientes con esa etiqueta (join interno); 'chips' trae todas sus etiquetas para mostrarlas
  const filtros = `${etiquetaSel ? ', filtro:cliente_etiquetas!inner(etiqueta_id)' : ''}${sedeSel ? ', filtro_sede:reservas!inner(sucursal_id)' : ''}`
  const columnas: string = `id, nombre, telefono, canal_origen, ultima_interaccion, ultima_reserva, creado_en, chips:cliente_etiquetas(etiquetas(nombre))${filtros}`
  // consulta con todos los filtros (búsqueda, etiqueta, origen, sede); 'cols' elige qué columnas trae
  const filtrada = (cols: string, conCuenta = false) => {
    let cq = supabase.from('clientes').select(cols, conCuenta ? { count: 'exact' } : undefined).eq('negocio_id', negocio.id)
    if (etiquetaSel) cq = cq.eq('filtro.etiqueta_id', etiquetaSel)
    if (origenSel) cq = cq.eq('canal_origen', origenSel)
    if (sedeSel) cq = cq.eq('filtro_sede.sucursal_id', sedeSel).is('filtro_sede.eliminado_en', null).neq('filtro_sede.estado', 'cancelada')
    if (texto) cq = cq.or([`nombre.ilike.%${texto}%`, ...(digitos ? [`telefono.like.%${digitos}%`] : [])].join(','))
    return cq
  }
  let lista: FilaCliente[] = []
  let totalClientes = 0
  if (orden.startsWith('reservas_')) {
    // El total de reservas no es una columna de clientes: se arma el orden completo (clientes filtrados + su total) y se toma la página pedida
    const totales = new Map<string, number>()
    for (let i = 0; ; i++) {
      const { data } = await supabase.rpc('resumen_reservas_clientes', { p_negocio: negocio.id, p_sede: sedeSel || null }).order('cliente_id').range(i * LOTE_IDS, (i + 1) * LOTE_IDS - 1)
      for (const f of (data ?? []) as { cliente_id: string; total: number }[]) totales.set(f.cliente_id, Number(f.total))
      if ((data?.length ?? 0) < LOTE_IDS) break
    }
    const todos: { id: string; nombre: string }[] = []
    for (let i = 0; ; i++) {
      const { data } = await filtrada(`id, nombre${filtros}`).order('id').range(i * LOTE_IDS, (i + 1) * LOTE_IDS - 1)
      todos.push(...((data ?? []) as unknown as { id: string; nombre: string }[]))
      if ((data?.length ?? 0) < LOTE_IDS) break
    }
    const sentido = orden === 'reservas_asc' ? 1 : -1
    todos.sort((x, y) => sentido * ((totales.get(x.id) ?? 0) - (totales.get(y.id) ?? 0)) || x.nombre.localeCompare(y.nombre, 'es') || x.id.localeCompare(y.id))
    totalClientes = todos.length
    const ids = todos.slice(desdeFila, desdeFila + POR_PAGINA).map((x) => x.id)
    if (ids.length) {
      const { data } = await supabase.from('clientes').select('id, nombre, telefono, canal_origen, ultima_interaccion, ultima_reserva, creado_en, chips:cliente_etiquetas(etiquetas(nombre))').in('id', ids)
      const porId = new Map(((data ?? []) as unknown as FilaCliente[]).map((c) => [c.id, c] as const))
      lista = ids.map((id) => porId.get(id)).filter((c): c is FilaCliente => !!c)
    }
  } else {
    const campo = orden === 'actividad' ? 'ultima_interaccion' : COLUMNA_ORDEN[orden.split('_')[0]]
    const asc = orden !== 'actividad' && orden.endsWith('_asc')
    const { data, count } = await filtrada(columnas, true).order(campo, { ascending: asc, nullsFirst: false }).order('id').range(desdeFila, desdeFila + POR_PAGINA - 1)
    lista = (data ?? []) as unknown as FilaCliente[]
    totalClientes = count ?? 0
  }

  // cuántas reservas (no canceladas) tiene cada cliente de la página, y la fecha de la última (de la sede elegida, si hay una)
  const resumen = new Map<string, { total: number; ultima: string | null }>()
  if (lista.length) {
    let rq = supabase.from('reservas').select('cliente_id, fecha').eq('negocio_id', negocio.id).in('cliente_id', lista.map((c) => c.id)).is('eliminado_en', null).neq('estado', 'cancelada').limit(20000)
    if (sedeSel) rq = rq.eq('sucursal_id', sedeSel)
    for (const r of ((await rq).data ?? []) as { cliente_id: string; fecha: string | null }[]) {
      const x = resumen.get(r.cliente_id) ?? { total: 0, ultima: null }
      x.total++
      if (r.fecha && (!x.ultima || r.fecha > x.ultima)) x.ultima = r.fecha
      resumen.set(r.cliente_id, x)
    }
  }
  const paramsOrden = { q: texto, etiqueta: etiquetaSel, origen: origenSel, sede: sp.sede }

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
        {sedesFiltro.length > 0 && (
          <select name="sede" defaultValue={sedeSel || 'todas'} aria-label="Filtrar por sede" className="input">
            <option value="todas">Todas las sedes</option>
            {sedesFiltro.map((s) => <option key={s.id} value={s.id}>{s.nombre}</option>)}
          </select>
        )}
        <button className="btn">Buscar</button>
        {(q || etiquetaSel || origenSel || sp.sede) && <Link href="/clientes" className="btn">Limpiar</Link>}
        <div className="ml-auto flex items-center gap-2">{sinNombreBC > 0 && <CompletarNombresBC pendientes={sinNombreBC} />}{ctx.puedeEscribir && <EtiquetarNumeroBtn catalogo={catalogo} esBotconversa={bc.activo} />}<OrdenSelect opciones={ORDENES} /></div>
      </form>

      <div className="card overflow-x-auto">
        <table className="w-full min-w-[760px]">
          <thead className="border-b border-rs-border">
            <tr>
              <ThOrden ruta="/clientes" params={paramsOrden} campo="nombre" orden={orden}>Nombre</ThOrden>
              <ThOrden ruta="/clientes" params={paramsOrden} campo="telefono" orden={orden}>Teléfono</ThOrden>
              <th className="th">Etiquetas</th>
              <ThOrden ruta="/clientes" params={paramsOrden} campo="reservas" orden={orden} primero="desc">Reservas</ThOrden>
              <ThOrden ruta="/clientes" params={paramsOrden} campo="ultima" orden={orden} primero="desc">Última reserva</ThOrden>
              <ThOrden ruta="/clientes" params={paramsOrden} campo="origen" orden={orden}>Origen</ThOrden>
              <ThOrden ruta="/clientes" params={paramsOrden} campo="alta" orden={orden} primero="desc">Alta</ThOrden>
            </tr>
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
                  <td className="td text-rs-muted">{((sedeSel ? r?.ultima : c.ultima_reserva ?? r?.ultima)) ? fechaCorta((sedeSel ? r?.ultima : c.ultima_reserva ?? r?.ultima)!) : '—'}</td>
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
