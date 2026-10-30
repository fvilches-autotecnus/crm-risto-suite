'use client'

import { useState } from 'react'
import { CopyPlus, Plus, X } from 'lucide-react'
import { guardarPedidosGeneral, guardarPedidosHorarios, guardarPedidosPagos } from '@/app/(panel)/pedidos-actions'
import { EstadoGuardado, useAutoGuardar } from '@/components/estado-guardado'
import { FechaInput, HoraInput } from '@/components/inputs'
import { MEDIOS_PAGO, TIPOS, type ConfigPedidos, type HorariosSemana, type MedioPago, type TipoPedido, type Turno } from '@/lib/pedidos'
import { DIAS_SEMANA } from '@/lib/pedidos-horarios'
import { fechaCorta } from '@/lib/fechas'

const casilla = 'mt-0.5 h-4 w-4 accent-[#c8e62b]'
function Check({ label, texto, checked, onChange, disabled }: { label: string; texto?: string; checked: boolean; onChange: (v: boolean) => void; disabled?: boolean }) {
  return (
    <label className={'flex items-start gap-2 text-sm ' + (disabled ? 'opacity-50' : '')}>
      <input type="checkbox" checked={checked} disabled={disabled} onChange={(e) => onChange(e.target.checked)} className={casilla} />
      <span><span className="font-medium">{label}</span>{texto && <span className="block text-xs text-rs-muted">{texto}</span>}</span>
    </label>
  )
}
const monto = (n: number | null) => (n ? String(n) : '')

