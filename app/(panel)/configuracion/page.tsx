import Link from 'next/link'
import ConfigIndex from '@/components/config-index'
import ConfigTiposSede from '@/components/config-tipos-sede'
import ConfigConfirmacionSede from '@/components/config-confirmacion-sede'
import ModulosSedesForm from '@/components/modulos-sedes-form'
import ReservasWebSede from '@/components/reservas-web-sede'
import { GRUPOS_WEB, grupoPisado, paramsPisados } from '@/lib/config-sedes'
import { aplicarSede } from '@/lib/modulos'
import GestionUsuarios from '@/components/usuarios-ui'
import { getContexto } from '@/lib/context'
import { webhookCliente } from '@/lib/notify'
import { fechaCorta, hoyEn } from '@/lib/fechas'
import type { UsuarioUI } from '@/lib/roles'
import { AforoForm, AvisosForm, BloqueoForm, BorrarBloqueo, FuncionesForm, ModulosForm, PausaAutoForm, ReglasPanel, SedesPanel, UbicacionesPanel } from './forms'
import { BotconversaForm, EtiquetasConfig, type EtiquetaConfig } from '@/components/etiquetas-ui'
import { integracionBC } from '@/lib/etiquetas'
import { leerPausaAuto } from '@/lib/pausas'
import ReservasWebConfig, { type ConfigReservasWeb, type SedeCfg } from '@/components/reservas-web-config'
import { labelTipo } from '@/lib/reservas'
import ConfigTiposReserva, { type FilaTipo } from '@/components/config-tipos-reserva'
import ConfigCalendario, { type AmbitoApertura, type DiaExtraUI } from '@/components/config-calendario'
import ConfigConfirmacion from '@/components/config-confirmacion'
import type { ReglaConfirmacion, ResultadoConfirmacion } from '@/lib/confirmacion'
import { createAdminClient } from '@/lib/supabase/server'
import ConfigParametrosReservas from '@/components/config-parametros-reservas'
import ConfigMensajesBot from '@/components/config-mensajes-bot'
import { cargarConfigReservas, cargarTiposReserva } from '@/lib/config-reservas-servidor'
import { MENSAJES_BOT, type ConfigReservas } from '@/lib/reservas-config'
import { sumarDias } from '@/lib/fechas'

const ROL: Record<string, string> = { owner: 'Dueño', admin: 'Administrador', encargado: 'Encargado', staff: 'Staff', solo_lectura: 'Solo lectura' }

function Seccion({ id, titulo, texto, i, children, borde }: { id: string; titulo: React.ReactNode; texto?: string; i: number; children: React.ReactNode; borde?: string }) {
  return (
    <section id={id} className={'reveal card scroll-mt-32 p-5 ' + (borde ?? '')} style={{ ['--i' as string]: i }}>
      <h2 className="card-title">{titulo}</h2>
      {texto && <p className="mt-1 text-sm text-rs-muted">{texto}</p>}
      {children}
    </section>
  )
}

