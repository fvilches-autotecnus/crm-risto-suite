'use client'

import { useEffect, useMemo, useRef, useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { createBrowserClient } from '@supabase/ssr'
import { Armchair, Check, ChevronLeft, ChevronRight, Clock, Copy, Pencil, Plus, QrCode, Sparkles, Trash2, Users, X } from 'lucide-react'
import {
  alternarSalon, asignarMesas, crearVariasMesas, eliminarMesa, eliminarSalon, guardarDuracionMesas, guardarMesa, guardarSalon, liberarMesa, marcarServicio, moverMesa, ocuparMesa, rotarMesa,
  type ResultadoAsignacion,
} from '@/app/(panel)/mesas-actions'
import { useConfirm, useToast } from '@/components/feedback'
import { FechaInput } from '@/components/inputs'
import Modal from '@/components/modal'
import { Spinner } from '@/components/ui'
import { useAccionFormulario } from '@/components/use-accion-formulario'
import { iniciarCarga } from '@/lib/carga'
import { CajaMesa, Derecho, LADOS_SILLAS, TEMAS_SILLAS, COLOR_SILLAS_DEFECTO } from '@/components/mesa-sillas'
import {
  ESTADOS_MESA, aMinutos, conflictoCon, deMinutos, estadoMesa, rangoCapacidad, sePuedenJuntar, seSuperponen, sugerirMesas, type Mesa, type ReservaSalon, type Salon,
} from '@/lib/mesas'

interface Props {
  salones: Salon[]; mesas: Mesa[]; reservas: ReservaSalon[]; duracion: number; fecha: string; hoy: string; modo: 'servicio' | 'editar'
  puedeEscribir: boolean; puedeEstructura: boolean; puedeAdministrar: boolean; negocioId: string; ahoraInicial: number; ubicaciones: string[]; turnos: { nombre: string; hora: string }[]; inactivos: number; nombreSedeElegida: string | null
}

const Acciones = ({ pending, texto, onCancel }: { pending: boolean; texto: string; onCancel: () => void }) => (
  <div className="mt-2 flex justify-end gap-2"><button type="button" onClick={onCancel} className="btn">Cancelar</button><button disabled={pending} className="btn btn-primary">{pending && <Spinner />}{pending ? 'Guardando…' : texto}</button></div>
)
function useCerrarAlGuardar(state: { ok: boolean } | null, texto: string, onDone: () => void) {
  const toast = useToast()
  useEffect(() => { if (state?.ok) { toast({ texto }); onDone() } }, [state]) // eslint-disable-line react-hooks/exhaustive-deps
}

/** Cambios en vivo: otra persona asigna una mesa, marca "llegó", o la base cambia el plano → la pantalla se actualiza sola. */
function MesasEnVivo({ negocioId }: { negocioId: string }) {
  const router = useRouter()
  useEffect(() => {
    const sb = createBrowserClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!)
    let activo = true, timer: ReturnType<typeof setTimeout> | null = null; const canales: ReturnType<typeof sb.channel>[] = []
    const recargar = () => { if (timer) return; timer = setTimeout(() => { timer = null; if (activo) router.refresh() }, 500) }
    void (async () => {
      const { data } = await sb.auth.getSession(); if (!activo) return
      if (data.session) sb.realtime.setAuth(data.session.access_token)
      for (const tabla of ['mesas', 'reserva_mesas', 'reservas']) {
        const c = sb.channel(`mesas-${tabla}-${negocioId}`).on('postgres_changes', { event: '*', schema: 'public', table: tabla, filter: `negocio_id=eq.${negocioId}` }, recargar).subscribe()
        canales.push(c)
      }
    })()
    return () => { activo = false; if (timer) clearTimeout(timer); canales.forEach((c) => void sb.removeChannel(c)) }
  }, [negocioId, router])
  return null
}