// ---------------------------------------------------------------------------
// Recepción de pedidos
// ---------------------------------------------------------------------------
export function PedidosGeneral({ config }: { config: ConfigPedidos }) {
  const [d, setD] = useState({
    recibe: config.recibe, retiro: config.retiro, delivery: config.delivery, mesa: config.mesa, costo_envio: monto(config.costo_envio), envio_gratis_desde: monto(config.envio_gratis_desde),
    pedido_minimo: monto(config.pedido_minimo), tiempo_estimado: config.tiempo_estimado ?? '', tiempo_delivery: config.tiempo_delivery ?? '', mensaje: config.mensaje ?? '', aceptar_auto: config.aceptar_auto,
  })
  const poner = <K extends keyof typeof d>(k: K, v: (typeof d)[K]) => setD((x) => ({ ...x, [k]: v }))
  const { estado, error } = useAutoGuardar(JSON.stringify(d), () => guardarPedidosGeneral(d))
  return (
    <div className="mt-4 space-y-4">
      <Check label="Recibiendo pedidos" checked={d.recibe} onChange={(v) => poner('recibe', v)} texto="Interruptor general. Apagado, la carta pública y el bot no aceptan pedidos nuevos (los que cargás a mano sí)." />
      <fieldset className="space-y-2"><legend className="label">Formas de entrega</legend>
        <Check label="Retiro en el local" checked={d.retiro} onChange={(v) => poner('retiro', v)} />
        <Check label="Delivery (envío a domicilio)" checked={d.delivery} onChange={(v) => poner('delivery', v)} />
        <Check label="En mesa" checked={d.mesa} onChange={(v) => poner('mesa', v)} texto="Para pedir desde la mesa con el QR de las mesas." />
      </fieldset>
      <div className="grid gap-3 sm:grid-cols-3">
        <div><label className="label" htmlFor="pg_envio">Costo de envío ($)</label><input id="pg_envio" inputMode="decimal" value={d.costo_envio} onChange={(e) => poner('costo_envio', e.target.value)} placeholder="Gratis" className="input w-full" disabled={!d.delivery} /></div>
        <div><label className="label" htmlFor="pg_gratis">Envío gratis desde ($)</label><input id="pg_gratis" inputMode="decimal" value={d.envio_gratis_desde} onChange={(e) => poner('envio_gratis_desde', e.target.value)} placeholder="Siempre se cobra" className="input w-full" disabled={!d.delivery} /></div>
        <div><label className="label" htmlFor="pg_min">Pedido mínimo ($)</label><input id="pg_min" inputMode="decimal" value={d.pedido_minimo} onChange={(e) => poner('pedido_minimo', e.target.value)} placeholder="Sin mínimo" className="input w-full" /></div>
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        <div><label className="label" htmlFor="pg_tiempo">Tiempo estimado (se muestra al cliente)</label><input id="pg_tiempo" value={d.tiempo_estimado} onChange={(e) => poner('tiempo_estimado', e.target.value)} maxLength={60} placeholder="Ej. 20 a 30 minutos" className="input w-full" /></div>
        <div><label className="label" htmlFor="pg_tdel">Tiempo estimado del delivery</label><input id="pg_tdel" value={d.tiempo_delivery} onChange={(e) => poner('tiempo_delivery', e.target.value)} maxLength={60} placeholder="Si es distinto al de arriba" className="input w-full" disabled={!d.delivery} /></div>
      </div>
      <div><label className="label" htmlFor="pg_msg">Mensaje para el cliente</label><textarea id="pg_msg" value={d.mensaje} onChange={(e) => poner('mensaje', e.target.value)} maxLength={300} rows={2} placeholder="Ej. Avisanos si tenés alguna alergia." className="input w-full" /></div>
      <Check label="Aceptar los pedidos automáticamente" checked={d.aceptar_auto} onChange={(v) => poner('aceptar_auto', v)} texto="Los pedidos de la carta y del bot entran directo como “Aceptados” en lugar de esperar que alguien los acepte. Los que cargás a mano no cambian." />
      <div className="flex justify-end"><EstadoGuardado estado={estado} error={error} /></div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Horarios de pedidos
// ---------------------------------------------------------------------------
const TURNO_NUEVO: Turno = ['19:00', '23:00']
const minutos = (h: string) => { const [a, b] = h.split(':').map(Number); return (a || 0) * 60 + (b || 0) }
const hhmm = (m: number) => (m >= 1440 ? '24:00' : `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`)
/** La franja que se propone al tocar "Otra franja": arranca donde termina la última (y dura hasta 2 horas, o hasta medianoche). Sin lugar, no se ofrece. */
function siguienteTurno(turnos: Turno[]): Turno | null {
  if (turnos.length === 0) return [...TURNO_NUEVO] as Turno
  const fin = Math.max(...turnos.map((t) => minutos(t[1])))
  return fin >= 1410 ? null : [hhmm(fin), hhmm(Math.min(fin + 120, 1440))]
}

function EditorSemana({ valor, onChange, idBase }: { valor: HorariosSemana; onChange: (v: HorariosSemana) => void; idBase: string }) {
  const poner = (n: string, turnos: Turno[]) => { const nuevo = { ...valor }; if (turnos.length) nuevo[n as '0'] = turnos; else delete nuevo[n as '0']; onChange(nuevo) }
  const repetir = (turnos: Turno[]) => onChange(Object.fromEntries(DIAS_SEMANA.map((x) => [x.n, turnos.map((t) => [...t] as Turno)])) as HorariosSemana)
  return (
    <ul className="divide-y divide-rs-border/60 rounded-md border border-rs-border/60">
      {DIAS_SEMANA.map((dia) => {
        const turnos = valor[dia.n] ?? []
        const cambiar = (i: number, k: 0 | 1, v: string) => poner(dia.n, turnos.map((t, x) => (x === i ? (k === 0 ? [v, t[1]] : [t[0], v]) as Turno : t)))
        return (
          <li key={dia.n} className="flex flex-wrap items-start gap-x-4 gap-y-2 px-3 py-2.5">
            <label className="flex w-28 shrink-0 items-center gap-2 pt-1.5 text-sm font-medium">
              <input type="checkbox" checked={turnos.length > 0} onChange={(e) => poner(dia.n, e.target.checked ? [[...TURNO_NUEVO] as Turno] : [])} className="h-4 w-4 accent-[#c8e62b]" aria-label={`Recibir pedidos el ${dia.largo}`} />
              <span className="capitalize">{dia.largo}</span>
            </label>
            {turnos.length === 0 ? <span className="pt-1.5 text-sm text-rs-muted">Cerrado</span> : (
              <div className="min-w-0 flex-1 space-y-2">
                {turnos.map((t, i) => (
                  <div key={i} className="flex flex-wrap items-center gap-2">
                    <span className="text-xs text-rs-muted">Desde</span><HoraInput id={`${idBase}-${dia.n}-${i}-d`} value={t[0]} onChange={(v) => cambiar(i, 0, v)} className="w-24" />
                    <span className="text-xs text-rs-muted">hasta</span><HoraInput id={`${idBase}-${dia.n}-${i}-h`} value={t[1]} onChange={(v) => cambiar(i, 1, v)} className="w-24" />
                    <button type="button" onClick={() => poner(dia.n, turnos.filter((_, x) => x !== i))} aria-label={`Quitar franja ${i + 1} del ${dia.largo}`} className="btn btn-sm btn-danger"><X size={13} /></button>
                  </div>
                ))}
                <div className="flex flex-wrap gap-2">
                  {turnos.length < 3 && siguienteTurno(turnos) && <button type="button" onClick={() => poner(dia.n, [...turnos, siguienteTurno(turnos)!])} className="btn btn-sm"><Plus size={13} />Otra franja</button>}
                  <button type="button" onClick={() => repetir(turnos)} className="btn btn-sm" title="Copia estas franjas a los 7 días"><CopyPlus size={13} />Repetir en todos los días</button>
                </div>
              </div>
            )}
          </li>
        )
      })}
    </ul>
  )
}

export function PedidosHorarios({ config }: { config: ConfigPedidos }) {
  const [d, setD] = useState({
    usar_horarios: config.usar_horarios, horarios: config.horarios, delivery_propio: !!config.horarios_delivery, horarios_delivery: config.horarios_delivery ?? config.horarios,
    fechas_cerradas: config.fechas_cerradas, mensaje_cerrado: config.mensaje_cerrado ?? '',
  })
  const [nueva, setNueva] = useState('')
  const poner = <K extends keyof typeof d>(k: K, v: (typeof d)[K]) => setD((x) => ({ ...x, [k]: v }))
  const { estado, error } = useAutoGuardar(JSON.stringify(d), () => guardarPedidosHorarios(d))
  const agregar = (iso: string) => { setNueva(''); if (iso && !d.fechas_cerradas.includes(iso)) poner('fechas_cerradas', [...d.fechas_cerradas, iso].sort()) }
  return (
    <div className="mt-4 space-y-4">
      <Check label="Recibir pedidos solo en ciertos horarios" checked={d.usar_horarios} onChange={(v) => poner('usar_horarios', v)}
        texto="Fuera de esos horarios la carta y el bot avisan que no toman pedidos y cuándo vuelven. Apagado, se reciben a toda hora (mientras “Recibiendo pedidos” esté encendido)." />
      {d.usar_horarios && (
        <>
          <div><p className="label">{d.delivery_propio ? 'Horarios de retiro y de pedidos en mesa' : 'Horarios de pedidos'}</p><EditorSemana valor={d.horarios} onChange={(v) => poner('horarios', v)} idBase="ph" /></div>
          <Check label="El delivery tiene horarios distintos" checked={d.delivery_propio} onChange={(v) => setD((x) => ({ ...x, delivery_propio: v, horarios_delivery: v && Object.keys(x.horarios_delivery).length === 0 ? x.horarios : x.horarios_delivery }))} texto="Por ejemplo, el local abre al mediodía pero el delivery sale recién a la noche." />
          {d.delivery_propio && <div><p className="label">Horarios del delivery</p><EditorSemana valor={d.horarios_delivery} onChange={(v) => poner('horarios_delivery', v)} idBase="phd" /></div>}
        </>
      )}
      <div>
        <p className="label">Días en que no se toman pedidos</p>
        <p className="mb-2 text-xs text-rs-muted">Feriados, vacaciones o un evento privado: ese día completo no se reciben pedidos, aunque el horario diga lo contrario.</p>
        <div className="flex flex-wrap items-center gap-2">
          <FechaInput id="ph_fecha" value={nueva} onChange={agregar} className="w-40" />
          <span className="text-xs text-rs-muted">Elegí un día para agregarlo</span>
        </div>
        {d.fechas_cerradas.length > 0 && (
          <ul className="mt-2 flex flex-wrap gap-2">
            {d.fechas_cerradas.map((f) => <li key={f} className="inline-flex items-center gap-1.5 rounded-full border border-rs-control px-3 py-1 text-sm">{fechaCorta(f)}<button type="button" onClick={() => poner('fechas_cerradas', d.fechas_cerradas.filter((x) => x !== f))} aria-label={`Quitar el ${fechaCorta(f)}`} className="text-rs-muted hover:text-rs-danger"><X size={13} /></button></li>)}
          </ul>
        )}
      </div>
      <div><label className="label" htmlFor="ph_msg">Mensaje cuando no se toman pedidos</label><textarea id="ph_msg" value={d.mensaje_cerrado} onChange={(e) => poner('mensaje_cerrado', e.target.value)} maxLength={300} rows={2} placeholder="Ej. Tomamos pedidos de martes a domingo de 19 a 23:30." className="input w-full" /></div>
      <div className="flex justify-end"><EstadoGuardado estado={estado} error={error} /></div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Medios de pago
// ---------------------------------------------------------------------------
export function PedidosPagos({ config }: { config: ConfigPedidos }) {
  const [d, setD] = useState(() => ({
    medios: config.medios_pago as string[], datos_pago: config.datos_pago ?? '', efectivo: config.instrucciones_pago.efectivo ?? '', tarjeta: config.instrucciones_pago.tarjeta ?? '',
    por_tipo: Object.fromEntries(TIPOS.map((t) => [t.value, (config.medios_por_tipo[t.value] ?? config.medios_pago) as string[]])) as Record<TipoPedido, string[]>,
  }))
  const alternar = (lista: string[], v: string, on: boolean) => (on ? [...new Set([...lista, v])] : lista.filter((x) => x !== v))
  const cambiarMedio = (m: MedioPago, on: boolean) => setD((x) => ({ ...x, medios: alternar(x.medios, m, on), por_tipo: Object.fromEntries(TIPOS.map((t) => [t.value, alternar(x.por_tipo[t.value], m, on)])) as Record<TipoPedido, string[]> }))
  const { estado, error } = useAutoGuardar(JSON.stringify(d), () => guardarPedidosPagos({ medios: d.medios, datos_pago: d.datos_pago, instrucciones: { efectivo: d.efectivo, tarjeta: d.tarjeta }, por_tipo: d.por_tipo }))
  const habilitados = MEDIOS_PAGO.filter((m) => d.medios.includes(m.value))
  return (
    <div className="mt-4 space-y-4">
      <fieldset className="space-y-2"><legend className="label">Medios de pago que se ofrecen</legend>
        {MEDIOS_PAGO.map((m) => <Check key={m.value} label={m.label} checked={d.medios.includes(m.value)} onChange={(v) => cambiarMedio(m.value, v)} />)}
      </fieldset>
      {habilitados.length > 1 && (
        <fieldset><legend className="label">Qué medios vale para cada forma de entrega</legend>
          <div className="overflow-x-auto rounded-md border border-rs-border/60">
            <table className="w-full text-sm">
              <thead><tr className="border-b border-rs-border/60 text-left text-xs text-rs-muted"><th className="px-3 py-2 font-medium">Entrega</th>{habilitados.map((m) => <th key={m.value} className="px-3 py-2 font-medium">{m.label.split(' (')[0]}</th>)}</tr></thead>
              <tbody>
                {TIPOS.map((t) => (
                  <tr key={t.value} className="border-b border-rs-border/40 last:border-0">
                    <th scope="row" className="px-3 py-2 text-left font-medium">{t.corto}</th>
                    {habilitados.map((m) => <td key={m.value} className="px-3 py-2"><input type="checkbox" aria-label={`${m.label.split(' (')[0]} para ${t.corto}`} checked={d.por_tipo[t.value].includes(m.value)} onChange={(e) => setD((x) => ({ ...x, por_tipo: { ...x.por_tipo, [t.value]: alternar(x.por_tipo[t.value], m.value, e.target.checked) } }))} className="h-4 w-4 accent-[#c8e62b]" /></td>)}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="mt-1 text-xs text-rs-muted">Por ejemplo, tarjeta solo para retiro o en mesa, y en el delivery solo efectivo y transferencia.</p>
        </fieldset>
      )}
      {d.medios.includes('transferencia') && <div><label className="label" htmlFor="pp_datos">Datos para transferir</label><textarea id="pp_datos" value={d.datos_pago} onChange={(e) => setD((x) => ({ ...x, datos_pago: e.target.value }))} maxLength={300} rows={2} placeholder="Alias, CBU, titular… (se muestra al cliente que elige transferencia)" className="input w-full" /></div>}
      {d.medios.includes('efectivo') && <div><label className="label" htmlFor="pp_ef">Aviso para quien paga en efectivo</label><input id="pp_ef" value={d.efectivo} onChange={(e) => setD((x) => ({ ...x, efectivo: e.target.value }))} maxLength={200} placeholder="Ej. Si pagás con billete grande, avisanos para llevar cambio." className="input w-full" /></div>}
      {d.medios.includes('tarjeta') && <div><label className="label" htmlFor="pp_ta">Aviso para quien paga con tarjeta</label><input id="pp_ta" value={d.tarjeta} onChange={(e) => setD((x) => ({ ...x, tarjeta: e.target.value }))} maxLength={200} placeholder="Ej. Aceptamos Visa, Mastercard y débito." className="input w-full" /></div>}
      <div className="flex justify-end"><EstadoGuardado estado={estado} error={error} /></div>
    </div>
  )
}
