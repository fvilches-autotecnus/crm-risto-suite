import { redirect } from 'next/navigation'
import { Megaphone } from 'lucide-react'
import { BarrasHorizontales, GraficoLinea, TarjetaGrafico } from '@/components/charts'
import { ListaCampanas, NuevaCampanaBtn } from '@/components/campanas-ui'
import { Tile } from '@/components/dashboard-ui'
import SelectorDias from '@/components/selector-dias'
import { CAMPANAS_EDITABLES, CAMPANA_COLS, DIAS_PERIODO, labelTipoCampana, pct, type Campana, type ResumenCampana } from '@/lib/campanas'
import { getContexto } from '@/lib/context'
import { TZ_AR, fechaCorta, hoyEn, sumarDias } from '@/lib/fechas'
import { agrupacionAuto, serieEvolucion } from '@/lib/metricas'

const ymdAR = (iso: string) => new Intl.DateTimeFormat('en-CA', { timeZone: TZ_AR }).format(new Date(iso))

export default async function CampanasPage({ searchParams }: { searchParams: Promise<{ dias?: string }> }) {
  const ctx = await getContexto()
  if (!ctx.modulosActivos.campanas) redirect('/')
  const { supabase, negocio } = ctx
  const sp = await searchParams
  const dias = DIAS_PERIODO.includes(Number(sp.dias)) ? Number(sp.dias) : 30
  const hoy = hoyEn(negocio.zona_horaria)
  const desde = sumarDias(hoy, -(dias - 1))
  const pDesde = `${desde}T00:00:00-03:00`
  const pHasta = `${sumarDias(hoy, 1)}T00:00:00-03:00`

  const [{ data: cs }, { data: res }, { data: env }] = await Promise.all([
    supabase.from('campanas').select(CAMPANA_COLS).eq('negocio_id', negocio.id).order('creado_en', { ascending: false }),
    supabase.rpc('resumen_campanas', { p_negocio: negocio.id, p_desde: pDesde, p_hasta: pHasta }),
    supabase.from('campanas_envios').select('enviado_en').eq('negocio_id', negocio.id).neq('estado', 'fallido').gte('enviado_en', pDesde).lt('enviado_en', pHasta).limit(50000),
  ])
  const campanas = (cs ?? []) as Campana[]
  const resumen: Record<string, ResumenCampana> = {}
  for (const r of (res ?? []) as ResumenCampana[]) resumen[r.campana_id] = { ...r, enviados: Number(r.enviados), entregados: Number(r.entregados), leidos: Number(r.leidos), respondidos: Number(r.respondidos), fallidos: Number(r.fallidos) }
  const suma = (k: 'enviados' | 'entregados' | 'leidos' | 'respondidos' | 'fallidos') => Object.values(resumen).reduce((a, r) => a + r[k], 0)
  const enviados = suma('enviados'), entregados = suma('entregados'), respondidos = suma('respondidos'), fallidos = suma('fallidos')
  const activas = campanas.filter((c) => c.estado === 'activa').length

  // Evolución diaria (todos los días del período, con ceros) agrupada según el rango
  const porDiaMapa = new Map<string, number>()
  for (const e of (env ?? []) as { enviado_en: string }[]) { const d = ymdAR(e.enviado_en); porDiaMapa.set(d, (porDiaMapa.get(d) ?? 0) + 1) }
  const porDia = Array.from({ length: dias }, (_, i) => { const f = sumarDias(desde, i); return { fecha: f, valor: porDiaMapa.get(f) ?? 0 } })
  const modo = agrupacionAuto(dias)
  const serie = serieEvolucion(porDia, modo)
  const porCampana = campanas.map((c) => ({ etiqueta: c.nombre, valor: resumen[c.id]?.enviados ?? 0 })).filter((x) => x.valor > 0).sort((a, b) => b.valor - a.valor).slice(0, 8)
  const porTipoMapa = new Map<string, number>()
  for (const c of campanas) porTipoMapa.set(c.tipo, (porTipoMapa.get(c.tipo) ?? 0) + (resumen[c.id]?.enviados ?? 0))
  const porTipo = [...porTipoMapa.entries()].filter(([, v]) => v > 0).map(([t, v]) => ({ etiqueta: labelTipoCampana(t), valor: v })).sort((a, b) => b.valor - a.valor)
  const vacio = enviados === 0

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div className="animate-fade-up">
          <h1 className="flex items-center gap-2 text-xl font-bold sm:text-2xl"><Megaphone className="text-rs-lime" size={22} />Campañas automáticas</h1>
          <p className="text-sm text-rs-muted">{negocio.nombre} · mensajes de marketing enviados · {fechaCorta(desde)} al {fechaCorta(hoy)}</p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <SelectorDias ruta="/campanas" dias={dias} />
          {CAMPANAS_EDITABLES && ctx.puedeEscribir && <NuevaCampanaBtn />}
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-5 sm:gap-4">
        <Tile i={0} valor={enviados} etiqueta={`Enviados (${dias} días)`} color="text-rs-lav" sub="mensajes de marketing" />
        <Tile i={1} valor={entregados} etiqueta="Entregados" color="text-rs-ok" sub={enviados ? `${pct(entregados, enviados)}% de los enviados` : 'Sin envíos todavía'} />
        <Tile i={2} valor={respondidos} etiqueta="Respondieron" color="text-rs-lime" sub={enviados ? `${pct(respondidos, enviados)}% de los enviados` : 'Sin envíos todavía'} />
        <Tile i={3} valor={fallidos} etiqueta="Fallidos" color={fallidos ? 'text-rs-danger' : 'text-rs-muted'} sub={fallidos ? 'no se pudieron enviar' : 'Ninguno'} />
        <Tile i={4} valor={activas} etiqueta="Campañas activas" color="text-rs-text" sub={`de ${campanas.length} en total`} />
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <TarjetaGrafico i={5} titulo={`Envíos ${modo === 'dia' ? 'por día' : 'por semana'} — últimos ${dias} días`} vacio={vacio} columnas={[modo === 'dia' ? 'Día' : 'Semana', 'Envíos']} filas={serie.map((d) => [d.titulo, d.valor])} ancho>
          <GraficoLinea puntos={serie} unidad="envíos" />
        </TarjetaGrafico>
        <TarjetaGrafico i={6} titulo={`Envíos por campaña — últimos ${dias} días`} vacio={porCampana.length === 0} columnas={['Campaña', 'Envíos']} filas={porCampana.map((d) => [d.etiqueta, d.valor])}>
          <BarrasHorizontales datos={porCampana} unidad="envíos" />
        </TarjetaGrafico>
        <TarjetaGrafico i={7} titulo={`Envíos por tipo — últimos ${dias} días`} vacio={porTipo.length === 0} columnas={['Tipo', 'Envíos']} filas={porTipo.map((d) => [d.etiqueta, d.valor])}>
          <BarrasHorizontales datos={porTipo} unidad="envíos" />
        </TarjetaGrafico>
      </div>

      <ListaCampanas campanas={campanas} resumen={resumen} editable={CAMPANAS_EDITABLES && ctx.puedeEscribir} puedeEliminar={ctx.puedeAdministrar} dias={dias} />
    </div>
  )
}
