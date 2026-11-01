import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { Clock, MapPin } from 'lucide-react'
import { urlImagen } from '@/lib/carta'
import { fechaLarga, hoyEn, horaCorta } from '@/lib/fechas'
import { normalizarMarca, origenCrm, urlAbsoluta, variablesMarca, type Marca } from '@/lib/marca'
import { resolverModulos } from '@/lib/modulos'
import { enlaceReservaShow, modalidadDe, type Show } from '@/lib/shows'
import { createAdminClient } from '@/lib/supabase/server'

// Cartelera pública (sin iniciar sesión). Se regenera sola cada minuto y al instante cuando el negocio edita algo.
export const revalidate = 60

async function cargar(slug: string) {
  if (!/^[a-z0-9-]{2,49}$/.test(slug)) return null
  const admin = createAdminClient()
  const { data: negocio } = await admin.from('negocios').select('id, nombre, modulos, zona_horaria').eq('slug', slug).eq('activo', true).maybeSingle()
  if (!negocio) return null
  const modulos = resolverModulos(negocio.modulos as Record<string, unknown> | null)
  if (!modulos.shows) return null
  const hoy = hoyEn(negocio.zona_horaria as string)
  const [{ data: shows }, { data: ubic }, { data: web }] = await Promise.all([
    admin.from('shows').select('id, titulo, descripcion, imagen_path, fecha, hora, ubicacion_id, modalidad, enlace, visible').eq('negocio_id', negocio.id).eq('visible', true).gte('fecha', hoy).order('fecha').order('hora').limit(200),
    admin.from('ubicaciones').select('id, nombre').eq('negocio_id', negocio.id),
    admin.from('reservas_web_config').select('marca, activo').eq('negocio_id', negocio.id).maybeSingle(),
  ])
  const nombreUbic = new Map((ubic ?? []).map((u) => [u.id as string, u.nombre as string]))
  const m = normalizarMarca(web?.marca)
  const marca: Marca = { ...m, logo_url: urlAbsoluta(m.logo_url), ornamento_url: urlAbsoluta(m.ornamento_url) }
  const sePuedeReservar = modulos.reservas && web?.activo === true   // el botón "Reservar mesa" solo si el sitio de reservas está abierto
  return { nombre: negocio.nombre as string, shows: (shows ?? []) as Show[], nombreUbic, marca, sePuedeReservar }
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const d = await cargar((await params).slug)
  if (!d) return { title: 'Cartelera no disponible' }
  return { title: `${d.nombre} · Shows`, description: `Cartelera de shows y eventos de ${d.nombre}`, ...(d.marca.logo_url ? { icons: { icon: d.marca.logo_url } } : {}) }
}

export default async function ShowsPublicosPage({ params }: { params: Promise<{ slug: string }> }) {
  const slug = (await params).slug
  const d = await cargar(slug)
  if (!d) notFound()
  const { marca } = d
  const vars = variablesMarca(marca)
  const logoRisto = `${origenCrm()}/logo.jpeg`
  const boton = 'inline-flex h-10 items-center justify-center rounded-rs px-4 text-sm font-semibold transition'
  return (
    <>
      {vars && <style>{`:root{${Object.entries(vars).map(([k, v]) => `${k}:${v}`).join(';')}}`}</style>}
      <div className="min-h-screen">
        <header className={'relative isolate overflow-hidden border-b border-rs-raised bg-rs-header px-4 text-center ' + (marca.logo_url ? 'pb-5 pt-8' : 'pb-4 pt-8')}>
          {marca.ornamento_url && /* eslint-disable-next-line @next/next/no-img-element */ <img src={marca.ornamento_url} alt="" aria-hidden className="pointer-events-none absolute -right-8 -top-4 -z-10 w-48 select-none opacity-25 sm:-right-4 sm:w-64" />}
          {marca.logo_url && (marca.logo_forma === 'libre'
            ? /* eslint-disable-next-line @next/next/no-img-element */ <img src={marca.logo_url} alt="" className="mx-auto mb-3 h-auto max-h-32 w-auto max-w-[85%] object-contain" />
            : /* eslint-disable-next-line @next/next/no-img-element */ <img src={marca.logo_url} alt="" width={96} height={96} className="mx-auto mb-3 h-24 w-24 rounded-full object-cover shadow-[0_10px_30px_-8px_rgba(0,0,0,.6)] ring-1 ring-rs-lime/30" />)}
          <h1 className={marca.logo_url && marca.logo_forma === 'libre' ? 'sr-only' : marca.logo_url ? 'text-lg font-light uppercase tracking-[.28em] text-rs-lime' : 'text-2xl font-bold text-rs-lime'}>{d.nombre}</h1>
          {marca.lema && <p className="mt-1.5 font-serif text-base italic text-rs-text/90">{marca.lema}</p>}
          <p className="mt-1 text-sm text-rs-muted">Shows y eventos</p>
        </header>

        <main className="mx-auto max-w-2xl px-4 pb-16 pt-6">
          {d.shows.length === 0 && <p className="py-16 text-center text-sm text-rs-muted">Por ahora no hay shows programados. Volvé pronto.</p>}
          <ul className="space-y-5">
            {d.shows.map((s) => {
              const img = urlImagen(s.imagen_path), ubic = s.ubicacion_id ? d.nombreUbic.get(s.ubicacion_id) ?? null : null
              const m = modalidadDe(s.modalidad)
              const reservar = s.modalidad === 'reserva' && d.sePuedeReservar
              return (
                <li key={s.id} data-show={s.titulo} className="card overflow-hidden">
                  {img && /* eslint-disable-next-line @next/next/no-img-element */ <img src={img} alt={s.titulo} loading="lazy" className="aspect-video w-full object-cover" />}
                  <div className="p-4">
                    <h2 className="text-lg font-bold">{s.titulo}</h2>
                    <p className="mt-1 flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-rs-muted">
                      <span className="capitalize">{fechaLarga(s.fecha)}</span>
                      {s.hora && <span className="inline-flex items-center gap-1"><Clock size={13} />{horaCorta(s.hora)} hs</span>}
                      <span className="inline-flex items-center gap-1"><MapPin size={13} />{ubic ?? 'Todo el local'}</span>
                    </p>
                    {s.descripcion && <p className="mt-3 whitespace-pre-line text-sm">{s.descripcion}</p>}
                    <div className="mt-4 flex flex-wrap gap-2">
                      {reservar && <a data-boton="reservar" href={enlaceReservaShow(slug, s, ubic)} className={`${boton} bg-rs-lime text-rs-on-lime`}>{m.boton}</a>}
                      {s.modalidad !== 'reserva' && s.enlace && <a data-boton={s.modalidad} href={s.enlace} target="_blank" rel="noopener noreferrer" className={`${boton} bg-rs-lime text-rs-on-lime`}>{m.boton}</a>}
                      {s.modalidad === 'reserva' && s.enlace && <a data-boton="entradas" href={s.enlace} target="_blank" rel="noopener noreferrer" className={`${boton} border border-rs-control hover:border-rs-lime/50 hover:text-rs-lime`}>Comprar entradas</a>}
                    </div>
                  </div>
                </li>
              )
            })}
          </ul>
          <p className="mt-12 flex items-center justify-center gap-1.5 text-xs text-rs-muted">
            Cartelera con
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={logoRisto} alt="" width={18} height={18} className="h-[18px] w-[18px] rounded-md" />
            <b className="font-semibold text-rs-text">Risto Suite</b>
          </p>
        </main>
      </div>
    </>
  )
}
