'use client'

import { useEffect, useMemo, useRef, useState, useTransition } from 'react'
import { ArrowDown, ArrowUp, BookOpen, Copy, Eye, EyeOff, FileText, ImageIcon, Pencil, Plus, QrCode, Settings, Star, Trash2, Upload, X, ExternalLink, Download } from 'lucide-react'
import QRCode from 'qrcode'
import {
  alternarCategoria, alternarProducto, descartarImagen, eliminarCategoria, eliminarProducto, guardarAjustesCarta, guardarCategoria, guardarProducto,
  importarCarta, moverCategoria, moverProducto, subirImagen,
} from '@/app/(panel)/carta-actions'
import { useConfirm, useToast } from '@/components/feedback'
import Modal from '@/components/modal'
import { EstadoVacio, Spinner } from '@/components/ui'
import { useAccionFormulario } from '@/components/use-accion-formulario'
import { ETIQUETAS, MAX_VARIANTES, etiquetaDe, formatearPrecio, textoPrecio, urlImagen, type CategoriaCarta, type ConfigCarta, type ProductoCarta, type Variante } from '@/lib/carta'

type Dialogo =
  | { t: 'categoria'; cat?: CategoriaCarta }
  | { t: 'producto'; prod?: ProductoCarta }
  | { t: 'ajustes' } | { t: 'importar' } | { t: 'qr' }

interface Props { categorias: CategoriaCarta[]; productos: ProductoCarta[]; config: ConfigCarta; slug: string; negocio: string; puedeEscribir: boolean; puedeEliminar: boolean; puedeAjustes: boolean }

/** Achica la foto en el navegador (máx. 1100 px de lado, WEBP) para que la carta cargue rápido y la subida sea liviana. */
async function achicarImagen(file: File, max = 1100): Promise<File> {
  const bmp = await createImageBitmap(file)
  const escala = Math.min(1, max / Math.max(bmp.width, bmp.height))
  const canvas = document.createElement('canvas')
  canvas.width = Math.round(bmp.width * escala); canvas.height = Math.round(bmp.height * escala)
  canvas.getContext('2d')!.drawImage(bmp, 0, 0, canvas.width, canvas.height)
  const blob: Blob | null = await new Promise((ok) => canvas.toBlob(ok, 'image/webp', 0.82))
  if (!blob) throw new Error('No se pudo procesar la foto')
  return new File([blob], 'foto.webp', { type: 'image/webp' })
}

const Switch = ({ on, onClick, disabled, titulo, children }: { on: boolean; onClick: () => void; disabled?: boolean; titulo: string; children?: React.ReactNode }) => (
  <button type="button" role="switch" aria-checked={on} aria-label={titulo} title={titulo} disabled={disabled} onClick={onClick}
    className={'inline-flex h-7 items-center gap-1.5 rounded-full border px-2.5 text-xs font-semibold transition disabled:opacity-50 ' + (on ? 'border-rs-ok/40 bg-rs-ok/10 text-rs-ok' : 'border-rs-danger/40 bg-rs-danger/10 text-rs-danger')}>
    <span className={'h-1.5 w-1.5 rounded-full ' + (on ? 'bg-rs-ok' : 'bg-rs-danger')} />{children}
  </button>
)

