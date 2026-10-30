'use client'

import { unirNombre } from '@/lib/nombres'
import { useEffect, useRef, useState, useTransition } from 'react'
import { Check, Minus, Plus, ShoppingBag, X } from 'lucide-react'
import type { Marca } from '@/lib/marca'
import { crearPedidoPublico, type ResultadoPedidoPublico } from '@/app/carta/[slug]/actions'
import { etiquetaDe, formatearPrecio, textoPrecio, type ConfigCarta, type ProductoCarta } from '@/lib/carta'
import { CONFIG_PEDIDOS_POR_DEFECTO, dinero, labelPago, labelTipo, type ConfigPedidos, type EntregaPedido, type MedioPedido } from '@/lib/pedidos'
import { costoEnvioFinal, estadoPedidos, mediosDisponibles } from '@/lib/pedidos-horarios'

export interface CategoriaPublica { id: string; nombre: string; descripcion: string | null; productos: (ProductoCarta & { img: string | null })[] }
/** Lo que la carta pública sabe de los pedidos del negocio (no incluye los datos para transferir: se muestran recién al hacer el pedido). */
export interface PedidosPublicos extends Omit<ConfigPedidos, 'aceptar_auto' | 'medios'> { medios: (Omit<MedioPedido, 'datos'> & { tieneDatos: boolean })[]; ahora: string }
const configDe = (p: PedidosPublicos): ConfigPedidos => ({ ...CONFIG_PEDIDOS_POR_DEFECTO, ...p, aceptar_auto: false, medios: p.medios.map((m) => ({ ...m, datos: null })) })
interface Linea { producto_id: string; nombre: string; variante: string | null; precio: number; cantidad: number }
const clave = (producto: string, variante: string | null) => `${producto}|${variante ?? ''}`

