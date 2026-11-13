'use client'

import { Fragment, useEffect, useState, useTransition } from 'react'
import { CalendarClock, CalendarPlus, ChevronDown, ChevronRight, Info, X } from 'lucide-react'
import { marcarDiaEspecial, quitarDiaEspecial } from '@/app/(panel)/prediccion-actions'
import { useToast } from '@/components/feedback'
import Modal from '@/components/modal'
import { Barra, Spinner } from '@/components/ui'
import { useAccionFormulario } from '@/components/use-accion-formulario'
import { fechaCorta } from '@/lib/fechas'
import { BANDAS, type Banda, type Celda, type DiaPred, type Prediccion } from '@/lib/prediccion'

const DIAS = ['domingo', 'lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado']
const COLOR_BANDA: Record<Banda, { barra: string; texto: string }> = {
  tranquilo: { barra: 'bg-rs-ok', texto: 'text-rs-ok' }, normal: { barra: 'bg-rs-lime', texto: 'text-rs-lime' },
  alto: { barra: 'bg-rs-warn', texto: 'text-rs-warn' }, completo: { barra: 'bg-rs-danger', texto: 'text-rs-danger' },
}
const labelBanda = (b: Banda) => BANDAS.find((x) => x.value === b)!.label

function CeldaVista({ c }: { c: Celda | null }) {
  if (!c) return <span className="text-rs-muted">—</span>
  if (c.origen === 'cerrado') return <span className="text-sm text-rs-muted">Cerrado</span>
  if (c.origen === 'habitualmente_cerrado') return <span className="text-sm text-rs-muted" title="En las últimas semanas casi no hubo reservas este día">Sin movimiento habitual</span>
  if (c.esperado === null) return <span className="text-sm"><span className="font-medium text-rs-lav">Evento</span>{c.reservado > 0 && <span className="block text-xs text-rs-muted">ya reservado: {c.reservado}</span>}</span>
  const col = c.banda ? COLOR_BANDA[c.banda] : null
  return (
    <div className="min-w-[8.5rem]">
      <div className="flex items-baseline gap-1.5"><span className="text-lg font-semibold tabular-nums">≈ {c.esperado}</span><span className="text-xs text-rs-muted">{c.esperado === 1 ? 'persona' : 'personas'}</span></div>
      <div className="text-xs tabular-nums text-rs-muted">{c.min === c.max ? 'ya reservado, sin más movimiento habitual' : `entre ${c.min} y ${c.max}`}{c.reservado > 0 && c.min !== c.max ? ` · reservado ${c.reservado}` : ''}</div>
      {c.pct !== null && c.banda && col && (
        <div className="mt-1.5">
          <Barra pct={Math.min(100, Math.round(c.pct * 100))} className={col.barra} />
          <div className={'mt-0.5 text-xs tabular-nums ' + col.texto}>{Math.round(c.pct * 100)}% del aforo ({c.capacidad}) · {labelBanda(c.banda)}</div>
        </div>
      )}
    </div>
  )
}

