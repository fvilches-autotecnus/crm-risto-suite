import Link from 'next/link'
import { notFound } from 'next/navigation'
import { ArrowLeft } from 'lucide-react'
import { getContexto } from '@/lib/context'
import { fechaCorta, horaCorta } from '@/lib/fechas'
import { labelTipo } from '@/lib/reservas'
import { EstadoBadge } from '@/components/reservas-ui'
import NotasCliente from './notas'
import EditarNombreCliente from '@/components/editar-nombre-cliente'
import { labelOrigen } from '@/lib/origen'
import { EtiquetasCliente, type EtiquetaUI } from '@/components/etiquetas-ui'
import { integracionBC } from '@/lib/etiquetas'
import { EditarCumple } from '@/components/cumples-ui'
import { ListaResenas, NuevaResenaBtn, type ResenaUI } from '@/components/resenas-ui'
import { BadgeVoucher, NuevoVoucherBtn } from '@/components/vouchers-ui'
import { labelCampana } from '@/lib/vouchers'
import { hoyEn } from '@/lib/fechas'
import { edadActual, proximoCumple, textoCumple, textoFaltan } from '@/lib/cumples'

export default async function ClienteDetalle({ params }: { params: Promise<{ id: string }> }) {
  const ctx = await getContexto()
  const { supabase, negocio } = ctx
  const { id } = await params
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound()

  const { data: cliente } = await supabase.from('clientes').select('id, nombre, telefono, email, canal_origen, notas, creado_en, cumple_dia, cumple_mes, fecha_nacimiento').eq('id', id).eq('negocio_id', negocio.id).maybeSingle()
  if (!cliente) notFound()

  const { data: reservas } = await supabase
    .from('reservas')
    .select('id, numero, fecha, hora, cantidad_personas, tipo_reserva, estado, observaciones')
    .eq('cliente_id', id)
    .is('eliminado_en', null)
    .order('fecha', { ascending: false, nullsFirst: true })

  const hoy = hoyEn(negocio.zona_horaria)
  const { data: vouchersCliente } = ctx.modulosActivos.vouchers
    ? await supabase.from('vouchers').select('id, codigo, beneficio, campana, estado, vence_el').eq('negocio_id', negocio.id).eq('cliente_id', id).order('creado_en', { ascending: false }).limit(20)
    : { data: [] as { id: string; codigo: string; beneficio: string | null; campana: string | null; estado: 'vigente' | 'usado' | 'anulado'; vence_el: string | null }[] }
  const { data: resenasCliente } = ctx.modulosActivos.resenas
    ? await supabase.from('resenas').select('id, nombre, telefono, puntaje, comentario, origen, fecha, creado_en, cliente_id, sucursal_id').eq('negocio_id', negocio.id).eq('cliente_id', id).order('creado_en', { ascending: false }).limit(50)
    : { data: [] as ResenaUI[] }
  const [{ data: catalogoDb }, { data: aplicadasDb }, bc] = await Promise.all([
    supabase.from('etiquetas').select('id, nombre').eq('negocio_id', negocio.id).order('nombre'),
    supabase.from('cliente_etiquetas').select('etiquetas(id, nombre)').eq('cliente_id', id),
    integracionBC(negocio.id),
  ])
  const catalogo = (catalogoDb ?? []) as EtiquetaUI[]
  const aplicadas = ((aplicadasDb ?? []) as unknown as { etiquetas: EtiquetaUI | null }[]).map((x) => x.etiquetas).filter((x): x is EtiquetaUI => !!x).sort((a, b) => a.nombre.localeCompare(b.nombre))
  const prox = cliente.cumple_dia && cliente.cumple_mes ? proximoCumple(cliente.cumple_dia, cliente.cumple_mes, hoy) : null

  return (
    <div className="space-y-6">
      <Link href="/clientes" className="inline-flex items-center gap-1.5 text-sm text-rs-muted hover:text-rs-text"><ArrowLeft size={14} /> Clientes</Link>

      <div className="card p-5">
        <div className="flex flex-wrap items-center gap-3"><h1 className="text-xl font-bold">{cliente.nombre}</h1>{ctx.puedeEscribir && <EditarNombreCliente id={cliente.id} nombre={cliente.nombre} conTexto />}</div>
        <dl className="mt-3 grid gap-3 text-sm sm:grid-cols-3">
          <div><dt className="card-title">Teléfono</dt><dd className="mt-1">{cliente.telefono ?? '—'}</dd></div>
          <div><dt className="card-title">Origen</dt><dd className="mt-1">{labelOrigen(cliente.canal_origen)}</dd></div>
          <div><dt className="card-title">Cliente desde</dt><dd className="mt-1">{fechaCorta(cliente.creado_en.slice(0, 10))}</dd></div>
        </dl>
        {cliente.telefono && ctx.modulosActivos.conversaciones && (
          <Link href={`/conversaciones?tel=${cliente.telefono}`} className="btn btn-sm mt-4 inline-flex">Ver conversación</Link>
        )}
      </div>

      <EtiquetasCliente clienteId={cliente.id} aplicadas={aplicadas} catalogo={catalogo} puedeEscribir={ctx.puedeEscribir} esBotconversa={bc.activo} />

      <NotasCliente id={cliente.id} notas={cliente.notas ?? ''} puedeEscribir={ctx.puedeEscribir} />

      {ctx.modulosActivos.cumpleanos && (
        <section className="card flex flex-wrap items-center justify-between gap-3 p-5">
          <div>
            <h2 className="card-title">Cumpleaños</h2>
            <p className="mt-1 text-sm">{prox ? <><span className="font-semibold">{textoCumple(cliente.cumple_dia!, cliente.cumple_mes!)}</span> <span className="text-rs-muted">· {textoFaltan(prox.dias)}{cliente.fecha_nacimiento ? ` · ${edadActual(cliente.fecha_nacimiento, hoy)} años` : ''}</span></> : <span className="text-rs-muted">Sin cargar</span>}</p>
          </div>
          {ctx.puedeEscribir && <EditarCumple cliente={{ id: cliente.id, nombre: cliente.nombre, dia: cliente.cumple_dia, mes: cliente.cumple_mes, anio: cliente.fecha_nacimiento ? Number(cliente.fecha_nacimiento.slice(0, 4)) : null }} />}
        </section>
      )}

      {ctx.modulosActivos.vouchers && (
        <section className="card p-5">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h2 className="card-title">Vouchers</h2>
            {ctx.puedeEscribir && <NuevoVoucherBtn chico etiqueta="Nuevo voucher" prefill={{ cliente_id: cliente.id, nombre: cliente.nombre, telefono: cliente.telefono ?? '' }} />}
          </div>
          <ul className="mt-3 divide-y divide-rs-border/60">
            {(vouchersCliente ?? []).length === 0 && <li className="py-3 text-sm text-rs-muted">Este cliente no tiene vouchers.</li>}
            {(vouchersCliente ?? []).map((v) => (
              <li key={v.id} className="flex flex-wrap items-center justify-between gap-2 py-2.5 text-sm">
                <span><span className="font-mono font-semibold text-rs-lime">{v.codigo}</span> <span className="text-rs-muted">· {v.beneficio ?? '—'} · {labelCampana(v.campana)}</span></span>
                <BadgeVoucher estado={v.estado} vencido={v.estado === 'vigente' && !!v.vence_el && v.vence_el < hoy} />
              </li>
            ))}
          </ul>
        </section>
      )}

      {ctx.modulosActivos.resenas && (
        <section>
          <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
            <h2 className="card-title">Reseñas</h2>
            {ctx.puedeEscribir && <NuevaResenaBtn chico sedes={ctx.sedes.map((x) => ({ id: x.id, nombre: x.nombre }))} hoy={hoy} prefill={{ cliente_id: cliente.id, nombre: cliente.nombre, telefono: cliente.telefono ?? '' }} />}
          </div>
          <ListaResenas resenas={(resenasCliente ?? []) as ResenaUI[]} mostrarCliente={false} sedes={ctx.sedes.map((x) => ({ id: x.id, nombre: x.nombre }))} nombresSede={Object.fromEntries(ctx.sedesTodas.map((x) => [x.id, x.nombre]))} hoy={hoy} puedeEscribir={ctx.puedeEscribir} puedeEliminar={ctx.puedeAdministrar} />
        </section>
      )}

      <section>
        <h2 className="card-title mb-3">Historial de reservas</h2>
        <div className="card overflow-x-auto">
          <table className="w-full min-w-[560px]">
            <thead className="border-b border-rs-border">
              <tr><th className="th">#</th><th className="th">Fecha</th><th className="th">Hora</th><th className="th">Personas</th><th className="th">Tipo</th><th className="th">Estado</th></tr>
            </thead>
            <tbody>
              {(reservas ?? []).length === 0 && <tr><td colSpan={6} className="td py-8 text-center text-rs-muted">Sin reservas.</td></tr>}
              {(reservas ?? []).map((r) => (
                <tr key={r.id} className="border-b border-rs-border/60 last:border-0">
                  <td className="td font-semibold text-rs-lime">#{r.numero}</td>
                  <td className="td">{fechaCorta(r.fecha)}</td>
                  <td className="td">{horaCorta(r.hora)}</td>
                  <td className="td">{r.cantidad_personas ?? '—'}</td>
                  <td className="td text-rs-muted">{labelTipo(r.tipo_reserva)}</td>
                  <td className="td"><EstadoBadge estado={r.estado} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  )
}
