import Link from 'next/link'
import { redirect } from 'next/navigation'
import { PauseCircle, Search } from 'lucide-react'
import Paginacion from '@/components/paginacion'
import { ListaPausados, ReactivarTodosBtn, type PausadoUI } from '@/components/pausados-ui'
import { getContexto } from '@/lib/context'
import { listarPausados } from '@/lib/pausados'
import { MOTIVOS_PAUSA, labelMotivoPausa, leerPausaAuto, motivoValido, textoPausa } from '@/lib/pausas'
import { createAdminClient } from '@/lib/supabase/server'
import { numPagina, paginar } from '@/lib/paginacion'

export default async function PausadosPage({ searchParams }: { searchParams: Promise<{ motivo?: string; q?: string; pagina?: string }> }) {
  const ctx = await getContexto()
  if (!ctx.puedeApagarBot) redirect('/')   // solo los negocios con el botón de apagado y los roles que pueden usarlo
  const sp = await searchParams
  const todos = await listarPausados(ctx)
  const nombresSede = new Map(ctx.sedesTodas.map((x) => [x.id, x.nombre]))

  const motivo = MOTIVOS_PAUSA.some((m) => m.value === sp.motivo) ? sp.motivo! : 'todos'
  const q = (sp.q ?? '').trim().toLowerCase()
  const conteo = { consulta: 0, reserva: 0, otro: 0 }
  for (const c of todos) conteo[motivoValido(c.motivo_pausa) as keyof typeof conteo]++

  // Nombre del cliente en el CRM (por teléfono): se busca solo para la página que se muestra
  const nombreCrm = new Map<string, string>()
  const base = todos.filter((c) => motivo === 'todos' || motivoValido(c.motivo_pausa) === motivo)
  const admin = createAdminClient()
  const buscaEnCrm = async (tels: string[]) => {
    for (let i = 0; i < tels.length; i += 100) {
      const { data } = await admin.from('clientes').select('telefono, nombre').eq('negocio_id', ctx.negocio.id).in('telefono', tels.slice(i, i + 100))
      for (const c of data ?? []) if (c.telefono && c.nombre) nombreCrm.set(c.telefono, c.nombre)
    }
  }
  const nombreDe = (c: { telefono: string; nombre_whatsapp: string | null }) => nombreCrm.get(c.telefono) ?? c.nombre_whatsapp
  let filtrados = base
  if (q) {
    // la búsqueda por nombre incluye el nombre del cliente en el CRM: se resuelve para todos los candidatos
    await buscaEnCrm(base.map((c) => c.telefono))
    filtrados = base.filter((c) => c.telefono.includes(q.replace(/\D/g, '') || '\u0000') || (nombreDe(c) ?? '').toLowerCase().includes(q))
  }
  const pg = paginar(filtrados, numPagina(sp.pagina))
  if (!q) await buscaEnCrm(pg.items.map((c) => c.telefono))

  const chats: PausadoUI[] = pg.items.map((c) => ({ id: c.id, telefono: c.telefono, nombre: nombreDe(c), motivo_pausa: c.motivo_pausa, pausado_en: c.pausado_en, reactivar_en: c.reactivar_en, sede: c.sucursal_id ? nombresSede.get(c.sucursal_id) ?? null : null }))
  const auto = leerPausaAuto(ctx.negocio.modulos)
  const link = (m: string) => `/pausados${m !== 'todos' || q ? '?' : ''}${[m !== 'todos' ? `motivo=${m}` : '', q ? `q=${encodeURIComponent(q)}` : ''].filter(Boolean).join('&')}`

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div className="animate-fade-up">
          <h1 className="flex items-center gap-2 text-xl font-bold sm:text-2xl"><PauseCircle className="text-rs-lime" size={22} />Chats pausados</h1>
          <p className="text-sm text-rs-muted">{ctx.negocio.nombre}{ctx.sede ? ` · ${ctx.sede.nombre}` : ''} · chats que el bot dejó esperando a una persona; mientras estén pausados no responde</p>
        </div>
        <ReactivarTodosBtn total={motivo === 'todos' ? todos.length : base.length} motivo={motivo === 'todos' ? undefined : motivo} etiquetaMotivo={motivo === 'todos' ? undefined : labelMotivoPausa(motivo)} />
      </div>

      <p className="-mt-2 text-sm text-rs-muted">
        Pausa automática: consulta o reclamo <span className="font-medium text-rs-text">{textoPausa(auto.consulta).toLowerCase()}</span> · solicitud de reserva <span className="font-medium text-rs-text">{textoPausa(auto.reserva).toLowerCase()}</span> · otros <span className="font-medium text-rs-text">{textoPausa(auto.otro).toLowerCase()}</span>.
        {ctx.puedeAdministrar ? <> <Link href="/configuracion#pausas" className="text-rs-lime hover:underline">Cambiar</Link></> : null}
      </p>

      <div className="grid grid-cols-3 gap-3">
        {[['Consultas', conteo.consulta, 'text-rs-warn'], ['Solicitudes de reserva', conteo.reserva, 'text-rs-lav'], ['Otros', conteo.otro, 'text-rs-muted']].map(([l, n, c], i) => (
          <div key={l as string} className="reveal card px-4 py-3" style={{ ['--i' as string]: i }}><div className={'text-2xl font-bold tabular-nums ' + c}>{n}</div><div className="card-title mt-1">{l}</div></div>
        ))}
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <Link href={link('todos')} className={'btn btn-sm ' + (motivo === 'todos' ? 'btn-primary' : '')}>Todos ({todos.length})</Link>
        {MOTIVOS_PAUSA.map((m) => <Link key={m.value} href={link(m.value)} className={'btn btn-sm ' + (motivo === m.value ? 'btn-primary' : '')}>{m.label} ({conteo[m.value as keyof typeof conteo]})</Link>)}
        <form className="relative ml-auto w-full sm:w-64">
          {motivo !== 'todos' && <input type="hidden" name="motivo" value={motivo} />}
          <Search size={14} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-rs-muted" />
          <input name="q" defaultValue={sp.q ?? ''} placeholder="Buscar por nombre o teléfono" className="input w-full pl-9" />
        </form>
      </div>

      <ListaPausados chats={chats} ahora={Date.now()} hayVarias={ctx.sedesTodas.length > 0} />
      <Paginacion ruta="/pausados" params={sp} {...pg} />
    </div>
  )
}
