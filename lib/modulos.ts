/**
 * Catálogo de módulos del CRM. El superadmin enciende o apaga cada uno por negocio (se guarda en negocios.modulos).
 * Un módulo apagado desaparece del menú, redirige al inicio si se entra por la dirección y no cuenta para las pantallas que lo usan.
 */

export type ModuloClave =
  | 'reservas' | 'shows' | 'carta' | 'pedidos'
  | 'clientes' | 'consultas' | 'cumpleanos' | 'vouchers' | 'resenas' | 'campanas' | 'metricas' | 'derivadas' | 'conversaciones'

export interface ModuloDef {
  clave: ModuloClave
  titulo: string
  texto: string
  grupo: 'Operación' | 'Clientes y marketing' | 'Análisis y bot'
  porDefecto: boolean
  /** Módulos que tienen que estar encendidos para que éste funcione. */
  requiere?: ModuloClave[]
  /** Todavía no tiene pantallas completas: hoy es la carpeta del módulo (se ve como "en preparación"). */
  enPreparacion?: boolean
}

export const MODULOS: ModuloDef[] = [
  { clave: 'reservas', titulo: 'Reservas', texto: 'Reservas de mesas: agenda, aforo, ubicaciones, fechas bloqueadas y avisos al cliente.', grupo: 'Operación', porDefecto: true },
  { clave: 'shows', titulo: 'Shows', texto: 'Shows y eventos del local (cartelera, entradas y cupos).', grupo: 'Operación', porDefecto: false, enPreparacion: true },
  { clave: 'carta', titulo: 'Carta', texto: 'Carta digital: categorías, productos, precios y fotos. Es la base de los pedidos.', grupo: 'Operación', porDefecto: false, enPreparacion: true },
  { clave: 'pedidos', titulo: 'Pedidos', texto: 'Pedidos de los clientes (delivery y retiro) armados desde la carta digital.', grupo: 'Operación', porDefecto: false, requiere: ['carta'], enPreparacion: true },
  { clave: 'clientes', titulo: 'Clientes', texto: 'Base de clientes, su historial, notas y etiquetas.', grupo: 'Clientes y marketing', porDefecto: true },
  { clave: 'consultas', titulo: 'Consultas y reclamos', texto: 'Lo que escriben los clientes por WhatsApp y hay que responder o resolver.', grupo: 'Clientes y marketing', porDefecto: true },
  { clave: 'cumpleanos', titulo: 'Cumpleaños', texto: 'Próximos cumpleaños de clientes y su distribución por mes.', grupo: 'Clientes y marketing', porDefecto: true },
  { clave: 'vouchers', titulo: 'Vouchers', texto: 'Códigos de beneficio y su estado de uso.', grupo: 'Clientes y marketing', porDefecto: true },
  { clave: 'resenas', titulo: 'Reseñas', texto: 'Reseñas conseguidas, puntaje promedio y resumen con IA.', grupo: 'Clientes y marketing', porDefecto: true },
  { clave: 'campanas', titulo: 'Campañas', texto: 'Seguimiento de las campañas de marketing: a quién se mandó cada mensaje (oculto por defecto).', grupo: 'Clientes y marketing', porDefecto: false },
  { clave: 'metricas', titulo: 'Métricas', texto: 'Gráficos de reservas, horarios y clientes recurrentes.', grupo: 'Análisis y bot', porDefecto: true, requiere: ['reservas'] },
  { clave: 'derivadas', titulo: 'Derivadas', texto: 'Reservas que toma el bot pero administra otra producción (oculto por defecto).', grupo: 'Análisis y bot', porDefecto: false, requiere: ['reservas'] },
  { clave: 'conversaciones', titulo: 'Conversaciones', texto: 'Chats del bot de WhatsApp (oculto por defecto).', grupo: 'Análisis y bot', porDefecto: false },
]

export type ModulosActivos = Record<ModuloClave, boolean>

/** Combinaciones frecuentes para configurar un negocio nuevo de un clic. */
export const PRESETS: { id: string; titulo: string; activos: ModuloClave[] }[] = [
  { id: 'reservas', titulo: 'Solo reservas', activos: ['reservas'] },
  { id: 'reservas_shows', titulo: 'Reservas y shows', activos: ['reservas', 'shows'] },
  { id: 'pedidos', titulo: 'Solo pedidos', activos: ['carta', 'pedidos'] },
  { id: 'reservas_pedidos', titulo: 'Reservas y pedidos', activos: ['reservas', 'carta', 'pedidos'] },
  { id: 'todo', titulo: 'Todo', activos: MODULOS.map((m) => m.clave) },
]
/** Módulos que se mantienen en cualquier combinación (los de clientes y marketing que vienen encendidos por defecto). */
export const BASE_PRESET: ModuloClave[] = MODULOS.filter((m) => m.porDefecto && m.clave !== 'reservas' && m.clave !== 'metricas').map((m) => m.clave)

/** Aplica las dependencias: un módulo que necesita a otro apagado queda apagado. */
export function aplicarDependencias(m: ModulosActivos): ModulosActivos {
  const r = { ...m }
  for (let pasada = 0; pasada < 3; pasada++) for (const d of MODULOS) if (r[d.clave] && d.requiere?.some((q) => !r[q])) r[d.clave] = false
  return r
}

/** Lo que está efectivamente activo según lo guardado en negocios.modulos (lo que no está guardado toma su valor por defecto). */
export function resolverModulos(raw: Record<string, unknown> | null | undefined): ModulosActivos {
  const base = {} as ModulosActivos
  for (const d of MODULOS) base[d.clave] = typeof raw?.[d.clave] === 'boolean' ? (raw[d.clave] as boolean) : d.porDefecto
  return aplicarDependencias(base)
}

/** Lee los checkboxes de un formulario (name = clave del módulo). Al guardar, pedidos enciende la carta y apagar reservas apaga lo que depende de ella. */
export function leerModulosForm(fd: FormData): ModulosActivos {
  const m = {} as ModulosActivos
  for (const d of MODULOS) m[d.clave] = fd.get(d.clave) === 'on'
  if (m.pedidos) m.carta = true
  return aplicarDependencias(m)
}

export const clavesModulos = MODULOS.map((m) => m.clave)
