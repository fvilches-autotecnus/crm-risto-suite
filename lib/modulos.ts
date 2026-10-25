/**
 * Catálogo de módulos del CRM. El superadmin enciende o apaga cada uno por negocio (se guarda en negocios.modulos).
 * Un módulo apagado desaparece del menú y redirige al inicio si se entra por la dirección. Los módulos son independientes:
 * algunos "convienen" con otros (se encienden juntos por defecto y se explica por qué), pero nada obliga a tenerlos todos.
 */

export type ModuloClave =
  | 'reservas' | 'shows' | 'carta' | 'pedidos'
  | 'clientes' | 'consultas' | 'cumpleanos' | 'vouchers' | 'resenas' | 'fidelizacion' | 'campanas' | 'metricas' | 'derivadas' | 'conversaciones'

export interface ModuloDef {
  clave: ModuloClave
  titulo: string
  texto: string
  grupo: 'Operación' | 'Clientes y marketing' | 'Análisis y bot'
  porDefecto: boolean
  /** Módulos con los que conviene tenerlo: al encenderlo se encienden juntos, pero cada uno se puede sacar (no es obligatorio). */
  conviene?: { con: ModuloClave[]; porque: string }
  /** Todavía no tiene pantallas completas: hoy es la carpeta del módulo (se ve como "en preparación"). */
  enPreparacion?: boolean
}

export const MODULOS: ModuloDef[] = [
  { clave: 'reservas', titulo: 'Reservas', texto: 'Reservas de mesas: agenda, aforo, ubicaciones, fechas bloqueadas y avisos al cliente.', grupo: 'Operación', porDefecto: true },
  { clave: 'shows', titulo: 'Shows', texto: 'Shows y eventos del local (cartelera, entradas y cupos).', grupo: 'Operación', porDefecto: false, conviene: { con: ['reservas'], porque: 'los shows se llenan con reservas de mesa; sin Reservas solo podrías mostrar la cartelera.' }, enPreparacion: true },
  { clave: 'carta', titulo: 'Carta', texto: 'Carta digital: categorías, productos, precios y fotos. Sirve para que los clientes vean el menú (con o sin pedidos) y es la base de los pedidos.', grupo: 'Operación', porDefecto: false },
  { clave: 'pedidos', titulo: 'Pedidos', texto: 'Pedidos de los clientes (delivery y retiro) armados desde la carta digital.', grupo: 'Operación', porDefecto: false, conviene: { con: ['carta'], porque: 'los pedidos se arman eligiendo productos de la carta; sin carta cada pedido habría que escribirlo a mano y no habría precios ni disponibilidad.' }, enPreparacion: true },
  { clave: 'clientes', titulo: 'Clientes', texto: 'Base de clientes, su historial, notas y etiquetas.', grupo: 'Clientes y marketing', porDefecto: true },
  { clave: 'consultas', titulo: 'Consultas y reclamos', texto: 'Lo que escriben los clientes por WhatsApp y hay que responder o resolver.', grupo: 'Clientes y marketing', porDefecto: true },
  { clave: 'cumpleanos', titulo: 'Cumpleaños', texto: 'Próximos cumpleaños de clientes y su distribución por mes.', grupo: 'Clientes y marketing', porDefecto: true, conviene: { con: ['clientes'], porque: 'el cumpleaños se guarda en la ficha de cada cliente.' } },
  { clave: 'vouchers', titulo: 'Vouchers', texto: 'Códigos de beneficio y su estado de uso.', grupo: 'Clientes y marketing', porDefecto: true, conviene: { con: ['clientes'], porque: 'cada voucher se asocia a un cliente y se ve en su ficha.' } },
  { clave: 'resenas', titulo: 'Reseñas', texto: 'Reseñas conseguidas, puntaje promedio y resumen con IA.', grupo: 'Clientes y marketing', porDefecto: true, conviene: { con: ['clientes'], porque: 'cada reseña se asocia a un cliente y se ve en su ficha.' } },
  { clave: 'fidelizacion', titulo: 'Fidelización', texto: 'Premia a los clientes que vuelven: un voucher automático al llegar a cierta cantidad de visitas.', grupo: 'Clientes y marketing', porDefecto: false, conviene: { con: ['reservas', 'clientes', 'vouchers'], porque: 'las visitas salen de las reservas, los premios se asignan a la ficha del cliente y se entregan como vouchers.' } },
  { clave: 'campanas', titulo: 'Campañas', texto: 'Seguimiento de las campañas de marketing: a quién se mandó cada mensaje (oculto por defecto).', grupo: 'Clientes y marketing', porDefecto: false, conviene: { con: ['clientes'], porque: 'las campañas registran a qué clientes se les mandó cada mensaje.' } },
  { clave: 'metricas', titulo: 'Métricas', texto: 'Gráficos de reservas, horarios y clientes recurrentes.', grupo: 'Análisis y bot', porDefecto: true, conviene: { con: ['reservas'], porque: 'las métricas se calculan con las reservas: sin ellas los gráficos quedan vacíos.' } },
  { clave: 'derivadas', titulo: 'Derivadas', texto: 'Reservas que toma el bot pero administra otra producción (oculto por defecto).', grupo: 'Análisis y bot', porDefecto: false, conviene: { con: ['reservas'], porque: 'son reservas que toma el bot: sin el módulo de Reservas no hay con qué relacionarlas.' } },
  { clave: 'conversaciones', titulo: 'Conversaciones', texto: 'Chats del bot de WhatsApp (oculto por defecto).', grupo: 'Análisis y bot', porDefecto: false },
]