export default function CartaAdmin({ categorias, productos, config, slug, negocio, puedeEscribir, puedeEliminar, puedeAjustes }: Props) {
  const toast = useToast()
  const confirmar = useConfirm()
  const [pend, start] = useTransition()
  const [sel, setSel] = useState<string>('todas')
  const [q, setQ] = useState('')
  const [modal, setModal] = useState<Dialogo | null>(null)
  const cerrar = () => setModal(null)
  const catSel = categorias.find((c) => c.id === sel) ?? null
  useEffect(() => { if (sel !== 'todas' && !categorias.some((c) => c.id === sel)) setSel('todas') }, [categorias, sel])

  const cuenta = useMemo(() => { const m = new Map<string, number>(); for (const p of productos) m.set(p.categoria_id, (m.get(p.categoria_id) ?? 0) + 1); return m }, [productos])
  const nombreCat = useMemo(() => new Map(categorias.map((c) => [c.id, c.nombre])), [categorias])
  const lista = useMemo(() => {
    const t = q.trim().toLowerCase()
    return productos.filter((p) => (sel === 'todas' || p.categoria_id === sel) && (!t || p.nombre.toLowerCase().includes(t) || (p.descripcion ?? '').toLowerCase().includes(t)))
      .sort((a, b) => categorias.findIndex((c) => c.id === a.categoria_id) - categorias.findIndex((c) => c.id === b.categoria_id) || a.orden - b.orden)
  }, [productos, sel, q, categorias])
  const puedeOrdenar = puedeEscribir && sel !== 'todas' && !q.trim()

  const ejecutar = (fn: () => Promise<{ ok: boolean; error?: string }>, okTexto?: string) =>
    start(async () => { const r = await fn(); if (!r.ok) toast({ tipo: 'error', texto: r.error ?? 'Ocurrió un error' }); else if (okTexto) toast({ texto: okTexto }) })

  const borrarCategoria = async (c: CategoriaCarta) => {
    if (!(await confirmar({ titulo: `¿Eliminar la categoría "${c.nombre}"?`, texto: 'Solo se puede borrar si no tiene productos.', confirmar: 'Eliminar', peligro: true }))) return
    ejecutar(() => eliminarCategoria(c.id), 'Categoría eliminada')
  }
  const borrarProducto = async (p: ProductoCarta) => {
    if (!(await confirmar({ titulo: `¿Eliminar "${p.nombre}"?`, texto: 'Se borra del menú para siempre (y su foto).', confirmar: 'Eliminar', peligro: true }))) return
    ejecutar(() => eliminarProducto(p.id), 'Producto eliminado')
  }

  const agotados = productos.filter((p) => !p.disponible).length, ocultos = productos.filter((p) => !p.visible).length
  const enlace = typeof window !== 'undefined' ? `${window.location.origin}/carta/${slug}` : `/carta/${slug}`
  const copiar = async () => { try { await navigator.clipboard.writeText(enlace); toast({ texto: 'Enlace de la carta copiado' }) } catch { toast({ tipo: 'error', texto: 'No se pudo copiar: ' + enlace }) } }

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div className="animate-fade-up">
          <h1 className="flex items-center gap-2 text-xl font-bold sm:text-2xl"><BookOpen className="text-rs-lime" size={22} />Carta</h1>
          <p className="text-sm text-rs-muted">Categorías y productos de {negocio}, con precio, foto y disponibilidad</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <a href={`/carta/${slug}`} target="_blank" rel="noopener noreferrer" className="btn"><ExternalLink size={14} />Ver carta pública</a>
          <button type="button" onClick={copiar} className="btn"><Copy size={14} />Copiar enlace</button>
          <button type="button" onClick={() => setModal({ t: 'qr' })} className="btn"><QrCode size={14} />QR</button>
          {puedeAjustes && <button type="button" onClick={() => setModal({ t: 'ajustes' })} className="btn"><Settings size={14} />Ajustes</button>}
        </div>
      </div>

      {!config.publica && <p role="status" className="rounded-md border border-rs-warn/40 bg-rs-warn/10 px-3 py-2 text-sm text-rs-warn">La carta pública está desactivada: quien abra el enlace verá “carta no disponible”. Se activa en Ajustes.</p>}

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {[['Productos', productos.length, 'text-rs-text'], ['Categorías', categorias.length, 'text-rs-text'], ['Agotados', agotados, agotados ? 'text-rs-danger' : 'text-rs-muted'], ['Ocultos', ocultos, ocultos ? 'text-rs-warn' : 'text-rs-muted']].map(([l, n, c]) => (
          <div key={l as string} className="card px-4 py-3"><div className={'text-2xl font-bold tabular-nums ' + c}>{n}</div><div className="card-title mt-1">{l}</div></div>
        ))}
      </div>

      <div className="grid gap-4 lg:grid-cols-[280px_1fr]">
        {/* Categorías */}
        <aside className="card h-fit p-3">
          <div className="mb-2 flex items-center justify-between px-1"><h2 className="card-title">Categorías</h2>{puedeEscribir && <button type="button" onClick={() => setModal({ t: 'categoria' })} className="btn btn-sm"><Plus size={13} />Nueva</button>}</div>
          <ul className="space-y-1">
            <li><button type="button" onClick={() => setSel('todas')} className={'flex w-full items-center justify-between rounded-md px-2.5 py-2 text-left text-sm transition ' + (sel === 'todas' ? 'bg-rs-lime/15 font-semibold text-rs-lime' : 'hover:bg-rs-raised')}>Todas <span className="text-xs text-rs-muted">{productos.length}</span></button></li>
            {categorias.map((c, i) => (
              <li key={c.id} className={'group rounded-md ' + (sel === c.id ? 'bg-rs-lime/10' : '')}>
                <div className="flex items-center gap-1">
                  <button type="button" onClick={() => setSel(c.id)} className={'flex min-w-0 flex-1 items-center justify-between gap-2 rounded-md px-2.5 py-2 text-left text-sm transition ' + (sel === c.id ? 'font-semibold text-rs-lime' : 'hover:bg-rs-raised')}>
                    <span className={'truncate ' + (c.visible ? '' : 'text-rs-muted line-through')}>{c.nombre}</span><span className="shrink-0 text-xs text-rs-muted">{cuenta.get(c.id) ?? 0}</span>
                  </button>
                </div>
                {puedeEscribir && sel === c.id && (
                  <div className="flex flex-wrap items-center gap-1 px-2 pb-2">
                    <button type="button" disabled={pend || i === 0} onClick={() => ejecutar(() => moverCategoria(c.id, 'arriba'))} aria-label="Subir categoría" className="btn btn-sm w-7 px-0"><ArrowUp size={13} /></button>
                    <button type="button" disabled={pend || i === categorias.length - 1} onClick={() => ejecutar(() => moverCategoria(c.id, 'abajo'))} aria-label="Bajar categoría" className="btn btn-sm w-7 px-0"><ArrowDown size={13} /></button>
                    <button type="button" disabled={pend} onClick={() => ejecutar(() => alternarCategoria(c.id))} aria-label={c.visible ? 'Ocultar categoría' : 'Mostrar categoría'} title={c.visible ? 'Ocultar de la carta pública' : 'Mostrar en la carta pública'} className="btn btn-sm w-7 px-0">{c.visible ? <Eye size={13} /> : <EyeOff size={13} />}</button>
                    <button type="button" onClick={() => setModal({ t: 'categoria', cat: c })} aria-label="Editar categoría" className="btn btn-sm w-7 px-0"><Pencil size={13} /></button>
                    {puedeEliminar && <button type="button" disabled={pend} onClick={() => borrarCategoria(c)} aria-label="Eliminar categoría" className="btn btn-sm btn-danger w-7 px-0"><Trash2 size={13} /></button>}
                  </div>
                )}
              </li>
            ))}
          </ul>
          {categorias.length === 0 && <p className="px-2 py-3 text-sm text-rs-muted">Todavía no hay categorías. Creá la primera (ej. Entradas, Principales, Postres, Bebidas).</p>}
        </aside>

        {/* Productos */}
        <section className="min-w-0 space-y-3">
          <div className="card flex flex-wrap items-center gap-2 p-3">
            <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Buscar producto…" aria-label="Buscar producto" className="input min-w-[180px] flex-1" />
            {puedeEscribir && <>
              <button type="button" onClick={() => setModal({ t: 'importar' })} className="btn"><FileText size={14} />Importar</button>
              <button type="button" disabled={categorias.length === 0} title={categorias.length === 0 ? 'Creá una categoría primero' : undefined} onClick={() => setModal({ t: 'producto' })} className="btn btn-primary"><Plus size={14} />Nuevo producto</button>
            </>}
          </div>

          {lista.length === 0 ? (
            <div className="card"><EstadoVacio icono={<BookOpen size={26} />} titulo={productos.length === 0 ? 'La carta está vacía' : 'No hay productos para mostrar'} texto={productos.length === 0 ? 'Creá categorías y cargá productos uno por uno, o pegá la carta entera con “Importar”.' : 'Probá con otra búsqueda o categoría.'} /></div>
          ) : (
            <ul className="space-y-2">
              {lista.map((p, i) => {
                const precio = textoPrecio(p, config.moneda), img = urlImagen(p.imagen_path)
                return (
                  <li key={p.id} className={'card flex flex-wrap items-start gap-3 p-3 sm:flex-nowrap ' + (p.visible ? '' : 'opacity-60')}>
                    <div className="h-16 w-16 shrink-0 overflow-hidden rounded-md bg-rs-raised">
                      {img ? /* eslint-disable-next-line @next/next/no-img-element */ <img src={img} alt="" loading="lazy" className="h-full w-full object-cover" /> : <div className="grid h-full w-full place-items-center text-rs-muted"><ImageIcon size={20} /></div>}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                        <span className="font-semibold">{p.nombre}</span>
                        {p.destacado && <Star size={13} className="fill-rs-lime text-rs-lime" aria-label="Destacado" />}
                        {sel === 'todas' && <span className="text-xs text-rs-muted">· {nombreCat.get(p.categoria_id)}</span>}
                        {!p.visible && <span className="badge bg-rs-raised text-rs-muted">Oculto</span>}
                      </div>
                      {p.descripcion && <p className="mt-0.5 line-clamp-2 text-sm text-rs-muted">{p.descripcion}</p>}
                      <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
                        <span className="text-sm font-semibold text-rs-lime">{precio ?? <span className="font-normal text-rs-muted">Sin precio</span>}</span>
                        {p.variantes.length > 0 && <span className="text-xs text-rs-muted">· {p.variantes.map((v) => `${v.nombre} ${formatearPrecio(v.precio, config.moneda)}`).join(' · ')}</span>}
                        {p.etiquetas.map((e) => { const d = etiquetaDe(e); return d ? <span key={e} className={'badge ' + d.color}>{d.label}</span> : null })}
                      </div>
                    </div>
                    {puedeEscribir && (
                      <div className="flex w-full flex-wrap items-center justify-end gap-1.5 sm:w-auto sm:flex-col sm:items-end">
                        <Switch on={p.disponible} disabled={pend} titulo={p.disponible ? 'Marcar como agotado' : 'Marcar como disponible'} onClick={() => ejecutar(() => alternarProducto(p.id, 'disponible'))}>{p.disponible ? 'Disponible' : 'Agotado'}</Switch>
                        <div className="flex items-center gap-1">
                          {puedeOrdenar && <>
                            <button type="button" disabled={pend || i === 0} onClick={() => ejecutar(() => moverProducto(p.id, 'arriba'))} aria-label="Subir producto" className="btn btn-sm w-7 px-0"><ArrowUp size={13} /></button>
                            <button type="button" disabled={pend || i === lista.length - 1} onClick={() => ejecutar(() => moverProducto(p.id, 'abajo'))} aria-label="Bajar producto" className="btn btn-sm w-7 px-0"><ArrowDown size={13} /></button>
                          </>}
                          <button type="button" disabled={pend} onClick={() => ejecutar(() => alternarProducto(p.id, 'destacado'))} aria-label={p.destacado ? 'Quitar destacado' : 'Destacar'} title={p.destacado ? 'Quitar destacado' : 'Destacar'} className="btn btn-sm w-7 px-0"><Star size={13} className={p.destacado ? 'fill-rs-lime text-rs-lime' : ''} /></button>
                          <button type="button" disabled={pend} onClick={() => ejecutar(() => alternarProducto(p.id, 'visible'))} aria-label={p.visible ? 'Ocultar producto' : 'Mostrar producto'} title={p.visible ? 'Ocultar de la carta pública' : 'Mostrar en la carta pública'} className="btn btn-sm w-7 px-0">{p.visible ? <Eye size={13} /> : <EyeOff size={13} />}</button>
                          <button type="button" onClick={() => setModal({ t: 'producto', prod: p })} aria-label="Editar producto" className="btn btn-sm w-7 px-0"><Pencil size={13} /></button>
                          {puedeEliminar && <button type="button" disabled={pend} onClick={() => borrarProducto(p)} aria-label="Eliminar producto" className="btn btn-sm btn-danger w-7 px-0"><Trash2 size={13} /></button>}
                        </div>
                      </div>
                    )}
                  </li>
                )
              })}
            </ul>
          )}
          {catSel?.descripcion && <p className="px-1 text-xs text-rs-muted">{catSel.nombre}: {catSel.descripcion}</p>}
        </section>
      </div>

      {modal?.t === 'categoria' && <Modal titulo={modal.cat ? 'Editar categoría' : 'Nueva categoría'} onClose={cerrar}><FormCategoria cat={modal.cat} onDone={cerrar} /></Modal>}
      {modal?.t === 'producto' && <ModalProducto prod={modal.prod} categorias={categorias} categoriaInicial={catSel?.id} moneda={config.moneda} onClose={cerrar} />}
      {modal?.t === 'ajustes' && <Modal titulo="Ajustes de la carta pública" onClose={cerrar}><FormAjustes config={config} onDone={cerrar} /></Modal>}
      {modal?.t === 'importar' && <Modal titulo="Importar productos" onClose={cerrar} ancho="max-w-2xl"><FormImportar onDone={cerrar} /></Modal>}
      {modal?.t === 'qr' && <Modal titulo="Código QR de la carta" onClose={cerrar}><PanelQR enlace={enlace} nombre={negocio} onCopiar={copiar} /></Modal>}
    </div>
  )
}

