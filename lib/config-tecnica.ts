import 'server-only'
import type { Contexto } from '@/lib/context'
import { normalizarMarca } from '@/lib/marca'

/** Mensaje para quien intenta cambiar algo de todo el negocio teniendo acceso solo a algunas sedes (sin nombrar las que no ve). */
export const MSG_ALCANCE = 'Esta configuración es de todo el negocio y tu usuario no tiene acceso a ella.'

/** Null si el usuario puede cambiar la configuración de todo el negocio (no tiene sedes limitadas); si no, el mensaje de error. */
export const falloAlcance = (ctx: Contexto): string | null => (ctx.sinRestriccionSede ? null : MSG_ALCANCE)

/** ¿La sede está dentro de lo que el usuario puede administrar? */
export const sedeEnAlcance = (ctx: Contexto, id: string | null | undefined): boolean => !!id && ctx.sedesGestion.some((s) => s.id === id)

/**
 * Los ajustes técnicos del sitio de reservas (modo de prueba, cuánto espera la solicitud, el texto del WhatsApp y la marca) los cambia solo el superadmin.
 * Para cualquier otro usuario, el formulario no los trae: se completan con lo que ya está guardado para que el guardado no los pise.
 */
export async function conservarTecnicosWeb(ctx: Contexto, fd: FormData): Promise<void> {
  if (ctx.esSuperadmin) return
  const { data } = await ctx.supabase.from('reservas_web_config').select('modo_prueba, validez_horas, texto_whatsapp, marca').eq('negocio_id', ctx.negocio.id).maybeSingle()
  const m = normalizarMarca(data?.marca)
  fd.set('modo_prueba', (data?.modo_prueba ?? true) ? 'on' : '')
  fd.set('validez_horas', String(data?.validez_horas ?? 48))
  fd.set('texto_whatsapp', (data?.texto_whatsapp as string | null) ?? '')
  fd.set('marca_logo_url', m.logo_url ?? ''); fd.set('marca_ornamento_url', m.ornamento_url ?? ''); fd.set('marca_color_fondo', m.color_fondo ?? ''); fd.set('marca_color_acento', m.color_acento ?? '')
  fd.set('marca_lema', m.lema ?? ''); fd.set('marca_logo_forma', m.logo_forma ?? '')
}

/** Lo mismo para el sitio de UNA sede: dirección propia, validez de la solicitud, texto del WhatsApp y marca. */
export async function conservarTecnicosSede(ctx: Contexto, fd: FormData, sedeId: string): Promise<void> {
  if (ctx.esSuperadmin) return
  const web = (ctx.configSedes[sedeId]?.web ?? {}) as Record<string, unknown>
  const sede = ctx.sedesTodas.find((s) => s.id === sedeId)
  fd.set('alias_web', sede?.alias_web ?? '')
  const { data } = await ctx.supabase.from('reservas_web_config').select('validez_horas').eq('negocio_id', ctx.negocio.id).maybeSingle()
  fd.set('validez_horas', String(typeof web.validez_horas === 'number' ? web.validez_horas : (data?.validez_horas ?? 48)))
  fd.set('texto_whatsapp', typeof web.texto_whatsapp === 'string' ? web.texto_whatsapp : '')
  const m = normalizarMarca(web.marca)
  fd.set('ov_marca', 'marca' in web ? 'on' : '')
  fd.set('marca_logo_url', m.logo_url ?? ''); fd.set('marca_ornamento_url', m.ornamento_url ?? ''); fd.set('marca_color_fondo', m.color_fondo ?? ''); fd.set('marca_color_acento', m.color_acento ?? '')
  fd.set('marca_lema', m.lema ?? ''); fd.set('marca_logo_forma', m.logo_forma ?? '')
}
