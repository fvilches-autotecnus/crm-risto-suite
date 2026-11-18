import { TZ_AR } from '@/lib/fechas'

/** Zonas horarias que se pueden elegir para un negocio. Solo zonas SIN horario de verano (el sistema calcula con el desfase fijo). */
export const ZONAS_NEGOCIO: { value: string; label: string }[] = [
  { value: TZ_AR, label: 'Argentina (UTC-3)' },
  { value: 'America/Lima', label: 'Perú (UTC-5)' },
  { value: 'America/Bogota', label: 'Colombia (UTC-5)' },
  { value: 'America/Montevideo', label: 'Uruguay (UTC-3)' },
  { value: 'America/Sao_Paulo', label: 'Brasil, São Paulo (UTC-3)' },
  { value: 'America/Mexico_City', label: 'México, Ciudad de México (UTC-6)' },
]
export const esZonaNegocio = (v: string) => ZONAS_NEGOCIO.some((z) => z.value === v)