// ---------------------------------------------------------------------------
function Acciones({ pending, texto, onCancel }: { pending: boolean; texto: string; onCancel: () => void }) {
  return (
    <div className="mt-2 flex justify-end gap-2">
      <button type="button" onClick={onCancel} className="btn">Cancelar</button>
      <button disabled={pending} className="btn btn-primary">{pending && <Spinner />}{pending ? 'Guardando…' : texto}</button>
    </div>
  )
}

function useCerrarAlGuardar(state: { ok: boolean; error?: string } | null, texto: string, onDone: () => void) {
  const toast = useToast()
  useEffect(() => { if (state?.ok) { toast({ texto }); onDone() } }, [state]) // eslint-disable-line react-hooks/exhaustive-deps
}

function FormCategoria({ cat, onDone }: { cat?: CategoriaCarta; onDone: () => void }) {
  const { state, pending, formProps } = useAccionFormulario(guardarCategoria)
  useCerrarAlGuardar(state, cat ? 'Categoría guardada' : 'Categoría creada', onDone)
  return (
    <form {...formProps} className="space-y-3">
      {cat && <input type="hidden" name="id" value={cat.id} />}
      <div><label className="label" htmlFor="c_nombre">Nombre *</label><input id="c_nombre" name="nombre" defaultValue={cat?.nombre ?? ''} maxLength={60} placeholder="Ej. Entradas" className="input w-full" required /></div>
      <div><label className="label" htmlFor="c_desc">Descripción (opcional)</label><textarea id="c_desc" name="descripcion" defaultValue={cat?.descripcion ?? ''} maxLength={300} rows={2} className="input w-full" placeholder="Ej. Para compartir" /></div>
      <label className="flex items-center gap-2 text-sm"><input type="checkbox" name="visible" defaultChecked={cat?.visible ?? true} className="h-4 w-4 accent-[#c8e62b]" />Visible en la carta pública</label>
      {state && !state.ok && <p role="alert" className="text-sm text-rs-danger">{state.error}</p>}
      <Acciones pending={pending} texto={cat ? 'Guardar' : 'Crear categoría'} onCancel={onDone} />
    </form>
  )
}

