import Link from 'next/link'
import { redirect } from 'next/navigation'
import { Search, ShoppingBag } from 'lucide-react'
import { Tile } from '@/components/dashboard-ui'
import Paginacion from '@/components/paginacion'
import { BotonesPedidos, ListaPedidos, PedidosEnVivo, type OpcionCatalogo } from '@/components/pedidos-ui'
import { getContexto } from '@/lib/context'
import { hoyEn, sumarDias } from '@/lib/fechas'
import { numPagina, paginar } from '@/lib/paginacion'
import { CONFIG_PEDIDOS_POR_DEFECTO, ESTADOS_ACTIVOS, dinero, type ConfigPedidos, type Pedido } from '@/lib/pedidos'

const TABS = [{ v: 'activos', l: 'En curso' }, { v: 'entregados', l: 'Entregados' }, { v: 'cancelados', l: 'Cancelados' }, { v: 'todos', l: 'Todos' }]
const PERIODOS = [{ v: 'hoy', l: 'Hoy' }, { v: '7', l: '7 días' }, { v: '30', l: '30 días' }, { v: 'todos', l: 'Todo' }]
const COLS = 'id, numero, nombre, telefono, tipo, mesa, direccion, observaciones, medio_pago, estado, subtotal, envio, total, motivo_cancelacion, origen, creado_en, aceptado_en, listo_en, entregado_en, cancelado_en, items:pedido_items(id, nombre, variante, precio_unit, cantidad, observaciones, subtotal)'

