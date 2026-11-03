'use client'

import { useEffect, useMemo, useState, useTransition } from 'react'
import { Pencil, Plus, Trash2, X } from 'lucide-react'
import { alternarDescuento, borrarDescuento, guardarDescuento, type DatosDescuento } from '@/app/(panel)/pedidos-actions'
import { useCatalogos } from '@/components/config-pedidos'
import { useConfirm, useToast } from '@/components/feedback'
import { FechaInput } from '@/components/inputs'
import Modal from '@/components/modal'
import { MAX_DESCUENTOS, MAX_FECHAS_DESCUENTO, resumenDescuento, type AlcanceDescuento, type DescuentoPedido, type TipoDescuento } from '@/lib/descuentos'
import { DIAS_SEMANA } from '@/lib/pedidos-horarios'

const casilla = 'h-4 w-4 accent-[#c8e62b]'
const chip = 'inline-flex cursor-pointer items-center gap-1.5 rounded-full border border-rs-control px-3 py-1 text-sm has-[:checked]:border-rs-lime/60 has-[:checked]:bg-rs-lime/10 has-[:checked]:font-semibold'

interface Props {
  descuentos: DescuentoPedido[]
  categorias: { id: string; nombre: string }[]
  productos: { id: string; nombre: string; categoria_id: string }[]
  moneda: string
}

/** Lista de reglas de descuento del negocio, con alta, edición, encendido y borrado. */
export function PedidosDescuentos({ descuentos, categorias, productos, moneda }: Props) {
  const { medios } = useCatalogos()
  const toast = useToast(), confirmar = useConfirm()
  const [pend, start] = useTransition()
  const [modal, setModal] = useState<{ d?: DescuentoPedido } | null>(null)
  const [encendidos, setEncendidos] = useState<Record<string, boolean>>({})   // el interruptor responde al toque; después llega lo que guardó el servidor
  useEffect(() => setEncendidos({}), [descuentos])   // cuando llega lo guardado, manda el servidor
  const ctx = useMemo(() => ({
    categorias: new Map(categorias.map((c) => [c.id, c.nombre])), productos: new Map(productos.map((p) => [p.id, p.nombre])),
    medios: new Map(medios.map((m) => [m.clave, m.etiqueta])), moneda,
  }), [categorias, productos, medios, moneda])
  const correr = (fn: () => Promise<{ ok: boolean; error?: string }>, ok?: string) => start(async () => { const r = await fn(); if (!r.ok) toast({ tipo: 'error', texto: r.error ?? 'Ocurrió un error' }); else if (ok) toast({ texto: ok }) })
  const borrar = async (d: DescuentoPedido) => {
    if (!(await confirmar({ titulo: `¿Borrar “${d.nombre}”?`, texto: 'Los pedidos que ya lo usaron conservan el descuento. Si solo querés pausarlo, apagalo.', confirmar: 'Borrar', peligro: true }))) return
    correr(() => borrarDescuento(d.id), 'Descuento borrado')
  }
  return (
    <div className="mt-4 space-y-3">
      {descuentos.length === 0 ? (
        <p className="rounded-md border border-dashed border-rs-border/70 px-3 py-4 text-sm text-rs-muted">Todavía no hay descuentos. Podés armar, por ejemplo, “15% en bebidas los jueves”, “10% pagando en efectivo” o un cupón para una difusión.</p>
      ) : (
        <ul className="space-y-2">
          {descuentos.map((d) => {
            const r = resumenDescuento(d, ctx), activo = encendidos[d.id] ?? d.activo
            return (
              <li key={d.id} className={'rounded-md border border-rs-border/60 bg-rs-raised/30 px-3 py-2.5 ' + (activo ? '' : 'opacity-60')}>
                <div className="flex flex-wrap items-center gap-2">
                  <span className="font-semibold">{d.nombre}</span>
                  <span className="badge bg-rs-lime/15 text-rs-lime">{r.beneficio}</span>
                  {d.codigo ? <span className="badge bg-rs-lav/15 text-rs-lav">Cupón {d.codigo}</span> : <span className="badge bg-rs-raised text-rs-muted">Automático</span>}
                  {!activo && <span className="badge bg-rs-raised text-rs-muted">Apagado</span>}
                  <span className="ml-auto flex items-center gap-1.5">
                    <label className="flex items-center gap-1.5 text-sm"><input type="checkbox" checked={activo} onChange={async (e) => { const v = e.target.checked; setEncendidos((x) => ({ ...x, [d.id]: v })); const r = await alternarDescuento(d.id, v); if (!r.ok) { setEncendidos((x) => ({ ...x, [d.id]: !v })); toast({ tipo: 'error', texto: r.error ?? 'No se pudo cambiar' }) } }} className={casilla} aria-label={`${activo ? 'Apagar' : 'Encender'} ${d.nombre}`} />Activo</label>
                    <button type="button" onClick={() => setModal({ d })} aria-label={`Editar ${d.nombre}`} className="btn btn-sm"><Pencil size={13} /></button>
                    <button type="button" onClick={() => borrar(d)} disabled={pend} aria-label={`Borrar ${d.nombre}`} className="btn btn-sm btn-danger"><Trash2 size={13} /></button>
                  </span>
                </div>
                <ul className="mt-1 space-y-0.5 text-xs text-rs-muted">{r.condiciones.map((c) => <li key={c}>{c}</li>)}</ul>
              </li>
            )
          })}
        </ul>
      )}
      {descuentos.length < MAX_DESCUENTOS && <button type="button" onClick={() => setModal({})} className="btn"><Plus size={14} />Nuevo descuento</button>}
      <p className="text-xs text-rs-muted">Los descuentos <b>no se acumulan</b>: a cada pedido se le aplica el que más le conviene al cliente (un cupón cuenta como uno más). Valen para los pedidos de la carta y del bot, no para los que cargás a mano. El envío nunca se descuenta. Las fechas y los días se miran con la hora de Argentina.</p>
      {modal && <ModalDescuento inicial={modal.d} categorias={categorias} productos={productos} moneda={moneda} onClose={() => setModal(null)} />}
    </div>
  )
}