function ModalProducto({ prod, categorias, categoriaInicial, moneda, onClose }: { prod?: ProductoCarta; categorias: CategoriaCarta[]; categoriaInicial?: string; moneda: string; onClose: () => void }) {
  const toast = useToast()
  const { state, pending, formProps } = useAccionFormulario(guardarProducto)
  const [imagen, setImagen] = useState<string | null>(prod?.imagen_path ?? null)
  const [subidas, setSubidas] = useState<string[]>([])   // fotos subidas en este diálogo (si no se guarda, se descartan)
  const [subiendo, setSubiendo] = useState(false)
  const [variantes, setVariantes] = useState<{ nombre: string; precio: string }[]>((prod?.variantes ?? []).map((v: Variante) => ({ nombre: v.nombre, precio: String(v.precio) })))
  const archivo = useRef<HTMLInputElement>(null)
  const guardado = useRef(false)

  const cerrar = () => { if (!guardado.current) for (const p of subidas) if (p !== prod?.imagen_path) void descartarImagen(p); onClose() }
  useEffect(() => { if (state?.ok) { guardado.current = true; toast({ texto: prod ? 'Producto guardado' : 'Producto creado' }); onClose() } }, [state]) // eslint-disable-line react-hooks/exhaustive-deps

  const elegirFoto = async (f: File | undefined) => {
    if (!f) return
    setSubiendo(true)
    try {
      const chica = await achicarImagen(f)
      const fd = new FormData(); fd.set('archivo', chica)
      const r = await subirImagen(fd)
      if (!r.ok) { toast({ tipo: 'error', texto: r.error }); return }
      if (imagen && subidas.includes(imagen)) void descartarImagen(imagen)   // la foto anterior de este mismo diálogo ya no sirve
      setSubidas((s) => [...s, r.path]); setImagen(r.path)
    } catch { toast({ tipo: 'error', texto: 'No se pudo procesar la foto. Probá con otra (JPG, PNG o WEBP).' }) }
    finally { setSubiendo(false); if (archivo.current) archivo.current.value = '' }
  }
  const img = urlImagen(imagen)

  return (
    <Modal titulo={prod ? 'Editar producto' : 'Nuevo producto'} onClose={cerrar} ancho="max-w-2xl">
      <form {...formProps} className="grid grid-cols-2 gap-3">
        {prod && <input type="hidden" name="id" value={prod.id} />}
        <input type="hidden" name="imagen_path" value={imagen ?? ''} />
        <input type="hidden" name="variantes" value={JSON.stringify(variantes)} />
        <div className="col-span-2 sm:col-span-1"><label className="label" htmlFor="p_nombre">Nombre *</label><input id="p_nombre" name="nombre" defaultValue={prod?.nombre ?? ''} maxLength={100} className="input w-full" required /></div>
        <div className="col-span-2 sm:col-span-1">
          <label className="label" htmlFor="p_cat">Categoría *</label>
          <select id="p_cat" name="categoria_id" defaultValue={prod?.categoria_id ?? categoriaInicial ?? categorias[0]?.id} className="input w-full" required>{categorias.map((c) => <option key={c.id} value={c.id}>{c.nombre}</option>)}</select>
        </div>
        <div className="col-span-2"><label className="label" htmlFor="p_desc">Descripción</label><textarea id="p_desc" name="descripcion" defaultValue={prod?.descripcion ?? ''} maxLength={600} rows={3} placeholder="Ingredientes, tamaño, aclaraciones…" className="input w-full" /></div>
        <div className="col-span-2 sm:col-span-1">
          <label className="label" htmlFor="p_precio">Precio ({moneda})</label>
          <input id="p_precio" name="precio" inputMode="decimal" defaultValue={prod?.precio ?? ''} placeholder="Ej. 12500" className="input w-full" />
          <p className="mt-1 text-xs text-rs-muted">Dejalo vacío si el producto tiene opciones o si no querés mostrar precio.</p>
        </div>
        <div className="col-span-2 sm:col-span-1">
          <span className="label">Foto</span>
          <div className="flex items-center gap-3">
            <div className="h-16 w-16 shrink-0 overflow-hidden rounded-md bg-rs-raised">{img ? /* eslint-disable-next-line @next/next/no-img-element */ <img src={img} alt="Vista previa" className="h-full w-full object-cover" /> : <div className="grid h-full w-full place-items-center text-rs-muted"><ImageIcon size={20} /></div>}</div>
            <div className="flex flex-wrap gap-2">
              <input ref={archivo} type="file" accept="image/jpeg,image/png,image/webp" className="sr-only" aria-label="Elegir foto" onChange={(e) => void elegirFoto(e.target.files?.[0])} />
              <button type="button" disabled={subiendo} onClick={() => archivo.current?.click()} className="btn btn-sm">{subiendo ? <Spinner /> : <Upload size={13} />}{subiendo ? 'Subiendo…' : img ? 'Cambiar' : 'Subir foto'}</button>
              {img && <button type="button" onClick={() => setImagen(null)} className="btn btn-sm btn-danger"><X size={13} />Quitar</button>}
            </div>
          </div>
        </div>

        <div className="col-span-2">
          <div className="mb-1 flex items-center justify-between"><span className="label mb-0">Opciones de precio (opcional)</span>{variantes.length < MAX_VARIANTES && <button type="button" onClick={() => setVariantes((v) => [...v, { nombre: '', precio: '' }])} className="btn btn-sm"><Plus size={12} />Agregar opción</button>}</div>
          {variantes.length === 0 ? <p className="text-xs text-rs-muted">Para productos con tamaños o variantes (Chica / Grande, media / entera). Se muestra “Desde $…”.</p> : (
            <ul className="space-y-2">{variantes.map((v, i) => (
              <li key={i} className="grid grid-cols-[1fr_120px_auto] items-center gap-2">
                <input aria-label={`Nombre de la opción ${i + 1}`} value={v.nombre} maxLength={40} placeholder="Ej. Grande" onChange={(e) => setVariantes((l) => l.map((x, k) => (k === i ? { ...x, nombre: e.target.value } : x)))} className="input" />
                <input aria-label={`Precio de la opción ${i + 1}`} value={v.precio} inputMode="decimal" placeholder="Precio" onChange={(e) => setVariantes((l) => l.map((x, k) => (k === i ? { ...x, precio: e.target.value } : x)))} className="input" />
                <button type="button" onClick={() => setVariantes((l) => l.filter((_, k) => k !== i))} aria-label="Quitar opción" className="btn btn-sm btn-danger w-8 px-0"><X size={13} /></button>
              </li>))}</ul>
          )}
        </div>

        <div className="col-span-2">
          <span className="label">Etiquetas</span>
          <div className="flex flex-wrap gap-2">{ETIQUETAS.map((e) => (
            <label key={e.clave} className="flex cursor-pointer items-center gap-1.5 rounded-full border border-rs-control px-2.5 py-1 text-xs has-[:checked]:border-rs-lime/60 has-[:checked]:bg-rs-lime/10"><input type="checkbox" name="etiquetas" value={e.clave} defaultChecked={prod?.etiquetas.includes(e.clave)} className="h-3.5 w-3.5 accent-[#c8e62b]" />{e.label}</label>
          ))}</div>
        </div>
        <div className="col-span-2 flex flex-wrap gap-x-5 gap-y-2 text-sm">
          <label className="flex items-center gap-2"><input type="checkbox" name="disponible" defaultChecked={prod?.disponible ?? true} className="h-4 w-4 accent-[#c8e62b]" />Disponible <span className="text-xs text-rs-muted">(si no, se muestra “Agotado”)</span></label>
          <label className="flex items-center gap-2"><input type="checkbox" name="visible" defaultChecked={prod?.visible ?? true} className="h-4 w-4 accent-[#c8e62b]" />Visible en la carta</label>
          <label className="flex items-center gap-2"><input type="checkbox" name="destacado" defaultChecked={prod?.destacado ?? false} className="h-4 w-4 accent-[#c8e62b]" />Destacado</label>
        </div>
        {state && !state.ok && <p role="alert" className="col-span-2 text-sm text-rs-danger">{state.error}</p>}
        <div className="col-span-2"><Acciones pending={pending || subiendo} texto={prod ? 'Guardar' : 'Crear producto'} onCancel={cerrar} /></div>
      </form>
    </Modal>
  )
}

