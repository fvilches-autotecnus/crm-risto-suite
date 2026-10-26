import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { getContexto } from '@/lib/context'
import { fechaCorta, fechaHoraLarga, fechaLarga, hoyEn } from '@/lib/fechas'
import { mesasPorReserva } from '@/lib/mesas-servidor'
import { labelTipo, RESERVA_COLS, type Reserva } from '@/lib/reservas'
import { cargarTiposReserva } from '@/lib/config-reservas-servidor'
import BotonImprimir from './boton-imprimir'

export const metadata: Metadata = { title: 'Reservas del día', robots: { index: false } }

/** Hoja de reservas del día para imprimir (o guardar como PDF): para que los mozos organicen las mesas en el salón. Solo para usuarios con sesión. */
export default async function HojaReservas({ searchParams }: { searchParams: Promise<{ fecha?: string; auto?: string }> }) {
  const ctx = await getContexto()
  if (!ctx.modulosActivos.reservas) notFound()
  const sp = await searchParams
  const fecha = sp.fecha && /^\d{4}-\d{2}-\d{2}$/.test(sp.fecha) ? sp.fecha : hoyEn(ctx.negocio.zona_horaria)
  let q = ctx.supabase.from('reservas').select(RESERVA_COLS).eq('negocio_id', ctx.negocio.id).is('eliminado_en', null).eq('fecha', fecha).in('estado', ['nueva', 'confirmada', 'pendiente_pago', 'revisar_pago'])
  if (ctx.sede) q = q.eq('sucursal_id', ctx.sede.id)
  const { data } = await q.order('hora', { ascending: true, nullsFirst: false }).limit(2000)
  const reservas = ((data ?? []) as Reserva[]).sort((a, b) => (a.hora ?? '99:99').localeCompare(b.hora ?? '99:99') || (a.ubicacion ?? '').localeCompare(b.ubicacion ?? '') || (a.cliente_nombre ?? '').localeCompare(b.cliente_nombre ?? ''))
  const mesas = await mesasPorReserva(ctx, reservas.map((r) => r.id))
  const etiquetas = Object.fromEntries((await cargarTiposReserva(ctx)).map((t) => [t.clave, t.etiqueta]))
  const nombresSede = Object.fromEntries(ctx.sedesTodas.map((s) => [s.id, s.nombre]))
  const conSedes = ctx.sedesTodas.some((s) => s.activa) && !ctx.sede
  const personas = reservas.reduce((s, r) => s + (r.cantidad_personas ?? 0), 0)
  const porUbicacion = new Map<string, { reservas: number; personas: number }>()
  for (const r of reservas) { const k = r.ubicacion ?? 'Sin ubicación'; const v = porUbicacion.get(k) ?? { reservas: 0, personas: 0 }; porUbicacion.set(k, { reservas: v.reservas + 1, personas: v.personas + (r.cantidad_personas ?? 0) }) }
  const sinMesa = ctx.modulosActivos.mesas ? reservas.filter((r) => !mesas[r.id]).length : 0
  const estadoCorto: Record<string, string> = { nueva: 'Sin confirmar', confirmada: 'Confirmada', pendiente_pago: 'Falta pago', revisar_pago: 'Revisar pago' }
  const horas = [...new Set(reservas.map((r) => (r.hora ? r.hora.slice(0, 5) : 'Sin hora')))]

  return (
    <div className="min-h-screen bg-white p-6 text-[12px] text-black print:p-0">
      <style>{'@page { size: A4; margin: 12mm } @media print { body { background: #fff !important } }'}</style>
      <BotonImprimir auto={sp.auto === '1'} />
      <header className="mb-3 border-b-2 border-black pb-2">
        <div className="flex flex-wrap items-end justify-between gap-2">
          <div><h1 className="text-xl font-bold">{ctx.negocio.nombre}{ctx.sede ? ` · ${ctx.sede.nombre}` : ''}</h1><p className="text-sm capitalize">Reservas del {fechaLarga(fecha)} ({fechaCorta(fecha)})</p></div>
          <p className="text-right text-sm"><b>{reservas.length}</b> reservas · <b>{personas}</b> personas{sinMesa > 0 && <> · <b>{sinMesa}</b> sin mesa</>}</p>
        </div>
        {porUbicacion.size > 1 && <p className="mt-1 text-xs">{[...porUbicacion].map(([u, v]) => `${u}: ${v.reservas} res. / ${v.personas} pers.`).join('  ·  ')}</p>}
      </header>
      {reservas.length === 0 ? <p className="py-10 text-center text-base">No hay reservas para este día.</p> : (
        <table className="w-full border-collapse">
          <thead>
            <tr className="border-b border-black text-left text-[11px] uppercase tracking-wide">
              <th className="w-12 py-1 pr-2">Hora</th><th className="w-10 pr-2">#</th><th className="pr-2">Cliente</th><th className="w-10 pr-2 text-center">Pers.</th>
              {ctx.modulosActivos.mesas && <th className="w-16 pr-2">Mesa</th>}{conSedes && <th className="pr-2">Sede</th>}<th className="pr-2">Ubicación</th><th className="pr-2">Tipo</th><th className="pr-2">Estado</th><th className="w-8 text-center">✓</th>
            </tr>
          </thead>
          <tbody>
            {horas.map((h) => (
              reservas.filter((r) => (r.hora ? r.hora.slice(0, 5) : 'Sin hora') === h).map((r, i) => (
                <tr key={r.id} className={'break-inside-avoid align-top ' + (i === 0 ? 'border-t border-black ' : 'border-t border-neutral-300 ')}>
                  <td className="py-1 pr-2 font-bold">{i === 0 ? h : ''}</td>
                  <td className="pr-2 tabular-nums">#{r.numero_sede ?? r.numero}</td>
                  <td className="pr-2"><b>{r.cliente_nombre ?? '—'}</b>{r.cliente_telefono ? <span className="text-neutral-600"> · {r.cliente_telefono}</span> : ''}{r.observaciones && <div className="text-[11px] italic text-neutral-700">{r.observaciones}</div>}</td>
                  <td className="pr-2 text-center text-sm font-bold tabular-nums">{r.cantidad_personas ?? '—'}</td>
                  {ctx.modulosActivos.mesas && <td className="pr-2 font-bold">{mesas[r.id] ? `Mesa ${mesas[r.id]}` : <span className="font-normal text-neutral-500">______</span>}</td>}
                  {conSedes && <td className="pr-2">{r.sucursal_id ? nombresSede[r.sucursal_id] ?? '' : ''}</td>}
                  <td className="pr-2">{r.ubicacion ?? ''}</td>
                  <td className="pr-2">{labelTipo(r.tipo_reserva, etiquetas)}</td>
                  <td className="pr-2">{estadoCorto[r.estado] ?? r.estado}{r.monto_sena ? ` ($${r.monto_sena})` : ''}</td>
                  <td className="text-center"><span className="inline-block h-4 w-4 border border-black" /></td>
                </tr>
              ))
            ))}
          </tbody>
        </table>
      )}
      <p className="mt-4 text-[10px] text-neutral-500">Impreso el {fechaHoraLarga(new Date().toISOString(), ctx.negocio.zona_horaria)} · RistoSuite</p>
    </div>
  )
}
