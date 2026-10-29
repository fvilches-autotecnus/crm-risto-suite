/** Marca propia del sitio de reservas de un local. Todo es opcional: sin datos, el sitio usa la identidad de Risto Suite. */
export interface Marca { logo_url: string | null; ornamento_url: string | null; color_fondo: string | null; color_acento: string | null; lema: string | null }
export const MARCA_VACIA: Marca = { logo_url: null, ornamento_url: null, color_fondo: null, color_acento: null, lema: null }

const DOMINIO = process.env.CRM_ORIGEN ?? 'https://crm.ristosuite.app'
/** Dirección de este CRM tal como la ve el que abre el sitio (en producción el sitio puede estar publicado en otro dominio). */
export const origenCrm = () => (process.env.VERCEL_ENV === 'production' ? DOMINIO : '')

const RE_URL = /^(https:\/\/|\/)[^\s"'()<>\\]{1,300}$/
const RE_COLOR = /^#[0-9a-f]{6}$/i
export const urlValida = (v: unknown): v is string => typeof v === 'string' && RE_URL.test(v) && !v.startsWith('//')
export const colorValido = (v: unknown): v is string => typeof v === 'string' && RE_COLOR.test(v)
/** Las imágenes propias del CRM (que empiezan con /) se piden con dirección completa para que anden desde cualquier dominio. */
export const urlAbsoluta = (u: string | null) => (u && u.startsWith('/') ? origenCrm() + u : u)

/** Deja solo lo válido de lo que haya guardado (nunca llega a la página algo que no sea una dirección o un color). */
export function normalizarMarca(raw: unknown): Marca {
  const o = (raw && typeof raw === 'object' ? raw : {}) as Record<string, unknown>
  const lema = typeof o.lema === 'string' ? o.lema.trim().slice(0, 120) : ''
  return {
    logo_url: urlValida(o.logo_url) ? o.logo_url : null, ornamento_url: urlValida(o.ornamento_url) ? o.ornamento_url : null,
    color_fondo: colorValido(o.color_fondo) ? o.color_fondo.toLowerCase() : null, color_acento: colorValido(o.color_acento) ? o.color_acento.toLowerCase() : null, lema: lema || null,
  }
}
export const tieneMarca = (m: Marca) => Object.values(m).some(Boolean)

type RGB = [number, number, number]
const aRgb = (h: string): RGB => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16)) as RGB
const mezcla = (a: RGB, b: RGB, t: number): RGB => a.map((v, i) => Math.round(v + (b[i] - v) * t)) as RGB
const NEGRO: RGB = [0, 0, 0], BLANCO: RGB = [255, 255, 255]
const canal = (c: RGB) => c.join(' ')
const luz = (c: RGB) => { const f = (v: number) => { const s = v / 255; return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4 }; return 0.2126 * f(c[0]) + 0.7152 * f(c[1]) + 0.0722 * f(c[2]) }

/**
 * Paleta del sitio a partir de dos colores del local: el del fondo (oscuro) y el de acento (botones y resaltados).
 * Las demás tintas (tarjetas, bordes, texto) salen de mezclarlos, así siempre se leen bien y se mantiene el estilo oscuro de Risto Suite.
 * Devuelve las variables CSS que usa toda la interfaz (rs-*), o null si el local no eligió colores.
 */
export function variablesMarca(m: Marca): Record<string, string> | null {
  if (!m.color_fondo && !m.color_acento) return null
  const v: Record<string, string> = {}
  if (m.color_fondo) {
    let f = aRgb(m.color_fondo)
    while (luz(f) > 0.12) f = mezcla(f, NEGRO, 0.12)   // el fondo siempre oscuro: el texto claro tiene que leerse
    const texto = mezcla(BLANCO, f, 0.06)
    Object.assign(v, {
      '--rs-bg': canal(mezcla(f, NEGRO, 0.3)), '--rs-header': canal(f), '--rs-card': canal(mezcla(f, BLANCO, 0.07)), '--rs-raised': canal(mezcla(f, BLANCO, 0.13)),
      '--rs-border': canal(mezcla(f, BLANCO, 0.17)), '--rs-control': canal(mezcla(f, BLANCO, 0.27)), '--rs-input': canal(mezcla(f, NEGRO, 0.25)),
      '--rs-text': canal(texto), '--rs-muted': canal(mezcla(texto, f, 0.42)),
    })
  }
  if (m.color_acento) {
    let a = aRgb(m.color_acento)
    while (luz(a) < 0.25) a = mezcla(a, BLANCO, 0.12)   // el acento siempre claro: se usa como texto y como botón sobre el fondo oscuro
    v['--rs-lime'] = canal(a)
    v['--rs-on-lime'] = canal(mezcla(m.color_fondo ? aRgb(m.color_fondo) : [13, 20, 0], NEGRO, 0.65))
  }
  return v
}

/** Nombre que encabeza el sitio: el del negocio y, si la dirección es de una sede, el de la sede (sin repetir el del negocio). */
export const nombreSitio = (negocio: string, sede?: string) => {
  if (!sede) return negocio
  const n = (t: string) => t.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()
  return n(sede).includes(n(negocio)) ? sede : `${negocio} ${sede}`
}

/** Lee los campos de marca de un formulario (marca_logo_url, marca_ornamento_url, marca_color_fondo, marca_color_acento, marca_lema). */
export function leerMarca(fd: FormData): { ok: true; marca: Partial<Marca> } | { ok: false; error: string } {
  const g = (k: string) => String(fd.get(k) ?? '').trim()
  const m = { logo_url: g('marca_logo_url'), ornamento_url: g('marca_ornamento_url'), color_fondo: g('marca_color_fondo'), color_acento: g('marca_color_acento'), lema: g('marca_lema') }
  for (const [k, n] of [['logo_url', 'El logo'], ['ornamento_url', 'El adorno']] as const) if (m[k] && !urlValida(m[k])) return { ok: false, error: `${n} tiene que ser una dirección https://… o una ruta que empiece con / (sin espacios ni comillas)` }
  for (const [k, n] of [['color_fondo', 'El color de fondo'], ['color_acento', 'El color de acento']] as const) if (m[k] && !colorValido(m[k])) return { ok: false, error: `${n} va como #RRGGBB (por ejemplo #3a442c)` }
  if (m.lema.length > 120) return { ok: false, error: 'La frase del local puede tener hasta 120 letras' }
  return { ok: true, marca: Object.fromEntries(Object.entries(m).filter(([, v]) => v)) as Partial<Marca> }
}
