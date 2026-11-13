import { ambos, leerOrden, ordenarPor } from '@/lib/orden'
import Link from 'next/link'
import { redirect } from 'next/navigation'
import { Search, Ticket } from 'lucide-react'
import OrdenSelect from '@/components/orden-select'
import VouchersEnVivo from '@/components/vouchers-en-vivo'
import { NuevoVoucherBtn, ListaVouchers, type VoucherUI } from '@/components/vouchers-ui'
import { getContexto } from '@/lib/context'
import Paginacion from '@/components/paginacion'
import { hoyEn } from '@/lib/fechas'
import { numPagina, paginar } from '@/lib/paginacion'

const FILTROS = [{ v: 'todos', l: 'Todos' }, { v: 'vigentes', l: 'Vigentes' }, { v: 'usados', l: 'Usados' }, { v: 'vencidos', l: 'Vencidos' }]

const ORDENES = [
  { value: 'alta_desc', label: 'Alta: más recientes primero' },
  { value: 'alta_asc', label: 'Alta: más antiguas primero' },
  { value: 'vence_asc', label: 'Vencimiento: más próximo primero' },
  { value: 'vence_desc', label: 'Vencimiento: más lejano primero' },
  { value: 'nombre_asc', label: 'Nombre (A–Z)' },
  { value: 'nombre_desc', label: 'Nombre (Z–A)' },
]
const COLUMNAS_ORDEN: Record<string, string[]> = { alta: ['creado_en'], codigo: ['codigo'], nombre: ['nombre', 'creado_en'], telefono: ['telefono'], beneficio: ['beneficio', 'creado_en'], campana: ['campana', 'creado_en'], vence: ['vence_el', 'creado_en'] }
const ORDENES_VALIDOS = ambos('alta', 'codigo', 'nombre', 'telefono', 'beneficio', 'campana', 'vence')

export default async function VouchersPage({ searchParams }: { searchParams: Promise<{ pagina?: string; estado?: string; q?: string; orden?: string }> }) {
  const ctx = await getContexto()
  if (!ctx.modulosActivos.vouchers) redirect('/')
  const { supabase, negocio } = ctx
  const sp = await searchParams
  const filtro = FILTROS.some((f) => f.v === sp.estado) ? sp.estado! : 'todos'
  const hoy = hoyEn(negocio.zona_horaria)
  const q = (sp.q ?? '').trim().replace(/[,()%*]/g, ' ')

  let consulta = supabase.from('vouchers').select('id, codigo, nombre, telefono, beneficio, campana, estado, vence_el, creado_en').eq('negocio_id', negocio.id)
  if (q) consulta = consulta.or(`codigo.ilike.%${q}%,nombre.ilike.%${q}%,telefono.ilike.%${q}%`)
  const orden = leerOrden(sp.orden, ORDENES_VALIDOS, 'alta_desc')
  const { data } = await ordenarPor(consulta, orden, COLUMNAS_ORDEN).limit(20000)
  const todos = (data ?? []) as VoucherUI[]

  const vencido = (v: VoucherUI) => v.estado === 'vigente' && !!v.vence_el && v.vence_el < hoy
  const conteo = { vigentes: todos.filter((v) => v.estado === 'vigente' && !vencido(v)).length, usados: todos.filter((v) => v.estado === 'usado').length, vencidos: todos.filter(vencido).length }
  const filtrados = todos.filter((v) => filtro === 'todos' ? true : filtro === 'vigentes' ? v.estado === 'vigente' && !vencido(v) : filtro === 'usados' ? v.estado === 'usado' : vencido(v))

  const pg = paginar(filtrados, numPagina(sp.pagina))

  const link = (estado: string) => `/vouchers?estado=${estado}${q ? `&q=${encodeURIComponent(q)}` : ''}${orden !== 'alta_desc' ? `&orden=${orden}` : ''}`

  return (
    <div className="space-y-5">
      <VouchersEnVivo negocioId={negocio.id} />
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div className="animate-fade-up">
          <h1 className="flex items-center gap-2 text-xl font-bold sm:text-2xl"><Ticket className="text-rs-lime" size={22} />Vouchers</h1>
          <p className="text-sm text-rs-muted">Administrá códigos y su estado de uso</p>
        </div>
        {ctx.puedeEscribir && <NuevoVoucherBtn />}
      </div>

      <div className="grid grid-cols-3 gap-3">
        {[['Vigentes', conteo.vigentes, 'text-rs-ok'], ['Usados', conteo.usados, 'text-rs-text'], ['Vencidos', conteo.vencidos, 'text-rs-warn']].map(([l, n, c], i) => (
          <div key={l as string} className="reveal card px-4 py-3" style={{ ['--i' as string]: i }}><div className={'text-2xl font-bold tabular-nums ' + c}>{n}</div><div className="card-title mt-1">{l}</div></div>
        ))}
      </div>

      <div className="flex flex-wrap items-center gap-2">
        {FILTROS.map((f) => <Link key={f.v} href={link(f.v)} className={'btn btn-sm ' + (filtro === f.v ? 'btn-primary' : '')}>{f.l}</Link>)}
        <div className="ml-auto flex flex-wrap items-center gap-2"><OrdenSelect opciones={ORDENES} />
        <form className="relative w-full sm:w-64">
          <input type="hidden" name="estado" value={filtro} />{orden !== 'alta_desc' && <input type="hidden" name="orden" value={orden} />}
          <Search size={14} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-rs-muted" />
          <input name="q" defaultValue={q} placeholder="Buscar por código, nombre o teléfono" className="input w-full pl-9" />
        </form>
        </div>
      </div>

      <ListaVouchers vouchers={pg.items} hoy={hoy} puedeEscribir={ctx.puedeEscribir} puedeEliminar={ctx.puedeAdministrar} orden={{ ruta: '/vouchers', params: sp, actual: orden }} />
      <Paginacion ruta="/vouchers" params={sp} {...pg} />
    </div>
  )
}