export type ModulosActivos = Record<ModuloClave, boolean>

/** Combinaciones frecuentes para configurar un negocio nuevo de un clic. */
export const PRESETS: { id: string; titulo: string; activos: ModuloClave[] }[] = [
  { id: 'reservas', titulo: 'Solo reservas', activos: ['reservas'] },
  { id: 'reservas_carta', titulo: 'Reservas con carta', activos: ['reservas', 'carta'] },
  { id: 'reservas_shows', titulo: 'Reservas y shows', activos: ['reservas', 'shows'] },
  { id: 'carta', titulo: 'Solo carta (menú digital)', activos: ['carta'] },
  { id: 'pedidos', titulo: 'Solo pedidos', activos: ['carta', 'pedidos'] },
  { id: 'reservas_pedidos', titulo: 'Reservas y pedidos', activos: ['reservas', 'carta', 'pedidos'] },
  { id: 'todo', titulo: 'Todo', activos: MODULOS.map((m) => m.clave) },
]
/** Módulos que se mantienen en los atajos (los de clientes y marketing que vienen encendidos por defecto). */
export const BASE_PRESET: ModuloClave[] = MODULOS.filter((m) => m.porDefecto && m.grupo === 'Clientes y marketing').map((m) => m.clave)

/** Al encender un módulo, también se encienden los módulos con los que conviene (el usuario puede volver a apagarlos). */
export function conSugeridos(m: ModulosActivos, clave: ModuloClave): ModulosActivos {
  const r = { ...m, [clave]: true }
  for (const q of MODULOS.find((d) => d.clave === clave)?.conviene?.con ?? []) r[q] = true
  return r
}

/** Lo que está efectivamente activo según lo guardado en negocios.modulos (lo que no está guardado toma su valor por defecto). */
export function resolverModulos(raw: Record<string, unknown> | null | undefined): ModulosActivos {
  const base = {} as ModulosActivos
  for (const d of MODULOS) base[d.clave] = typeof raw?.[d.clave] === 'boolean' ? (raw[d.clave] as boolean) : d.porDefecto
  return base
}

/** Lee los checkboxes de un formulario (name = clave del módulo). Cada módulo es independiente: se guarda exactamente lo que se marcó. */
export function leerModulosForm(fd: FormData): ModulosActivos {
  const m = {} as ModulosActivos
  for (const d of MODULOS) m[d.clave] = fd.get(d.clave) === 'on'
  return m
}

export const clavesModulos = MODULOS.map((m) => m.clave)
