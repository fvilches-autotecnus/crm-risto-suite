import { getContexto } from '@/lib/context'
import { hoyEn } from '@/lib/fechas'
import { AforoForm, BloqueoForm, BorrarBloqueo } from './forms'
import { fechaCorta } from '@/lib/fechas'

const ROL: Record<string, string> = { owner: 'Dueño', admin: 'Administrador', encargado: 'Encargado', staff: 'Staff', solo_lectura: 'Solo lectura' }

export default async function ConfiguracionPage() {
  const ctx = await getContexto()
  const { supabase, negocio } = ctx
  const hoy = hoyEn(negocio.zona_horaria)

  const [{ data: bloqueos }, { data: miembros }] = await Promise.all([
    supabase.from('fechas_bloqueadas_reservas').select('id, fecha, hora_desde, hora_hasta, motivo').eq('negocio_id', negocio.id).gte('fecha', hoy).order('fecha'),
    ctx.puedeAdministrar
      ? supabase.from('membresias').select('rol, activo, perfiles(usuario, nombre)').eq('negocio_id', negocio.id)
      : Promise.resolve({ data: null }),
  ])

  return (
    <div className="max-w-3xl space-y-6">
      <section className="card p-5">
        <h2 className="card-title">Negocio</h2>
        <dl className="mt-3 grid gap-3 text-sm sm:grid-cols-3">
          <div><dt className="text-xs text-rs-muted">Nombre</dt><dd className="mt-0.5 font-medium">{negocio.nombre}</dd></div>
          <div><dt className="text-xs text-rs-muted">WhatsApp</dt><dd className="mt-0.5 font-medium">{negocio.whatsapp_nro ?? '—'}</dd></div>
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

      {ctx.puedeAdministrar && (
        <section className="card p-5">
          <h2 className="card-title">Usuarios del negocio</h2>
          <ul className="mt-3 divide-y divide-rs-border/60">
            {(miembros ?? []).map((m: any, i: number) => (
              <li key={i} className="flex items-center justify-between py-2.5 text-sm">
                <span><span className="font-medium">{m.perfiles?.nombre}</span> <span className="text-rs-muted">@{m.perfiles?.usuario}</span></span>
                <span className="badge bg-rs-raised text-rs-lime">{ROL[m.rol] ?? m.rol}{m.activo ? '' : ' · inactivo'}</span>
              </li>
            ))}
          </ul>
          <p className="mt-3 text-xs text-rs-muted">Para sumar o quitar usuarios, escribile a Risto Suite.</p>
        </section>
      )}
    </div>
  )
}