function DialogoMarca({ dia, puedeMarcar, onClose }: { dia: DiaPred; puedeMarcar: boolean; onClose: () => void }) {
  const toast = useToast()
  const { state, pending, formProps } = useAccionFormulario(marcarDiaEspecial, { okTexto: 'Día marcado' })
  const [quitando, start] = useTransition()
  const manual = dia.especial?.origen === 'manual' ? dia.especial : null
  useEffect(() => { if (state?.ok) onClose() }, [state]) // eslint-disable-line react-hooks/exhaustive-deps
  const quitar = () => start(async () => {
    if (!manual?.id) return
    const r = await quitarDiaEspecial(manual.id)
    if (r.ok) { toast({ texto: 'Se quitó la marca' }); onClose() } else toast({ tipo: 'error', texto: r.error ?? 'No se pudo quitar' })
  })
  return (
    <Modal titulo={`${DIAS[dia.dow].charAt(0).toUpperCase() + DIAS[dia.dow].slice(1)} ${fechaCorta(dia.fecha)}`} onClose={onClose}>
      {dia.especial && dia.especial.origen !== 'manual' && (
        <p className="mb-3 rounded-md bg-rs-raised/50 px-3 py-2 text-xs text-rs-muted">Este día ya figura como <strong>{dia.especial.tipo === 'cerrado' ? 'cerrado' : 'evento'}</strong> {dia.especial.origen === 'bloqueo' ? 'por una fecha bloqueada' : 'por un show cargado'}{dia.especial.motivo ? ` (${dia.especial.motivo})` : ''}. Si lo marcás acá, vale tu marca.</p>
      )}
      <form {...formProps} className="space-y-3" noValidate>
        <input type="hidden" name="fecha" value={dia.fecha} />
        <fieldset>
          <legend className="label">¿Qué pasó o qué va a pasar ese día?</legend>
          <div className="grid gap-2 sm:grid-cols-2">
            {[['evento', 'Evento o día especial', 'Habrá mucha más (o distinta) demanda: show, fecha especial, evento privado.'], ['cerrado', 'Cerrado', 'El local no abre o no toma reservas.']].map(([v, t, d]) => (
              <label key={v} className="flex cursor-pointer gap-2 rounded-md border border-rs-border p-3 text-sm has-[:checked]:border-rs-lime has-[:checked]:bg-rs-lime/10">
                <input type="radio" name="tipo" value={v} defaultChecked={(manual?.tipo ?? 'evento') === v} className="mt-1" />
                <span><span className="font-semibold">{t}</span><span className="block text-xs text-rs-muted">{d}</span></span>
              </label>
            ))}
          </div>
        </fieldset>
        <div><label className="label" htmlFor="dia_motivo">Motivo (opcional)</label><input id="dia_motivo" name="motivo" defaultValue={manual?.motivo ?? ''} maxLength={120} placeholder="Ej. Noche de karaoke" className="input w-full" /></div>
        <p className="text-xs text-rs-muted">Es solo una marca para la predicción: no bloquea reservas. Ese día deja de contar para el promedio de los {DIAS[dia.dow]}.</p>
        {state && !state.ok && <p role="alert" className="text-sm text-rs-danger">{state.error}</p>}
        <div className="flex flex-wrap justify-end gap-2">
          {manual && <button type="button" disabled={quitando} onClick={quitar} className="btn btn-danger mr-auto">{quitando ? <Spinner /> : <X size={14} />}Quitar marca</button>}
          <button type="button" onClick={onClose} className="btn">Cancelar</button>
          {puedeMarcar && <button disabled={pending} className="btn btn-primary">{pending && <Spinner />}{pending ? 'Guardando…' : 'Guardar'}</button>}
        </div>
      </form>
    </Modal>
  )
}

/**
 * Demanda esperada de los próximos días por franja, comparada con el aforo. El detalle por ubicación está en cada fila (flecha).
 * Solo cuenta reservas: no incluye a quien llega sin reservar.
 */