function ModalDescuento({ inicial, categorias, productos, moneda, onClose }: { inicial?: DescuentoPedido; categorias: Props['categorias']; productos: Props['productos']; moneda: string; onClose: () => void }) {
  const { medios } = useCatalogos()
  const toast = useToast()
  const [pend, start] = useTransition()
  const [error, setError] = useState<string | null>(null)
  const [f, setF] = useState(() => ({
    nombre: inicial?.nombre ?? '', activo: inicial?.activo ?? true, tipo: (inicial?.tipo ?? 'porcentaje') as TipoDescuento, valor: inicial ? String(inicial.valor) : '',
    alcance: (inicial?.alcance ?? 'todo') as AlcanceDescuento, categoria_ids: inicial?.categoria_ids ?? [], producto_ids: inicial?.producto_ids ?? [],
    medios: inicial?.medios ?? ([] as string[]), dias: inicial?.dias ?? ([] as number[]), fechas: (inicial?.fechas ?? []).map((x) => ({ desde: x.desde, hasta: x.hasta ?? '' })),
    codigo: inicial?.codigo ?? '', usos_max: inicial?.usos_max ? String(inicial.usos_max) : '',
  }))
  const [buscar, setBuscar] = useState('')
  const poner = <K extends keyof typeof f>(k: K, v: (typeof f)[K]) => setF((x) => ({ ...x, [k]: v }))
  const alternar = <T,>(lista: T[], v: T) => (lista.includes(v) ? lista.filter((x) => x !== v) : [...lista, v])
  const sinTilde = (t: string) => t.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()
  const grupos = useMemo(() => {
    const q = sinTilde(buscar.trim())
    return categorias.map((c) => ({ ...c, productos: productos.filter((p) => p.categoria_id === c.id && (!q || sinTilde(p.nombre).includes(q))) })).filter((g) => g.productos.length > 0)
  }, [categorias, productos, buscar])

  const guardar = (e: React.FormEvent) => {
    e.preventDefault(); setError(null)
    const datos: DatosDescuento = {
      id: inicial?.id, nombre: f.nombre, activo: f.activo, tipo: f.tipo, valor: f.valor, alcance: f.alcance, categoria_ids: f.categoria_ids, producto_ids: f.producto_ids,
      medios: f.medios.length ? f.medios : null, dias: f.dias.length ? f.dias : null, fechas: f.fechas, codigo: f.codigo, usos_max: f.usos_max,
    }
    start(async () => { const r = await guardarDescuento(datos); if (!r.ok) return setError(r.error ?? 'No se pudo guardar'); toast({ texto: inicial ? 'Descuento guardado' : 'Descuento creado' }); onClose() })
  }

  return (
    <Modal titulo={inicial ? 'Editar descuento' : 'Nuevo descuento'} onClose={onClose} ancho="max-w-2xl">
      <form onSubmit={guardar} className="space-y-4">
        <div className="grid gap-3 sm:grid-cols-[1fr_auto_auto]">
          <div><label className="label" htmlFor="d_nombre">Nombre *</label><input id="d_nombre" value={f.nombre} onChange={(e) => poner('nombre', e.target.value)} maxLength={60} placeholder="Ej. Jueves de cerveza" className="input w-full" required /></div>
          <div><label className="label" htmlFor="d_tipo">Descuento</label>
            <select id="d_tipo" value={f.tipo} onChange={(e) => { const t = e.target.value as TipoDescuento; setF((x) => ({ ...x, tipo: t, alcance: t === 'monto' ? 'todo' : x.alcance })) }} className="input w-full">
              <option value="porcentaje">Porcentaje (%)</option><option value="monto">Monto fijo ({moneda})</option>
            </select></div>
          <div><label className="label" htmlFor="d_valor">{f.tipo === 'porcentaje' ? 'Porcentaje *' : 'Monto *'}</label><input id="d_valor" inputMode="decimal" value={f.valor} onChange={(e) => poner('valor', e.target.value)} placeholder={f.tipo === 'porcentaje' ? '15' : '2000'} className="input w-28" required /></div>
        </div>

        <fieldset>
          <legend className="label">¿Sobre qué se aplica?</legend>
          <div className="flex flex-wrap gap-2">
            {([['todo', 'Todo el pedido'], ['categorias', 'Algunas categorías'], ['productos', 'Algunos productos']] as const).map(([v, t]) => (
              <label key={v} className={chip + (f.tipo === 'monto' && v !== 'todo' ? ' pointer-events-none opacity-40' : '')}><input type="radio" name="d_alcance" value={v} checked={f.alcance === v} disabled={f.tipo === 'monto' && v !== 'todo'} onChange={() => poner('alcance', v)} className="sr-only" />{t}</label>
            ))}
          </div>
          {f.tipo === 'monto' && <p className="mt-1 text-xs text-rs-muted">Un monto fijo se descuenta del total del pedido; para categorías o productos usá un porcentaje.</p>}
          {f.alcance === 'categorias' && (
            <div className="mt-2 flex flex-wrap gap-2">
              {categorias.map((c) => <label key={c.id} className={chip}><input type="checkbox" checked={f.categoria_ids.includes(c.id)} onChange={() => poner('categoria_ids', alternar(f.categoria_ids, c.id))} className="sr-only" />{c.nombre}</label>)}
              {categorias.length === 0 && <p className="text-sm text-rs-muted">Primero cargá categorías en la Carta.</p>}
            </div>
          )}
          {f.alcance === 'productos' && (
            <div className="mt-2 space-y-2">
              <input type="search" value={buscar} onChange={(e) => setBuscar(e.target.value)} placeholder="Buscar un producto" aria-label="Buscar un producto" className="input w-full" />
              <div className="max-h-56 overflow-y-auto rounded-md border border-rs-border/60 p-2">
                {grupos.map((g) => (
                  <div key={g.id} className="mb-2 last:mb-0">
                    <p className="text-xs font-semibold uppercase tracking-wide text-rs-muted">{g.nombre}</p>
                    <ul>{g.productos.map((p) => <li key={p.id}><label className="flex items-center gap-2 py-0.5 text-sm"><input type="checkbox" checked={f.producto_ids.includes(p.id)} onChange={() => poner('producto_ids', alternar(f.producto_ids, p.id))} className={casilla} />{p.nombre}</label></li>)}</ul>
                  </div>
                ))}
                {grupos.length === 0 && <p className="text-sm text-rs-muted">No hay productos que coincidan.</p>}
              </div>
              <p className="text-xs text-rs-muted">{f.producto_ids.length} producto{f.producto_ids.length === 1 ? '' : 's'} elegido{f.producto_ids.length === 1 ? '' : 's'}</p>
            </div>
          )}
        </fieldset>

        <div className="space-y-3 rounded-md border border-rs-border/60 p-3">
          <p className="text-sm font-semibold">¿Cuándo aplica? <span className="font-normal text-rs-muted">(todo lo que dejes vacío vale siempre; lo que elijas se tiene que cumplir)</span></p>
          <fieldset>
            <legend className="label">Medio de pago</legend>
            <div className="flex flex-wrap gap-2">{medios.map((m) => <label key={m.clave} className={chip}><input type="checkbox" checked={f.medios.includes(m.clave)} onChange={() => poner('medios', alternar(f.medios, m.clave))} className="sr-only" />{m.etiqueta}</label>)}</div>
          </fieldset>
          <fieldset>
            <legend className="label">Días de la semana</legend>
            <div className="flex flex-wrap gap-2">{DIAS_SEMANA.map((d) => <label key={d.n} className={chip}><input type="checkbox" checked={f.dias.includes(Number(d.n))} onChange={() => poner('dias', alternar(f.dias, Number(d.n)))} className="sr-only" />{d.corto}</label>)}</div>
          </fieldset>
          <fieldset>
            <legend className="label">Fechas puntuales</legend>
            <ul className="space-y-2">
              {f.fechas.map((x, i) => (
                <li key={i} className="flex flex-wrap items-center gap-2">
                  <span className="text-xs text-rs-muted">Desde</span><FechaInput id={`d_fd_${i}`} value={x.desde} onChange={(v) => poner('fechas', f.fechas.map((y, k) => (k === i ? { ...y, desde: v } : y)))} className="w-36" />
                  <span className="text-xs text-rs-muted">hasta</span><FechaInput id={`d_fh_${i}`} value={x.hasta} onChange={(v) => poner('fechas', f.fechas.map((y, k) => (k === i ? { ...y, hasta: v } : y)))} className="w-36" />
                  <button type="button" onClick={() => poner('fechas', f.fechas.filter((_, k) => k !== i))} aria-label={`Quitar la fecha ${i + 1}`} className="btn btn-sm btn-danger"><X size={13} /></button>
                </li>
              ))}
            </ul>
            {f.fechas.length < MAX_FECHAS_DESCUENTO && <button type="button" onClick={() => poner('fechas', [...f.fechas, { desde: '', hasta: '' }])} className="btn btn-sm mt-2"><Plus size={12} />Agregar fecha o rango</button>}
            <p className="mt-1 text-xs text-rs-muted">Para un solo día, dejá el “hasta” vacío. Podés sumar varias fechas o rangos (ej. 24/12 y 31/12).</p>
          </fieldset>
        </div>

        <div className="grid gap-3 sm:grid-cols-2">
          <div><label className="label" htmlFor="d_codigo">Cupón (opcional)</label><input id="d_codigo" value={f.codigo} onChange={(e) => poner('codigo', e.target.value.replace(/\s/g, ''))} maxLength={30} autoCapitalize="characters" placeholder="Ej. VERANO10" className="input w-full" />
            <p className="mt-1 text-xs text-rs-muted">Con código, solo aplica cuando el cliente lo escribe (no distingue mayúsculas). Vacío = se aplica solo.</p></div>
          <div><label className="label" htmlFor="d_usos">Usos máximos (opcional)</label><input id="d_usos" inputMode="numeric" value={f.usos_max} onChange={(e) => poner('usos_max', e.target.value.replace(/\D/g, ''))} maxLength={7} placeholder="Sin límite" className="input w-full" />
            <p className="mt-1 text-xs text-rs-muted">Cuántos pedidos pueden usarlo en total. Un pedido cancelado no cuenta.</p></div>
        </div>
        <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={f.activo} onChange={(e) => poner('activo', e.target.checked)} className={casilla} />Descuento activo</label>

        {error && <p role="alert" className="text-sm text-rs-danger">{error}</p>}
        <div className="flex justify-end gap-2"><button type="button" onClick={onClose} className="btn">Cancelar</button><button disabled={pend} className="btn btn-primary">{pend ? 'Guardando…' : inicial ? 'Guardar' : 'Crear descuento'}</button></div>
      </form>
    </Modal>
  )
}
