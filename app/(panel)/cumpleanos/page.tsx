import Link from 'next/link'
import { redirect } from 'next/navigation'
import { Cake } from 'lucide-react'
import { AgregarCumpleBtn, EditarCumple } from '@/components/cumples-ui'
import { EstadoVacio } from '@/components/ui'
import { BadgeVoucher, NuevoVoucherBtn } from '@/components/vouchers-ui'
import { labelCampana } from '@/lib/vouchers'
import { PERIODOS_CUMPLE, proximoCumple, rangoPeriodo, textoCumple, textoFaltan, type PeriodoCumple } from '@/lib/cumples'
import { getContexto } from '@/lib/context'
import { hoyEn, sumarDias } from '@/lib/fechas'

export default async function CumpleanosPage({ searchParams }: { searchParams: Promise<{ periodo?: string }> }) {
  const ctx = await getContexto()
  if (!ctx.modulosActivos.cumpleanos) redirect('/')
  const { supabase, negocio } = ctx
  const sp = await searchParams
  const periodo = (PERIODOS_CUMPLE.some((p) => p.value === sp.periodo) ? sp.periodo : 'semana') as PeriodoCumple
  const hoy = hoyEn(negocio.zona_horaria)

  const { data: clientes } = await supabase.from('clientes').select('id, nombre, telefono, cumple_dia, cumple_mes').eq('negocio_id', negocio.id).not('cumple_mes', 'is', null).limit(5000)

  const rango = rangoPeriodo(periodo, hoy)
  const filas = (clientes ?? [])
    .map((c) => ({ ...c, prox: proximoCumple(c.cumple_dia!, c.cumple_mes!, hoy) }))
    // "Todos" mira hacia adelante (próximos 12 meses); los períodos con rango se comparan contra la próxima ocurrencia
    .filter((c) => !rango || (c.prox.fecha >= rango.desde && c.prox.fecha <= rango.hasta))
    .sort((a, b) => a.prox.dias - b.prox.dias || a.nombre.localeCompare(b.nombre))

  // Vouchers de cumpleaños emitidos en el último año para esos clientes (para saber a quién ya se le dio el regalo)
  const ids = filas.map((c) => c.id)
  const desde = sumarDias(hoy, -365)
  const vouchers = new Map<string, { codigo: string; estado: 'vigente' | 'usado' | 'anulado'; vence_el: string | null }>()
  for (let i = 0; i < ids.length; i += 100) {
    const { data } = await supabase.from('vouchers').select('cliente_id, codigo, estado, vence_el, creado_en').eq('negocio_id', negocio.id).eq('campana', 'cumpleanos').in('cliente_id', ids.slice(i, i + 100)).gte('creado_en', desde).order('creado_en', { ascending: false })
    for (const v of data ?? []) if (v.cliente_id && !vouchers.has(v.cliente_id)) vouchers.set(v.cliente_id, v)
  }
  const pendientes = filas.filter((c) => !vouchers.has(c.id)).length

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div className="animate-fade-up">
          <h1 className="flex items-center gap-2 text-xl font-bold sm:text-2xl"><Cake className="text-rs-lime" size={22} />Cumpleaños</h1>
          <p className="text-sm text-rs-muted">Clientes con regalo pendiente de planificar</p>
        </div>
        {ctx.puedeEscribir && <AgregarCumpleBtn />}
      </div>

      <div className="flex flex-wrap gap-2">
        {PERIODOS_CUMPLE.map((p) => <Link key={p.value} href={`/cumpleanos?periodo=${p.value}`} className={'btn btn-sm ' + (periodo === p.value ? 'btn-primary' : '')}>{p.label}</Link>)}
      </div>

      <p className="text-sm text-rs-muted"><span className="font-semibold text-rs-text">{filas.length}</span> cumpleaños en este período · <span className="font-semibold text-rs-warn">{pendientes}</span> sin regalo asignado</p>

      {filas.length === 0 ? (
        <div className="card"><EstadoVacio icono={<Cake size={26} />} titulo="No hay cumpleaños en este período" texto="Los cumpleaños se cargan solos cuando una reserva trae la fecha, o a mano con “Agregar cumpleaños”." /></div>
      ) : (
        <div className="card overflow-x-auto">
          <table className="w-full min-w-[720px]">
            <thead className="border-b border-rs-border"><tr><th className="th">Nombre</th><th className="th">Teléfono</th><th className="th">Cumpleaños</th><th className="th">Regalo</th>{ctx.puedeEscribir && <th className="th text-right">Acciones</th>}</tr></thead>
            <tbody>
              {filas.map((c, i) => {
                const v = vouchers.get(c.id)
                return (
                  <tr key={c.id} className="reveal border-b border-rs-border/60 transition-colors last:border-0 hover:bg-rs-raised/50" style={{ ['--i' as string]: Math.min(i, 12) }}>
                    <td className="td font-medium"><Link href={`/clientes/${c.id}`} className="transition-colors hover:text-rs-lime">{c.nombre}</Link></td>
                    <td className="td text-rs-muted">{c.telefono ?? '—'}</td>
                    <td className="td"><span className="font-semibold">{textoCumple(c.cumple_dia!, c.cumple_mes!)}</span> <span className={'text-xs ' + (c.prox.dias <= 1 ? 'font-semibold text-rs-lime' : 'text-rs-muted')}>· {textoFaltan(c.prox.dias)}</span></td>
                    <td className="td">
                      {v ? <span className="inline-flex items-center gap-2"><span className="font-mono text-xs text-rs-lime">{v.codigo}</span><BadgeVoucher estado={v.estado} vencido={v.estado === 'vigente' && !!v.vence_el && v.vence_el < hoy} /></span> : <span className="text-rs-warn">Sin voucher</span>}
                    </td>
                    {ctx.puedeEscribir && (
                      <td className="td">
                        <div className="flex justify-end gap-1.5">
                          {!v && <NuevoVoucherBtn chico etiqueta="Crear voucher" prefill={{ cliente_id: c.id, nombre: c.nombre, telefono: c.telefono ?? '', campana: 'cumpleanos' }} />}
                          <EditarCumple cliente={{ id: c.id, nombre: c.nombre, dia: c.cumple_dia, mes: c.cumple_mes }} />
                        </div>
                      </td>
                    )}
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}
      <p className="text-xs text-rs-muted">Campaña “{labelCampana('cumpleanos')}”: el regalo se considera asignado si el cliente tiene un voucher de cumpleaños emitido en el último año.</p>
    </div>
  )
}
