import Link from 'next/link'
import { notFound, redirect } from 'next/navigation'
import { ArrowLeft, Megaphone } from 'lucide-react'
import { BadgeCampana, BadgeModo, EditarCampanaBtn, EliminarCampanaBtn, ListaEnvios, RegistrarEnviosBtn } from '@/components/campanas-ui'
import { GraficoLinea, TarjetaGrafico } from '@/components/charts'
import { Tile } from '@/components/dashboard-ui'
import Paginacion from '@/components/paginacion'
import SelectorDias from '@/components/selector-dias'
import { CAMPANAS_EDITABLES, CAMPANA_COLS, DIAS_PERIODO, ENVIO_COLS, labelTipoCampana, type Campana, type Envio, type ResumenCampana } from '@/lib/campanas'
import { getContexto } from '@/lib/context'
import { TZ_AR, fechaCorta, fechaHoraLarga, hoyEn, sumarDias } from '@/lib/fechas'
import { agrupacionAuto, serieEvolucion } from '@/lib/metricas'
import { POR_PAGINA, numPagina } from '@/lib/paginacion'

const ymdAR = (iso: string) => new Intl.DateTimeFormat('en-CA', { timeZone: TZ_AR }).format(new Date(iso))

export default async function CampanaPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ dias?: string; pagina?: string }> }) {
  const ctx = await getContexto()
  if (!ctx.modulosActivos.campanas) redirect('/')
  const { id } = await params
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound()
  const { supabase, negocio } = ctx
  const sp = await searchParams
  const { data: c } = await supabase.from('campanas').select(CAMPANA_COLS).eq('id', id).eq('negocio_id', negocio.id).maybeSingle()
  if (!c) notFound()
  const campana = c as Campana

  const dias = DIAS_PERIODO.includes(Number(sp.dias)) ? Number(sp.dias) : 30
  const hoy = hoyEn(negocio.zona_horaria)
  const desde = sumarDias(hoy, -(dias - 1))
  const pDesde = `${desde}T00:00:00-03:00`
  const pHasta = `${sumarDias(hoy, 1)}T00:00:00-03:00`
  const pagina = numPagina(sp.pagina)
  const desdeFila = (pagina - 1) * POR_PAGINA

  const [{ data: res }, { data: envios, count }, { data: serieDatos }] = await Promise.all([
    supabase.rpc('resumen_campanas', { p_negocio: negocio.id, p_desde: pDesde, p_hasta: pHasta }),
    supabase.from('campanas_envios').select(ENVIO_COLS, { count: 'exact' }).eq('campana_id', id).neq('estado', 'fallido').gte('enviado_en', pDesde).lt('enviado_en', pHasta).order('enviado_en', { ascending: false }).range(desdeFila, desdeFila + POR_PAGINA - 1),
    supabase.from('campanas_envios').select('enviado_en').eq('campana_id', id).neq('estado', 'fallido').gte('enviado_en', pDesde).lt('enviado_en', pHasta).limit(50000),
  ])
  const r = ((res ?? []) as ResumenCampana[]).find((x) => x.campana_id === id)
  const enviados = Number(r?.enviados ?? 0), clientes = Number(r?.clientes ?? 0)

  const porDiaMapa = new Map<string, number>()
  for (const e of (serieDatos ?? []) as { enviado_en: string }[]) { const d = ymdAR(e.enviado_en); porDiaMapa.set(d, (porDiaMapa.get(d) ?? 0) + 1) }
  const porDia = Array.from({ length: dias }, (_, i) => { const f = sumarDias(desde, i); return { fecha: f, valor: porDiaMapa.get(f) ?? 0 } })
  const modo = agrupacionAuto(dias)
  const serie = serieEvolucion(porDia, modo)

  const total = count ?? 0
  const editable = CAMPANAS_EDITABLES && ctx.puedeEscribir
  const vigencia = campana.fecha_inicio || campana.fecha_fin ? `${campana.fecha_inicio ? fechaCorta(campana.fecha_inicio) : '…'} al ${campana.fecha_fin ? fechaCorta(campana.fecha_fin) : 'sin fin'}` : 'sin fechas definidas'

  return (
    <div className="space-y-5">
      <div>
        <Link href="/campanas" className="inline-flex items-center gap-1.5 text-sm text-rs-muted transition-colors hover:text-rs-lime"><ArrowLeft size={14} />Campañas</Link>
        <div className="mt-2 flex flex-wrap items-start justify-between gap-3">
          <div className="animate-fade-up">
            <h1 className="flex flex-wrap items-center gap-2 text-xl font-bold sm:text-2xl"><Megaphone className="text-rs-lime" size={22} />{campana.nombre}<BadgeCampana estado={campana.estado} /><BadgeModo modo={campana.modo} /></h1>
            <p className="mt-1 text-sm text-rs-muted">{labelTipoCampana(campana.tipo)} · {campana.canal === 'whatsapp' ? 'WhatsApp' : campana.canal} · {vigencia}{r?.ultimo_envio ? ` · último envío ${fechaHoraLarga(r.ultimo_envio)}` : ''}</p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {editable && <><RegistrarEnviosBtn campanaId={id} /><EditarCampanaBtn campana={campana} etiqueta />{ctx.puedeAdministrar && <EliminarCampanaBtn campana={campana} volverA="/campanas" etiqueta />}</>}
          </div>
        </div>
        {campana.mensaje && <p className="mt-3 whitespace-pre-wrap rounded-rs-lg border border-rs-border bg-rs-raised/40 px-3 py-2 text-sm text-rs-muted">{campana.mensaje}</p>}
      </div>

      <div className="flex justify-end"><SelectorDias ruta={`/campanas/${id}`} dias={dias} /></div>

      <div className="grid grid-cols-2 gap-3 sm:gap-4">
        <Tile i={0} valor={enviados} etiqueta={`Enviados (${dias} días)`} color="text-rs-lav" sub="mensajes" />
        <Tile i={1} valor={clientes} etiqueta="Clientes alcanzados" color="text-rs-ok" sub="clientes distintos" />
      </div>

      <TarjetaGrafico i={2} titulo={`Envíos ${modo === 'dia' ? 'por día' : 'por semana'} — últimos ${dias} días`} vacio={enviados === 0} columnas={[modo === 'dia' ? 'Día' : 'Semana', 'Envíos']} filas={serie.map((d) => [d.titulo, d.valor])}>
        <GraficoLinea puntos={serie} unidad="envíos" />
      </TarjetaGrafico>

      <section className="space-y-3">
        <h2 className="card-title">Clientes a los que se les envió</h2>
        <ListaEnvios envios={(envios ?? []) as Envio[]} editable={editable} puedeEliminar={editable && ctx.puedeAdministrar} />
        <Paginacion ruta={`/campanas/${id}`} params={sp} pagina={pagina} paginas={Math.max(1, Math.ceil(total / POR_PAGINA))} total={total} desde={total ? desdeFila + 1 : 0} hasta={desdeFila + (envios?.length ?? 0)} />
      </section>
    </div>
  )
}