/** Carta pública. Si el negocio tiene Pedidos encendido, cada producto se puede agregar a un pedido y confirmarlo sin salir de la página. */
export default function CartaPublica({ slug, nombre, config, categorias, pedidos, marca, logoRisto }: { slug: string; nombre: string; config: ConfigCarta; categorias: CategoriaPublica[]; pedidos: PedidosPublicos | null; marca?: Marca; logoRisto?: string }) {
  // Los horarios se evalúan con la hora de este momento (la página puede estar guardada desde hace un rato): se vuelve a mirar cada 30 segundos
  const [ahora, setAhora] = useState(() => (pedidos ? new Date(pedidos.ahora) : new Date()))
  useEffect(() => { setAhora(new Date()); const t = setInterval(() => setAhora(new Date()), 30_000); return () => clearInterval(t) }, [])
  const cfgPed = pedidos ? configDe(pedidos) : null
  const estados = cfgPed ? cfgPed.entregas.filter((e) => e.activo).map((e) => ({ e, ...estadoPedidos(cfgPed, e, ahora) })) : []
  const abiertas: EntregaPedido[] = estados.filter((x) => x.abierto).map((x) => x.e)
  const fuera = estados.filter((x) => !x.abierto && (x.motivo === 'horario' || x.motivo === 'fecha'))
  const puedePedir = !!pedidos?.recibe && abiertas.length > 0
  const [carrito, setCarrito] = useState<Record<string, Linea>>({})
  const [abierto, setAbierto] = useState(false)
  const [listo, setListo] = useState(false)
  const [exito, setExito] = useState<Extract<ResultadoPedidoPublico, { ok: true }> | null>(null)

  // el carrito se recuerda en este navegador (por si se recarga o se vuelve más tarde)
  useEffect(() => { try { const g = localStorage.getItem('carrito:' + slug); if (g) setCarrito(JSON.parse(g)) } catch { /* sin almacenamiento */ } setListo(true) }, [slug])
  useEffect(() => { if (!listo) return; try { localStorage.setItem('carrito:' + slug, JSON.stringify(carrito)) } catch { /* sin almacenamiento */ } }, [carrito, listo, slug])

  const lineas = Object.values(carrito)
  const unidades = lineas.reduce((s, l) => s + l.cantidad, 0)
  const subtotal = lineas.reduce((s, l) => s + l.precio * l.cantidad, 0)
  const cambiar = (p: ProductoCarta, variante: string | null, precio: number, delta: number) => setCarrito((c) => {
    const k = clave(p.id, variante), actual = c[k]?.cantidad ?? 0, n = Math.max(0, Math.min(99, actual + delta))
    const { [k]: _quitado, ...resto } = c; void _quitado
    return n === 0 ? resto : { ...resto, [k]: { producto_id: p.id, nombre: p.nombre, variante, precio, cantidad: n } }
  })
  const cant = (id: string, variante: string | null) => carrito[clave(id, variante)]?.cantidad ?? 0
  const stepper = (p: ProductoCarta, variante: string | null, precio: number) => {
    const n = cant(p.id, variante)
    return n === 0
      ? <button type="button" onClick={() => cambiar(p, variante, precio, 1)} aria-label={`Agregar ${p.nombre}${variante ? ' ' + variante : ''}`} className="inline-flex h-8 items-center gap-1 rounded-full bg-rs-lime px-3 text-sm font-semibold text-rs-on-lime transition hover:brightness-95"><Plus size={14} />Agregar</button>
      : <span className="inline-flex h-8 items-center gap-1 rounded-full border border-rs-lime/50 bg-rs-lime/10">
          <button type="button" onClick={() => cambiar(p, variante, precio, -1)} aria-label="Quitar uno" className="grid h-8 w-8 place-items-center text-rs-lime"><Minus size={14} /></button>
          <span className="min-w-5 text-center text-sm font-bold tabular-nums" aria-live="polite">{n}</span>
          <button type="button" onClick={() => cambiar(p, variante, precio, 1)} aria-label="Agregar uno más" className="grid h-8 w-8 place-items-center text-rs-lime"><Plus size={14} /></button>
        </span>
  }

  return (
    <div className="min-h-screen">
      {/* Mismo encabezado que el sitio de reservas del local: logo, adorno, frase y colores propios */}
      {marca?.ornamento_url && (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={marca.ornamento_url} alt="" aria-hidden className="pointer-events-none fixed -bottom-16 -left-20 -z-10 w-64 rotate-180 select-none opacity-[.12] sm:w-80" />
      )}
      <header className={'relative isolate overflow-hidden border-b border-rs-raised bg-rs-header px-4 text-center ' + (marca?.logo_url ? 'pb-5 pt-8' : 'pb-4 pt-8')}>
        {marca?.ornamento_url && (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={marca.ornamento_url} alt="" aria-hidden className="pointer-events-none absolute -right-8 -top-4 -z-10 w-48 select-none opacity-25 sm:-right-4 sm:w-64" />
        )}
        {/* eslint-disable-next-line @next/next/no-img-element */}
        {marca?.logo_url && (marca.logo_forma === 'libre'
          ? <img src={marca.logo_url} alt="" className="mx-auto mb-3 h-auto max-h-32 w-auto max-w-[85%] object-contain" />
          : <img src={marca.logo_url} alt="" width={96} height={96} className="mx-auto mb-3 h-24 w-24 rounded-full object-cover shadow-[0_10px_30px_-8px_rgba(0,0,0,.6)] ring-1 ring-rs-lime/30" />)}
        <h1 className={marca?.logo_url && marca.logo_forma === 'libre' ? 'sr-only' : marca?.logo_url ? 'text-lg font-light uppercase tracking-[.28em] text-rs-lime' : 'text-2xl font-bold text-rs-lime'}>{config.titulo || nombre}</h1>
        {marca?.lema && <p className="mt-1.5 font-serif text-base italic text-rs-text/90">{marca.lema}</p>}
        <p className="mt-1 text-sm text-rs-muted">{pedidos ? 'Carta y pedidos' : 'Carta digital'}</p>
        {config.mensaje && <p className="mx-auto mt-3 max-w-xl whitespace-pre-line text-sm">{config.mensaje}</p>}
        {pedidos && !pedidos.recibe && <p role="status" className="mx-auto mt-3 max-w-xl rounded-md border border-rs-warn/40 bg-rs-warn/10 px-3 py-2 text-sm text-rs-warn">Por el momento no estamos tomando pedidos online.{pedidos.mensaje ? ` ${pedidos.mensaje}` : ''}</p>}
        {pedidos?.recibe && !puedePedir && fuera.length > 0 && (
          <p role="status" className="mx-auto mt-3 max-w-xl rounded-md border border-rs-warn/40 bg-rs-warn/10 px-3 py-2 text-sm text-rs-warn">
            {fuera.every((x) => x.motivo === 'fecha') ? 'Hoy no estamos tomando pedidos online.' : 'Ahora estamos fuera del horario de pedidos.'}{fuera[0].proxima ? ` Volvemos a tomar pedidos ${fuera[0].proxima}.` : ''}{pedidos.mensaje_cerrado ? ` ${pedidos.mensaje_cerrado}` : ''}
          </p>
        )}
        {puedePedir && fuera.length > 0 && <p role="status" className="mx-auto mt-3 max-w-xl rounded-md border border-rs-warn/40 bg-rs-warn/10 px-3 py-2 text-sm text-rs-warn">{fuera.map((x) => x.e.etiqueta).join(' y ')} no {fuera.length > 1 ? 'están disponibles' : 'está disponible'} en este momento{fuera[0].proxima ? ` (vuelve ${fuera[0].proxima})` : ''}.</p>}
        {puedePedir && pedidos!.tiempo_estimado && <p className="mt-2 text-xs text-rs-muted">Demora estimada: {pedidos!.tiempo_estimado}</p>}
      </header>

      {categorias.length > 1 && (
        <nav aria-label="Categorías" className="sticky top-0 z-10 border-b border-rs-raised bg-rs-header/95 backdrop-blur-md">
          <ul className="mx-auto flex max-w-2xl gap-2 overflow-x-auto px-4 py-2.5">
            {categorias.map((c) => <li key={c.id} className="shrink-0"><a href={`#c-${c.id}`} className="inline-flex h-8 items-center rounded-full border border-rs-control px-3.5 text-sm font-medium text-rs-muted transition hover:border-rs-lime/50 hover:text-rs-lime">{c.nombre}</a></li>)}
          </ul>
        </nav>
      )}

      <main className={'mx-auto max-w-2xl px-4 ' + (puedePedir && unidades > 0 ? 'pb-32' : 'pb-16')}>
        {categorias.length === 0 && <p className="py-16 text-center text-sm text-rs-muted">La carta se está actualizando. Volvé en un rato.</p>}
        {categorias.map((c) => (
          <section key={c.id} id={`c-${c.id}`} className="scroll-mt-16 pt-8">
            <h2 className="text-lg font-bold">{c.nombre}</h2>
            {c.descripcion && <p className="mt-0.5 text-sm text-rs-muted">{c.descripcion}</p>}
            <ul className="mt-3 space-y-3">
              {c.productos.map((p) => {
                const precio = config.mostrar_precios ? textoPrecio(p, config.moneda) : null
                const pedible = puedePedir && p.disponible
                return (
                  <li key={p.id} className={'card flex gap-3 p-3 ' + (p.disponible ? '' : 'opacity-55')}>
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                        <h3 className="font-semibold">{p.nombre}</h3>
                        {!p.disponible && <span className="badge bg-rs-danger/15 text-rs-danger">Agotado</span>}
                        {p.destacado && p.disponible && <span className="badge bg-rs-lime/15 text-rs-lime">Destacado</span>}
                      </div>
                      {p.descripcion && <p className="mt-1 whitespace-pre-line text-sm text-rs-muted">{p.descripcion}</p>}
                      {p.etiquetas.length > 0 && <div className="mt-2 flex flex-wrap gap-1.5">{p.etiquetas.map((e) => { const t = etiquetaDe(e); return t ? <span key={e} className={'badge ' + t.color}>{t.label}</span> : null })}</div>}
                      {p.variantes.length > 0 ? (
                        <ul className="mt-2 space-y-1 text-sm">{p.variantes.map((v) => (
                          <li key={v.nombre} className="flex items-center justify-between gap-3 border-b border-rs-border/60 py-1.5 last:border-0">
                            <span>{v.nombre}{config.mostrar_precios && <>{' '}<span className="ml-2 font-semibold text-rs-lime">{formatearPrecio(v.precio, config.moneda)}</span></>}</span>
                            {pedible && stepper(p, v.nombre, v.precio)}
                          </li>))}</ul>
                      ) : (
                        <div className="mt-2 flex items-center justify-between gap-3">
                          {precio ? <p className="font-semibold text-rs-lime">{precio}</p> : <span />}
                          {pedible && p.precio !== null && stepper(p, null, p.precio)}
                        </div>
                      )}
                    </div>
                    {p.img && /* eslint-disable-next-line @next/next/no-img-element */ <img src={p.img} alt={p.nombre} loading="lazy" className="h-24 w-24 shrink-0 self-start rounded-md object-cover sm:h-28 sm:w-28" />}
                  </li>
                )
              })}
            </ul>
          </section>
        ))}
        {marca && Object.values(marca).some(Boolean) ? (
          <p className="mt-12 flex items-center justify-center gap-1.5 text-xs text-rs-muted">
            {pedidos ? 'Carta y pedidos' : 'Carta digital'} con
            {/* eslint-disable-next-line @next/next/no-img-element */}
            {logoRisto && <img src={logoRisto} alt="" width={18} height={18} className="h-[18px] w-[18px] rounded-md" />}
            <b className="font-semibold text-rs-text">Risto Suite</b>
          </p>
        ) : <p className="mt-12 text-center text-xs text-rs-muted">{pedidos ? 'Carta y pedidos' : 'Carta digital'} · RistoSuite</p>}
      </main>

      {puedePedir && unidades > 0 && !abierto && (
        <div className="fixed inset-x-0 bottom-0 z-20 border-t border-rs-control bg-rs-header/95 p-3 backdrop-blur-md">
          <button type="button" onClick={() => { setExito(null); setAbierto(true) }} className="mx-auto flex h-12 w-full max-w-2xl items-center justify-between rounded-rs bg-rs-lime px-4 font-semibold text-rs-on-lime shadow-[0_0_24px_-4px_rgba(200,230,43,.55)]">
            <span className="inline-flex items-center gap-2"><ShoppingBag size={18} />Ver mi pedido <span className="rounded-full bg-rs-on-lime/15 px-2 text-sm tabular-nums">{unidades}</span></span>
            <span className="tabular-nums">{dinero(subtotal, config.moneda)}</span>
          </button>
        </div>
      )}
      {abierto && pedidos && (
        <Pedido slug={slug} nombre={nombre} pedidos={pedidos} cfg={cfgPed!} pub={pedidos.medios} abiertas={abiertas} moneda={config.moneda} lineas={lineas} subtotal={subtotal} exito={exito}
          onCerrar={() => setAbierto(false)} onCambiar={(l, d) => setCarrito((c) => { const k = clave(l.producto_id, l.variante), n = Math.max(0, Math.min(99, (c[k]?.cantidad ?? 0) + d)); const { [k]: _q, ...resto } = c; void _q; return n === 0 ? resto : { ...resto, [k]: { ...l, cantidad: n } } })}
          onExito={(r) => { setExito(r); setCarrito({}) }} />
      )}
    </div>
  )
}

