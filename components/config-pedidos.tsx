'use client'

import { createContext, useContext, useState } from 'react'
import { ArrowDown, ArrowUp, CopyPlus, Plus, Trash2, X } from 'lucide-react'
import { guardarPedidosEntregas, guardarPedidosGeneral, guardarPedidosHorarios, guardarPedidosMedios } from '@/app/(panel)/pedidos-actions'
import { EstadoGuardado, useAutoGuardar } from '@/components/estado-guardado'
import { FechaInput, HoraInput } from '@/components/inputs'
import { claveDeNombre, type ConfigPedidos, type EntregaPedido, type HorariosSemana, type MedioPedido, type TipoPedido, type Turno } from '@/lib/pedidos'
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

const BASES: { value: TipoPedido; label: string; texto: string }[] = [
  { value: 'retiro', label: 'Retiro', texto: 'Pide teléfono. El cliente pasa a buscarlo.' },
  { value: 'delivery', label: 'Delivery', texto: 'Pide teléfono y dirección, y suma el costo de envío.' },
  { value: 'mesa', label: 'En mesa', texto: 'Pide el número de mesa (el teléfono es opcional).' },
]

// ---------------------------------------------------------------------------
// Catálogos compartidos: las formas de entrega eligen entre los medios de pago, así que comparten estado
// ---------------------------------------------------------------------------
interface EntregaUI { clave: string; etiqueta: string; base: TipoPedido; activo: boolean; costo_envio: string; envio_gratis_desde: string; tiempo: string; horarios_propios: boolean; horarios: HorariosSemana; medios: string[] | null }
interface MedioUI { clave: string; etiqueta: string; aviso: string; datos: string; activo: boolean }
interface Catalogos { entregas: EntregaUI[]; setEntregas: React.Dispatch<React.SetStateAction<EntregaUI[]>>; medios: MedioUI[]; setMedios: React.Dispatch<React.SetStateAction<MedioUI[]>>; horariosGenerales: HorariosSemana; setHorariosGenerales: (h: HorariosSemana) => void }
const Ctx = createContext<Catalogos | null>(null)
const useCatalogos = () => { const c = useContext(Ctx); if (!c) throw new Error('Falta CatalogosPedidos'); return c }

export function CatalogosPedidos({ entregas, medios, horariosGenerales, children }: { entregas: EntregaPedido[]; medios: MedioPedido[]; horariosGenerales: HorariosSemana; children: React.ReactNode }) {
  const [e, setEntregas] = useState<EntregaUI[]>(() => entregas.map((x) => ({ clave: x.clave, etiqueta: x.etiqueta, base: x.base, activo: x.activo, costo_envio: monto(x.costo_envio), envio_gratis_desde: monto(x.envio_gratis_desde), tiempo: x.tiempo ?? '', horarios_propios: !!x.horarios, horarios: x.horarios ?? horariosGenerales, medios: x.medios })))
  const [m, setMedios] = useState<MedioUI[]>(() => medios.map((x) => ({ clave: x.clave, etiqueta: x.etiqueta, aviso: x.aviso ?? '', datos: x.datos ?? '', activo: x.activo })))
  const [hg, setHorariosGenerales] = useState<HorariosSemana>(horariosGenerales)   // lo que se edita en “Horarios de pedidos”, para que las formas de entrega con horarios propios arranquen copiándolo
  return <Ctx.Provider value={{ entregas: e, setEntregas, medios: m, setMedios, horariosGenerales: hg, setHorariosGenerales }}>{children}</Ctx.Provider>
}

function mover<T>(lista: T[], i: number, d: -1 | 1): T[] { const j = i + d; if (j < 0 || j >= lista.length) return lista; const c = [...lista];[c[i], c[j]] = [c[j], c[i]]; return c }
function claveNueva(nombre: string, existentes: string[]) { const base = claveDeNombre(nombre); let c = base, n = 2; while (existentes.includes(c)) c = `${base}_${n++}`.slice(0, 40); return c }

