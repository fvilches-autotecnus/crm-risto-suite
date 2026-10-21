import { getContexto } from '@/lib/context'
import { hoyEn } from '@/lib/fechas'
import GestionUsuarios from '@/components/usuarios-ui'
import type { UsuarioUI } from '@/lib/roles'
import { AforoForm, BloqueoForm, BorrarBloqueo, FuncionesForm, SedesPanel, UbicacionesPanel } from './forms'
import { fechaCorta } from '@/lib/fechas'

const ROL: Record<string, string> = { owner: 'Dueño', admin: 'Administrador', encargado: 'Encargado', staff: 'Staff', solo_lectura: 'Solo lectura' }

export default async function ConfiguracionPage() {
  const ctx = await getContexto()
  const { supabase, negocio, sede } = ctx
  const hoy = hoyEn(negocio.zona_horaria)

  let bq = supabase.from('fechas_bloqueadas_reservas').select('id, fecha, hora_desde, hora_hasta, motivo, sucursal_id').eq('negocio_id', negocio.id).gte('fecha', hoy)
  if (sede) bq = bq.or(`sucursal_id.is.null,sucursal_id.eq.${sede.id}`)
  const nombresSede = new Map(ctx.sedesTodas.map((x) => [x.id, x.nombre]))

  const [{ data: bloqueos }, { data: ubicaciones }, { data: miembros }] = await Promise.all([
    bq.order('fecha'),
    supabase.from('ubicaciones').select('id, nombre, sucursal_id').eq('negocio_id', negocio.id).eq('activo', true).order('orden').order('nombre'),
    ctx.puedeAdministrar
      ? supabase.from('membresias').select('user_id, rol, activo, sucursal_ids, perfiles(id, usuario, nombre, activo, es_superadmin)').eq('negocio_id', negocio.id)
      : Promise.resolve({ data: null }),
  ])

  const usuarios: UsuarioUI[] = ((miembros ?? []) as any[]).filter((m) => m.perfiles).map((m) => ({
    id: m.perfiles.id, usuario: m.perfiles.usuario, nombre: m.perfiles.nombre, activo: m.perfiles.activo, es_superadmin: m.perfiles.es_superadmin,
    membresias: [{ negocio_id: negocio.id, negocio_nombre: negocio.nombre, rol: m.rol, activo: m.activo, sucursal_ids: m.sucursal_ids ?? [] }],
  }))

  return (
    <div className="max-w-4xl space-y-6">
      <section className="card p-5">
        <h2 className="card-title">Negocio</h2>
        <dl className="mt-3 grid gap-3 text-sm sm:grid-cols-4">
          <div><dt className="text-xs text-rs-muted">Nombre</dt><dd className="mt-0.5 font-medium">{negocio.nombre}</dd></div>
          <div><dt className="text-xs text-rs-muted">WhatsApp</dt><dd className="mt-0.5 font-medium">{negocio.whatsapp_nro ?? '—'}</dd></div>
          <div><dt className="text-xs text-rs-muted">Horario</dt><dd className="mt-0.5 font-medium">Argentina (GMT-3)</dd></div>
          <div><dt className="text-xs text-rs-muted">Tu rol</dt><dd className="mt-0.5 font-medium">{ctx.rol === 'superadmin' ? 'Superadmin' : ROL[ctx.rol]}</dd></div>
        </dl>
      </section>

      <section className="card p-5">
        <h2 className="card-title">{ctx.sedesTodas.length > 0 ? 'Aforo general del negocio' : 'Aforo máximo por día'}</h2>
        <p className="mt-1 text-sm text-rs-muted">Cantidad máxima de personas con reserva confirmada en un mismo día. Se muestra en el dashboard y alerta al llegar al 90%.{ctx.sedesTodas.length > 0 ? ' Lo usan las sedes que no tienen un aforo propio.' : ''}</p>
        <AforoForm aforo={negocio.aforo_maximo_reservas} puedeEditar={ctx.puedeAdministrar} />
      </section>

      <section className="card p-5">
        <h2 className="card-title">Fechas bloqueadas</h2>
        <p className="mt-1 text-sm text-rs-muted">Días (o franjas horarias) en los que no se aceptan reservas.</p>
        {(ctx.puedeAdministrar || ctx.rol === 'encargado') && <BloqueoForm sedes={ctx.sedes.map((x) => ({ id: x.id, nombre: x.nombre }))} puedeTodas={ctx.sinRestriccionSede} />}
        <ul className="mt-4 divide-y divide-rs-border/60">
          {(bloqueos ?? []).length === 0 && <li className="py-3 text-sm text-rs-muted">No hay fechas bloqueadas próximas.</li>}
          {(bloqueos ?? []).map((b) => (
            <li key={b.id} className="flex items-center justify-between gap-3 py-2.5 text-sm">
              <span>
                <span className="font-medium">{fechaCorta(b.fecha)}</span>
                <span className="text-rs-muted">{b.hora_desde ? ` · ${b.hora_desde.slice(0, 5)}–${b.hora_hasta?.slice(0, 5)}` : ' · todo el día'}{ctx.sedesTodas.length > 0 ? ` · ${b.sucursal_id ? nombresSede.get(b.sucursal_id) : 'todas las sedes'}` : ''}{b.motivo ? ` · ${b.motivo}` : ''}</span>
              </span>
              {(ctx.puedeAdministrar || ctx.rol === 'encargado') && <BorrarBloqueo id={b.id} />}
            </li>
          ))}
        </ul>
      </section>

      {ctx.puedeAdministrar && (ctx.sedesTodas.length > 0 || ctx.esSuperadmin) && (
        <section id="sedes" className="card scroll-mt-4 p-5">
          <h2 className="card-title">Sedes</h2>
          <p className="mt-1 text-sm text-rs-muted">Cada sede tiene su aforo, sus fechas bloqueadas y su WhatsApp. Los usuarios pueden limitarse a una o más sedes desde "Usuarios del negocio".</p>
          <div className="mt-3"><SedesPanel sedes={ctx.sedesGestion} puedeCrear={ctx.sinRestriccionSede} /></div>
        </section>
      )}

      {ctx.puedeAdministrar && (
        <section className="card p-5">
          <h2 className="card-title">Ubicaciones</h2>
          <p className="mt-1 text-sm text-rs-muted">Zonas del local para elegir al cargar una reserva (ej. interior, exterior).</p>
          <div className="mt-3"><UbicacionesPanel ubicaciones={ubicaciones ?? []} sedes={ctx.sedes.map((x) => ({ id: x.id, nombre: x.nombre }))} puedeTodas={ctx.sinRestriccionSede} /></div>
        </section>
      )}

      {ctx.esSuperadmin && (
        <section className="card border-rs-lime/30 p-5">
          <h2 className="card-title">Funciones del negocio <span className="ml-2 rounded-full bg-rs-raised px-2 py-0.5 text-[10px] normal-case tracking-normal text-rs-lime">solo superadmin</span></h2>
          <FuncionesForm apagadoBot={ctx.tieneApagadoBot} />
        </section>
      )}

      {ctx.puedeAdministrar && (
        <section>
          <h2 className="card-title mb-3">Usuarios del negocio</h2>
          <GestionUsuarios
            usuarios={usuarios}
            negocios={[{ id: negocio.id, nombre: negocio.nombre }]}
            sedesPorNegocio={{ [negocio.id]: ctx.sedes.map((x) => ({ id: x.id, nombre: x.nombre })) }} nombresSede={Object.fromEntries(ctx.sedesTodas.map((x) => [x.id, x.nombre]))}
            modo="negocio" negocioActual={negocio.id} esSuperadmin={ctx.esSuperadmin} miRol={ctx.rol} yoId={ctx.userId}
          />
        </section>
      )}
    </div>
  )
}