function FormAjustes({ config, onDone }: { config: ConfigCarta; onDone: () => void }) {
  const { state, pending, formProps } = useAccionFormulario(guardarAjustesCarta)
  useCerrarAlGuardar(state, 'Ajustes guardados', onDone)
  return (
    <form {...formProps} className="space-y-3">
      <label className="flex items-start gap-2 text-sm"><input type="checkbox" name="publica" defaultChecked={config.publica} className="mt-0.5 h-4 w-4 accent-[#c8e62b]" /><span><span className="font-medium">Carta pública activa</span><span className="block text-xs text-rs-muted">Si la desactivás, el enlace y el QR muestran “carta no disponible”.</span></span></label>
      <label className="flex items-start gap-2 text-sm"><input type="checkbox" name="mostrar_precios" defaultChecked={config.mostrar_precios} className="mt-0.5 h-4 w-4 accent-[#c8e62b]" /><span><span className="font-medium">Mostrar precios</span><span className="block text-xs text-rs-muted">Desmarcalo para una carta solo de menú, sin precios.</span></span></label>
      <div><label className="label" htmlFor="a_titulo">Título (opcional)</label><input id="a_titulo" name="titulo" defaultValue={config.titulo ?? ''} maxLength={80} placeholder="Por defecto: el nombre del negocio" className="input w-full" /></div>
      <div><label className="label" htmlFor="a_msg">Mensaje de cabecera (opcional)</label><textarea id="a_msg" name="mensaje" defaultValue={config.mensaje ?? ''} maxLength={400} rows={3} placeholder="Ej. Precios con IVA incluido. Avisanos si tenés alguna alergia." className="input w-full" /></div>
      <div><label className="label" htmlFor="a_mon">Símbolo de moneda</label><input id="a_mon" name="moneda" defaultValue={config.moneda} maxLength={4} className="input w-24" /></div>
      {state && !state.ok && <p role="alert" className="text-sm text-rs-danger">{state.error}</p>}
      <Acciones pending={pending} texto="Guardar" onCancel={onDone} />
    </form>
  )
}

