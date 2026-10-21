import Link from 'next/link'
import { getContexto } from '@/lib/context'
import { fechaHoraCorta } from '@/lib/fechas'

const AUTOR: Record<string, string> = { cliente: 'Cliente', bot: 'Bot', humano: 'Equipo' }

export default async function ConversacionesPage({ searchParams }: { searchParams: Promise<{ tel?: string }> }) {
  const { supabase, negocio } = await getContexto()
  const { tel } = await searchParams

  const { data: sesiones } = await supabase
    .from('sesiones_bot')
    .select('telefono, nombre_whatsapp, estado_bot, motivo_pausa, actualizado_en')
    .eq('negocio_id', negocio.id)
    .order('actualizado_en', { ascending: false })
    .limit(200)

  const lista = sesiones ?? []
  const activo = tel && /^\d{6,20}$/.test(tel) ? tel : lista[0]?.telefono
  const sesion = lista.find((s) => s.telefono === activo)

  const { data: mensajes } = activo
    ? await supabase.from('mensajes_bot').select('id, autor, contenido, creado_en').eq('negocio_id', negocio.id).eq('telefono', activo).order('creado_en', { ascending: true }).limit(500)
    : { data: [] }

  return (
    <div className="grid gap-4 lg:grid-cols-[320px_1fr]">
      <aside className="card max-h-[70vh] overflow-y-auto">
        {lista.length === 0 && <p className="p-6 text-center text-sm text-rs-muted">Todavía no hay conversaciones del bot.</p>}
        {lista.map((s) => (
          <Link key={s.telefono} href={`/conversaciones?tel=${s.telefono}`} className={'block border-b border-rs-border/60 px-4 py-3 last:border-0 hover:bg-rs-raised/40 ' + (s.telefono === activo ? 'bg-rs-raised/60' : '')}>
            <div className="flex items-center justify-between gap-2">
              <span className="truncate text-sm font-medium">{s.nombre_whatsapp || s.telefono}</span>
              {s.estado_bot !== 'activo' && <span className="badge bg-rs-warn/15 text-rs-warn">Pausado</span>}
            </div>
            <div className="mt-0.5 text-xs text-rs-muted">{s.telefono} · {fechaHoraCorta(s.actualizado_en, negocio.zona_horaria)}</div>
          </Link>
        ))}
      </aside>

      <section className="card flex max-h-[70vh] flex-col">
        {!activo ? (
          <p className="p-10 text-center text-sm text-rs-muted">Elegí una conversación.</p>
        ) : (
          <>
            <header className="border-b border-rs-border px-5 py-3">
              <div className="font-semibold">{sesion?.nombre_whatsapp || activo}</div>
              <div className="text-xs text-rs-muted">
                {activo}{sesion && sesion.estado_bot !== 'activo' ? ` · Bot pausado${sesion.motivo_pausa ? ` (${sesion.motivo_pausa})` : ''}` : ' · Bot activo'}
              </div>
            </header>
            <div className="flex-1 space-y-2 overflow-y-auto p-5">
              {(mensajes ?? []).length === 0 && <p className="text-center text-sm text-rs-muted">Sin mensajes.</p>}
              {(mensajes ?? []).map((m) => (
                <div key={m.id} className={'flex ' + (m.autor === 'cliente' ? 'justify-start' : 'justify-end')}>
                  <div className={'max-w-[80%] rounded-2xl px-3.5 py-2 text-sm ' + (m.autor === 'cliente' ? 'bg-rs-raised' : m.autor === 'humano' ? 'bg-rs-lime text-rs-on-lime' : 'bg-rs-lime/15 text-rs-text')}>
                    <div className="mb-0.5 text-[10px] font-semibold uppercase tracking-wide opacity-70">{AUTOR[m.autor] ?? m.autor} · {fechaHoraCorta(m.creado_en, negocio.zona_horaria)}</div>
                    <p className="whitespace-pre-wrap">{m.contenido}</p>
                  </div>
                </div>
              ))}
            </div>
          </>
        )}
      </section>
    </div>
  )
}
