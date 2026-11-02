import { Clock, MapPin } from 'lucide-react'
import { fechaLarga, horaCorta } from '@/lib/fechas'
import { modalidadDe, type ModalidadShow } from '@/lib/shows'

/** Lo que muestra la tarjeta de un show (la cartelera pública y el sitio de reservas usan la misma). */
export interface DatosTarjetaShow { titulo: string; descripcion: string | null; img: string | null; hora: string | null; ubicacion: string | null; modalidad: ModalidadShow; enlace: string | null }
interface Boton { clave: string; texto: string; href: string; principal: boolean; externo: boolean }

/**
 * Los botones que corresponden al show según cómo se reserva o se entra:
 * reserva de mesa → “Reservar mesa” (solo si hay a dónde mandar: `reservarHref`) y, si trae enlace, “Comprar entradas” como botón secundario;
 * reservas con otra producción / solo entradas → un botón principal que lleva al enlace.
 */
export function botonesShow(s: Pick<DatosTarjetaShow, 'modalidad' | 'enlace'>, reservarHref: string | null): Boton[] {
  const m = modalidadDe(s.modalidad), r: Boton[] = []
  if (s.modalidad === 'reserva') {
    if (reservarHref) r.push({ clave: 'reservar', texto: m.boton, href: reservarHref, principal: true, externo: false })
    if (s.enlace) r.push({ clave: 'entradas', texto: 'Comprar entradas', href: s.enlace, principal: false, externo: true })
  } else if (s.enlace) r.push({ clave: s.modalidad, texto: m.boton, href: s.enlace, principal: true, externo: true })
  return r
}

/**
 * Tarjeta de un show. En la cartelera (`fecha` + `reservarHref`) muestra el día y el botón de reservar;
 * en el sitio de reservas (`aviso`) va con marco, el aviso “Ese día hay show” y sin fecha (el cliente ya eligió el día).
 */
export function TarjetaShow({ show: s, fecha, reservarHref = null, aviso }: { show: DatosTarjetaShow; fecha?: string; reservarHref?: string | null; aviso?: string }) {
  const enSitio = !!aviso
  const botones = botonesShow(s, reservarHref)
  const clase = 'inline-flex items-center justify-center rounded-rs font-semibold transition ' + (enSitio ? 'h-9 px-3.5 text-sm' : 'h-10 px-4 text-sm')
  return (
    <div {...(enSitio ? { 'data-show-dia': s.titulo } : { 'data-show': s.titulo })} className={enSitio ? 'overflow-hidden rounded-md border border-rs-lime/30 bg-rs-raised/40' : 'card overflow-hidden'}>
      {s.img && /* eslint-disable-next-line @next/next/no-img-element */ <img src={s.img} alt={s.titulo} loading="lazy" className="aspect-video w-full object-cover" />}
      <div className={enSitio ? 'space-y-2 p-3' : 'p-4'}>
        {aviso && <span className="badge bg-rs-lime/15 text-rs-lime">{aviso}</span>}
        {enSitio ? <h3 className="text-base font-bold">{s.titulo}</h3> : <h2 className="text-lg font-bold">{s.titulo}</h2>}
        <p className={'flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-rs-muted ' + (enSitio ? '' : 'mt-1')}>
          {fecha && <span className="capitalize">{fechaLarga(fecha)}</span>}
          {s.hora && <span className="inline-flex items-center gap-1"><Clock size={13} />{horaCorta(s.hora)} hs</span>}
          <span className="inline-flex items-center gap-1"><MapPin size={13} />{s.ubicacion ?? 'Todo el local'}</span>
        </p>
        {s.descripcion && <p className={'whitespace-pre-line text-sm ' + (enSitio ? '' : 'mt-3')}>{s.descripcion}</p>}
        {botones.length > 0 && (
          <div className={'flex flex-wrap gap-2 ' + (enSitio ? '' : 'mt-4')}>
            {botones.map((b) => (
              <a key={b.clave} data-boton={b.clave} href={b.href} {...(b.externo ? { target: '_blank', rel: 'noopener noreferrer' } : {})}
                className={`${clase} ${b.principal ? 'bg-rs-lime text-rs-on-lime' : 'border border-rs-control hover:border-rs-lime/50 hover:text-rs-lime'}`}>{b.texto}</a>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