export default async function ConfiguracionPage({ searchParams }: { searchParams: Promise<{ ambito?: string }> }) {
  const ctx = await getContexto()
  const sp = await searchParams
  // Ámbito: todo el negocio o una sede (?ambito=<id de la sede>). En una sede, lo que ella no cambia se hereda del negocio.
  const sedeAmb = ctx.puedeAdministrar && sp.ambito ? ctx.sedesGestion.find((x) => x.id === sp.ambito) ?? null : null
  const esSede = !!sedeAmb
  const mods = sedeAmb ? aplicarSede(ctx.modulosNegocio, ctx.configSedes[sedeAmb.id]?.modulos) : ctx.modulosNegocio
  const ovSede = sedeAmb ? ctx.configSedes[sedeAmb.id] : undefined
  // las consultas propias de esta pantalla se lanzan juntas con las demás (cada una es un viaje a la base)
  const pWebhook = ctx.esSuperadmin ? webhookCliente(ctx.negocio.id) : Promise.resolve(null)
  const pBc = integracionBC(ctx.negocio.id)
  const pEtiquetas = ctx.puedeAdministrar ? ctx.supabase.from('etiquetas').select('id, nombre, bc_tag_id, cliente_etiquetas(count)').eq('negocio_id', ctx.negocio.id).order('nombre') : Promise.resolve({ data: [] })
  const { supabase, negocio, sede } = ctx
  const hoy = hoyEn(negocio.zona_horaria)
  const conSedes = ctx.sedesTodas.length > 0

  let bq = supabase.from('fechas_bloqueadas_reservas').select('id, fecha, hora_desde, hora_hasta, motivo, sucursal_id').eq('negocio_id', negocio.id).gte('fecha', hoy)
  const sedeVista = sedeAmb ?? sede
  if (sedeVista) bq = bq.or(`sucursal_id.is.null,sucursal_id.eq.${sedeVista.id}`)
  const nombresSede = Object.fromEntries(ctx.sedesTodas.map((x) => [x.id, x.nombre]))

  const [{ data: bloqueos }, { data: ubicaciones }, { data: reglas }, { data: miembros }] = await Promise.all([
    bq.order('fecha'),
    supabase.from('ubicaciones').select('id, nombre, sucursal_id').eq('negocio_id', negocio.id).eq('activo', true).order('orden').order('nombre'),
    ctx.puedeAdministrar ? supabase.from('aforos').select('id, sucursal_id, ubicacion, hora_desde, hora_hasta, maximo, dias_semana, fecha_desde, fecha_hasta').eq('negocio_id', negocio.id).order('creado_en') : Promise.resolve({ data: [] }),
    ctx.puedeAdministrar
      ? supabase.from('membresias').select('user_id, rol, activo, sucursal_ids, perfiles(id, usuario, nombre, activo, es_superadmin)').eq('negocio_id', negocio.id)
      : Promise.resolve({ data: null }),
  ])

  const [webhook, bc, { data: etiquetasDb }] = await Promise.all([pWebhook, pBc, pEtiquetas])
  // Sitio público de reservas: su configuración, los tipos de reserva que ya existen y los horarios que más se usan
  let webCfg: ConfigReservasWeb | null = null
  let webTipos: { value: string; label: string }[] = []
  let webHorarios: string[] = []
  let filasTipos: FilaTipo[] = []
  let sedesWeb: SedeCfg[] = []
  let ambitos: AmbitoApertura[] = []
  let diasExtra: DiaExtraUI[] = []
  let confDefecto: ResultadoConfirmacion = 'nueva'
  let confReglas: ReglaConfirmacion[] = []
  let cfgRes: ConfigReservas | null = null
  let mensajesOriginales: Record<string, string> = {}
  let mensajesPropios: Record<string, string> = {}
  if (mods.reservas && ctx.puedeAdministrar) {
    const [{ data: c }, { data: ts }, { data: hs }] = await Promise.all([
      supabase.from('reservas_web_config').select('activo, elegir_mesa, tipos, horarios, dias_adelante, horas_anticipacion, personas_min, personas_max, mensaje, modo_prueba, titulo, subtitulo, texto_whatsapp, validez_horas, max_mesas, cualquier_ubicacion, texto_cualquier_ubicacion, pedir_cumple, horarios_dias, escasez_modo, escasez_umbral, escasez_texto').eq('negocio_id', negocio.id).maybeSingle(),
      supabase.from('reservas').select('tipo_reserva').eq('negocio_id', negocio.id).limit(10000),
      supabase.from('reservas').select('hora').eq('negocio_id', negocio.id).is('eliminado_en', null).gte('fecha', sumarDias(hoy, -120)).lte('fecha', hoy).not('hora', 'is', null).limit(10000),
    ])
    webCfg = { activo: false, elegir_mesa: true, tipos: [], horarios: [], dias_adelante: 60, horas_anticipacion: 2, personas_min: 1, personas_max: 12, mensaje: null, modo_prueba: true, titulo: null, subtitulo: null, texto_whatsapp: null, validez_horas: 48, max_mesas: 6, cualquier_ubicacion: true, texto_cualquier_ubicacion: null, pedir_cumple: true, ...(c ?? {}) } as ConfigReservasWeb
    // catálogo de tipos de reserva (el que configura el dueño) + los que el bot creó y todavía no tienen nombre
    const [catalogo, cr, { data: bm }, { data: orig }, { data: apert }, { data: extras }, { data: negEstado }, { data: reglasConf }] = await Promise.all([
      cargarTiposReserva(ctx, null), cargarConfigReservas(ctx, sedeAmb?.id ?? null),
      supabase.from('bot_mensajes').select('clave, texto').eq('negocio_id', negocio.id),
      supabase.rpc('bot_mensajes_defectos'),
      supabase.from('reservas_dias_apertura').select('sucursal_id, dias_semana').eq('negocio_id', negocio.id),
      supabase.from('reservas_dias_extra').select('id, fecha, motivo, sucursal_id').eq('negocio_id', negocio.id).gte('fecha', sumarDias(hoy, -30)).order('fecha'),
      createAdminClient().from('negocios').select('reserva_estado_inicial').eq('id', negocio.id).maybeSingle(),
      supabase.from('reservas_confirmacion_reglas').select('id, activo, sucursal_id, tipo_reserva, fecha_desde, fecha_hasta, dias_semana, personas_min, personas_max, resultado, nota').eq('negocio_id', negocio.id).order('orden').order('creado_en'),
    ])
    confDefecto = negEstado?.reserva_estado_inicial === 'confirmada' ? 'confirmada' : 'nueva'
    confReglas = (reglasConf ?? []).map((g) => ({ uid: g.id as string, activo: g.activo as boolean, sucursal_id: g.sucursal_id as string | null, tipo_reserva: g.tipo_reserva as string | null, fecha_desde: g.fecha_desde as string | null, fecha_hasta: g.fecha_hasta as string | null, dias_semana: ((g.dias_semana as number[] | null) ?? []).map(Number), personas_min: g.personas_min as number | null, personas_max: g.personas_max as number | null, resultado: g.resultado as ResultadoConfirmacion, nota: (g.nota as string | null) ?? '' }))
    const reglaDe = (sid: string | null) => ((apert ?? []).find((a) => (a.sucursal_id as string | null) === sid)?.dias_semana as number[] | undefined) ?? null
    ambitos = [{ id: null, nombre: ctx.sedesTodas.length ? 'Todo el negocio' : negocio.nombre, dias: reglaDe(null) }, ...ctx.sedesTodas.filter((x) => x.activa).map((x) => ({ id: x.id, nombre: x.nombre, dias: reglaDe(x.id) }))]
    diasExtra = (extras ?? []) as DiaExtraUI[]
    if (sedeAmb) { ambitos = ambitos.filter((a) => a.id === sedeAmb.id); diasExtra = diasExtra.filter((d) => !d.sucursal_id || d.sucursal_id === sedeAmb.id) }
    cfgRes = cr; mensajesOriginales = (orig ?? {}) as Record<string, string>; mensajesPropios = Object.fromEntries((bm ?? []).map((m) => [m.clave as string, m.texto as string]))
    // sedes: las activas con lo que tiene cada una (WhatsApp, ajustes propios del sitio y si tiene plano de mesas)
    const sedesActivas = ctx.sedesTodas.filter((x) => x.activa)
    if (sedesActivas.length) {
      const [{ data: ajustes }, { data: salonesW }, { data: mesasW }] = await Promise.all([
        supabase.from('reservas_web_sedes').select('sucursal_id, activo, horarios, horarios_dias, elegir_mesa, mensaje').eq('negocio_id', negocio.id),
        supabase.from('salones').select('id, sucursal_id').eq('negocio_id', negocio.id).eq('activo', true),
        supabase.from('mesas').select('salon_id').eq('negocio_id', negocio.id).eq('tipo', 'mesa').eq('activa', true),
      ])
      const conMesas = new Set((mesasW ?? []).map((m) => m.salon_id as string))
      sedesWeb = sedesActivas.map((x) => {
        const a = (ajustes ?? []).find((j) => j.sucursal_id === x.id)
        const propio = !!(x.whatsapp_nro ?? '').replace(/\D/g, '')
        return {
          id: x.id, nombre: x.nombre, whatsapp: ((x.whatsapp_nro ?? '') || (negocio.whatsapp_nro ?? '')).replace(/\D/g, ''), propio,
          activo: a?.activo ?? true, horarios: ((a?.horarios as string[] | null) ?? []).map((h) => String(h).slice(0, 5)), elegir_mesa: (a?.elegir_mesa as boolean | null) ?? null, mensaje: (a?.mensaje as string | null) ?? null, horarios_dias: (a?.horarios_dias as Record<string, string[]> | null) ?? {}, alias_web: x.alias_web ?? null,
          tiene_plano: (salonesW ?? []).some((sl) => (!sl.sucursal_id || sl.sucursal_id === x.id) && conMesas.has(sl.id as string)),
        }
      })
    }
    const usos: Record<string, number> = {}
    for (const t of ts ?? []) { const k = t.tipo_reserva as string; if (k) usos[k] = (usos[k] ?? 0) + 1 }
    filasTipos = [
      ...catalogo.map((t) => ({ clave: t.clave, etiqueta: t.etiqueta, activo: t.activo, usos: usos[t.clave] ?? 0, modo: t.modo ?? 'siempre', dias_semana: (t.dias_semana ?? []).map(Number), fechas: t.fechas ?? [] })),
      ...Object.keys(usos).filter((k) => !catalogo.some((t) => t.clave === k)).sort().map((k) => ({ clave: k, etiqueta: labelTipo(k), activo: true, usos: usos[k], sinConfigurar: true, modo: 'siempre' as const, dias_semana: [], fechas: [] })),
    ]
    webTipos = filasTipos.filter((t) => t.activo).map((t) => ({ value: t.clave, label: t.etiqueta }))
    const cuenta: Record<string, number> = {}
    for (const h of hs ?? []) { const k = String(h.hora).slice(0, 5); cuenta[k] = (cuenta[k] ?? 0) + 1 }
    webHorarios = Object.entries(cuenta).filter(([, c]) => c >= 5).map(([k]) => k).sort()
  }
  const etiquetas: EtiquetaConfig[] = ((etiquetasDb ?? []) as unknown as { id: string; nombre: string; bc_tag_id: number | null; cliente_etiquetas: { count: number }[] }[]).map((e) => ({ id: e.id, nombre: e.nombre, total: e.cliente_etiquetas?.[0]?.count ?? 0, vinculada: !!e.bc_tag_id }))
  const usuarios: UsuarioUI[] = ((miembros ?? []) as any[]).filter((m) => m.perfiles).map((m) => ({
    id: m.perfiles.id, usuario: m.perfiles.usuario, nombre: m.perfiles.nombre, activo: m.perfiles.activo, es_superadmin: m.perfiles.es_superadmin,
    membresias: [{ negocio_id: negocio.id, negocio_nombre: negocio.nombre, rol: m.rol, activo: m.activo, sucursal_ids: m.sucursal_ids ?? [] }],
  }))

  const puedeBloquear = ctx.puedeAdministrar || ctx.rol === 'encargado'
  const sedesAsignables = ctx.sedes.map((x) => ({ id: x.id, nombre: x.nombre }))
  const nombresUbicacion = [...new Set((ubicaciones ?? []).map((u) => u.nombre))]
  const muestraSedes = ctx.puedeAdministrar && (conSedes || ctx.esSuperadmin)

  const indice = [
    ...(!esSede ? [{ id: 'negocio', label: 'Negocio' }] : []),
    ...(muestraSedes && !esSede ? [{ id: 'sedes', label: 'Sedes' }] : []),
    ...(mods.reservas ? [{ id: 'aforo', label: 'Aforo' }, ...(cfgRes ? [{ id: 'calendario', label: 'Días de apertura' }] : []), { id: 'bloqueos', label: 'Fechas bloqueadas' }] : []),
    ...(cfgRes ? [{ id: 'tipos', label: 'Tipos de reserva' }, { id: 'confirmacion', label: 'Confirmación' }, { id: 'parametros', label: 'Parámetros' }] : []),
    ...(webCfg ? [{ id: 'reservas-web', label: 'Reservas web' }, { id: 'mensajes-bot', label: 'Mensajes del bot' }] : []),
    ...(mods.reservas && ctx.puedeAdministrar ? [{ id: 'ubicaciones', label: 'Ubicaciones' }] : []),
    ...(ctx.esSuperadmin && !esSede ? [{ id: 'funciones', label: 'Funciones' }] : []),
    ...(ctx.puedeAdministrar && !esSede ? [{ id: 'etiquetas', label: 'Etiquetas' }] : []),
    ...(ctx.tieneApagadoBot && ctx.puedeAdministrar && !esSede ? [{ id: 'pausas', label: 'Chats pausados' }] : []),
    ...(ctx.puedeAdministrar && !esSede ? [{ id: 'usuarios', label: 'Usuarios' }] : []),
  ]

  let n = 0
  return (
    <div className="max-w-4xl space-y-5">
      {ctx.puedeAdministrar && conSedes && (
        <nav aria-label="Qué estás configurando" className="card flex flex-wrap items-center gap-2 p-3 text-sm">
          <span className="font-semibold">Configurando:</span>
          <Link href="/configuracion" className={'btn btn-sm ' + (!esSede ? 'btn-primary' : '')}>Todo el negocio</Link>
          {ctx.sedesGestion.filter((x) => x.activa).map((x) => <Link key={x.id} href={`/configuracion?ambito=${x.id}`} className={'btn btn-sm ' + (sedeAmb?.id === x.id ? 'btn-primary' : '')}>{x.nombre}</Link>)}
          <span className="ml-auto text-xs text-rs-muted">{esSede ? `Lo que ${sedeAmb!.nombre} no cambie lo hereda del negocio.` : 'Cada sede puede cambiar algunas cosas para ella sola.'}</span>
        </nav>
      )}
      <ConfigIndex secciones={indice} />

      {!esSede && <Seccion id="negocio" i={n++} titulo="Negocio">
        <dl className="mt-3 grid gap-3 text-sm sm:grid-cols-4">
          <div><dt className="text-xs text-rs-muted">Nombre</dt><dd className="mt-0.5 font-medium">{negocio.nombre}</dd></div>
          <div><dt className="text-xs text-rs-muted">WhatsApp</dt><dd className="mt-0.5 font-medium">{negocio.whatsapp_nro ?? '—'}</dd></div>
          <div><dt className="text-xs text-rs-muted">Horario</dt><dd className="mt-0.5 font-medium">Argentina (GMT-3)</dd></div>
          <div><dt className="text-xs text-rs-muted">Tu rol</dt><dd className="mt-0.5 font-medium">{ctx.rol === 'superadmin' ? 'Superadmin' : ROL[ctx.rol]}</dd></div>
        </dl>
      </Seccion>}

      {muestraSedes && !esSede && (
        <Seccion id="sedes" i={n++} titulo="Sedes" texto='Cada sede tiene su aforo, sus fechas bloqueadas y su WhatsApp. Los usuarios pueden limitarse a una o más sedes desde "Usuarios".'>
          <div className="mt-3"><SedesPanel sedes={ctx.sedesGestion} puedeCrear={ctx.sinRestriccionSede} /></div>
        </Seccion>
      )}

      {mods.reservas && <Seccion id="aforo" i={n++} titulo="Aforo" texto="Se muestra en el dashboard, avisa al llegar al 90% y advierte al cargar una reserva que supera el cupo (se puede guardar igual).">
        <h3 className="mt-4 text-sm font-semibold">{esSede ? `Total por día de ${sedeAmb!.nombre}` : conSedes ? 'Total por día del negocio' : 'Total por día'}</h3>
        <p className="text-xs text-rs-muted">Máximo de personas con reserva (nueva o confirmada) en un mismo día.{esSede ? ' Vacío: sin tope propio (rige el del negocio, si tiene).' : conSedes ? ' Lo usan las sedes que no tienen un total propio.' : ''}</p>
        <AforoForm aforo={esSede ? sedeAmb!.aforo_maximo_reservas : negocio.aforo_maximo_reservas} puedeEditar={ctx.puedeAdministrar} sedeId={sedeAmb?.id} />
        {ctx.puedeAdministrar && (
          <>
            <h3 className="mt-6 text-sm font-semibold">Reglas por franja horaria y ubicación</h3>
            <p className="mb-2 text-xs text-rs-muted">Ej.: "INTERIOR de 20:00 a 23:00, máximo 20 personas", o "viernes y sábado, máximo 120" y "lunes a jueves, máximo 60". Una reserva cuenta en todas las reglas que le corresponden, así que para tener un aforo distinto por día cargá una regla por grupo de días (y no una general que las pise).</p>
            <ReglasPanel reglas={((reglas ?? []) as any[]).filter((r) => !sedeAmb || !r.sucursal_id || r.sucursal_id === sedeAmb.id)} sedes={sedeAmb ? [{ id: sedeAmb.id, nombre: sedeAmb.nombre }] : sedesAsignables} nombresSede={nombresSede} ubicaciones={nombresUbicacion} puedeTodas={ctx.sinRestriccionSede && !sedeAmb} />
          </>
        )}
      </Seccion>}

      {cfgRes && <Seccion id="calendario" i={n++} titulo="Días de apertura" texto="Qué días de la semana abre el negocio (y cada sede) para reservas. Si no abre todos los días, el sitio de reservas y el bot solo ofrecen los días habituales; las semanas especiales se suman como días extra.">
        <div className="mt-3"><ConfigCalendario ambitos={ambitos} extras={diasExtra} sedes={ctx.sedesTodas.filter((x) => x.activa).map((x) => ({ id: x.id, nombre: x.nombre }))} hoy={hoy} puedeAdministrar={ctx.puedeAdministrar} /></div>
      </Seccion>}

      {mods.reservas && <Seccion id="bloqueos" i={n++} titulo="Fechas bloqueadas" texto="Días (o franjas horarias) en los que no se aceptan reservas.">
        {puedeBloquear && <BloqueoForm sedes={sedeAmb ? [{ id: sedeAmb.id, nombre: sedeAmb.nombre }] : sedesAsignables} puedeTodas={ctx.sinRestriccionSede && !sedeAmb} />}
        <ul className="mt-4 divide-y divide-rs-border/60">
          {(bloqueos ?? []).length === 0 && <li className="py-3 text-sm text-rs-muted">No hay fechas bloqueadas próximas.</li>}
          {(bloqueos ?? []).map((b) => (
            <li key={b.id} className="flex items-center justify-between gap-3 py-2.5 text-sm">
              <span>
                <span className="font-medium">{fechaCorta(b.fecha)}</span>
                <span className="text-rs-muted">{b.hora_desde ? ` · ${b.hora_desde.slice(0, 5)}–${b.hora_hasta?.slice(0, 5)}` : ' · todo el día'}{conSedes ? ` · ${b.sucursal_id ? nombresSede[b.sucursal_id] : 'todas las sedes'}` : ''}{b.motivo ? ` · ${b.motivo}` : ''}</span>
              </span>
              {puedeBloquear && <BorrarBloqueo id={b.id} />}
            </li>
          ))}
        </ul>
      </Seccion>}

      {cfgRes && (
        <Seccion id="tipos" i={n++} titulo="Tipos de reserva" texto="Los tipos que se ofrecen al cargar una reserva y en el sitio de reservas (Común, Cumpleaños, Cena show…). Cambiás el nombre, el orden y cuáles están activos.">
          <div className="mt-3">{sedeAmb ? <ConfigTiposSede key={sedeAmb.id} sedeId={sedeAmb.id} base={filasTipos.filter((t) => !t.sinConfigurar)} overrides={ovSede?.tipos ?? {}} hoy={hoy} /> : <ConfigTiposReserva inicial={filasTipos} hoy={hoy} />}</div>
        </Seccion>
      )}

      {cfgRes && (
        <Seccion id="confirmacion" i={n++} titulo="Confirmación de reservas" texto="Si las reservas que llegan por el sitio o el bot se confirman solas o quedan en “Nuevas” para que un asesor las confirme, y las excepciones (por cantidad de personas, tipo de reserva, fechas o días).">
          <div className="mt-3">{sedeAmb ? <ConfigConfirmacionSede key={sedeAmb.id} sedeId={sedeAmb.id} nombreSede={sedeAmb.nombre} defectoNegocio={confDefecto} valor={ovSede?.estado_inicial ?? null} reglas={confReglas.filter((r) => r.sucursal_id === sedeAmb.id)} tipos={filasTipos.map((t) => ({ value: t.clave, label: t.etiqueta }))} /> : <ConfigConfirmacion defectoInicial={confDefecto} inicial={confReglas} sedes={ctx.sedesTodas.filter((x) => x.activa).map((x) => ({ id: x.id, nombre: x.nombre }))} tipos={filasTipos.map((t) => ({ value: t.clave, label: t.etiqueta }))} hoy={hoy} />}</div>
        </Seccion>
      )}

      {cfgRes && (
        <Seccion id="parametros" i={n++} titulo="Parámetros de reservas" texto="Cuándo avisar que el aforo se llena, los turnos del plano y qué reservas ocupan una mesa en el sitio.">
          <div className="mt-3"><ConfigParametrosReservas key={sedeAmb?.id ?? 'negocio'} config={cfgRes} usaMesas={mods.mesas} sede={sedeAmb ? { id: sedeAmb.id, pisado: paramsPisados(ovSede) } : undefined} /></div>
        </Seccion>
      )}

      {webCfg && (
        <Seccion id="reservas-web" i={n++} titulo="Sitio de reservas (prueba)" texto="Una página pública para que los clientes reserven solos, eligiendo su mesa en el plano o dejando que un asesor la elija. Usa tus ubicaciones, aforo, fechas bloqueadas y planos de mesas.">
          <div className="mt-3">{sedeAmb && sedesWeb.find((x) => x.id === sedeAmb.id) ? <ReservasWebSede key={sedeAmb.id} sede={sedesWeb.find((x) => x.id === sedeAmb.id)!} config={{ ...webCfg, ...(ovSede?.web ?? {}) } as ConfigReservasWeb} pisados={Object.fromEntries(GRUPOS_WEB.map((g) => [g.id, grupoPisado(ovSede, g.id)]))} slug={negocio.slug} tiposDisponibles={webTipos} /> : <ReservasWebConfig config={webCfg} tieneWhatsapp={!!negocio.whatsapp_nro || sedesWeb.some((x) => !!x.whatsapp)} sedes={sedesWeb} slug={negocio.slug} tiposDisponibles={webTipos} horariosSugeridos={webHorarios} />}</div>
        </Seccion>
      )}

      {webCfg && (
        <Seccion id="mensajes-bot" i={n++} titulo="Mensajes del bot" texto="Lo que el bot le contesta al cliente cuando llega su solicitud de reserva del sitio. Usa el texto original hasta que escribas el tuyo.">
          <div className="mt-3"><ConfigMensajesBot key={sedeAmb?.id ?? 'negocio'} mensajes={MENSAJES_BOT} originales={sedeAmb ? { ...mensajesOriginales, ...mensajesPropios } : mensajesOriginales} propios={sedeAmb ? ovSede?.mensajes ?? {} : mensajesPropios} sedeId={sedeAmb?.id} /></div>
        </Seccion>
      )}

      {mods.reservas && ctx.puedeAdministrar && (
        <Seccion id="ubicaciones" i={n++} titulo="Ubicaciones" texto="Zonas del local para elegir al cargar una reserva (ej. interior, exterior). También sirven para las reglas de aforo.">
          <div className="mt-3"><UbicacionesPanel ubicaciones={(ubicaciones ?? []).filter((u) => !sedeAmb || !u.sucursal_id || u.sucursal_id === sedeAmb.id)} sedes={sedeAmb ? [{ id: sedeAmb.id, nombre: sedeAmb.nombre }] : sedesAsignables} puedeTodas={ctx.sinRestriccionSede && !sedeAmb} /></div>
        </Seccion>
      )}

      {ctx.esSuperadmin && !esSede && (
        <Seccion id="funciones" i={n++} borde="border-rs-lime/30" titulo={<>Funciones del negocio <span className="ml-2 rounded-full bg-rs-raised px-2 py-0.5 text-[10px] normal-case tracking-normal text-rs-lime">solo superadmin</span></>}>
          <FuncionesForm apagadoBot={ctx.tieneApagadoBot} />
          <BotconversaForm activo={bc.activo} tieneClave={bc.tieneClave} />
          {webhook && (
            <AvisosForm
              config={webhook}
              sedes={ctx.sedesTodas.filter((x) => x.activa).map((x) => {
                const w = webhook.sedes[x.id]
                return { id: x.id, nombre: x.nombre, propio: !!w, destino: w?.destino ?? webhook.destino, url: w?.url ?? '', tieneSecreto: !!w?.tieneSecreto, estados: w?.estados ?? webhook.estados }
              })}
            />
          )}
          <ModulosForm modulos={ctx.modulosNegocio} />
          <ModulosSedesForm sedes={ctx.sedesTodas.filter((x) => x.activa).map((x) => ({ id: x.id, nombre: x.nombre }))} modulosNegocio={ctx.modulosNegocio} configSedes={ctx.configSedes} />
        </Seccion>
      )}

      {ctx.puedeAdministrar && !esSede && (
        <Seccion id="etiquetas" i={n++} titulo="Etiquetas de clientes" texto={bc.activo ? 'Las etiquetas vienen de BotConversa: al etiquetar un cliente también se aplica allá.' : 'Se usan para clasificar clientes y hacer seguimiento (por ejemplo, post visita).'}>
          <EtiquetasConfig etiquetas={etiquetas} puedeAdministrar={ctx.puedeAdministrar} esBotconversa={bc.activo} />
        </Seccion>
      )}

      {ctx.tieneApagadoBot && ctx.puedeAdministrar && !esSede && (
        <Seccion id="pausas" i={n++} titulo="Pausa automática de chats" texto="Cuánto tiempo queda pausado un chat que el bot derivó a una persona, antes de que el bot vuelva a atenderlo. También podés dejarlo indefinido y reactivarlo a mano desde la pestaña Chats pausados.">
          <PausaAutoForm config={leerPausaAuto(ctx.negocio.modulos)} />
        </Seccion>
      )}

      {ctx.puedeAdministrar && !esSede && (
        <section id="usuarios" className="reveal scroll-mt-32" style={{ ['--i' as string]: n++ }}>
          <h2 className="card-title mb-3">Usuarios del negocio</h2>
          <GestionUsuarios
            usuarios={usuarios}
            negocios={[{ id: negocio.id, nombre: negocio.nombre }]}
            sedesPorNegocio={{ [negocio.id]: sedesAsignables }} nombresSede={nombresSede}
            modo="negocio" negocioActual={negocio.id} esSuperadmin={ctx.esSuperadmin} miRol={ctx.rol} yoId={ctx.userId}
          />
        </section>
      )}
    </div>
  )
}