// ---------------------------------------------------------------------------
// Plano (dibujo): sirve para el servicio y para el editor
// ---------------------------------------------------------------------------
interface PlanoProps {
  salon: Salon; mesas: Mesa[]; reservas: ReservaSalon[]; t: number; duracion: number; esHoy: boolean
  seleccionadas: string[]; resaltar?: Record<string, 'ok' | 'choque'>; editar: boolean
  onClick: (m: Mesa) => void; onMover?: (m: Mesa, x: number, y: number) => Promise<boolean>
}
function Plano({ salon, mesas, reservas, t, duracion, esHoy, seleccionadas, resaltar, editar, onClick, onMover }: PlanoProps) {
  const caja = useRef<HTMLDivElement>(null)
  const [arrastre, setArrastre] = useState<{ id: string; x: number; y: number; ox: number; oy: number; px: number; py: number; mueve: boolean } | null>(null)
  const celda = () => (caja.current ? caja.current.getBoundingClientRect().width / salon.ancho : 24)
  const posDe = (m: Mesa) => (arrastre?.id === m.id && arrastre.mueve ? { x: arrastre.x, y: arrastre.y } : { x: m.x, y: m.y })
  const choca = (m: Mesa, x: number, y: number) => x < 0 || y < 0 || x + m.w > salon.ancho || y + m.h > salon.alto || mesas.some((o) => o.id !== m.id && seSuperponen({ x, y, w: m.w, h: m.h }, o))

  const soltar = async () => {
    const a = arrastre; setArrastre(null)
    if (!a) return
    const m = mesas.find((x) => x.id === a.id)!
    if (!a.mueve) { onClick(m); return }
    if ((a.x !== m.x || a.y !== m.y) && !choca(m, a.x, a.y)) await onMover?.(m, a.x, a.y)
  }
  return (
    <div className="overflow-x-auto rounded-rs-lg border border-rs-border bg-rs-bg/60 p-3">
      <div ref={caja} className="relative select-none" style={{ aspectRatio: `${salon.ancho} / ${salon.alto}`, minWidth: salon.ancho * 26, containerType: 'inline-size',
        backgroundImage: 'linear-gradient(to right, rgba(122,144,80,.10) 1px, transparent 1px), linear-gradient(to bottom, rgba(122,144,80,.10) 1px, transparent 1px)', backgroundSize: `${100 / salon.ancho}% ${100 / salon.alto}%` }}
        onPointerMove={(e) => {
          if (!arrastre || !editar) return
          const c = celda(), dx = (e.clientX - arrastre.px) / c, dy = (e.clientY - arrastre.py) / c
          const m = mesas.find((x) => x.id === arrastre.id)!
          const x = Math.max(0, Math.min(salon.ancho - m.w, Math.round(arrastre.ox + dx))), y = Math.max(0, Math.min(salon.alto - m.h, Math.round(arrastre.oy + dy)))
          setArrastre({ ...arrastre, x, y, mueve: arrastre.mueve || Math.abs(dx) > 0.3 || Math.abs(dy) > 0.3 })
        }}
        onPointerUp={() => void soltar()} onPointerCancel={() => setArrastre(null)}>
        {mesas.map((m) => {
          const { x, y } = posDe(m)
          const sel = seleccionadas.includes(m.id)
          const enArrastre = arrastre?.id === m.id && arrastre.mueve
          const choque = enArrastre && choca(m, x, y)
          const base = { left: `${(x / salon.ancho) * 100}%`, top: `${(y / salon.alto) * 100}%`, width: `${(m.w / salon.ancho) * 100}%`, height: `${(m.h / salon.alto) * 100}%`, fontSize: `calc(100cqw / ${salon.ancho} * .55)` }
          if (m.tipo === 'deco') {
            return <button key={m.id} type="button" style={base} onPointerDown={(e) => { if (editar) { (e.currentTarget as HTMLElement).setPointerCapture?.(e.pointerId); setArrastre({ id: m.id, x: m.x, y: m.y, ox: m.x, oy: m.y, px: e.clientX, py: e.clientY, mueve: false }) } }} onClick={() => { if (!editar) return; onClick(m) }}
              className={'absolute grid place-items-center overflow-hidden rounded border border-dashed px-1 text-center font-semibold uppercase tracking-wide ' + (sel ? 'border-rs-lime bg-rs-lime/10 text-rs-lime' : 'border-rs-muted/50 bg-rs-raised/40 text-rs-muted') + (editar ? ' cursor-grab touch-none' : ' cursor-default')}>{m.numero}</button>
          }
          const { estado, reservas: rs } = estadoMesa(m, reservas, t, duracion, esHoy)
          const est = ESTADOS_MESA[estado]
          const r = rs[0]
          const resaltado = resaltar?.[m.id]
          return (
            <CajaMesa key={m.id} mesa={m} tema={salon} style={base} className={enArrastre ? 'z-10' : ''}><button type="button" aria-label={`Mesa ${m.numero}, ${rangoCapacidad(m)} personas, ${m.movil ? 'móvil, ' : 'fija, '}${est.label.toLowerCase()}`}
              onPointerDown={(e) => { if (editar) { (e.currentTarget as HTMLElement).setPointerCapture?.(e.pointerId); setArrastre({ id: m.id, x: m.x, y: m.y, ox: m.x, oy: m.y, px: e.clientX, py: e.clientY, mueve: false }) } }}
              onClick={() => { if (!editar) onClick(m) }}
              className={'absolute inset-0 flex flex-col items-center justify-center overflow-hidden border-2 leading-tight transition-colors ' + (m.forma === 'redonda' ? 'rounded-full ' : 'rounded-lg ') + (m.movil ? 'border-dashed ' : '') + (editar ? 'border-rs-control bg-rs-card text-rs-text cursor-grab touch-none ' : est.clases + ' ') +
                (sel ? 'ring-2 ring-rs-lime ring-offset-1 ring-offset-black ' : '') + (resaltado === 'choque' ? '!border-rs-danger ' : resaltado === 'ok' ? '!border-rs-lime ' : '') + (choque ? '!border-rs-danger !bg-rs-danger/30 ' : '') + (enArrastre ? 'opacity-90 ' : '')}>
              <Derecho rot={m.rotacion}><span className="font-bold">{m.numero}</span>
              <span className="opacity-70" style={{ fontSize: '.7em' }}><Users className="mr-0.5 inline" size={9} />{rangoCapacidad(m)}</span>
              {!editar && r && m.w >= 3 && <span className="max-w-full truncate px-1 opacity-90" style={{ fontSize: '.62em' }}>{(r.cliente_nombre ?? '').split(' ')[0]} {r.hora?.slice(0, 5)}</span>}
              {!editar && !r && estado === 'ocupada' && m.ocupada_pax && <span className="opacity-90" style={{ fontSize: '.62em' }}>{m.ocupada_pax} pers.</span>}</Derecho>
            </button></CajaMesa>
          )
        })}
        {mesas.length === 0 && <p className="absolute inset-0 grid place-items-center text-sm text-rs-muted">{editar ? 'Este salón está vacío: agregá mesas con los botones de arriba.' : 'Este salón todavía no tiene mesas.'}</p>}
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Pantalla
// ---------------------------------------------------------------------------
export default function SalonUI({ salones, mesas, reservas, duracion, fecha, hoy, modo, puedeEscribir, puedeEstructura, puedeAdministrar, negocioId, ahoraInicial, ubicaciones, turnos, inactivos, nombreSedeElegida }: Props) {
  const router = useRouter()
  const toast = useToast()
  const confirmar = useConfirm()
  const [pend, start] = useTransition()
  const esHoy = fecha === hoy
  const [salonId, setSalonId] = useState(salones[0]?.id ?? '')
  useEffect(() => { if (!salones.some((s) => s.id === salonId)) setSalonId(salones[0]?.id ?? '') }, [salones, salonId])
  // Al crear el primer salón la pantalla cambia de la invitación a la del plano y el diálogo se vuelve a montar: se cierra acá
  const cantAntes = useRef(salones.length)
  useEffect(() => { if (cantAntes.current === 0 && salones.length > 0) setDialogo((d) => (d === 'salon-nuevo' ? null : d)); cantAntes.current = salones.length }, [salones.length])
  const salon = salones.find((s) => s.id === salonId) ?? null
  const mesasSalon = useMemo(() => mesas.filter((m) => m.salon_id === salonId), [mesas, salonId])
  // La hora "ahora" arranca con la del servidor (así coincide con lo que se dibujó al cargar) y se actualiza cada minuto en el navegador.
  const [ahora, setAhora] = useState(ahoraInicial)
  const [usarAhora, setUsarAhora] = useState(esHoy)
  const [horaTxt, setHoraTxt] = useState('21:00')
  useEffect(() => { setUsarAhora(esHoy) }, [esHoy])
  useEffect(() => {
    const tick = () => { const d = new Date(new Date().toLocaleString('en-US', { timeZone: 'America/Argentina/Buenos_Aires' })); setAhora(d.getHours() * 60 + d.getMinutes()) }
    tick(); const i = setInterval(tick, 60000); return () => clearInterval(i)
  }, [])
  const t = usarAhora && esHoy ? ahora : aMinutos(horaTxt) ?? 21 * 60

  const [seleccion, setSeleccion] = useState<string | null>(null)
  const [asignando, setAsignando] = useState<{ reserva: ReservaSalon; ids: string[] } | null>(null)
  const [dialogo, setDialogo] = useState<null | 'salon' | 'salon-nuevo' | 'mesa' | 'deco' | 'varias' | 'duracion'>(null)
  const [paxLibre, setPaxLibre] = useState('')

  const mesaSel = mesas.find((m) => m.id === seleccion) ?? null
  const nombreMesa = useMemo(() => new Map(mesas.map((m) => [m.id, m.numero])), [mesas])
  const activas = reservas.filter((r) => ['nueva', 'confirmada', 'pendiente_pago', 'revisar_pago'].includes(r.estado))
  const sinMesa = activas.filter((r) => r.mesas.length === 0 && !r.liberada_en).length

  const ejecutar = (fn: () => Promise<{ ok: boolean; error?: string }>, okTexto?: string) => start(async () => { const r = await fn(); if (!r.ok) toast({ tipo: 'error', texto: r.error ?? 'Error' }); else if (okTexto) toast({ texto: okTexto }) })
  const ir = (cambios: Record<string, string>) => { const p = new URLSearchParams({ fecha, ...(modo === 'editar' ? { modo } : {}), ...cambios }); iniciarCarga(); router.push(`/mesas?${p.toString()}`) }

  // ---- asignación de mesas a una reserva
  const resaltar: Record<string, 'ok' | 'choque'> = {}
  if (asignando) for (const m of mesasSalon) if (m.tipo === 'mesa' && m.activa) resaltar[m.id] = conflictoCon(m.id, asignando.reserva, reservas, duracion) ? 'choque' : 'ok'
  const iniciarAsignacion = (r: ReservaSalon) => { setSeleccion(null); setAsignando({ reserva: r, ids: r.mesas }); const primera = mesas.find((m) => r.mesas.includes(m.id)); if (primera) setSalonId(primera.salon_id) }
  const sugerir = () => {
    if (!asignando) return
    const ids = sugerirMesas(asignando.reserva, mesas, reservas, duracion)
    if (!ids.length) { toast({ tipo: 'info', texto: 'No hay mesas libres que alcancen a esa hora. Podés elegir una a mano.' }); return }
    setAsignando({ ...asignando, ids }); const m = mesas.find((x) => x.id === ids[0]); if (m) setSalonId(m.salon_id)
  }
  const confirmarAsignacion = () => {
    if (!asignando) return
    const { reserva, ids } = asignando
    start(async () => {
      let r: ResultadoAsignacion = await asignarMesas(reserva.id, ids, false)
      if (!r.ok && r.error === 'mesa_ocupada') {
        const lista = (r.conflictos ?? []).map((c) => `Mesa ${c.mesa}: reserva #${c.reserva_numero} (${c.cliente ?? 'sin nombre'}) a las ${c.hora}`).join('\n')
        if (!(await confirmar({ titulo: 'Hay mesas ocupadas a esa hora', texto: lista + '\n\n¿Asignar igual?', confirmar: 'Asignar igual', peligro: true }))) return
        r = await asignarMesas(reserva.id, ids, true)
      }
      if (!r.ok) { toast({ tipo: 'error', texto: r.error === 'mesa_ocupada' ? 'Las mesas están ocupadas' : r.error ?? 'Error' }); return }
      toast({ texto: ids.length ? `Reserva #${reserva.numero}: mesa ${ids.map((i) => nombreMesa.get(i)).join(' + ')}` : `Reserva #${reserva.numero}: sin mesa` })
      if (r.capacidadInsuficiente) toast({ tipo: 'info', texto: `Ojo: las mesas elegidas suman ${r.capacidad} lugares y la reserva es de ${r.personas} personas.` })
      if (r.capacidadMinima) toast({ tipo: 'info', texto: `Ojo: la reserva es de ${r.personas} personas y las mesas elegidas piden como mínimo ${r.capacidadMin}.` })
      setAsignando(null)
    })
  }
  const clickMesa = (m: Mesa) => {
    if (asignando) {
      if (m.tipo !== 'mesa' || !m.activa) return
      const ids = asignando.ids.includes(m.id) ? asignando.ids.filter((i) => i !== m.id) : [...asignando.ids, m.id]
      if (!sePuedenJuntar(mesas.filter((x) => ids.includes(x.id)))) { toast({ tipo: 'info', texto: 'Las mesas fijas no se pueden juntar: solo se juntan las móviles (borde punteado).' }); return }
      setAsignando({ ...asignando, ids }); return
    }
    setSeleccion(m.id)
  }

  // ---- editor: mover y borrar
  const mover = async (m: Mesa, x: number, y: number) => { const r = await moverMesa(m.id, x, y); if (!r.ok) toast({ tipo: 'error', texto: r.error ?? 'No se pudo mover' }); return r.ok }
  const borrarMesa = async (m: Mesa) => { if (await confirmar({ titulo: `¿Borrar ${m.tipo === 'deco' ? 'el cartel' : 'la mesa'} “${m.numero}”?`, texto: m.tipo === 'mesa' ? 'Las reservas que la tenían asignada quedan sin mesa.' : undefined, confirmar: 'Borrar', peligro: true })) { setSeleccion(null); ejecutar(() => eliminarMesa(m.id), 'Eliminada') } }
  const borrarSalon = async () => { if (salon && (await confirmar({ titulo: `¿Borrar el salón “${salon.nombre}”?`, texto: 'Se borran también sus mesas y las asignaciones de reservas a esas mesas.', confirmar: 'Borrar salón', peligro: true }))) ejecutar(() => eliminarSalon(salon.id), 'Salón eliminado') }

  const fechaTexto = new Date(fecha + 'T12:00:00').toLocaleDateString('es-AR', { weekday: 'long', day: 'numeric', month: 'long' })
  const dia = (d: number) => new Date(new Date(fecha + 'T12:00:00Z').getTime() + d * 86400000).toISOString().slice(0, 10)

  if (salones.length === 0) {
    return (
      <div className="card p-8 text-center">
        <div className="mx-auto mb-3 grid h-14 w-14 place-items-center rounded-full bg-rs-raised text-rs-lime"><Armchair size={26} /></div>
        {inactivos > 0 ? (
          <>
            <p className="font-semibold">Los planos están desactivados</p>
            <p className="mx-auto mt-1 max-w-md text-sm text-rs-muted">Tenés {inactivos} plano{inactivos === 1 ? '' : 's'} guardado{inactivos === 1 ? '' : 's'} con sus mesas, pero ninguno está activo: no se usan para asignar mesas ni en el sitio de reservas. Activalos desde “Editar plano”.</p>
            {puedeEstructura && <a href={`/mesas?fecha=${fecha}&modo=editar`} className="btn btn-primary mt-4"><Pencil size={14} />Editar plano</a>}
          </>
        ) : (
          <>
            <p className="font-semibold">Todavía no armaste el plano del salón</p>
            <p className="mx-auto mt-1 max-w-md text-sm text-rs-muted">Creá tu primer salón (por ejemplo “Salón”, “Patio” o “Terraza”), cargá las mesas con su capacidad y acomodalas como están en el local.</p>
            {puedeEstructura && <button type="button" onClick={() => setDialogo('salon-nuevo')} className="btn btn-primary mt-4"><Plus size={14} />Crear el primer salón</button>}
          </>
        )}
        {dialogo === 'salon-nuevo' && <Modal titulo="Nuevo salón" onClose={() => setDialogo(null)}><FormSalon ubicaciones={ubicaciones} onDone={() => setDialogo(null)} /></Modal>}
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <MesasEnVivo negocioId={negocioId} />
      {/* barra de control */}
      <div className="card flex flex-wrap items-center gap-2 p-3">
        {modo === 'servicio' ? (
          <>
            <div className="flex items-center gap-1">
              <button type="button" onClick={() => ir({ fecha: dia(-1) })} aria-label="Día anterior" className="btn btn-sm w-8 px-0"><ChevronLeft size={14} /></button>
              <FechaInput value={fecha} onChange={(iso) => iso && ir({ fecha: iso })} className="w-36" />
              <button type="button" onClick={() => ir({ fecha: dia(1) })} aria-label="Día siguiente" className="btn btn-sm w-8 px-0"><ChevronRight size={14} /></button>
              {!esHoy && <button type="button" onClick={() => ir({ fecha: hoy })} className="btn btn-sm">Hoy</button>}
            </div>
            <div className="flex items-center gap-1">
              <Clock size={14} className="text-rs-muted" />
              {esHoy && <button type="button" onClick={() => setUsarAhora(true)} className={'btn btn-sm ' + (usarAhora ? 'btn-primary' : '')}>Ahora</button>}
              <input type="time" value={usarAhora && esHoy ? deMinutos(t) : horaTxt} onChange={(e) => { setHoraTxt(e.target.value); setUsarAhora(false) }} aria-label="Hora a mostrar" className="input h-8 w-28" />
              {turnos.map((t) => [t.hora, t.nombre]).map(([h, l]) => <button key={h} type="button" onClick={() => { setHoraTxt(h); setUsarAhora(false) }} className={'btn btn-sm ' + (!usarAhora && horaTxt === h ? 'btn-primary' : '')}>{l}</button>)}
            </div>
            <span className="ml-auto text-xs capitalize text-rs-muted">{fechaTexto}{sinMesa > 0 && <span className="ml-2 font-semibold normal-case text-rs-warn">· {sinMesa} reserva{sinMesa === 1 ? '' : 's'} sin mesa</span>}</span>
          </>
        ) : (
          <>
            <span className="text-sm font-semibold">Editando el plano</span>
            <span className="text-xs text-rs-muted">Arrastrá las mesas para acomodarlas; tocá una para cambiar su número, capacidad o forma.</span>
          </>
        )}
        <div className="flex w-full flex-wrap items-center gap-2 border-t border-rs-border/60 pt-2">
          {salones.length > 1 || modo === 'editar' ? (
            <div className="flex flex-wrap gap-1.5">{salones.map((s) => <button key={s.id} type="button" onClick={() => { setSalonId(s.id); setSeleccion(null) }} className={'btn btn-sm ' + (s.id === salonId ? 'btn-primary' : '') + (s.activo ? '' : ' opacity-60')}>{s.nombre}{!s.activo && <span className="ml-1 text-[10px] font-normal uppercase">inactivo</span>}</button>)}</div>
          ) : <span className="text-sm font-semibold">{salon?.nombre}</span>}
          <span className="ml-auto flex flex-wrap items-center gap-1.5">
            {modo === 'servicio' ? (
              <>
                {puedeEstructura && <a href={`/mesas?fecha=${fecha}&modo=editar`} className="btn btn-sm"><Pencil size={13} />Editar plano</a>}
                <a href="/qr-mesas" target="_blank" rel="noopener noreferrer" className="btn btn-sm" title="Códigos QR para pedir desde cada mesa"><QrCode size={13} />QR de mesas</a>
              </>
            ) : (
              <>
                <button type="button" onClick={() => setDialogo('mesa')} className="btn btn-sm btn-primary"><Plus size={13} />Mesa</button>
                <button type="button" onClick={() => setDialogo('varias')} className="btn btn-sm"><Copy size={13} />Varias mesas</button>
                <button type="button" onClick={() => setDialogo('deco')} className="btn btn-sm">Cartel</button>
                <button type="button" onClick={() => setDialogo('salon-nuevo')} className="btn btn-sm"><Plus size={13} />Salón</button>
                <button type="button" onClick={() => setDialogo('salon')} className="btn btn-sm"><Pencil size={13} />Salón</button>
                <button type="button" onClick={() => setDialogo('duracion')} className="btn btn-sm" title="Cuánto suele ocupar una mesa cada reserva"><Clock size={13} />{duracion} min</button>
                <a href={`/mesas?fecha=${fecha}`} className="btn btn-sm btn-primary"><Check size={13} />Listo</a>
              </>
            )}
          </span>
        </div>
      </div>

      {asignando && (
        <div role="status" className="flex flex-wrap items-center gap-2 rounded-md border border-rs-lime/40 bg-rs-lime/10 px-3 py-2 text-sm">
          <span>Asignando mesa a la reserva <b>#{(asignando.reserva.numero_sede ?? asignando.reserva.numero)}</b> · {asignando.reserva.cliente_nombre ?? 'Sin nombre'} · {asignando.reserva.cantidad_personas ?? '?'} pers. · {asignando.reserva.hora?.slice(0, 5) ?? 'a coordinar'}.</span>
          <span className="text-rs-muted">Tocá las mesas (podés elegir varias para juntarlas): <b className="text-rs-text">{asignando.ids.length ? asignando.ids.map((i) => nombreMesa.get(i)).join(' + ') : 'ninguna'}</b>{asignando.ids.length ? ` · ${mesas.filter((m) => asignando.ids.includes(m.id)).reduce((s, m) => s + (m.capacidad ?? 0), 0)} lugares` : ''}</span>
          <span className="ml-auto flex gap-1.5">
            <button type="button" onClick={sugerir} className="btn btn-sm"><Sparkles size={13} />Sugerir</button>
            <button type="button" disabled={pend} onClick={confirmarAsignacion} className="btn btn-sm btn-primary">{pend ? <Spinner /> : <Check size={13} />}{asignando.ids.length ? 'Asignar' : 'Dejar sin mesa'}</button>
            <button type="button" onClick={() => setAsignando(null)} className="btn btn-sm">Cancelar</button>
          </span>
        </div>
      )}

      <div className="grid gap-4 lg:grid-cols-[1fr_340px]">
        <div className="min-w-0 space-y-3">
          {salon && <Plano salon={salon} mesas={mesasSalon} reservas={reservas} t={t} duracion={duracion} esHoy={esHoy} seleccionadas={asignando ? asignando.ids : seleccion ? [seleccion] : []} resaltar={resaltar} editar={modo === 'editar'}
            onClick={(m) => (modo === 'editar' ? setSeleccion(m.id) : clickMesa(m))} onMover={mover} />}
          {modo === 'servicio' && <div className="flex flex-wrap items-center gap-3 text-xs text-rs-muted">{(['libre', 'reservada', 'llego', 'ocupada', 'inactiva'] as const).map((e) => <span key={e} className="inline-flex items-center gap-1.5"><span className={'h-2.5 w-2.5 rounded-full ' + ESTADOS_MESA[e].punto} />{ESTADOS_MESA[e].label}</span>)}{!esHoy && <span>· “Llegó” y “Ocupada” solo se ven el día de hoy</span>}</div>}
        </div>

        <aside className="space-y-3">
          {modo === 'editar' ? (
            mesaSel ? <PanelEdicion key={mesaSel.id + mesaSel.x + mesaSel.y + mesaSel.w + mesaSel.h + ':' + mesaSel.rotacion} mesa={mesaSel} onBorrar={() => void borrarMesa(mesaSel)} onCerrar={() => setSeleccion(null)} />
              : <div className="card p-4 text-sm text-rs-muted"><p className="font-semibold text-rs-text">{salon?.nombre} · {mesasSalon.filter((m) => m.tipo === 'mesa').length} mesas · {mesasSalon.filter((m) => m.tipo === 'mesa').reduce((s, m) => s + (m.capacidad ?? 0), 0)} lugares</p><p className="mt-2">Tocá una mesa para editarla o arrastrala para moverla. No se pueden superponer ni salir del plano.</p>
                {salon && <div className={'mt-3 rounded-md border px-3 py-2 ' + (salon.activo ? 'border-rs-border/60' : 'border-rs-warn/40 bg-rs-warn/10')}><p className="text-xs">{salon.activo ? <>Este plano está <b className="text-rs-lime">activo</b>: se usa para asignar mesas y en el sitio de reservas.</> : <>Este plano está <b className="text-rs-warn">inactivo</b>: queda guardado con sus mesas pero no se usa en ningún lado.</>}</p>
                  <button type="button" disabled={pend} onClick={() => ejecutar(() => alternarSalon(salon.id, !salon.activo), salon.activo ? 'Plano desactivado' : 'Plano activado')} className="btn btn-sm mt-2">{salon.activo ? 'Desactivar este plano' : 'Activar este plano'}</button></div>}
                {puedeAdministrar && <button type="button" onClick={() => void borrarSalon()} className="btn btn-sm btn-danger mt-3"><Trash2 size={13} />Borrar este salón</button>}</div>
          ) : (
            <>
              {mesaSel && !asignando && <PanelMesa mesa={mesaSel} reservas={reservas} t={t} duracion={duracion} esHoy={esHoy} puedeEscribir={puedeEscribir} pend={pend} paxLibre={paxLibre} setPaxLibre={setPaxLibre} nombreMesa={nombreMesa}
                onServicio={(id, paso) => ejecutar(() => marcarServicio(id, paso))} onOcupar={() => ejecutar(() => ocuparMesa(mesaSel.id, Number(paxLibre) || null), `Mesa ${mesaSel.numero} ocupada`)} onLiberar={() => ejecutar(() => liberarMesa(mesaSel.id), `Mesa ${mesaSel.numero} liberada`)}
                onAsignar={iniciarAsignacion} onCerrar={() => setSeleccion(null)} />}
              <ListaReservas reservas={reservas} nombreMesa={nombreMesa} esHoy={esHoy} puedeEscribir={puedeEscribir} pend={pend} asignandoId={asignando?.reserva.id}
                onAsignar={iniciarAsignacion} onServicio={(id, paso) => ejecutar(() => marcarServicio(id, paso))} />
            </>
          )}
        </aside>
      </div>

      {dialogo === 'salon-nuevo' && <Modal titulo="Nuevo salón" onClose={() => setDialogo(null)}><FormSalon ubicaciones={ubicaciones} onDone={() => setDialogo(null)} /></Modal>}
      {dialogo === 'salon' && salon && <Modal titulo="Editar salón" onClose={() => setDialogo(null)}><FormSalon salon={salon} ubicaciones={ubicaciones} onDone={() => setDialogo(null)} /></Modal>}
      {(dialogo === 'mesa' || dialogo === 'deco') && salon && <Modal titulo={dialogo === 'mesa' ? 'Nueva mesa' : 'Nuevo cartel'} onClose={() => setDialogo(null)}><FormNuevaMesa salonId={salon.id} deco={dialogo === 'deco'} sugerido={String(Math.max(0, ...mesasSalon.filter((m) => m.tipo === 'mesa').map((m) => Number(m.numero) || 0)) + 1)} onDone={() => setDialogo(null)} /></Modal>}
      {dialogo === 'varias' && salon && <Modal titulo="Agregar varias mesas" onClose={() => setDialogo(null)}><FormVarias salonId={salon.id} onDone={() => setDialogo(null)} /></Modal>}
      {dialogo === 'duracion' && <Modal titulo="Duración de una mesa" onClose={() => setDialogo(null)}><FormDuracion actual={duracion} sedeNombre={nombreSedeElegida} onDone={() => setDialogo(null)} /></Modal>}
    </div>
  )
}

// ---------------------------------------------------------------------------
// Paneles laterales
// ---------------------------------------------------------------------------
function etiquetaEstado(r: ReservaSalon, esHoy: boolean) {
  if (r.liberada_en) return { t: 'Se fue', c: 'bg-rs-raised text-rs-muted' }
  if (esHoy && r.sentada_en) return { t: 'Sentada', c: 'bg-rs-danger/15 text-rs-danger' }
  if (esHoy && r.asistio_en) return { t: 'Llegó', c: 'bg-rs-warn/15 text-rs-warn' }
  return null
}

function BotonesServicio({ r, esHoy, puedeEscribir, pend, onServicio }: { r: ReservaSalon; esHoy: boolean; puedeEscribir: boolean; pend: boolean; onServicio: (id: string, paso: 'llego' | 'sentada' | 'liberada' | 'reabrir') => void }) {
  if (!puedeEscribir || !esHoy) return null
  return (
    <span className="flex flex-wrap gap-1">
      {!r.asistio_en && !r.liberada_en && <button disabled={pend} onClick={() => onServicio(r.id, 'llego')} className="btn btn-sm">Llegó</button>}
      {!r.sentada_en && !r.liberada_en && <button disabled={pend} onClick={() => onServicio(r.id, 'sentada')} className="btn btn-sm btn-primary">Sentar</button>}
      {r.sentada_en && !r.liberada_en && <button disabled={pend} onClick={() => onServicio(r.id, 'liberada')} className="btn btn-sm">Liberar</button>}
      {(r.liberada_en || r.sentada_en) && <button disabled={pend} onClick={() => onServicio(r.id, 'reabrir')} className="btn btn-sm" title="Volver a dejarla sin sentar">Deshacer</button>}
    </span>
  )
}

function PanelMesa({ mesa, reservas, t, duracion, esHoy, puedeEscribir, pend, paxLibre, setPaxLibre, nombreMesa, onServicio, onOcupar, onLiberar, onAsignar, onCerrar }: {
  mesa: Mesa; reservas: ReservaSalon[]; t: number; duracion: number; esHoy: boolean; puedeEscribir: boolean; pend: boolean; paxLibre: string; setPaxLibre: (v: string) => void; nombreMesa: Map<string, string>
  onServicio: (id: string, paso: 'llego' | 'sentada' | 'liberada' | 'reabrir') => void; onOcupar: () => void; onLiberar: () => void; onAsignar: (r: ReservaSalon) => void; onCerrar: () => void
}) {
  const { estado, reservas: rs } = estadoMesa(mesa, reservas, t, duracion, esHoy)
  const est = ESTADOS_MESA[estado]
  return (
    <section className="card space-y-3 p-4">
      <div className="flex items-start justify-between gap-2">
        <div><h2 className="text-lg font-bold">Mesa {mesa.numero}</h2><p className="text-sm text-rs-muted"><Users size={12} className="mr-1 inline" />{rangoCapacidad(mesa)} personas · {mesa.movil ? 'móvil (se puede juntar)' : 'fija'}</p></div>
        <span className="flex items-center gap-2"><span className={'badge ' + est.clases}>{est.label}</span><button type="button" onClick={onCerrar} aria-label="Cerrar" className="rounded p-1 text-rs-muted hover:bg-rs-raised"><X size={15} /></button></span>
      </div>
      {rs.map((r) => (
        <div key={r.id} className="space-y-2 rounded-md bg-rs-raised/50 p-3 text-sm">
          <p className="font-semibold">#{(r.numero_sede ?? r.numero)} · {r.cliente_nombre ?? 'Sin nombre'}</p>
          <p className="text-rs-muted">{r.hora?.slice(0, 5) ?? 'A coordinar'} · {r.cantidad_personas ?? '?'} personas{r.mesas.length > 1 ? ` · mesas ${r.mesas.map((i) => nombreMesa.get(i)).join(' + ')}` : ''}</p>
          {r.observaciones && <p className="text-xs text-rs-warn">📝 {r.observaciones}</p>}
          <BotonesServicio r={r} esHoy={esHoy} puedeEscribir={puedeEscribir} pend={pend} onServicio={onServicio} />
          {puedeEscribir && <button type="button" onClick={() => onAsignar(r)} className="btn btn-sm">Cambiar mesa</button>}
        </div>
      ))}
      {estado === 'libre' && puedeEscribir && esHoy && (
        <div className="flex items-end gap-2"><div className="flex-1"><label className="label" htmlFor="pax_libre">Llegó gente sin reserva</label><input id="pax_libre" type="number" min={1} max={99} value={paxLibre} onChange={(e) => setPaxLibre(e.target.value)} placeholder="Personas (opcional)" className="input w-full" /></div><button type="button" disabled={pend} onClick={onOcupar} className="btn btn-primary">Ocupar</button></div>
      )}
      {mesa.ocupada_desde && puedeEscribir && <div className="flex items-center justify-between gap-2 text-sm"><span className="text-rs-muted">Ocupada sin reserva{mesa.ocupada_pax ? ` (${mesa.ocupada_pax} pers.)` : ''} desde las {new Date(mesa.ocupada_desde).toLocaleTimeString('es-AR', { timeZone: 'America/Argentina/Buenos_Aires', hour: '2-digit', minute: '2-digit' })}</span><button type="button" disabled={pend} onClick={onLiberar} className="btn btn-sm">Liberar</button></div>}
      {estado === 'libre' && !esHoy && <p className="text-xs text-rs-muted">Libre a esa hora. Para asignarla elegí una reserva de la lista.</p>}
    </section>
  )
}

function ListaReservas({ reservas, nombreMesa, esHoy, puedeEscribir, pend, asignandoId, onAsignar, onServicio }: {
  reservas: ReservaSalon[]; nombreMesa: Map<string, string>; esHoy: boolean; puedeEscribir: boolean; pend: boolean; asignandoId?: string
  onAsignar: (r: ReservaSalon) => void; onServicio: (id: string, paso: 'llego' | 'sentada' | 'liberada' | 'reabrir') => void
}) {
  const lista = reservas.filter((r) => ['nueva', 'confirmada', 'pendiente_pago', 'revisar_pago'].includes(r.estado)).sort((a, b) => (aMinutos(a.hora) ?? 9999) - (aMinutos(b.hora) ?? 9999) || a.numero - b.numero)
  return (
    <section className="card p-4">
      <h2 className="card-title mb-2">Reservas del día · {lista.length}</h2>
      {lista.length === 0 ? <p className="text-sm text-rs-muted">No hay reservas para este día.</p> : (
        <ul className="max-h-[560px] divide-y divide-rs-border/60 overflow-y-auto">
          {lista.map((r) => {
            const e = etiquetaEstado(r, esHoy)
            return (
              <li key={r.id} className={'space-y-1.5 py-2.5 text-sm ' + (asignandoId === r.id ? 'rounded-md bg-rs-lime/10 px-2' : '')}>
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className="font-semibold tabular-nums">{r.hora?.slice(0, 5) ?? '—'} <span className="font-normal text-rs-muted">#{(r.numero_sede ?? r.numero)}</span></span>
                  <span className="flex items-center gap-1.5">{e && <span className={'badge ' + e.c}>{e.t}</span>}<span className="text-xs text-rs-muted"><Users size={11} className="mr-0.5 inline" />{r.cantidad_personas ?? '?'}</span></span>
                </div>
                <p className="truncate">{r.cliente_nombre ?? 'Sin nombre'}{r.ubicacion ? <span className="text-xs text-rs-muted"> · {r.ubicacion}</span> : null}</p>
                <div className="flex flex-wrap items-center gap-1.5">
                  {r.mesas.length ? <span className="badge bg-rs-lav/15 text-rs-lav">Mesa {r.mesas.map((i) => nombreMesa.get(i)).join(' + ')}</span> : <span className="badge bg-rs-warn/15 text-rs-warn">Sin mesa</span>}
                  {puedeEscribir && !r.liberada_en && <button type="button" disabled={pend} onClick={() => onAsignar(r)} className="btn btn-sm">{r.mesas.length ? 'Cambiar' : 'Asignar mesa'}</button>}
                  <BotonesServicio r={r} esHoy={esHoy} puedeEscribir={puedeEscribir} pend={pend} onServicio={onServicio} />
                </div>
              </li>
            )
          })}
        </ul>
      )}
    </section>
  )
}

function PanelEdicion({ mesa, onBorrar, onCerrar }: { mesa: Mesa; onBorrar: () => void; onCerrar: () => void }) {
  const { state, pending, formProps } = useAccionFormulario(guardarMesa)
  const toast = useToast()
  useEffect(() => { if (state?.ok) toast({ texto: 'Guardado' }) }, [state]) // eslint-disable-line react-hooks/exhaustive-deps
  const deco = mesa.tipo === 'deco'
  const [girando, empezarGiro] = useTransition()
  const girar = (g: number) => empezarGiro(async () => { const r = await rotarMesa(mesa.id, g); if (!r.ok) toast({ tipo: 'error', texto: r.error ?? 'No se pudo girar' }) })
  return (
    <form {...formProps} className="card space-y-3 p-4">
      <input type="hidden" name="id" value={mesa.id} /><input type="hidden" name="salon_id" value={mesa.salon_id} /><input type="hidden" name="tipo" value={mesa.tipo} /><input type="hidden" name="x" value={mesa.x} /><input type="hidden" name="y" value={mesa.y} />
      <div className="flex items-center justify-between"><h2 className="font-bold">{deco ? 'Cartel' : `Mesa ${mesa.numero}`}</h2><button type="button" onClick={onCerrar} aria-label="Cerrar" className="rounded p-1 text-rs-muted hover:bg-rs-raised"><X size={15} /></button></div>
      <div><label className="label" htmlFor="e_num">{deco ? 'Texto del cartel' : 'Número o nombre'}</label><input id="e_num" name="numero" defaultValue={mesa.numero} maxLength={24} className="input w-full" required /></div>
      {!deco && <div className="grid grid-cols-2 gap-3"><div><label className="label" htmlFor="e_capmin">Capacidad mínima</label><input id="e_capmin" name="capacidad_min" type="number" min={1} max={40} defaultValue={mesa.capacidad_min} className="input w-full" required /></div><div><label className="label" htmlFor="e_cap">Capacidad máxima</label><input id="e_cap" name="capacidad" type="number" min={1} max={40} defaultValue={mesa.capacidad ?? 2} className="input w-full" required /></div></div>}
      {!deco && <div className="grid grid-cols-2 gap-3"><label className="col-span-2 flex items-start gap-2 text-sm"><input type="checkbox" name="movil" defaultChecked={mesa.movil} className="mt-0.5 h-4 w-4 accent-[#c8e62b]" /><span><span className="font-medium">Móvil (se puede juntar)</span><span className="block text-xs text-rs-muted">Las mesas móviles se pueden juntar con otras móviles para grupos grandes. Las fijas siempre van solas.</span></span></label>
        <div><label className="label" htmlFor="e_forma">Forma</label><select id="e_forma" name="forma" defaultValue={mesa.forma} className="input w-full"><option value="cuadrada">Cuadrada</option><option value="redonda">Redonda</option></select></div></div>}
      <div className="grid grid-cols-2 gap-3"><div><label className="label" htmlFor="e_w">Ancho</label><input id="e_w" name="w" type="number" min={1} max={40} defaultValue={mesa.w} className="input w-full" /></div><div><label className="label" htmlFor="e_h">Alto</label><input id="e_h" name="h" type="number" min={1} max={40} defaultValue={mesa.h} className="input w-full" /></div></div>
      {!deco && <label className="flex items-center gap-2 text-sm"><input type="hidden" name="__activa_form" value="1" /><input type="checkbox" name="activa" defaultChecked={mesa.activa} className="h-4 w-4 accent-[#c8e62b]" />En servicio</label>}
      {!deco && (
        <fieldset className="space-y-2 rounded-md border border-rs-border/60 p-3">
          <legend className="label px-1">Sillas y giro</legend>
          <input type="hidden" name="__sillas_form" value="1" />
          <label className="flex items-start gap-2 text-sm"><input type="checkbox" name="sillas" defaultChecked={mesa.sillas} className="mt-0.5 h-4 w-4 accent-[#c8e62b]" /><span><span className="font-medium">Dibujar las sillas</span><span className="block text-xs text-rs-muted">Una por lugar (capacidad máxima: {mesa.capacidad ?? 0}).</span></span></label>
          <div>
            <span className="label">Sillas en estos lados</span>
            <div className="flex flex-wrap gap-1.5">{LADOS_SILLAS.map((l) => <label key={l.v} className="flex cursor-pointer items-center gap-1 rounded-full border border-rs-control px-2.5 py-1 text-xs has-[:checked]:border-rs-lime/60 has-[:checked]:bg-rs-lime/10"><input type="checkbox" name="sillas_lado" value={l.v} defaultChecked={!mesa.sillas_lados || mesa.sillas_lados.includes(l.v)} className="h-3 w-3 accent-[#c8e62b]" />{l.l}</label>)}</div>
            <p className="mt-1 text-xs text-rs-muted">Por ejemplo, sin “Izquierda” si la mesa está contra la pared. En las redondas las sillas van alrededor.</p>
          </div>
          <div>
            <label className="label" htmlFor="e_rot">Girar la mesa (grados)</label>
            <div className="flex flex-wrap items-center gap-1.5">
              <input id="e_rot" name="rotacion" type="number" min={0} max={359} step={5} defaultValue={mesa.rotacion} className="input w-24" />
              {[-15, 15, 90].map((g) => <button key={g} type="button" disabled={girando} onClick={() => girar((mesa.rotacion + g + 360) % 360)} className="btn btn-sm" title={`Girar ${g > 0 ? '+' : ''}${g}°`}>{g > 0 ? '+' : '−'}{Math.abs(g)}°</button>)}
              {mesa.rotacion !== 0 && <button type="button" disabled={girando} onClick={() => girar(0)} className="btn btn-sm">Enderezar</button>}
            </div>
            <p className="mt-1 text-xs text-rs-muted">Es solo el dibujo: el lugar que ocupa en el plano no cambia (para dejarla vertical también podés intercambiar ancho y alto).</p>
          </div>
        </fieldset>
      )}
      {state && !state.ok && <p role="alert" className="text-sm text-rs-danger">{state.error}</p>}
      <div className="flex justify-between gap-2"><button type="button" onClick={onBorrar} className="btn btn-sm btn-danger"><Trash2 size={13} />Borrar</button><button disabled={pending} className="btn btn-sm btn-primary">{pending && <Spinner />}Guardar</button></div>
    </form>
  )
}

// ---------------------------------------------------------------------------
// Formularios
// ---------------------------------------------------------------------------
function FormSalon({ salon, ubicaciones, onDone }: { salon?: Salon; ubicaciones: string[]; onDone: () => void }) {
  const { state, pending, formProps } = useAccionFormulario(guardarSalon)
  useCerrarAlGuardar(state, salon ? 'Salón guardado' : 'Salón creado', onDone)
  const [tema, setTema] = useState(salon?.tema_sillas ?? 'redondas')
  const [color, setColor] = useState(salon?.color_sillas ?? COLOR_SILLAS_DEFECTO)
  const [colorDefecto, setColorDefecto] = useState(!salon?.color_sillas)
  return (
    <form {...formProps} className="space-y-3">
      {salon && <input type="hidden" name="id" value={salon.id} />}
      <div><label className="label" htmlFor="s_nombre">Nombre *</label><input id="s_nombre" name="nombre" defaultValue={salon?.nombre ?? ''} maxLength={40} placeholder="Ej. Salón, Patio, Terraza" className="input w-full" required /></div>
      {ubicaciones.length > 0 && <div><label className="label" htmlFor="s_ubic">Ubicación del CRM</label><select id="s_ubic" name="ubicacion" defaultValue={salon?.ubicacion ?? ''} className="input w-full"><option value="">Todas</option>{ubicaciones.map((u) => <option key={u} value={u}>{u}</option>)}</select><p className="mt-1 text-xs text-rs-muted">Si este plano es de una ubicación (por ejemplo SALÓN o PLANTA ALTA), el sitio de reservas lo muestra solo a quien elige esa ubicación.</p></div>}
      <div className="grid grid-cols-2 gap-3"><div><label className="label" htmlFor="s_ancho">Ancho del plano</label><input id="s_ancho" name="ancho" type="number" min={8} max={80} defaultValue={salon?.ancho ?? 24} className="input w-full" /></div><div><label className="label" htmlFor="s_alto">Alto del plano</label><input id="s_alto" name="alto" type="number" min={6} max={60} defaultValue={salon?.alto ?? 16} className="input w-full" /></div></div>
      <p className="text-xs text-rs-muted">El plano es una grilla de casilleros: una mesa chica ocupa 2×2. Un plano de 24×16 alcanza para un salón mediano; podés agrandarlo después.</p>
      <label className="flex items-start gap-2 text-sm"><input type="hidden" name="__activo_form" value="1" /><input type="checkbox" name="activo" defaultChecked={salon?.activo ?? true} className="mt-0.5 h-4 w-4 accent-[#c8e62b]" /><span><span className="font-medium">Plano activo</span><span className="block text-xs text-rs-muted">Desmarcalo para dejarlo guardado sin usarlo: no se ofrece para asignar mesas ni en el sitio de reservas. Podés volver a activarlo cuando quieras.</span></span></label>
      <fieldset className="space-y-2 rounded-md border border-rs-border/60 p-3">
        <legend className="label px-1">Sillas de las mesas</legend>
        <div className="grid grid-cols-2 gap-3">
          <div><label className="label" htmlFor="s_tema">Estilo</label><select id="s_tema" name="tema_sillas" value={tema} onChange={(e) => setTema(e.target.value)} className="input w-full">{TEMAS_SILLAS.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}</select></div>
          <div><label className="label" htmlFor="s_color">Color</label><div className="flex items-center gap-2"><input id="s_color" name="color_sillas" type="color" value={color} onChange={(e) => { setColor(e.target.value); setColorDefecto(false) }} className="h-9 w-12 cursor-pointer rounded border border-rs-control bg-transparent" /><label className="flex items-center gap-1 text-xs"><input type="checkbox" name="color_defecto" checked={colorDefecto} onChange={(e) => setColorDefecto(e.target.checked)} className="h-3.5 w-3.5 accent-[#c8e62b]" />Predeterminado</label></div></div>
        </div>
        <div className="relative mx-auto h-24 w-full max-w-xs overflow-visible rounded bg-rs-bg/60" style={{ fontSize: 14 }} aria-label="Vista previa de las sillas">
          <CajaMesa mesa={{ capacidad: 4, forma: 'redonda', w: 3, h: 3 }} tema={{ tema_sillas: tema, color_sillas: colorDefecto ? null : color }} style={{ left: '12%', top: '22%', width: '17%', height: '56%' }}><div className="absolute inset-0 rounded-full border-2 border-rs-control bg-rs-card" /></CajaMesa>
          <CajaMesa mesa={{ capacidad: 6, forma: 'cuadrada', w: 4, h: 2 }} tema={{ tema_sillas: tema, color_sillas: colorDefecto ? null : color }} style={{ left: '50%', top: '30%', width: '34%', height: '40%' }}><div className="absolute inset-0 rounded-lg border-2 border-rs-control bg-rs-card" /></CajaMesa>
        </div>
        <p className="text-xs text-rs-muted">Cada mesa dibuja una silla por lugar (su capacidad máxima). Después podés girar cada mesa o sacarle las sillas de algún lado desde su ficha.</p>
      </fieldset>
      {state && !state.ok && <p role="alert" className="text-sm text-rs-danger">{state.error}</p>}
      <Acciones pending={pending} texto={salon ? 'Guardar' : 'Crear salón'} onCancel={onDone} />
    </form>
  )
}
function FormNuevaMesa({ salonId, deco, sugerido, onDone }: { salonId: string; deco: boolean; sugerido: string; onDone: () => void }) {
  const { state, pending, formProps } = useAccionFormulario(guardarMesa)
  useCerrarAlGuardar(state, deco ? 'Cartel agregado' : 'Mesa agregada', onDone)
  return (
    <form {...formProps} className="space-y-3">
      <input type="hidden" name="salon_id" value={salonId} /><input type="hidden" name="tipo" value={deco ? 'deco' : 'mesa'} />
      <div><label className="label" htmlFor="n_num">{deco ? 'Texto del cartel *' : 'Número o nombre *'}</label><input id="n_num" name="numero" defaultValue={deco ? '' : sugerido} maxLength={24} placeholder={deco ? 'Ej. Barra, Entrada, Baños' : ''} className="input w-full" required autoFocus /></div>
      {!deco && <div className="grid grid-cols-2 gap-3"><div><label className="label" htmlFor="n_capmin">Capacidad mínima</label><input id="n_capmin" name="capacidad_min" type="number" min={1} max={40} defaultValue={1} className="input w-full" /></div><div><label className="label" htmlFor="n_cap">Capacidad máxima *</label><input id="n_cap" name="capacidad" type="number" min={1} max={40} defaultValue={4} className="input w-full" required /></div></div>}
      {!deco && <label className="flex items-start gap-2 text-sm"><input type="checkbox" name="movil" className="mt-0.5 h-4 w-4 accent-[#c8e62b]" /><span><span className="font-medium">Móvil (se puede juntar)</span><span className="block text-xs text-rs-muted">Si no la marcás, la mesa es fija y siempre va sola.</span></span></label>}
      {!deco && <div className="grid grid-cols-2 gap-3"><div><label className="label" htmlFor="n_forma">Forma</label><select id="n_forma" name="forma" className="input w-full"><option value="cuadrada">Cuadrada</option><option value="redonda">Redonda</option></select></div></div>}
      <div className="grid grid-cols-2 gap-3"><div><label className="label" htmlFor="n_w">Ancho</label><input id="n_w" name="w" type="number" min={1} max={40} defaultValue={deco ? 4 : 2} className="input w-full" /></div><div><label className="label" htmlFor="n_h">Alto</label><input id="n_h" name="h" type="number" min={1} max={40} defaultValue={2} className="input w-full" /></div></div>
      <p className="text-xs text-rs-muted">Se coloca en el primer lugar libre del plano; después la arrastrás adonde va.</p>
      {state && !state.ok && <p role="alert" className="text-sm text-rs-danger">{state.error}</p>}
      <Acciones pending={pending} texto="Agregar" onCancel={onDone} />
    </form>
  )
}
function FormVarias({ salonId, onDone }: { salonId: string; onDone: () => void }) {
  const { state, pending, formProps } = useAccionFormulario(crearVariasMesas)
  useCerrarAlGuardar(state, 'Mesas creadas', onDone)
  return (
    <form {...formProps} className="space-y-3">
      <input type="hidden" name="salon_id" value={salonId} />
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4"><div><label className="label" htmlFor="v_cant">Cuántas *</label><input id="v_cant" name="cantidad" type="number" min={1} max={60} defaultValue={10} className="input w-full" required /></div><div><label className="label" htmlFor="v_capmin">Cap. mínima</label><input id="v_capmin" name="capacidad_min" type="number" min={1} max={40} defaultValue={1} className="input w-full" /></div><div><label className="label" htmlFor="v_cap">Cap. máxima *</label><input id="v_cap" name="capacidad" type="number" min={1} max={40} defaultValue={4} className="input w-full" required /></div><div><label className="label" htmlFor="v_desde">Desde el N.º</label><input id="v_desde" name="desde" type="number" min={0} defaultValue={1} className="input w-full" /></div></div>
      <label className="flex items-start gap-2 text-sm"><input type="checkbox" name="movil" className="mt-0.5 h-4 w-4 accent-[#c8e62b]" /><span><span className="font-medium">Móviles (se pueden juntar)</span><span className="block text-xs text-rs-muted">Sin marcar, las mesas son fijas y siempre van solas.</span></span></label>
      <div><label className="label" htmlFor="v_forma">Forma</label><select id="v_forma" name="forma" className="input w-full"><option value="cuadrada">Cuadrada</option><option value="redonda">Redonda</option></select></div>
      <p className="text-xs text-rs-muted">Las mesas se acomodan solas en los lugares libres del plano (los números que ya existen se saltean). Después las movés como quieras.</p>
      {state && !state.ok && <p role="alert" className="text-sm text-rs-danger">{state.error}</p>}
      <Acciones pending={pending} texto="Crear mesas" onCancel={onDone} />
    </form>
  )
}
function FormDuracion({ actual, sedeNombre, onDone }: { actual: number; sedeNombre: string | null; onDone: () => void }) {
  const { state, pending, formProps } = useAccionFormulario(guardarDuracionMesas)
  useCerrarAlGuardar(state, 'Duración guardada', onDone)
  return (
    <form {...formProps} className="space-y-3">
      <div><label className="label" htmlFor="d_min">Minutos que suele ocupar una mesa cada reserva{sedeNombre ? ` (en ${sedeNombre})` : ''}</label><input id="d_min" name="duracion_min" type="number" min={30} max={480} defaultValue={actual} className="input w-32" required /></div>
      <p className="text-xs text-rs-muted">Se usa para avisarte cuando le querés dar una mesa a una reserva que se pisa con otra (por ejemplo, 120 min: una reserva de las 21:00 y otra de las 22:00 en la misma mesa).</p>
      {state && !state.ok && <p role="alert" className="text-sm text-rs-danger">{state.error}</p>}
      <Acciones pending={pending} texto="Guardar" onCancel={onDone} />
    </form>
  )
}