function FormImportar({ onDone }: { onDone: () => void }) {
  const { state, pending, formProps } = useAccionFormulario(importarCarta)
  const toast = useToast()
  useEffect(() => {
    if (state?.ok) { const s = state as { cantidad?: number; omitidas?: number; categorias?: number }; toast({ texto: `${s.cantidad ?? 0} producto${s.cantidad === 1 ? '' : 's'} cargado${s.cantidad === 1 ? '' : 's'}${s.categorias ? ` y ${s.categorias} categoría${s.categorias === 1 ? '' : 's'} nueva${s.categorias === 1 ? '' : 's'}` : ''}${s.omitidas ? ` · ${s.omitidas} línea${s.omitidas === 1 ? '' : 's'} omitida${s.omitidas === 1 ? '' : 's'}` : ''}` }); onDone() }
  }, [state]) // eslint-disable-line react-hooks/exhaustive-deps
  return (
    <form {...formProps} className="space-y-3">
      <p className="text-sm text-rs-muted">Pegá un producto por línea con este formato (precio y descripción son opcionales). Las categorías que no existan se crean solas.</p>
      <pre className="overflow-x-auto rounded-md bg-rs-raised/60 p-3 text-xs text-rs-text">{`Entradas | Provoleta | 9500 | Con orégano y tomate
Principales | Milanesa napolitana | 14.500,50
Postres | Flan casero | 6000 | Con dulce de leche`}</pre>
      <textarea name="texto" rows={10} required aria-label="Productos a importar" className="input w-full font-mono text-xs" placeholder="Categoría | Producto | Precio | Descripción" />
      {state && !state.ok && <p role="alert" className="text-sm text-rs-danger">{state.error}</p>}
      <Acciones pending={pending} texto="Importar" onCancel={onDone} />
    </form>
  )
}