function Pedido({ slug, nombre, pedidos, cfg, pub, abiertas, moneda, lineas, subtotal, exito, onCerrar, onCambiar, onExito }: {
  slug: string; nombre: string; pedidos: PedidosPublicos; cfg: ConfigPedidos; pub: PedidosPublicos['medios']; abiertas: EntregaPedido[]; moneda: string; lineas: Linea[]; subtotal: number; exito: Extract<ResultadoPedidoPublico, { ok: true }> | null
  onCerrar: () => void; onCambiar: (l: Linea, d: number) => void; onExito: (r: Extract<ResultadoPedidoPublico, { ok: true }>) => void
}) {
  const sinTipo = abiertas.length === 0
  const mesaUrl = typeof window !== 'undefined' ? new URLSearchParams(window.location.search).get('mesa') ?? '' : ''
  const [tipo, setTipo] = useState<string>((mesaUrl && abiertas.find((e) => e.base === 'mesa')?.clave) || abiertas[0]?.clave || '')
  const [form, setForm] = useState({ nombre: '', apellido: '', telefono: '', direccion: '', mesa: abiertas.some((e) => e.base === 'mesa') ? mesaUrl : '', medio_pago: mediosDisponibles(cfg, (mesaUrl && abiertas.find((e) => e.base === 'mesa')) || abiertas[0] || { medios: null })[0]?.clave ?? '', observaciones: '', web: '' })
  const [error, setError] = useState<string | null>(null)
  const [pend, start] = useTransition()
  const arriba = useRef<HTMLDivElement>(null)
  const ent = abiertas.find((e) => e.clave === tipo) ?? abiertas[0]
  const base = ent?.base ?? 'retiro'
  const envio = ent ? costoEnvioFinal(ent, subtotal) : 0
  const medios = ent ? mediosDisponibles(cfg, ent) : []
  const medioElegido = pub.find((m) => m.clave === form.medio_pago)
  // si cambia la forma de entrega (o se cierra una por horario), el tipo y el medio de pago elegidos siguen siendo válidos
  useEffect(() => { if (!abiertas.some((e) => e.clave === tipo) && abiertas[0]) setTipo(abiertas[0].clave) }, [abiertas.map((e) => e.clave).join(',')]) // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { if (medios.length && !medios.some((m) => m.clave === form.medio_pago)) setForm((f) => ({ ...f, medio_pago: medios[0].clave })) }, [medios.map((m) => m.clave).join(',')]) // eslint-disable-line react-hooks/exhaustive-deps
  const faltaGratis = ent && base === 'delivery' && ent.envio_gratis_desde && ent.costo_envio > 0 && subtotal < ent.envio_gratis_desde ? ent.envio_gratis_desde - subtotal : 0
  const faltaMinimo = pedidos.pedido_minimo > 0 && subtotal < pedidos.pedido_minimo
  const campo = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => setForm((f) => ({ ...f, [k]: e.target.value }))
  useEffect(() => { document.body.style.overflow = 'hidden'; return () => { document.body.style.overflow = '' } }, [])
  useEffect(() => { arriba.current?.scrollTo({ top: 0 }) }, [exito])

  const enviar = (e: React.FormEvent) => {
    e.preventDefault(); setError(null)
    start(async () => {
      const r = await crearPedidoPublico(slug, { tipo, ...form, nombre: unirNombre(form.nombre, form.apellido), items: lineas.map((l) => ({ producto_id: l.producto_id, variante: l.variante, cantidad: l.cantidad })) })
      if (r.ok) onExito(r); else { setError(r.error); arriba.current?.scrollTo({ top: 0, behavior: 'smooth' }) }
    })
  }

  const textoWA = exito ? `Hola, soy ${unirNombre(form.nombre, form.apellido)}. Hice el pedido #${exito.numero} por ${dinero(exito.total, moneda)} (${exito.entrega_nombre || labelTipo(exito.tipo)}). ¡Gracias!` : ''
  return (
    <div className="fixed inset-0 z-50 flex animate-fade-in items-end justify-center bg-black/70 backdrop-blur-sm sm:items-center" onMouseDown={(e) => e.target === e.currentTarget && onCerrar()}>
      <div role="dialog" aria-modal="true" aria-label="Mi pedido" className="flex max-h-[94vh] w-full max-w-lg animate-scale-in flex-col rounded-t-rs-lg border border-rs-control bg-rs-card shadow-2xl sm:rounded-rs-lg">
        <div className="flex items-center justify-between border-b border-rs-border px-4 py-3"><h2 className="font-bold">{exito ? '¡Pedido recibido!' : 'Mi pedido'}</h2><button type="button" onClick={onCerrar} aria-label="Cerrar" className="rounded-md p-1 text-rs-muted hover:bg-rs-raised hover:text-rs-text"><X size={18} /></button></div>
        <div ref={arriba} className="overflow-y-auto px-4 py-4">
          {exito ? (
            <div className="space-y-4 text-center">
              <div className="mx-auto grid h-14 w-14 place-items-center rounded-full bg-rs-ok/15 text-rs-ok"><Check size={28} /></div>
              <div><p className="text-3xl font-bold tabular-nums text-rs-lime">#{exito.numero}</p><p className="text-sm text-rs-muted">{nombre} recibió tu pedido · {exito.entrega_nombre || labelTipo(exito.tipo)} · {exito.unidades} producto{exito.unidades === 1 ? '' : 's'}</p></div>
              <p className="text-xl font-bold">{dinero(exito.total, moneda)} <span className="text-sm font-normal text-rs-muted">· {labelPago(exito.medio_pago, exito.medio_pago_nombre)}</span></p>
              {exito.tiempo_estimado && <p className="text-sm">Demora estimada: <span className="font-semibold">{exito.tiempo_estimado}</span></p>}
              {exito.instrucciones && <p className="rounded-md bg-rs-raised/50 p-3 text-left text-sm text-rs-muted">{exito.instrucciones}</p>}
              {exito.datos_pago && <div className="rounded-md border border-rs-lime/30 bg-rs-lime/5 p-3 text-left text-sm"><p className="font-semibold">Datos para pagar</p><p className="mt-1 whitespace-pre-line text-rs-muted">{exito.datos_pago}</p></div>}
              {exito.mensaje && <p className="whitespace-pre-line text-sm text-rs-muted">{exito.mensaje}</p>}
              {exito.whatsapp && <a href={`https://wa.me/${exito.whatsapp.replace(/\D/g, '')}?text=${encodeURIComponent(textoWA)}`} target="_blank" rel="noopener noreferrer" className="btn btn-primary w-full">Avisar por WhatsApp</a>}
              <button type="button" onClick={onCerrar} className="btn w-full">Volver a la carta</button>
            </div>
          ) : (
            <form onSubmit={enviar} className="space-y-4">
              {error && <p role="alert" className="rounded-md border border-rs-danger/40 bg-rs-danger/10 px-3 py-2 text-sm text-rs-danger">{error}</p>}
              <ul className="divide-y divide-rs-border/60">
                {lineas.map((l) => (
                  <li key={clave(l.producto_id, l.variante)} className="flex items-center justify-between gap-3 py-2.5 text-sm">
                    <span className="min-w-0"><span className="block truncate font-medium">{l.nombre}</span>{l.variante && <span className="block text-xs text-rs-muted">{l.variante}</span>}<span className="text-xs text-rs-muted">{dinero(l.precio, moneda)} c/u</span></span>
                    <span className="inline-flex shrink-0 items-center gap-1">
                      <button type="button" onClick={() => onCambiar(l, -1)} aria-label={`Quitar uno de ${l.nombre}`} className="grid h-8 w-8 place-items-center rounded-full border border-rs-control"><Minus size={13} /></button>
                      <span className="w-6 text-center font-bold tabular-nums">{l.cantidad}</span>
                      <button type="button" onClick={() => onCambiar(l, 1)} aria-label={`Agregar uno de ${l.nombre}`} className="grid h-8 w-8 place-items-center rounded-full border border-rs-control"><Plus size={13} /></button>
                    </span>
                    <span className="w-20 shrink-0 text-right font-semibold tabular-nums">{dinero(l.precio * l.cantidad, moneda)}</span>
                  </li>
                ))}
              </ul>

              <fieldset><legend className="label">¿Cómo lo querés?</legend>
                <div className="flex flex-wrap gap-2">{abiertas.map((t) => <label key={t.clave} className="flex cursor-pointer items-center rounded-full border border-rs-control px-3.5 py-1.5 text-sm has-[:checked]:border-rs-lime/60 has-[:checked]:bg-rs-lime/10 has-[:checked]:font-semibold"><input type="radio" name="tipo" value={t.clave} checked={tipo === t.clave} onChange={() => setTipo(t.clave)} className="sr-only" />{t.etiqueta}</label>)}</div>
              </fieldset>
              <div className="grid grid-cols-2 gap-3">
                <div className="col-span-2 sm:col-span-1"><label className="label" htmlFor="pp_nombre">Tu nombre {base === 'mesa' ? '' : '*'}</label><input id="pp_nombre" value={form.nombre} onChange={campo('nombre')} maxLength={60} autoComplete="given-name" className="input w-full" required={tipo !== 'mesa'} /></div>
                <div className="col-span-2 sm:col-span-1"><label className="label" htmlFor="pp_apellido">Tu apellido {base === 'mesa' ? '' : '*'}</label><input id="pp_apellido" value={form.apellido} onChange={campo('apellido')} maxLength={60} autoComplete="family-name" className="input w-full" required={tipo !== 'mesa'} /></div>
                <div className="col-span-2 sm:col-span-1"><label className="label" htmlFor="pp_tel">Teléfono {base === 'mesa' ? '' : '*'}</label><input id="pp_tel" value={form.telefono} onChange={campo('telefono')} type="tel" inputMode="tel" autoComplete="tel" placeholder="Ej. 341 6582156" className="input w-full" required={tipo !== 'mesa'} /></div>
                {base === 'delivery' && <div className="col-span-2"><label className="label" htmlFor="pp_dir">Dirección de entrega *</label><input id="pp_dir" value={form.direccion} onChange={campo('direccion')} maxLength={200} autoComplete="street-address" placeholder="Calle, número, piso/depto, referencias" className="input w-full" required /></div>}
                {base === 'mesa' && <div className="col-span-2 sm:col-span-1"><label className="label" htmlFor="pp_mesa">Número de mesa *</label><input id="pp_mesa" value={form.mesa} onChange={campo('mesa')} maxLength={20} className="input w-full" required /></div>}
              </div>
              <fieldset><legend className="label">Forma de pago</legend>
                <div className="flex flex-wrap gap-2">{medios.map((m) => <label key={m.clave} className="flex cursor-pointer items-center rounded-full border border-rs-control px-3.5 py-1.5 text-sm has-[:checked]:border-rs-lime/60 has-[:checked]:bg-rs-lime/10 has-[:checked]:font-semibold"><input type="radio" name="pago" value={m.clave} checked={form.medio_pago === m.clave} onChange={campo('medio_pago')} className="sr-only" />{m.etiqueta}</label>)}</div>
              </fieldset>
              {medioElegido?.aviso && <p className="-mt-2 text-xs text-rs-muted">{medioElegido.aviso}</p>}
              {medioElegido?.tieneDatos && <p className="-mt-2 text-xs text-rs-muted">Al confirmar el pedido te mostramos los datos para pagar.</p>}
              <div><label className="label" htmlFor="pp_obs">Aclaraciones (opcional)</label><textarea id="pp_obs" value={form.observaciones} onChange={campo('observaciones')} maxLength={500} rows={2} placeholder="Alergias, sin cebolla, timbre que no anda…" className="input w-full" /></div>
              <input type="text" name="web" value={form.web} onChange={campo('web')} tabIndex={-1} autoComplete="off" aria-hidden className="absolute -left-[9999px] h-0 w-0 opacity-0" />

              <div className="space-y-1 border-t border-rs-border pt-3 text-sm">
                <div className="flex justify-between text-rs-muted"><span>Subtotal</span><span className="tabular-nums">{dinero(subtotal, moneda)}</span></div>
                {base === 'delivery' && <div className="flex justify-between text-rs-muted"><span>Envío</span><span className="tabular-nums">{envio > 0 ? dinero(envio, moneda) : 'Gratis'}</span></div>}
                {(ent?.tiempo || pedidos.tiempo_estimado) && <p className="text-xs text-rs-muted">Demora estimada: {ent?.tiempo || pedidos.tiempo_estimado}</p>}
                {faltaGratis > 0 && <p className="text-xs text-rs-ok">Sumá {dinero(faltaGratis, moneda)} más y el envío es gratis.</p>}
                <div className="flex justify-between text-lg font-bold"><span>Total</span><span className="tabular-nums text-rs-lime">{dinero(subtotal + envio, moneda)}</span></div>
              </div>
              {faltaMinimo && <p role="status" className="text-sm text-rs-warn">El pedido mínimo es {dinero(pedidos.pedido_minimo, moneda)}: te faltan {dinero(pedidos.pedido_minimo - subtotal, moneda)}.</p>}
              {pedidos.mensaje && <p className="whitespace-pre-line text-xs text-rs-muted">{pedidos.mensaje}</p>}
              <button disabled={pend || lineas.length === 0 || faltaMinimo} className="btn btn-primary h-12 w-full text-base">{pend ? 'Enviando…' : `Hacer el pedido · ${dinero(subtotal + envio, moneda)}`}</button>
            </form>
          )}
        </div>
      </div>
    </div>
  )
}