// ---------------------------------------------------------------------------
// Recepción de pedidos
// ---------------------------------------------------------------------------
export function PedidosGeneral({ config }: { config: ConfigPedidos }) {
  const [d, setD] = useState({ recibe: config.recibe, pedido_minimo: monto(config.pedido_minimo), tiempo_estimado: config.tiempo_estimado ?? '', mensaje: config.mensaje ?? '', aceptar_auto: config.aceptar_auto })
  const poner = <K extends keyof typeof d>(k: K, v: (typeof d)[K]) => setD((x) => ({ ...x, [k]: v }))
  const { estado, error } = useAutoGuardar(JSON.stringify(d), () => guardarPedidosGeneral(d))
  return (
    <div className="mt-4 space-y-4">
      <Check label="Recibiendo pedidos" checked={d.recibe} onChange={(v) => poner('recibe', v)} texto="Interruptor general. Apagado, la carta pública y el bot no aceptan pedidos nuevos (los que cargás a mano sí)." />
      <div className="grid gap-3 sm:grid-cols-2">
        <div><label className="label" htmlFor="pg_min">Pedido mínimo ($)</label><input id="pg_min" inputMode="decimal" value={d.pedido_minimo} onChange={(e) => poner('pedido_minimo', e.target.value)} placeholder="Sin mínimo" className="input w-full" /></div>
        <div><label className="label" htmlFor="pg_tiempo">Tiempo estimado (se muestra al cliente)</label><input id="pg_tiempo" value={d.tiempo_estimado} onChange={(e) => poner('tiempo_estimado', e.target.value)} maxLength={60} placeholder="Ej. 20 a 30 minutos" className="input w-full" /></div>
      </div>
      <p className="-mt-2 text-xs text-rs-muted">Cada forma de entrega puede tener su propio tiempo, costo de envío y horarios (ver “Formas de entrega”).</p>
      <div><label className="label" htmlFor="pg_msg">Mensaje para el cliente</label><textarea id="pg_msg" value={d.mensaje} onChange={(e) => poner('mensaje', e.target.value)} maxLength={300} rows={2} placeholder="Ej. Avisanos si tenés alguna alergia." className="input w-full" /></div>
      <Check label="Aceptar los pedidos automáticamente" checked={d.aceptar_auto} onChange={(v) => poner('aceptar_auto', v)} texto="Los pedidos de la carta y del bot entran directo como “Aceptados” en lugar de esperar que alguien los acepte. Los que cargás a mano no cambian." />
      <div className="flex justify-end"><EstadoGuardado estado={estado} error={error} /></div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Horarios
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
  const { setHorariosGenerales } = useCatalogos()
  const [d, setD] = useState({ usar_horarios: config.usar_horarios, horarios: config.horarios, fechas_cerradas: config.fechas_cerradas, mensaje_cerrado: config.mensaje_cerrado ?? '' })
  const [nueva, setNueva] = useState('')
  const poner = <K extends keyof typeof d>(k: K, v: (typeof d)[K]) => { setD((x) => ({ ...x, [k]: v })); if (k === 'horarios') setHorariosGenerales(v as HorariosSemana) }
  const { estado, error } = useAutoGuardar(JSON.stringify(d), () => guardarPedidosHorarios(d))
  const agregar = (iso: string) => { setNueva(''); if (iso && !d.fechas_cerradas.includes(iso)) poner('fechas_cerradas', [...d.fechas_cerradas, iso].sort()) }
  return (
    <div className="mt-4 space-y-4">
      <Check label="Recibir pedidos solo en ciertos horarios" checked={d.usar_horarios} onChange={(v) => poner('usar_horarios', v)}
        texto="Fuera de esos horarios la carta y el bot avisan que no toman pedidos y cuándo vuelven. Apagado, se reciben a toda hora (mientras “Recibiendo pedidos” esté encendido)." />
      {d.usar_horarios && (
        <div><p className="label">Horarios de pedidos</p><EditorSemana valor={d.horarios} onChange={(v) => poner('horarios', v)} idBase="ph" />
          <p className="mt-1 text-xs text-rs-muted">Valen para todas las formas de entrega, salvo las que tengan horarios propios (se eligen en “Formas de entrega”).</p></div>
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
// Formas de entrega (catálogo)
// ---------------------------------------------------------------------------
export function PedidosEntregas() {
  const { entregas: filas, setEntregas: setFilas, medios, horariosGenerales } = useCatalogos()
  const [nuevo, setNuevo] = useState(''), [baseNueva, setBaseNueva] = useState<TipoPedido>('retiro')
  const cambiar = (i: number, c: Partial<EntregaUI>) => setFilas((f) => f.map((x, k) => (k === i ? { ...x, ...c } : x)))
  const agregar = () => {
    const nombre = nuevo.trim(); if (!nombre) return
    setFilas((f) => [...f, { clave: claveNueva(nombre, f.map((x) => x.clave)), etiqueta: nombre.slice(0, 40), base: baseNueva, activo: true, costo_envio: '', envio_gratis_desde: '', tiempo: '', horarios_propios: false, horarios: horariosGenerales, medios: null }]); setNuevo('')
  }
  const { estado, error } = useAutoGuardar(JSON.stringify(filas), () => guardarPedidosEntregas(filas.map((f) => ({ clave: f.clave, etiqueta: f.etiqueta, base: f.base, activo: f.activo, costo_envio: f.costo_envio, envio_gratis_desde: f.envio_gratis_desde, tiempo: f.tiempo, horarios: f.horarios_propios ? f.horarios : null, medios: f.medios }))))
  return (
    <div className="mt-4 space-y-3">
      <ul className="space-y-2">
        {filas.map((f, i) => (
          <li key={f.clave} className="rounded-md border border-rs-border/60 bg-rs-raised/30 px-2.5 py-2">
            <div className="flex flex-wrap items-center gap-2">
              <div className="flex flex-col"><button type="button" onClick={() => setFilas(mover(filas, i, -1))} disabled={i === 0} aria-label="Subir" className="text-rs-muted hover:text-rs-lime disabled:opacity-30"><ArrowUp size={13} /></button><button type="button" onClick={() => setFilas(mover(filas, i, 1))} disabled={i === filas.length - 1} aria-label="Bajar" className="text-rs-muted hover:text-rs-lime disabled:opacity-30"><ArrowDown size={13} /></button></div>
              <input value={f.etiqueta} onChange={(e) => cambiar(i, { etiqueta: e.target.value })} maxLength={40} aria-label={`Nombre de la forma de entrega ${f.clave}`} className="input min-w-[160px] flex-1" />
              <select value={f.base} onChange={(e) => cambiar(i, { base: e.target.value as TipoPedido })} aria-label={`Cómo se comporta ${f.etiqueta}`} className="input w-40">{BASES.map((b) => <option key={b.value} value={b.value}>Como {b.label.toLowerCase()}</option>)}</select>
              <label className="flex items-center gap-1.5 text-sm"><input type="checkbox" checked={f.activo} onChange={(e) => cambiar(i, { activo: e.target.checked })} className="h-4 w-4 accent-[#c8e62b]" />Activa</label>
              <button type="button" onClick={() => setFilas(filas.filter((_, k) => k !== i))} aria-label={`Quitar ${f.etiqueta}`} title="Quitar (si ya tiene pedidos, queda desactivada)" className="btn btn-sm btn-danger"><Trash2 size={13} /></button>
            </div>
            <p className="mt-1 pl-6 text-xs text-rs-muted">{BASES.find((b) => b.value === f.base)?.texto}</p>
            <details className="mt-1 pl-6">
              <summary className="cursor-pointer text-sm font-medium text-rs-lime">Costos, tiempo, horarios y medios de pago</summary>
              <div className="mt-3 space-y-3">
                {f.base === 'delivery' && (
                  <div className="grid gap-3 sm:grid-cols-2">
                    <div><label className="label" htmlFor={`ee-${f.clave}-costo`}>Costo de envío ($)</label><input id={`ee-${f.clave}-costo`} inputMode="decimal" value={f.costo_envio} onChange={(e) => cambiar(i, { costo_envio: e.target.value })} placeholder="Gratis" className="input w-full" /></div>
                    <div><label className="label" htmlFor={`ee-${f.clave}-gratis`}>Envío gratis desde ($)</label><input id={`ee-${f.clave}-gratis`} inputMode="decimal" value={f.envio_gratis_desde} onChange={(e) => cambiar(i, { envio_gratis_desde: e.target.value })} placeholder="Siempre se cobra" className="input w-full" /></div>
                  </div>
                )}
                <div><label className="label" htmlFor={`ee-${f.clave}-tiempo`}>Tiempo estimado</label><input id={`ee-${f.clave}-tiempo`} value={f.tiempo} onChange={(e) => cambiar(i, { tiempo: e.target.value })} maxLength={60} placeholder="Vacío = el tiempo general" className="input w-full sm:max-w-xs" /></div>
                <div>
                  <Check label="Tiene horarios propios" checked={f.horarios_propios} onChange={(v) => cambiar(i, { horarios_propios: v, horarios: v && Object.keys(f.horarios).length === 0 ? horariosGenerales : f.horarios })} texto="Por ejemplo, el delivery sale recién a la noche. Solo cuenta si los horarios de pedidos están activados." />
                  {f.horarios_propios && <div className="mt-2"><EditorSemana valor={f.horarios} onChange={(v) => cambiar(i, { horarios: v })} idBase={`eh-${f.clave}`} /></div>}
                </div>
                <fieldset>
                  <legend className="label">Medios de pago que acepta</legend>
                  <Check label="Todos los medios de pago activos" checked={f.medios === null} onChange={(v) => cambiar(i, { medios: v ? null : medios.filter((m) => m.activo).map((m) => m.clave) })} />
                  {f.medios !== null && (
                    <div className="mt-2 flex flex-wrap gap-x-5 gap-y-2 pl-6">
                      {medios.map((m) => <Check key={m.clave} label={m.etiqueta + (m.activo ? '' : ' (desactivado)')} checked={f.medios!.includes(m.clave)} onChange={(v) => cambiar(i, { medios: v ? [...new Set([...(f.medios ?? []), m.clave])] : (f.medios ?? []).filter((x) => x !== m.clave) })} />)}
                    </div>
                  )}
                </fieldset>
              </div>
            </details>
          </li>
        ))}
      </ul>
      <div className="flex flex-wrap items-end gap-2">
        <div className="min-w-[200px] flex-1"><label className="label" htmlFor="entrega_nueva">Agregar una forma de entrega</label><input id="entrega_nueva" value={nuevo} onChange={(e) => setNuevo(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); agregar() } }} maxLength={40} placeholder="Ej. Drive, Retiro en sucursal Centro, Envío por moto" className="input w-full" /></div>
        <div><label className="label" htmlFor="entrega_base">Se comporta como</label><select id="entrega_base" value={baseNueva} onChange={(e) => setBaseNueva(e.target.value as TipoPedido)} className="input w-36">{BASES.map((b) => <option key={b.value} value={b.value}>{b.label}</option>)}</select></div>
        <button type="button" onClick={agregar} className="btn"><Plus size={14} />Agregar</button>
      </div>
      <EstadoGuardado estado={estado} error={error} />
      <p className="text-xs text-rs-muted">El nombre es lo que ven tus clientes en la carta y tu equipo en los pedidos. “Se comporta como” define qué datos se piden: el teléfono (retiro), la dirección y el costo de envío (delivery) o el número de mesa.</p>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Medios de pago (catálogo)
// ---------------------------------------------------------------------------
export function PedidosMedios() {
  const { medios: filas, setMedios: setFilas, setEntregas } = useCatalogos()
  const [nuevo, setNuevo] = useState('')
  const cambiar = (i: number, c: Partial<MedioUI>) => setFilas((f) => f.map((x, k) => (k === i ? { ...x, ...c } : x)))
  const agregar = () => { const nombre = nuevo.trim(); if (!nombre) return; setFilas((f) => [...f, { clave: claveNueva(nombre, f.map((x) => x.clave)), etiqueta: nombre.slice(0, 40), aviso: '', datos: '', activo: true }]); setNuevo('') }
  const quitar = (i: number) => { const clave = filas[i].clave; setFilas(filas.filter((_, k) => k !== i)); setEntregas((es) => es.map((e) => (e.medios ? { ...e, medios: e.medios.filter((m) => m !== clave) } : e))) }
  const { estado, error } = useAutoGuardar(JSON.stringify(filas), () => guardarPedidosMedios(filas.map((f) => ({ clave: f.clave, etiqueta: f.etiqueta, aviso: f.aviso, datos: f.datos, activo: f.activo }))))
  return (
    <div className="mt-4 space-y-3">
      <ul className="space-y-2">
        {filas.map((f, i) => (
          <li key={f.clave} className="rounded-md border border-rs-border/60 bg-rs-raised/30 px-2.5 py-2">
            <div className="flex flex-wrap items-center gap-2">
              <div className="flex flex-col"><button type="button" onClick={() => setFilas(mover(filas, i, -1))} disabled={i === 0} aria-label="Subir" className="text-rs-muted hover:text-rs-lime disabled:opacity-30"><ArrowUp size={13} /></button><button type="button" onClick={() => setFilas(mover(filas, i, 1))} disabled={i === filas.length - 1} aria-label="Bajar" className="text-rs-muted hover:text-rs-lime disabled:opacity-30"><ArrowDown size={13} /></button></div>
              <input value={f.etiqueta} onChange={(e) => cambiar(i, { etiqueta: e.target.value })} maxLength={40} aria-label={`Nombre del medio de pago ${f.clave}`} className="input min-w-[160px] flex-1" />
              <label className="flex items-center gap-1.5 text-sm"><input type="checkbox" checked={f.activo} onChange={(e) => cambiar(i, { activo: e.target.checked })} className="h-4 w-4 accent-[#c8e62b]" />Activo</label>
              <button type="button" onClick={() => quitar(i)} aria-label={`Quitar ${f.etiqueta}`} title="Quitar (si ya se usó en pedidos, queda desactivado)" className="btn btn-sm btn-danger"><Trash2 size={13} /></button>
            </div>
            <div className="mt-2 grid gap-2 pl-6 sm:grid-cols-2">
              <div><label className="label" htmlFor={`em-${f.clave}-aviso`}>Aviso al elegirlo</label><input id={`em-${f.clave}-aviso`} value={f.aviso} onChange={(e) => cambiar(i, { aviso: e.target.value })} maxLength={200} placeholder="Ej. Avisanos si necesitás cambio" className="input w-full" /></div>
              <div><label className="label" htmlFor={`em-${f.clave}-datos`}>Datos para pagar (se ven al confirmar)</label><input id={`em-${f.clave}-datos`} value={f.datos} onChange={(e) => cambiar(i, { datos: e.target.value })} maxLength={300} placeholder="Ej. Alias, CBU, link de pago" className="input w-full" /></div>
            </div>
          </li>
        ))}
      </ul>
      <div className="flex flex-wrap items-end gap-2">
        <div className="min-w-[200px] flex-1"><label className="label" htmlFor="medio_nuevo">Agregar un medio de pago</label><input id="medio_nuevo" value={nuevo} onChange={(e) => setNuevo(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); agregar() } }} maxLength={40} placeholder="Ej. Mercado Pago, Débito, Cuenta DNI" className="input w-full" /></div>
        <button type="button" onClick={agregar} className="btn"><Plus size={14} />Agregar</button>
      </div>
      <EstadoGuardado estado={estado} error={error} />
      <p className="text-xs text-rs-muted">El “aviso” se ve cuando el cliente elige ese medio y al confirmar el pedido. Los “datos para pagar” (alias, CBU, link de pago) se muestran recién al confirmar el pedido, para que no queden a la vista de cualquiera. Qué medios acepta cada forma de entrega se elige en “Formas de entrega”.</p>
    </div>
  )
}