export default async function PedidosPage({ searchParams }: { searchParams: Promise<{ tab?: string; periodo?: string; q?: string; pagina?: string }> }) {
  const ctx = await getContexto()
  if (!ctx.modulosActivos.pedidos) redirect('/')
  const { supabase, negocio } = ctx
  const sp = await searchParams
  const tab = TABS.some((t) => t.v === sp.tab) ? sp.tab! : 'activos'
  const periodo = PERIODOS.some((p) => p.v === sp.periodo) ? sp.periodo! : 'hoy'
  const q = (sp.q ?? '').trim().replace(/[,()%*]/g, ' ')
  const hoy = hoyEn(negocio.zona_horaria)
  const desde = (p: string) => (p === 'todos' ? null : `${p === 'hoy' ? hoy : sumarDias(hoy, -Number(p))}T00:00:00-03:00`)

  let consulta = supabase.from('pedidos').select(COLS).eq('negocio_id', negocio.id)
  if (tab === 'activos') consulta = consulta.in('estado', ESTADOS_ACTIVOS)
  else if (tab === 'entregados') consulta = consulta.eq('estado', 'entregado')
  else if (tab === 'cancelados') consulta = consulta.eq('estado', 'cancelado')
  if (tab !== 'activos' && desde(periodo)) consulta = consulta.gte('creado_en', desde(periodo)!)
  if (q) { const n = Number(q.replace('#', '')); consulta = Number.isInteger(n) && n > 0 ? consulta.or(`numero.eq.${n},nombre.ilike.%${q}%,telefono.ilike.%${q}%`) : consulta.or(`nombre.ilike.%${q}%,telefono.ilike.%${q}%`) }

  const [{ data }, { data: cfg }, { data: hoyRows }, { data: prods }] = await Promise.all([
    consulta.order('creado_en', { ascending: tab === 'activos' }).limit(300),
    supabase.from('pedidos_config').select('recibe, retiro, delivery, mesa, costo_envio, pedido_minimo, tiempo_estimado, medios_pago, datos_pago, mensaje').eq('negocio_id', negocio.id).maybeSingle(),
    supabase.from('pedidos').select('estado, total').eq('negocio_id', negocio.id).gte('creado_en', `${hoy}T00:00:00-03:00`).limit(2000),
    supabase.from('carta_productos').select('id, nombre, precio, variantes, categoria:carta_categorias(nombre, visible, orden)').eq('negocio_id', negocio.id).eq('visible', true).eq('disponible', true).order('orden').limit(3000),
  ])
  const config: ConfigPedidos = { ...CONFIG_PEDIDOS_POR_DEFECTO, ...(cfg ?? {}), costo_envio: Number(cfg?.costo_envio ?? 0), pedido_minimo: Number(cfg?.pedido_minimo ?? 0) } as ConfigPedidos
  const pedidos: Pedido[] = (data ?? []).map((p) => ({ ...p, subtotal: Number(p.subtotal), envio: Number(p.envio), total: Number(p.total), items: ((p as unknown as { items: Pedido['items'] }).items ?? []).map((i) => ({ ...i, precio_unit: Number(i.precio_unit), subtotal: Number(i.subtotal) })) })) as unknown as Pedido[]

  const catalogo: OpcionCatalogo[] = []
  for (const p of (prods ?? []) as unknown as { id: string; nombre: string; precio: number | null; variantes: { nombre: string; precio: number }[]; categoria: { nombre: string; visible: boolean; orden: number } | null }[]) {
    if (!p.categoria?.visible) continue
    if (Array.isArray(p.variantes) && p.variantes.length) for (const v of p.variantes) catalogo.push({ clave: `${p.id}|${v.nombre}`, producto_id: p.id, variante: v.nombre, label: `${p.nombre} · ${v.nombre}`, precio: Number(v.precio), categoria: p.categoria.nombre })
    else if (p.precio !== null) catalogo.push({ clave: p.id, producto_id: p.id, variante: null, label: p.nombre, precio: Number(p.precio), categoria: p.categoria.nombre })
  }

  const delDia = hoyRows ?? []
  const enCurso = delDia.filter((r) => ESTADOS_ACTIVOS.includes(r.estado as never)).length
  const nuevos = delDia.filter((r) => r.estado === 'nuevo').length
  const validos = delDia.filter((r) => r.estado !== 'cancelado')
  const ventas = validos.reduce((s, r) => s + Number(r.total), 0)
  const pg = paginar(pedidos, numPagina(sp.pagina), 20)
  const link = (cambios: Record<string, string>) => { const p = new URLSearchParams({ tab, periodo, ...(q ? { q } : {}), ...cambios }); return `/pedidos?${p.toString()}` }

  return (
    <div className="space-y-5">
      <PedidosEnVivo negocioId={negocio.id} />
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div className="animate-fade-up">
          <h1 className="flex items-center gap-2 text-xl font-bold sm:text-2xl"><ShoppingBag className="text-rs-lime" size={22} />Pedidos</h1>
          <p className="text-sm text-rs-muted">Retiro, delivery y pedidos en mesa, armados desde la carta</p>
        </div>
        <BotonesPedidos config={config} catalogo={catalogo} slug={negocio.slug} puedeEscribir={ctx.puedeEscribir} puedeAjustes={ctx.puedeAdministrar || ctx.rol === 'encargado'} hayConfig={!!cfg} />
      </div>

      {!cfg ? (
        <p role="status" className="rounded-md border border-rs-warn/40 bg-rs-warn/10 px-3 py-2 text-sm text-rs-warn">Todavía no configuraste los pedidos. {ctx.puedeAdministrar || ctx.rol === 'encargado' ? 'Entrá a Ajustes: elegí formas de entrega y medios de pago y encendé “Recibiendo pedidos”.' : 'Pedile a un administrador que lo configure.'}</p>
      ) : !config.recibe ? (
        <p role="status" className="rounded-md border border-rs-warn/40 bg-rs-warn/10 px-3 py-2 text-sm text-rs-warn">Los pedidos están en pausa: la carta pública y el bot no aceptan pedidos nuevos (los que cargues a mano sí).</p>
      ) : null}
      {!ctx.modulosActivos.carta && <p className="rounded-md bg-rs-raised/60 px-3 py-2 text-sm text-rs-muted">El módulo Carta está apagado: los clientes no pueden armar pedidos desde la carta pública. Podés encenderlo desde Configuración → Funciones.</p>}

      <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
        <Tile i={0} valor={enCurso} etiqueta="En curso hoy" color="text-rs-lime" sub="Pedidos sin entregar" />
        <Tile i={1} valor={nuevos} etiqueta="Nuevos sin aceptar" color={nuevos ? 'text-rs-warn' : 'text-rs-muted'} sub="Esperan tu respuesta" />
        <Tile i={2} valor={validos.length} etiqueta="Pedidos de hoy" color="text-rs-text" sub="Sin contar cancelados" />
        <div className="reveal card p-4 sm:p-5" style={{ ['--i' as string]: 3 }}><div className="text-2xl font-bold tabular-nums text-rs-ok sm:text-3xl">{dinero(ventas)}</div><div className="card-title mt-3">Ventas de hoy</div><div className="mt-1 text-xs text-rs-muted/80">Pedidos no cancelados</div></div>
      </div>

      <div className="card space-y-3 p-4">
        <div className="flex flex-wrap items-center gap-2">
          <form className="relative min-w-[220px] flex-1">
            <input type="hidden" name="tab" value={tab} /><input type="hidden" name="periodo" value={periodo} />
            <Search size={14} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-rs-muted" />
            <input name="q" defaultValue={sp.q ?? ''} placeholder="Buscar por número, nombre o teléfono" className="input w-full pl-9" />
          </form>
        </div>
        <div className="flex flex-wrap items-center gap-2"><span className="label mb-0 mr-1 w-14 shrink-0">Ver</span>{TABS.map((t) => <Link key={t.v} href={link({ tab: t.v })} className={'btn btn-sm ' + (tab === t.v ? 'btn-primary' : '')}>{t.l}</Link>)}</div>
        {tab !== 'activos' && <div className="flex flex-wrap items-center gap-2"><span className="label mb-0 mr-1 w-14 shrink-0">Período</span>{PERIODOS.map((p) => <Link key={p.v} href={link({ periodo: p.v })} className={'btn btn-sm ' + (periodo === p.v ? 'btn-primary' : '')}>{p.l}</Link>)}</div>}
      </div>

      <ListaPedidos pedidos={pg.items} negocio={negocio.nombre} tiempo={config.tiempo_estimado} puedeEscribir={ctx.puedeEscribir} />
      <Paginacion ruta="/pedidos" params={sp} {...pg} />
    </div>
  )
}
