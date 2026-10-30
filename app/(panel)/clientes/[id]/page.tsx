import Link from 'next/link'
import { notFound, redirect } from 'next/navigation'
import { ArrowLeft } from 'lucide-react'
import { getContexto } from '@/lib/context'
import { fechaCorta, horaCorta } from '@/lib/fechas'
import { labelTipo } from '@/lib/reservas'
import { cargarTiposReserva } from '@/lib/config-reservas-servidor'
import { EstadoBadge } from '@/components/reservas-ui'
import NotasCliente from './notas'
import EditarNombreCliente from '@/components/editar-nombre-cliente'
import { labelOrigen } from '@/lib/origen'
import { EtiquetasCliente, type EtiquetaUI } from '@/components/etiquetas-ui'
import { cuentasBC, integracionBC } from '@/lib/etiquetas'
import { SilencioBot, type CuentaSilencio } from '@/components/silencio-bot-ui'
import { estadoSilencio } from '@/lib/silencio'
import { EditarCumple } from '@/components/cumples-ui'
import { ListaResenas, NuevaResenaBtn, type ResenaUI } from '@/components/resenas-ui'
import { BadgeVoucher, NuevoVoucherBtn } from '@/components/vouchers-ui'
import { labelCampana } from '@/lib/vouchers'
import { hoyEn } from '@/lib/fechas'
import { edadActual, proximoCumple, textoCumple, textoFaltan } from '@/lib/cumples'
import { proximoPremio, textoRegla, textoVisitas, type ReglaFidelidad } from '@/lib/fidelidad'