export default function PrediccionDemanda({ pred, hoy, puedeMarcar, marcasDisponibles }: { pred: Prediccion; hoy: string; puedeMarcar: boolean; marcasDisponibles: boolean }) {
  const [abierto, setAbierto] = useState<string | null>(null)
  const [marcando, setMarcando] = useState<DiaPred | null>(null)
  const sinPrediccion = pred.nivel === 'poco_historial' || pred.nivel === 'desactualizado'

  return (
    <section className="reveal card p-4 sm:p-5" style={{ ['--i' as string]: 3 }} aria-labelledby="demanda-titulo">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <h2 id="demanda-titulo" className="flex items-center gap-2 text-base font-semibold"><CalendarClock size={18} className="text-rs-lime" />Demanda esperada · próximos 14 días</h2>
          <p className="mt-0.5 max-w-3xl text-xs text-rs-muted">Estimación según lo que pasó en las últimas semanas el mismo día de la semana (y lo ya reservado para los próximos días). Cuenta solo reservas: no incluye a quien llega sin reservar.</p>
        </div>
      </div>

      {sinPrediccion ? (
        <div role="status" className={'mt-4 flex gap-2 rounded-md border px-3 py-3 text-sm ' + (pred.nivel === 'desactualizado' ? 'border-rs-warn/40 bg-rs-warn/10 text-rs-warn' : 'border-rs-border bg-rs-raised/40 text-rs-muted')}>
          <Info size={16} className="mt-0.5 shrink-0" /><p>{pred.aviso}</p>
        </div>
      ) : (
        <>
          {pred.aviso && <p role="status" className="mt-3 flex gap-2 rounded-md bg-rs-raised/50 px-3 py-2 text-xs text-rs-muted"><Info size={14} className="mt-0.5 shrink-0" />{pred.aviso}</p>}
          <div className="mt-4 overflow-x-auto">
            <table className="w-full min-w-[640px]">
              <thead className="border-b border-rs-border">
                <tr><th className="th w-44">Día</th>{pred.franjas.map((f) => <th key={f.clave} className="th">{f.etiqueta}</th>)}{puedeMarcar && marcasDisponibles && <th className="th w-12 text-right"><span className="sr-only">Marcar</span></th>}</tr>
              </thead>
              <tbody>
                {pred.dias.map((d) => {
                  const hayDetalle = Object.values(d.celdas).some((c) => c && c.ubicaciones.length > 0)
                  const abiertoAca = abierto === d.fecha
                  return (
                    <Fragment key={d.fecha}>
                      <tr className="border-b border-rs-border/60 align-top last:border-0">
                        <td className="td">
                          <div className="flex items-start gap-1">
                            {hayDetalle ? <button type="button" onClick={() => setAbierto(abiertoAca ? null : d.fecha)} aria-expanded={abiertoAca} aria-label={`Detalle por ubicación del ${fechaCorta(d.fecha)}`} className="mt-0.5 text-rs-muted hover:text-rs-lime">{abiertoAca ? <ChevronDown size={15} /> : <ChevronRight size={15} />}</button> : <span className="w-[15px]" />}
                            <div>
                              <div className="font-medium capitalize">{DIAS[d.dow]} <span className="font-normal normal-case text-rs-muted">{fechaCorta(d.fecha)}</span>{d.fecha === hoy && <span className="ml-1.5 badge bg-rs-lime/15 text-rs-lime">hoy</span>}</div>
                              <div className="mt-0.5 flex flex-wrap gap-1">
                                {d.feriado && <span className="badge bg-rs-warn/15 text-rs-warn" title={d.feriado}>Feriado</span>}
                                {d.especial && <span className={'badge ' + (d.especial.tipo === 'cerrado' ? 'bg-rs-muted/20 text-rs-muted' : 'bg-rs-lav/15 text-rs-lav')} title={d.especial.motivo ?? undefined}>{d.especial.tipo === 'cerrado' ? 'Cerrado' : 'Evento'}{d.especial.origen === 'show' ? ' (show)' : d.especial.origen === 'bloqueo' ? ' (bloqueo)' : ''}</span>}
                              </div>
                              {d.feriado && <div className="mt-0.5 max-w-[11rem] text-[11px] text-rs-muted">{d.feriado}: puede salir distinto</div>}
                              {d.especial?.motivo && <div className="mt-0.5 max-w-[11rem] truncate text-[11px] text-rs-muted" title={d.especial.motivo}>{d.especial.motivo}</div>}
                            </div>
                          </div>
                        </td>
                        {pred.franjas.map((f) => <td key={f.clave} className="td"><CeldaVista c={d.celdas[f.clave]} /></td>)}
                        {puedeMarcar && marcasDisponibles && <td className="td text-right"><button type="button" onClick={() => setMarcando(d)} title="Marcar como evento o cerrado" aria-label={`Marcar el ${fechaCorta(d.fecha)} como evento o cerrado`} className="btn btn-sm"><CalendarPlus size={13} /></button></td>}
                      </tr>
                      {abiertoAca && (
                        <tr className="border-b border-rs-border/60 bg-rs-raised/30">
                          <td className="td text-xs text-rs-muted">Por ubicación</td>
                          {pred.franjas.map((f) => {
                            const c = d.celdas[f.clave]
                            return (
                              <td key={f.clave} className="td">
                                {c && c.ubicaciones.length > 0 ? (
                                  <ul className="space-y-1 text-xs">
                                    {c.ubicaciones.map((u) => (
                                      <li key={u.nombre} className="flex items-center justify-between gap-3"><span className="truncate">{u.nombre}</span><span className={'shrink-0 tabular-nums ' + COLOR_BANDA[u.banda].texto}>≈ {u.esperado} <span className="text-rs-muted">({u.min}–{u.max})</span> / {u.capacidad} · {Math.round(u.pct * 100)}%</span></li>
                                    ))}
                                  </ul>
                                ) : <span className="text-xs text-rs-muted">—</span>}
                              </td>
                            )
                          })}
                          {puedeMarcar && marcasDisponibles && <td />}
                        </tr>
                      )}
                    </Fragment>
                  )
                })}
              </tbody>
            </table>
          </div>
          <p className="mt-3 text-xs text-rs-muted">Los números son una guía, no una promesa: los eventos, los cierres y los feriados cambian mucho un día puntual. Marcá esos días con el botón de la derecha y la predicción los deja afuera del promedio.</p>
        </>
      )}
      {marcando && <DialogoMarca dia={marcando} puedeMarcar={puedeMarcar} onClose={() => setMarcando(null)} />}
    </section>
  )
}
