import type { Metadata } from 'next'
import GestionarReserva, { type InfoReserva } from '@/components/gestionar-reserva'
import { hoyEn } from '@/lib/fechas'
import { createAdminClient } from '@/lib/supabase/server'

// Página del link de una reserva: ver, cancelar o modificar. No se guarda en caché (depende del código) y no se indexa.
export const dynamic = 'force-dynamic'
export const metadata: Metadata = { title: 'Tu reserva', robots: { index: false, follow: false } }

export default async function ReservaPage({ params }: { params: Promise<{ slug: string; codigo: string }> }) {
  const { slug, codigo } = await params
  const noEncontrada = (
    <main className="mx-auto max-w-md space-y-3 px-4 py-16 text-center">
      <h1 className="text-xl font-bold">No encontramos esa reserva</h1>
      <p className="text-sm text-rs-muted">Revisá que el link esté completo. Si el problema sigue, escribinos por WhatsApp.</p>
    </main>
  )
  if (!/^[a-z0-9-]{2,49}$/.test(slug) || !/^[a-z0-9]{6,20}$/i.test(codigo)) return noEncontrada
  const admin = createAdminClient()
  const { data } = await admin.rpc('web_reserva_info', { p: { negocio: slug, codigo } })
  const info = data as (InfoReserva & { ok: boolean }) | null
  if (!info?.ok) return noEncontrada
  const { data: neg } = await admin.from('negocios').select('zona_horaria').eq('slug', slug).maybeSingle()
  return <GestionarReserva slug={slug} codigo={codigo} info={info} hoy={hoyEn((neg?.zona_horaria as string | undefined) ?? undefined)} />
}
