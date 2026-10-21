import Link from 'next/link'
import { getContexto } from '@/lib/context'
import { fechaHoraCorta } from '@/lib/fechas'
import ConsultaAcciones from './acciones'

export default async function ConsultasPage({ searchParams }: { searchParams: Promise<{ estado?: string }> }) {
  const ctx = await getContexto()
  const { supabase, negocio } = ctx
  const { estado } = await searchParams
  const filtro = estado === 'resuelta' ? 'resuelta' : 'pendiente'

  const { data } = await supabase
    .from('consultas_reclamos')
    .select('id, telefono, mensaje, estado, creado_en')
    .eq('negocio_id', negocio.id)
    .eq('estado', filtro)
    .order('creado_en', { ascending: false })
    .limit(200)

  const tab = (v: string, label: string) => (
    <Link href={`/consultas?estado=${v}`} className={'btn btn-sm ' + (filtro === v ? 'btn-primary' : '')}>{label}</Link>
  )

  return (
    <div className="space-y-4">
      <div className="flex gap-2">{tab('pendiente', 'Pendientes')}{tab('resuelta', 'Resueltas')}</div>
      <div className="space-y-3">
        {(data ?? []).length === 0 && <div className="card p-10 text-center text-sm text-rs-muted">{filtro === 'pendiente' ? 'No hay consultas pendientes.' : 'No hay consultas resueltas.'}</div>}
        {(data ?? []).map((c) => (
          <article key={c.id} className="card p-4">
            <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-rs-muted">
              <span>{c.telefono ? <Link href={`/conversaciones?tel=${c.telefono}`} className="font-semibold text-rs-lime hover:underline">{c.telefono}</Link> : 'Sin teléfono'}</span>
              <span>{fechaHoraCorta(c.creado_en, negocio.zona_horaria)}</span>
            </div>
            <p className="mt-2 whitespace-pre-wrap text-sm">{c.mensaje}</p>
            {ctx.puedeEscribir && <ConsultaAcciones id={c.id} estado={c.estado} />}
          </article>
        ))}
      </div>
    </div>
  )
}
