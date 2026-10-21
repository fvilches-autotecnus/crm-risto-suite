import { getContexto } from '@/lib/context'
import { hoyEn } from '@/lib/fechas'
import GestionUsuarios from '@/components/usuarios-ui'
import type { UsuarioUI } from '@/lib/roles'
import { AforoForm, BloqueoForm, BorrarBloqueo, FuncionesForm } from './forms'
import { fechaCorta } from '@/lib/fechas'

const ROL: Record<string, string> = { owner: 'Dueño', admin: 'Administrador', encargado: 'Encargado', staff: 'Staff', solo_lectura: 'Solo lectura' }

export default async function ConfiguracionPage() {
  const ctx = await getContexto()
  const { supabase, negocio } = ctx
  const hoy = hoyEn(negocio.zona_horaria)

  const [{ data: bloqueos }, { data: miembros }] = await Promise.all([
    supabase.from('fechas_bloqueadas_reservas').select('id, fecha, hora_desde, hora_hasta, motivo').eq('negocio_id', negocio.id).gte('fecha', hoy).order('fecha'),
    ctx.puedeAdministrar
      ? supabase.from('membresias').select('user_id, rol, activo, perfiles(id, usuario, nombre, activo, es_superadmin)').eq('negocio_id', negocio.id)
      : Promise.resolve({ data: null }),
  ])

  const usuarios: UsuarioUI[] = ((miembros ?? []) as any[]).filter((m) => m.perfiles).map((m) => ({
    id: m.perfiles.id, usuario: m.perfiles.usuario, nombre: m.perfiles.nombre, activo: m.perfiles.activo, es_superadmin: m.perfiles.es_superadmin,
    membresias: [{ negocio_id: negocio.id, negocio_nombre: negocio.nombre, rol: m.rol, activo: m.activo }],
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
        <h2 className="card-title">Aforo máximo por día</h2>
        <p className="mt-1 text-sm text-rs-muted">Cantidad máxima de personas con reserva confirmada en un mismo día. Se muestra en el dashboard y alerta al llegar al 90%.</p>
        <AforoForm aforo={negocio.aforo_maximo_reservas} puedeEditar={ctx.puedeAdministrar} />
      </section>

      <section className="card p-5">
        <h2 className="card-title">Fechas bloqueadas</h2>
        <p className="mt-1 text-sm text-rs-muted">Días (o franjas horarias) en los que no se aceptan reservas.</p>
        {(ctx.puedeAdministrar || ctx.rol === 'encargado') && <BloqueoForm />}
        <ul className="mt-4 divide-y divide-rs-border/60">
          {(bloqueos ?? []).length === 0 && <li className="py-3 text-sm text-rs-muted">No hay fechas bloqueadas próximas.</li>}
          {(bloqueos ?? []).map((b) => (
            <li key={b.id} className="flex items-center justify-between gap-3 py-2.5 text-sm">
              <span>
                <span className="font-medium">{fechaCorta(b.fecha)}</span>
                <span className="text-rs-muted">{b.hora_desde ? ` · ${b.hora_desde.slice(0, 5)}–${b.hora_hasta?.slice(0, 5)}` : ' · todo el día'}{b.motivo ? ` · ${b.motivo}` : ''}</span>
              </span>
              {(ctx.puedeAdministrar || ctx.rol === 'encargado') && <BorrarBloqueo id={b.id} />}
            </li>
          ))}
        </ul>
      </section>

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
            modo="negocio" negocioActual={negocio.id} esSuperadmin={ctx.esSuperadmin} miRol={ctx.rol} yoId={ctx.userId}
          />
        </section>
      )}
    </div>
  )
}