export default async function ClienteDetalle({ params }: { params: Promise<{ id: string }> }) {
  const ctx = await getContexto()
  if (!ctx.modulosActivos.clientes) redirect('/')
  const { supabase, negocio } = ctx
  const { id } = await params
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound()

  const etiquetasTipo = Object.fromEntries((await cargarTiposReserva(ctx)).map((t) => [t.clave, t.etiqueta]))
  const { data: cliente } = await supabase.from('clientes').select('id, nombre, telefono, email, canal_origen, notas, creado_en, cumple_dia, cumple_mes, fecha_nacimiento').eq('id', id).eq('negocio_id', negocio.id).maybeSingle()
  if (!cliente) notFound()

  const { data: reservas } = await supabase
    .from('reservas')
    .select('id, numero, numero_sede, fecha, hora, cantidad_personas, tipo_reserva, estado, observaciones')
    .eq('cliente_id', id)
    .is('eliminado_en', null)
    .order('fecha', { ascending: false, nullsFirst: true })

  const hoy = hoyEn(negocio.zona_horaria)
  // Fidelización: visitas del cliente, próxima meta y premios recibidos
  const fid = ctx.modulosActivos.fidelizacion
    ? await Promise.all([
        supabase.from('fidelidad_config').select('activo').eq('negocio_id', negocio.id).maybeSingle(),
        supabase.rpc('fidelidad_resumen', { p_negocio: negocio.id, p_cliente: id }),
        supabase.from('fidelidad_reglas').select('id, nombre, visitas, repetir, beneficio, vence_dias, activa').eq('negocio_id', negocio.id).order('visitas'),
        supabase.from('fidelidad_premios').select('id, hito, creado_en, regla:fidelidad_reglas(nombre, beneficio), voucher:vouchers(codigo, estado)').eq('cliente_id', id).order('creado_en', { ascending: false }),
      ])
    : null
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
  // BotConversa: una cuenta por sede que tenga la suya (solo las sedes del usuario) y la del negocio; cada una con su estado de silencio para este cliente
  const cuentasBot: CuentaSilencio[] = []
  if (ctx.puedeSilenciarBot && cliente.telefono) {
    const [cb, { data: estados }] = await Promise.all([cuentasBC(negocio.id), supabase.from('cliente_botconversa').select('sucursal_id, bot_silenciado_en, bot_silenciado_hasta').eq('cliente_id', id)])
    const estado = (sid: string | null) => estadoSilencio((estados ?? []).find((e) => (e.sucursal_id ?? null) === sid) ?? { bot_silenciado_en: null, bot_silenciado_hasta: null })
    for (const s of [...ctx.sedesGestion.filter((x) => x.activa)].sort((a, b) => Number(b.id === ctx.sede?.id) - Number(a.id === ctx.sede?.id))) {
      const c = cb.sedes[s.id]
      if (c?.activo && c.tieneClave) cuentasBot.push({ sucursalId: s.id, nombre: s.nombre, estado: estado(s.id), flujos: c.flujos })
    }
    if (cb.negocio.activo && cb.negocio.tieneClave) cuentasBot.push({ sucursalId: null, nombre: 'Cuenta del negocio', estado: estado(null), flujos: cb.negocio.flujos })
  }
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

      {cuentasBot.length > 0 && <SilencioBot clienteId={cliente.id} cuentas={cuentasBot} />}

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

      {fid && (() => {
        const activo = fid[0].data?.activo === true
        const resumen = (fid[1].data ?? [])[0] as { visitas: number; total: number; ultima: string | null } | undefined
        const reglas = (fid[2].data ?? []) as ReglaFidelidad[]
        const prox = proximoPremio(resumen?.visitas ?? 0, reglas)
        const premios = (fid[3].data ?? []) as unknown as { id: string; hito: number; creado_en: string; regla: { nombre: string; beneficio: string } | null; voucher: { codigo: string; estado: string } | null }[]
        const meta = prox ? (prox.regla.repetir ? Math.ceil(((resumen?.visitas ?? 0) + 1) / prox.regla.visitas) * prox.regla.visitas : prox.regla.visitas) : 0
        return (
          <section className="card p-5">
            <div className="flex flex-wrap items-center justify-between gap-3"><h2 className="card-title">Fidelidad</h2><Link href="/fidelizacion" className="text-xs text-rs-lime hover:underline">Ver programa</Link></div>
            {!activo ? <p className="mt-2 text-sm text-rs-muted">El programa de fidelización está apagado.</p> : (
              <>
                <p className="mt-2 text-sm"><span className="text-2xl font-bold tabular-nums text-rs-lime">{resumen?.visitas ?? 0}</span> <span className="text-rs-muted">{(resumen?.visitas ?? 0) === 1 ? 'visita' : 'visitas'} en el programa{resumen && resumen.total !== resumen.visitas ? ` · ${textoVisitas(resumen.total)} en total` : ''}{resumen?.ultima ? ` · última el ${fechaCorta(resumen.ultima)}` : ''}</span></p>
                {prox && <div className="mt-3"><div className="flex items-center justify-between text-xs text-rs-muted"><span>{prox.faltan === 1 ? 'Le falta 1 visita' : `Le faltan ${prox.faltan} visitas`} para: <span className="text-rs-text">{prox.regla.beneficio}</span></span><span>{resumen?.visitas ?? 0}/{meta}</span></div><div className="mt-1 h-2 overflow-hidden rounded-full bg-rs-raised"><div className="h-full rounded-full bg-rs-lime" style={{ width: `${Math.min(100, ((resumen?.visitas ?? 0) / Math.max(meta, 1)) * 100)}%` }} /></div><p className="mt-1 text-xs text-rs-muted">{textoRegla(prox.regla)}</p></div>}
                <ul className="mt-3 divide-y divide-rs-border/60">
                  {premios.length === 0 && <li className="py-2 text-sm text-rs-muted">Todavía no recibió premios.</li>}
                  {premios.map((p) => <li key={p.id} className="flex flex-wrap items-center justify-between gap-2 py-2 text-sm"><span>{p.regla?.beneficio ?? '—'} <span className="text-rs-muted">· visita {p.hito} · {fechaCorta(p.creado_en.slice(0, 10))}</span></span><span className="font-mono font-semibold text-rs-lime">{p.voucher?.codigo ?? '—'}</span></li>)}
                </ul>
              </>
            )}
          </section>
        )
      })()}

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
                  <td className="td font-semibold text-rs-lime">#{r.numero_sede ?? r.numero}</td>
                  <td className="td">{fechaCorta(r.fecha)}</td>
                  <td className="td">{horaCorta(r.hora)}</td>
                  <td className="td">{r.cantidad_personas ?? '—'}</td>
                  <td className="td text-rs-muted">{labelTipo(r.tipo_reserva, etiquetasTipo)}</td>
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
