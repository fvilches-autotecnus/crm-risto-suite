import ConfigIndex from '@/components/config-index'
import GestionUsuarios from '@/components/usuarios-ui'
import { getContexto } from '@/lib/context'
import { webhookCliente } from '@/lib/notify'
import { fechaCorta, hoyEn } from '@/lib/fechas'
import type { UsuarioUI } from '@/lib/roles'
import { AforoForm, AvisosForm, BloqueoForm, BorrarBloqueo, FuncionesForm, ModulosForm, PausaAutoForm, ReglasPanel, SedesPanel, UbicacionesPanel } from './forms'
import { BotconversaForm, EtiquetasConfig, type EtiquetaConfig } from '@/components/etiquetas-ui'
import { integracionBC } from '@/lib/etiquetas'
import { leerPausaAuto } from '@/lib/pausas'

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

export default async function ConfiguracionPage() {
  const ctx = await getContexto()
  // las consultas propias de esta pantalla se lanzan juntas con las demás (cada una es un viaje a la base)
  const pWebhook = ctx.esSuperadmin ? webhookCliente(ctx.negocio.id) : Promise.resolve(null)
  const pBc = integracionBC(ctx.negocio.id)
  const pEtiquetas = ctx.puedeAdministrar ? ctx.supabase.from('etiquetas').select('id, nombre, bc_tag_id, cliente_etiquetas(count)').eq('negocio_id', ctx.negocio.id).order('nombre') : Promise.resolve({ data: [] })
  const { supabase, negocio, sede } = ctx
  const hoy = hoyEn(negocio.zona_horaria)
  const conSedes = ctx.sedesTodas.length > 0

  let bq = supabase.from('fechas_bloqueadas_reservas').select('id, fecha, hora_desde, hora_hasta, motivo, sucursal_id').eq('negocio_id', negocio.id).gte('fecha', hoy)
  if (sede) bq = bq.or(`sucursal_id.is.null,sucursal_id.eq.${sede.id}`)
  const nombresSede = Object.fromEntries(ctx.sedesTodas.map((x) => [x.id, x.nombre]))

  const [{ data: bloqueos }, { data: ubicaciones }, { data: reglas }, { data: miembros }] = await Promise.all([
    bq.order('fecha'),
    supabase.from('ubicaciones').select('id, nombre, sucursal_id').eq('negocio_id', negocio.id).eq('activo', true).order('orden').order('nombre'),
    ctx.puedeAdministrar ? supabase.from('aforos').select('id, sucursal_id, ubicacion, hora_desde, hora_hasta, maximo').eq('negocio_id', negocio.id).order('creado_en') : Promise.resolve({ data: [] }),
    ctx.puedeAdministrar
      ? supabase.from('membresias').select('user_id, rol, activo, sucursal_ids, perfiles(id, usuario, nombre, activo, es_superadmin)').eq('negocio_id', negocio.id)
      : Promise.resolve({ data: null }),
  ])

  const [webhook, bc, { data: etiquetasDb }] = await Promise.all([pWebhook, pBc, pEtiquetas])
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
    { id: 'negocio', label: 'Negocio' },
    ...(muestraSedes ? [{ id: 'sedes', label: 'Sedes' }] : []),
    ...(ctx.modulosActivos.reservas ? [{ id: 'aforo', label: 'Aforo' }, { id: 'bloqueos', label: 'Fechas bloqueadas' }] : []),
    ...(ctx.modulosActivos.reservas && ctx.puedeAdministrar ? [{ id: 'ubicaciones', label: 'Ubicaciones' }] : []),
    ...(ctx.esSuperadmin ? [{ id: 'funciones', label: 'Funciones' }] : []),
    ...(ctx.puedeAdministrar ? [{ id: 'etiquetas', label: 'Etiquetas' }] : []),
    ...(ctx.tieneApagadoBot && ctx.puedeAdministrar ? [{ id: 'pausas', label: 'Chats pausados' }] : []),
    ...(ctx.puedeAdministrar ? [{ id: 'usuarios', label: 'Usuarios' }] : []),
  ]

  let n = 0
  return (
    <div className="max-w-4xl space-y-5">
      <ConfigIndex secciones={indice} />

      <Seccion id="negocio" i={n++} titulo="Negocio">
        <dl className="mt-3 grid gap-3 text-sm sm:grid-cols-4">
          <div><dt className="text-xs text-rs-muted">Nombre</dt><dd className="mt-0.5 font-medium">{negocio.nombre}</dd></div>
          <div><dt className="text-xs text-rs-muted">WhatsApp</dt><dd className="mt-0.5 font-medium">{negocio.whatsapp_nro ?? '—'}</dd></div>
          <div><dt className="text-xs text-rs-muted">Horario</dt><dd className="mt-0.5 font-medium">Argentina (GMT-3)</dd></div>
          <div><dt className="text-xs text-rs-muted">Tu rol</dt><dd className="mt-0.5 font-medium">{ctx.rol === 'superadmin' ? 'Superadmin' : ROL[ctx.rol]}</dd></div>
        </dl>
      </Seccion>

      {muestraSedes && (
        <Seccion id="sedes" i={n++} titulo="Sedes" texto='Cada sede tiene su aforo, sus fechas bloqueadas y su WhatsApp. Los usuarios pueden limitarse a una o más sedes desde "Usuarios".'>
          <div className="mt-3"><SedesPanel sedes={ctx.sedesGestion} puedeCrear={ctx.sinRestriccionSede} /></div>
        </Seccion>
      )}

      {ctx.modulosActivos.reservas && <Seccion id="aforo" i={n++} titulo="Aforo" texto="Se muestra en el dashboard, avisa al llegar al 90% y advierte al cargar una reserva que supera el cupo (se puede guardar igual).">
        <h3 className="mt-4 text-sm font-semibold">{conSedes ? 'Total por día del negocio' : 'Total por día'}</h3>
        <p className="text-xs text-rs-muted">Máximo de personas con reserva (nueva o confirmada) en un mismo día.{conSedes ? ' Lo usan las sedes que no tienen un total propio.' : ''}</p>
        <AforoForm aforo={negocio.aforo_maximo_reservas} puedeEditar={ctx.puedeAdministrar} />
        {ctx.puedeAdministrar && (
          <>
            <h3 className="mt-6 text-sm font-semibold">Reglas por franja horaria y ubicación</h3>
            <p className="mb-2 text-xs text-rs-muted">Ej.: "INTERIOR de 20:00 a 23:00, máximo 20 personas". Una reserva cuenta en todas las reglas que le corresponden.</p>
            <ReglasPanel reglas={(reglas ?? []) as any} sedes={sedesAsignables} nombresSede={nombresSede} ubicaciones={nombresUbicacion} puedeTodas={ctx.sinRestriccionSede} />
          </>
        )}
      </Seccion>}

      {ctx.modulosActivos.reservas && <Seccion id="bloqueos" i={n++} titulo="Fechas bloqueadas" texto="Días (o franjas horarias) en los que no se aceptan reservas.">
        {puedeBloquear && <BloqueoForm sedes={sedesAsignables} puedeTodas={ctx.sinRestriccionSede} />}
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

      {ctx.modulosActivos.reservas && ctx.puedeAdministrar && (
        <Seccion id="ubicaciones" i={n++} titulo="Ubicaciones" texto="Zonas del local para elegir al cargar una reserva (ej. interior, exterior). También sirven para las reglas de aforo.">
          <div className="mt-3"><UbicacionesPanel ubicaciones={ubicaciones ?? []} sedes={sedesAsignables} puedeTodas={ctx.sinRestriccionSede} /></div>
        </Seccion>
      )}

      {ctx.esSuperadmin && (
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
          <ModulosForm modulos={ctx.modulosActivos} />
        </Seccion>
      )}

      {ctx.puedeAdministrar && (
        <Seccion id="etiquetas" i={n++} titulo="Etiquetas de clientes" texto={bc.activo ? 'Las etiquetas vienen de BotConversa: al etiquetar un cliente también se aplica allá.' : 'Se usan para clasificar clientes y hacer seguimiento (por ejemplo, post visita).'}>
          <EtiquetasConfig etiquetas={etiquetas} puedeAdministrar={ctx.puedeAdministrar} esBotconversa={bc.activo} />
        </Seccion>
      )}

      {ctx.tieneApagadoBot && ctx.puedeAdministrar && (
        <Seccion id="pausas" i={n++} titulo="Pausa automática de chats" texto="Cuánto tiempo queda pausado un chat que el bot derivó a una persona, antes de que el bot vuelva a atenderlo. También podés dejarlo indefinido y reactivarlo a mano desde la pestaña Chats pausados.">
          <PausaAutoForm config={leerPausaAuto(ctx.negocio.modulos)} />
        </Seccion>
      )}

      {ctx.puedeAdministrar && (
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
