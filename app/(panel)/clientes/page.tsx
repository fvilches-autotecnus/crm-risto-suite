import Link from 'next/link'
import { Search, Users } from 'lucide-react'
import OrdenSelect from '@/components/orden-select'
import { EstadoVacio } from '@/components/ui'
import { getContexto } from '@/lib/context'
import { fechaCorta, fechaHoraLarga } from '@/lib/fechas'

const ORDENES = [
  { value: 'alta_desc', label: 'Alta: más recientes primero' },
  { value: 'alta_asc', label: 'Alta: más antiguos primero' },
  { value: 'actividad', label: 'Última actividad' },
  { value: 'nombre', label: 'Nombre (A–Z)' },
]

export default async function ClientesPage({ searchParams }: { searchParams: Promise<{ q?: string; orden?: string }> }) {
  const { supabase, negocio } = await getContexto()
  const { q, orden: ordenParam } = await searchParams
  const orden = ['alta_asc', 'actividad', 'nombre'].includes(ordenParam ?? '') ? ordenParam! : 'alta_desc'
  const busqueda = (q ?? '').trim().toLowerCase()

  const [{ data: clientes }, { data: reservas }] = await Promise.all([
    supabase.from('clientes').select('id, nombre, telefono, canal_origen, ultima_interaccion, creado_en').eq('negocio_id', negocio.id).order(orden === 'actividad' ? 'ultima_interaccion' : orden === 'nombre' ? 'nombre' : 'creado_en', { ascending: orden === 'alta_asc' || orden === 'nombre', nullsFirst: false }).limit(1000),
    supabase.from('reservas').select('cliente_id, fecha, estado').eq('negocio_id', negocio.id).is('eliminado_en', null).not('cliente_id', 'is', null).limit(5000),
  ])

  const resumen = new Map<string, { total: number; ultima: string | null }>()
  for (const r of reservas ?? []) {
    if (r.estado === 'cancelada') continue
    const x = resumen.get(r.cliente_id!) ?? { total: 0, ultima: null }
    x.total++
    if (r.fecha && (!x.ultima || r.fecha > x.ultima)) x.ultima = r.fecha
    resumen.set(r.cliente_id!, x)
  }

  const lista = (clientes ?? []).filter((c) => !busqueda || c.nombre.toLowerCase().includes(busqueda) || (c.telefono ?? '').includes(busqueda.replace(/\D/g, '') || '\u0000'))

  return (
    <div className="space-y-4">
      <form className="flex gap-2">
        <div className="relative w-full max-w-sm">
          <Search size={14} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-rs-muted" />
          <input name="q" defaultValue={q ?? ''} placeholder="Buscar nombre o teléfono" className="input w-full pl-9" />
        </div>
        {orden !== 'alta_desc' && <input type="hidden" name="orden" value={orden} />}
        <button className="btn">Buscar</button>
        {q && <Link href="/clientes" className="btn">Limpiar</Link>}
        <div className="ml-auto"><OrdenSelect opciones={ORDENES} /></div>
      </form>

      <div className="card overflow-x-auto">
        <table className="w-full min-w-[640px]">
          <thead className="border-b border-rs-border">
            <tr><th className="th">Nombre</th><th className="th">Teléfono</th><th className="th">Reservas</th><th className="th">Última reserva</th><th className="th">Origen</th><th className="th">Alta</th></tr>
          </thead>
          <tbody>
            {lista.length === 0 && <tr><td colSpan={6}><EstadoVacio icono={<Users size={26} />} titulo={busqueda ? 'Ningún cliente coincide con la búsqueda' : 'Todavía no hay clientes'} texto={busqueda ? 'Probá con otro nombre o con los últimos dígitos del teléfono.' : 'Aparecen solos cuando se carga una reserva con teléfono.'} /></td></tr>}
            {lista.map((c, i) => {
              const r = resumen.get(c.id)
              return (
                <tr key={c.id} className="reveal border-b border-rs-border/60 transition-colors last:border-0 hover:bg-rs-raised/50" style={{ ['--i' as string]: Math.min(i, 12) }}>
                  <td className="td font-medium"><Link href={`/clientes/${c.id}`} className="transition-colors hover:text-rs-lime">{c.nombre}</Link></td>
                  <td className="td text-rs-muted">{c.telefono ?? '—'}</td>
                  <td className="td">{r?.total ?? 0}</td>
                  <td className="td text-rs-muted">{r?.ultima ? fechaCorta(r.ultima) : '—'}</td>
                  <td className="td text-rs-muted">{c.canal_origen === 'whatsapp' ? 'WhatsApp' : 'Manual'}</td>
                  <td className="td whitespace-nowrap text-xs text-rs-muted">{fechaHoraLarga(c.creado_en)}</td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </div>
  )
}