function PanelQR({ enlace, nombre, onCopiar }: { enlace: string; nombre: string; onCopiar: () => void }) {
  const [png, setPng] = useState<string | null>(null)
  useEffect(() => { QRCode.toDataURL(enlace, { width: 800, margin: 2, errorCorrectionLevel: 'M', color: { dark: '#000000', light: '#ffffff' } }).then(setPng).catch(() => setPng(null)) }, [enlace])
  return (
    <div className="space-y-4 text-center">
      <div className="mx-auto grid h-64 w-64 place-items-center rounded-lg bg-white p-2">{png ? /* eslint-disable-next-line @next/next/no-img-element */ <img src={png} alt={`Código QR de la carta de ${nombre}`} className="h-full w-full" /> : <Spinner size={22} />}</div>
      <p className="break-all text-xs text-rs-muted">{enlace}</p>
      <p className="text-xs text-rs-muted">Imprimilo y pegalo en las mesas, la entrada o el ticket: quien lo escanee ve la carta actualizada, sin instalar nada.</p>
      <div className="flex flex-wrap justify-center gap-2">
        {png && <a href={png} download={`qr-carta-${nombre.toLowerCase().replace(/[^a-z0-9]+/g, '-')}.png`} className="btn btn-primary"><Download size={14} />Descargar PNG</a>}
        <button type="button" onClick={onCopiar} className="btn"><Copy size={14} />Copiar enlace</button>
      </div>
    </div>
  )
}
