import type { ModuloClave } from '@/lib/modulos'

/**
 * Manual de usuario del CRM (pantalla /ayuda). Está escrito como datos para poder mostrar solo lo que le sirve a cada usuario:
 * las secciones de un módulo se marcan "no activo en este negocio" si está apagado, y las de administración solo las ven quienes
 * administran. Texto en negrita con **doble asterisco**.
 */

export type Bloque =
  | { t: 'p'; x: string }
  | { t: 'pasos'; x: string[] }
  | { t: 'lista'; x: string[] }
  | { t: 'tip'; x: string }
  | { t: 'ojo'; x: string }
  | { t: 'tabla'; cab: string[]; filas: string[][] }

export interface SeccionManual {
  id: string
  grupo: string
  titulo: string
  resumen: string
  modulo?: ModuloClave
  /** admin = solo quienes administran el negocio (dueño y administrador) */
  solo?: 'admin'
  bloques: Bloque[]
}

export const GRUPOS_MANUAL = ['Primeros pasos', 'Operación diaria', 'Clientes y marketing', 'Análisis', 'Administración', 'Ayuda'] as const

export const MANUAL: SeccionManual[] = [
  // ───────────────────────── Primeros pasos
  {
    id: 'ingresar', grupo: 'Primeros pasos', titulo: 'Ingresar, salir y moverse', resumen: 'Cómo entrar, elegir negocio o sede y entender el menú.',
    bloques: [
      { t: 'p', x: 'Se entra desde **crm.ristosuite.app** con tu **usuario** (no es un email) y tu contraseña. Si no tenés usuario, pedíselo al dueño o administrador del negocio.' },
      { t: 'p', x: 'Arriba a la izquierda ves el nombre del negocio. Si tu usuario trabaja en **más de un negocio** o el negocio tiene **sedes**, aparecen selectores para cambiar de uno a otro: todo lo que ves (reservas, clientes, vouchers…) es del negocio y la sede elegidos.' },
      { t: 'p', x: 'La barra de pestañas muestra **solo los módulos que tu negocio tiene encendidos**. Si falta algo que esperabas ver, no es un error: ese módulo no está activado en tu negocio. Consultalo con Risto Suite.' },
      { t: 'p', x: 'Para salir, usá el botón **Salir** (arriba a la derecha). Si dejaste la pantalla abierta mucho tiempo, igual cierra la sesión.' },
      { t: 'tip', x: 'En el celular la barra de pestañas se desliza hacia los costados, y las tablas se convierten en tarjetas.' },
      { t: 'tip', x: 'Todas las fechas se ven y se escriben **día-mes-año** (por ejemplo 26-10-2026). En los campos de fecha podés escribir solo los números (26102026) o tocar el calendario, que empieza en lunes.' },
      { t: 'tip', x: 'Las pantallas se actualizan solas (reservas nuevas, pedidos, vouchers). Cuando entra una reserva o un pedido nuevo suena un aviso y aparece una notificación. Si algo no cambia, recargá la página.' },
      { t: 'p', x: '**Campanita de notificaciones** (arriba a la derecha, al lado de tu nombre): junta lo que fue llegando y todavía no viste, sin que tengas que estar mirando la pantalla justo en ese momento: reservas nuevas que toma el bot o el sitio, consultas, reclamos y pedidos (los últimos 14 días). El globito muestra cuántos hay sin leer. Tocá un aviso para ir a esa pantalla (queda marcado como leído) o usá **Marcar todas como leídas**. Cada persona tiene sus propias lecturas, y si tu usuario tiene algunas sedes asignadas, solo ves lo de esas sedes. Las reservas que cargás a mano no generan aviso.' },
    ],
  },
  {
    id: 'roles', grupo: 'Primeros pasos', titulo: 'Roles: qué puede hacer cada usuario', resumen: 'Dueño, administrador, encargado, staff y solo lectura.',
    bloques: [
      { t: 'tabla', cab: ['Rol', 'Qué puede hacer'], filas: [
        ['Dueño', 'Todo en su negocio, incluida la gestión de usuarios y de otros dueños.'],
        ['Administrador', 'Configura el negocio y gestiona encargados, staff y usuarios de solo lectura.'],
        ['Encargado', 'Opera las reservas y puede apagar o encender el bot. También arma el plano del salón.'],
        ['Staff', 'Carga y edita reservas, pedidos y el trabajo del día a día.'],
        ['Solo lectura', 'Mira todo, no cambia nada (los botones de acción no aparecen).'],
      ] },
      { t: 'p', x: 'Un usuario puede tener un rol distinto en cada negocio, y puede estar limitado a algunas sedes.' },
    ],
  },

  // ───────────────────────── Operación diaria
  {
    id: 'dashboard', grupo: 'Operación diaria', titulo: 'Dashboard (pantalla de inicio)', resumen: 'El resumen del día: reservas, aforo y alertas.',
    bloques: [
      { t: 'p', x: 'Muestra cómo viene el día: **Reservas hoy**, **Personas hoy**, **Pendientes** (las que todavía hay que revisar) y **Reservas semana**; el **aforo del día** (cuánto del cupo del local está tomado) y la lista de **reservas del día**. Con las flechas pasás al día anterior o al siguiente.' },
      { t: 'p', x: 'Las **alertas activas** te avisan, por ejemplo, cuando el aforo llega al 90 %. El aforo se configura en Configuración → Aforo.' },
      { t: 'p', x: 'Si tu negocio no tiene el módulo Reservas, en su lugar el inicio te muestra los módulos que tiene encendidos y los que se pueden sumar.' },
    ],
  },
  {
    id: 'reservas', grupo: 'Operación diaria', titulo: 'Reservas', modulo: 'reservas', resumen: 'Cargar, confirmar, cancelar y seguir las reservas.',
    bloques: [
      { t: 'p', x: 'Las reservas llegan de tres lugares: las **carga una persona del local** (botón **Nueva reserva**), las **toma el bot de WhatsApp** y las **hacen los clientes desde el sitio de reservas** (ver “Sitio de reservas”). Todas aparecen en la misma lista.' },
      { t: 'tabla', cab: ['Estado', 'Qué significa'], filas: [
        ['Nueva', 'Entró y nadie la revisó todavía. **No bloquea mesa** en el sitio de reservas.'],
        ['Confirmada', 'El local la aceptó. Cuenta para el aforo y **bloquea la mesa**.'],
        ['Pendiente de pago', 'Se pidió una seña y falta que el cliente la pague. Cuenta para el aforo y **bloquea la mesa**. Al elegir este estado cargás el monto a pagar.'],
        ['Revisar pago', 'El cliente mandó un comprobante y hay que verificarlo. **Bloquea la mesa**.'],
        ['Cancelada', 'Se canceló (queda el motivo). Libera la mesa y el aforo.'],
        ['No-show', 'Confirmó pero no vino.'],
      ] },
      { t: 'p', x: '**Buscar y filtrar.** Arriba elegís el período (Hoy, Mañana, 7 días, Futuras o un rango de fechas), el estado (los botones muestran cuántas hay de cada uno), el tipo y la ubicación. También podés buscar por nombre o teléfono y ordenar por fecha de alta o fecha de reserva.' },
      { t: 'p', x: '**Nueva reserva.** Botón arriba a la derecha: nombre, teléfono, fecha, hora, personas, tipo, ubicación y observaciones. Si el negocio tiene aforo, te avisa cuando la reserva superaría el cupo (podés guardarla igual). Si el negocio tiene **Salón y mesas**, abajo aparece **“Elegir en el plano”**: una vez cargados fecha, hora y personas ves el plano de la sede y la ubicación elegidas, con las mesas libres, las ocupadas (con quién) y las que no sirven para esa cantidad de personas; tocás una mesa (o varias móviles juntas) y se asigna al crear la reserva.' },
      { t: 'pasos', x: [
        'En cada reserva, la **tilde** la confirma y la **cruz** la cancela. El menú de estados permite elegir cualquier otro (pendiente de pago, revisar pago, no-show…).',
        'Según el estado puede abrirse una ventanita: para **pendiente de pago** pide el monto, para **cancelada** el motivo.',
        'Si el negocio tiene los avisos por WhatsApp activados para ese estado, la ventanita pregunta **“¿Avisamos al cliente?”**. Si decís que sí, el cliente recibe el mensaje automáticamente.',
        '**Aviso para el equipo:** cuando entra, se modifica o se cancela una reserva, el bot puede mandar a un contacto o grupo de WhatsApp de tu equipo un mensaje que cuenta qué pasó, por ejemplo «🟢 NUEVA RESERVA · San Lorenzo / #5 Facundo Vilches / 📅 Sábado 31-10-2026 · 21:00 / 👥 6 personas / 📍 SALÓN». Si querés recibirlo, pedile a Risto Suite que lo active.',
        'Todo cambio de estado y toda eliminación tienen **Deshacer** durante unos segundos (en el aviso que aparece abajo).',
      ] },
      { t: 'p', x: '**Columnas de la tabla.** El número, el cliente, el estado y las acciones siempre se ven. Con el botón **Columnas** (arriba a la derecha de la tabla) elegís cuáles de las demás querés ver: teléfono, sede, fecha, hora, personas y mesa, tipo, ubicación, observaciones como columna aparte y fecha de alta. Se recuerda para vos. Por defecto las observaciones salen en letra chica debajo del nombre.' },
      { t: 'p', x: '**Buscar.** El buscador de arriba encuentra por nombre, por teléfono o por **número de reserva** (por ejemplo `12` o `#12`; si la sede numera aparte es el número de esa sede).' },
      { t: 'p', x: '**Imprimir las reservas del día.** En el Dashboard, el botón **Imprimir / PDF** abre una hoja con las reservas del día elegido (y de la sede elegida), ordenadas por hora, con cliente, personas, mesa, ubicación, observaciones y un casillero para tildar al llegar: sirve para que los mozos organicen las mesas. En el cuadro de impresión elegí “Guardar como PDF” si querés el archivo.' },
      { t: 'p', x: '**Chips en la lista.** “Mesa 4” te lleva al plano del salón (si usás Salón y mesas). El botón **“Llegó”** aparece en reservas confirmadas si usás Fidelización por asistencia.' },
      { t: 'p', x: '**Solicitudes web esperando el WhatsApp.** Si el sitio de reservas está activo, arriba de la lista aparece este bloque con lo que los clientes armaron en el sitio y todavía no confirmaron por WhatsApp. **No son reservas**: no ocupan mesa ni aforo (ver “Sitio de reservas”).' },
      { t: 'ojo', x: 'Eliminar una reserva la saca de la lista pero se puede deshacer enseguida. Para que quede registro de que no se concretó, es mejor **cancelarla** (con motivo).' },
    ],
  },
  {
    id: 'mesas', grupo: 'Operación diaria', titulo: 'Salón y mesas', modulo: 'mesas', resumen: 'El plano: asignar mesas, ver qué está libre y manejar el servicio.',
    bloques: [
      { t: 'p', x: 'Muestra el plano de tu salón. Tiene dos modos: **servicio** (el día a día) y **editar** (armar el plano).' },
      { t: 'p', x: '**En el celular** el plano entero se ve achicado (botón **Ampliar** para verlo a tamaño real y deslizarlo hacia los costados), y hay una vista **Lista** con una fila por mesa (número, lugares, estado y reserva) que es más cómoda para tocar.' },
      { t: 'p', x: '**Modo servicio.** Elegís la fecha y el momento (**Ahora**, una hora o Almuerzo / Cena). Cada mesa se pinta según su estado: libre, reservada, **llegó** (amarillo), ocupada o fuera de servicio. Tocás una mesa y se abre su panel. Abajo ves la **lista de reservas del día**:' },
      { t: 'lista', x: [
        '**Asignar / Cambiar:** elegís la mesa (o varias, si son móviles y se juntan). Si otra reserva ya tiene esa mesa a esa hora, te avisa y podés forzarlo.',
        '**Sugerir:** el sistema propone la mesa más justa para la cantidad de personas, o dos o tres móviles juntas.',
        '**Llegó → Sentar → Liberar:** marcan que el cliente llegó, que se sentó (la mesa pasa a Ocupada) y que se fue (la mesa vuelve a Libre).',
        '**Ocupar sin reserva:** para gente que llega sin reservar; anotás cuántos son.',
      ] },
      { t: 'p', x: '**Mesas fijas y móviles.** Cada mesa tiene **capacidad mínima y máxima** (por ejemplo, de 2 a 4). Una mesa **fija** no se puede juntar con otras. Las **móviles** (borde punteado) se pueden juntar entre sí: la capacidad del grupo es la suma de los mínimos hasta la suma de los máximos. No se pueden juntar una fija con una móvil, ni dos fijas. Al elegir mesa, las que no sirven para la cantidad de personas de la reserva se ven **bloqueadas** (“No apta”): por ejemplo, para 2 personas una mesa que pide 4 como mínimo, o una móvil que sumada a las ya elegidas pediría más personas de las que son.' },
      { t: 'p', x: '**Modo editar** (botón **Editar plano**, para dueño, administrador y encargado). Podés crear **salones** (ancho y alto), agregar mesas, **varias mesas** de una vez, y **carteles** (BARRA, ESCENARIO, ENTRADA…). Las mesas se arrastran con el mouse y no se pisan entre sí. En cada mesa editás número, capacidad mínima y máxima, forma y si es **Móvil**. En cada salón elegís su **Ubicación del CRM** (SALÓN, PLANTA ALTA…): así el sitio de reservas sabe qué plano mostrar cuando el cliente elige esa ubicación.' },
      { t: 'p', x: '**Sillas.** Cada mesa dibuja una silla por lugar (su capacidad máxima), repartidas por sus lados o alrededor si es redonda. En cada **salón** elegís el estilo de las sillas (redondas, cuadradas, con respaldo o sin sillas) y su color. En cada **mesa** podés **girarla** (de a 15° o 90°, o escribir los grados), sacarle las sillas de un lado (por ejemplo si está contra la pared) o quitárselas. Se ven igual en el servicio, al elegir mesa al cargar una reserva y en el sitio de reservas. El giro es solo el dibujo: el lugar que ocupa en el plano no cambia.' },
      { t: 'p', x: '**Planos activos e inactivos.** Podés tener varios planos guardados aunque no los uses (por ejemplo, el salón de invierno o una distribución para eventos). En modo editar, cada plano tiene el botón **Activar / Desactivar este plano**. Un plano **inactivo** conserva todas sus mesas, pero no aparece en el servicio, no se ofrece al asignar mesas ni en el sitio de reservas, y no entra en el QR de mesas. Cuando lo reactivás vuelve todo como estaba. Si el módulo Salón y mesas está apagado para el negocio, tampoco se usa ningún plano (siguen guardados).' },
      { t: 'p', x: '**Duración de la mesa:** cuánto tiempo se considera ocupada una mesa reservada (por defecto 120 minutos). Dos reservas chocan si caen a menos de esa duración una de otra.' },
      { t: 'tip', x: '**Hoja de QR de las mesas** (botón **QR de mesas**): imprime un QR por mesa que lleva a la carta con la mesa ya cargada, para pedir desde la mesa (necesita Carta y Pedidos).' },
    ],
  },
  {
    id: 'sitio-reservas', grupo: 'Operación diaria', titulo: 'Sitio de reservas', modulo: 'reservas', resumen: 'La página pública donde el cliente elige día y mesa, y la reserva se registra cuando escribe por WhatsApp.',
    bloques: [
      { t: 'p', x: 'Es una página pública, sin necesidad de iniciar sesión, con el nombre de tu negocio. El enlace se puede compartir por Instagram, WhatsApp o un QR. Necesita que el negocio tenga cargado su **WhatsApp** (Configuración → Negocio).' },
      { t: 'p', x: '**La idea:** el cliente no “reserva” directamente en la web: **arma su solicitud y la termina de confirmar por WhatsApp**. La reserva real **no existe hasta que llega su mensaje**. Así no se acumulan reservas fantasma de gente que abandonó a la mitad, y el teléfono es el de quien escribe (por eso el formulario **no pide teléfono**).' },
      { t: 'p', x: '**Si el negocio tiene sedes**, el primer paso es **“¿En qué sede?”** y cada sede se comporta como un negocio propio: usa **su WhatsApp** (si la sede no tiene, el del negocio), **sus ubicaciones** (las que cargaste para esa sede más las generales), **su aforo y sus fechas bloqueadas**, **su plano de mesas** (una sede puede tener plano y otra no: la que no tiene deja que un asesor elija la mesa), y opcionalmente **sus horarios y su mensaje**. La reserva queda en la sede elegida. Una sede se ofrece solo si está activa, no está apagada para la web y tiene un WhatsApp al que escribir. Si queda una sola sede, el sitio no pregunta. Cada sede tiene su enlace directo, que se copia en Configuración.' },
      { t: 'p', x: '**Cómo lo vive el cliente:**' },
      { t: 'pasos', x: [
        'Elige **día, cantidad de personas, ubicación, tipo de reserva y horario**. Todo sale de lo que tenés configurado en el CRM: las ubicaciones, los tipos, los horarios, el aforo y las fechas bloqueadas. Un horario completo o cerrado aparece como “Completo” o “Cerrado”.',
        'Elige su mesa **tocando el plano**, o toca **“Que un asesor la elija”**. Las mesas que no sirven para su grupo se ven “No apta”; las que ya tienen una reserva **confirmada, pendiente de pago o en revisión de pago** se ven “Reservada” y no se pueden tocar.',
        'Deja su nombre y comentarios, y toca **Reservar y enviar por WhatsApp**.',
        'Se guarda la **solicitud en espera** (con un **código** corto) y se abre **WhatsApp con un mensaje ya escrito** (“SOLICITUD DE RESERVA…” con el código y todos los datos). El cliente tiene que **enviarlo sin cambiarlo**: ese es el paso que registra la reserva.',
      ] },
      { t: 'p', x: '**Qué pasa del lado del local:**' },
      { t: 'pasos', x: [
        'Cuando el mensaje llega, **el bot** lo reconoce por su código y **crea la reserva** con el teléfono de quien escribió. Aparece en **Reservas** como **Nueva**, con las mesas ya asignadas si las eligió el cliente. El bot le contesta que la recibió.',
        'Hablás con el cliente y la **confirmás** (o la pasás a **Pendiente de pago** si pedís seña). Recién ahí la mesa queda **bloqueada** para los demás en el sitio.',
        'Si el bot no la tomó (por ejemplo, porque el cliente cambió el texto del mensaje), la solicitud queda en el bloque **“Solicitudes web esperando el WhatsApp”** de **Reservas**. Buscás su código en el chat de WhatsApp, tocás **“Registrar con su teléfono”**, escribís el número con el que te escribió y se crea la reserva.',
        'Si el cliente nunca escribe, la solicitud no molesta: no ocupa mesa ni aforo, vence a las **48 horas** y se borra sola. También podés **descartarla** (el tachito).',
      ] },
      { t: 'p', x: '**Cancelar o modificar una reserva desde un link.** Cada reserva tiene su propio link, que el bot le manda al cliente junto con la confirmación. Ahí el cliente puede **cancelar** o **modificar** (día, hora o cantidad de personas, con los mismos horarios y aforo del sitio). Pedirlo **no cambia nada todavía**: se abre WhatsApp con un mensaje ya escrito (“CANCELACIÓN DE RESERVA - …” o “MODIFICACIÓN DE RESERVA - …”, con un código) y el cambio se aplica recién cuando ese mensaje llega **desde el mismo teléfono con el que se hizo la reserva**. Si lo manda otro número, no se toca nada y el chat se deriva a una persona: así nadie puede cancelar o cambiar reservas ajenas. Una modificación borra la mesa asignada (hay que reasignarla), deja una nota y, si el local revisa cada reserva, la vuelve a “Nueva”. Los textos que contesta el bot los ajusta Risto Suite: si querés cambiar alguno, pedíselo.' },
      { t: 'ojo', x: 'Si entre que el cliente armó la solicitud y mandó el mensaje la mesa se ocupó o el horario se completó, **igual se crea la reserva** (el cliente ya escribió), pero **sin mesa** y con un aviso en las observaciones para que un asesor la resuelva con él.' },
      { t: 'ojo', x: 'Una reserva **“Nueva” no bloquea** la mesa: dos clientes pueden pedir la misma mientras ninguna esté confirmada. Si pasa, al asignar la segunda el sistema te avisa del choque y vos resolvés con el cliente.' },
      { t: 'p', x: '**Configuración del sitio** (dueño, administrador): en **Configuración → Sitio de reservas**.' },
      { t: 'p', x: '**Cumpleaños con año (opcional):** en el mismo renglón que el día y el mes, el cliente puede sumar su año de nacimiento (“Recibí un regalo en ese día 🎁”; día de 1 a 31, mes de enero a diciembre y año desde el actual hasta 100 años atrás); con el año, la ficha del cliente guarda su fecha de nacimiento completa y muestra la edad que cumple. **El plano en el celular:** se abre mostrando el salón completo; se acerca y aleja pellizcando o con los botones **+ / −**, se desliza para recorrerlo y **Ver todo** vuelve a la vista completa. Si preferís no usar el mapa, el cliente puede cambiar a **Lista** y elegir la mesa de ahí. **Mesas que no alcanzan:** si todas las mesas libres de un salón piden más personas que las de la reserva (por ejemplo, reservás para 2 y son de 3 como mínimo), el sitio lo explica y sugiere subir la cantidad, probar otro horario u otra ubicación o pedir un asesor. **Cambiar solo la mesa:** desde el link de su reserva el cliente puede pedir otra mesa sin cambiar día ni hora.' },
      { t: 'lista', x: [
        '**Activo:** apagado, el enlace muestra “no encontrado”.',
        '**Sedes en el sitio** (si el negocio tiene sedes): por cada sede, si se ofrece en el sitio, sus propios horarios, si deja elegir mesa en el plano y su mensaje. Lo que quede vacío hereda lo del sitio. El WhatsApp de cada sede se carga en Sedes.',
        '**El cliente puede elegir su mesa:** si lo apagás, siempre decide un asesor.',
        '**Tipos de reserva que se ofrecen:** tildás cuáles (Común, Cumpleaños, Cena show…). Cada tipo se ofrece solo los días en que está disponible (se configura en Tipos de reserva).',
        '**Aviso de pocos lugares:** cuando a un horario de un sector (ubicación) le quedan pocos lugares, el sitio lo avisa debajo de la hora: **“Quedan pocos lugares”** (recomendado: avisa que se está llenando sin mostrar la capacidad del local) o **“Quedan 6 lugares”** (el número exacto; “Queda 1 lugar” en singular). Elegís desde cuántos lugares libres avisar (por defecto 10) y podés cambiar el texto (por ejemplo, “¡Últimas mesas!”). Los lugares son personas, como en el aforo. Se calcula con tus **reglas de aforo** por ubicación y franja: un sector sin regla de aforo nunca avisa. Con “cualquier ubicación” avisa solo si en todos los sectores quedan pocos. Viene apagado.',
        '**Horarios por día de la semana:** además de los horarios generales, podés poner horarios distintos para cada día (por ejemplo, los sábados también al mediodía). El día que dejes vacío usa los generales. Cada **sede** también puede tener horarios distintos según el día de la semana (se abre desde la tarjeta de la sede); el orden es: horarios de la sede para ese día, horarios de la sede, horarios del sitio para ese día, horarios del sitio.',
        '**Cualquier ubicación disponible:** una opción más junto a tus ubicaciones para que el cliente reserve sin elegir lugar ni mesa. Solo aparece si tenés dos o más ubicaciones. El horario se ofrece si **entra en al menos una ubicación** según el aforo de cada una (y los topes generales y fechas bloqueadas); cuando llega el WhatsApp se le asigna la **primera ubicación con lugar, en el orden en que cargaste las ubicaciones**. Si en el medio se llenaron todas, la reserva igual se crea, sin ubicación y con una nota para que la resuelvas. Podés cambiar el texto de la opción.',
        '**Horarios:** una lista separada por coma (13:00, 21:00). Vacío = usa los horarios que más se usan en tus reservas.',
        '**Días hacia adelante, anticipación mínima y rango de personas.** Y un **mensaje** que ve el cliente (por ejemplo: “Tolerancia de 15 minutos”).',
        '**Preguntar el cumpleaños:** agrega al formulario el día y el mes de cumpleaños, siempre **opcional** para el cliente (los dos o ninguno). Si lo completa, se guarda en la reserva y en su ficha para el módulo Cumpleaños, y va en el mensaje de WhatsApp.',
        '**Título y subtítulo** de la página (por defecto, el nombre del local y “Reservá tu mesa”).',
        '**Máximo de mesas por reserva** (cuántas móviles se pueden juntar).',
      ] },
      { t: 'tip', x: 'Para probarlo: abrí el enlace desde tu celular, armá una solicitud con tu nombre, enviá el mensaje de WhatsApp y mirá cómo aparece la reserva en Reservas. Después cancelala.' },
    ],
  },
  {
    id: 'shows', grupo: 'Operación diaria', titulo: 'Shows', modulo: 'shows', resumen: 'Cartelera y cupos de shows (en preparación).',
    bloques: [
      { t: 'p', x: 'Este módulo **todavía no tiene pantallas completas**. Está pensado para la cartelera de shows y eventos, con entradas y cupos. Mientras tanto, las cenas show se manejan como un **tipo de reserva** (“Cena show”).' },
    ],
  },
  {
    id: 'carta', grupo: 'Operación diaria', titulo: 'Carta digital', modulo: 'carta', resumen: 'El menú online: categorías, productos, fotos y precios.',
    bloques: [
      { t: 'p', x: 'Armás la carta de tu negocio y los clientes la ven en una página pública con la marca de tu negocio, sin necesidad de iniciar sesión (el enlace y el QR salen de **Ajustes**). Funciona sola (solo para mirar) o junto con Pedidos.' },
      { t: 'pasos', x: [
        'Creá las **categorías** (Entradas, Platos, Postres…). Podés ordenarlas y ocultarlas.',
        'Agregá **productos**: nombre, descripción, precio (o **variantes** con su precio, por ejemplo Chico / Grande), **foto** y **etiquetas** (recomendado, vegano, sin TACC, picante…). Las fotos se achican solas.',
        'Usá el interruptor **Disponible / Agotado** para marcar lo que se terminó sin borrarlo. También podés **destacar** u **ocultar** un producto.',
        '**Importar texto:** pegás una lista con el formato “Categoría | Producto | Precio | Descripción” y se cargan todos juntos.',
        'En **Ajustes** elegís si se muestran precios, el título y un mensaje. Desde ahí sacás también el **QR** de la carta para imprimir.',
      ] },
      { t: 'tip', x: 'El enlace de la carta se puede usar en el menú del bot, para que mande siempre la carta actualizada (pedíselo a Risto Suite).' },
    ],
  },
  {
    id: 'pedidos', grupo: 'Operación diaria', titulo: 'Pedidos', modulo: 'pedidos', resumen: 'Pedidos de retiro, delivery y mesa que llegan desde la carta.',
    bloques: [
      { t: 'p', x: 'Los clientes arman su pedido desde la carta pública (agregan productos, eligen retiro, delivery o mesa, forma de pago y dejan sus datos). **Los precios siempre salen de la carta**: el cliente no puede cambiarlos.' },
      { t: 'pasos', x: [
        'Activá **“Recibiendo pedidos”** (interruptor en la pantalla de Pedidos). Apagado, la carta sigue visible pero no se puede pedir.',
        'Cada pedido nuevo suena, avisa y aparece como tarjeta con sus ítems. Con el botón de **siguiente paso** lo avanzás: Aceptado → Preparando → Listo → (En camino) → Entregado.',
        'Podés **cancelar** un pedido con motivo, **reabrirlo**, **imprimir el ticket** (formato 80 mm) o **avisar al cliente por WhatsApp** con un clic (abre WhatsApp con un mensaje según el estado).',
        'También podés cargar un **pedido manual** (por ejemplo, uno que llegó por teléfono).',
      ] },
      { t: 'p', x: '**Ajustes de pedidos** (botón **Ajustes**, que lleva a **Configuración → Pedidos**; los cambios se aplican solos). Hay cuatro secciones:' },
      { t: 'lista', x: [
        '**Recepción de pedidos:** el interruptor **Recibiendo pedidos**, el **pedido mínimo**, el **tiempo estimado**, un **mensaje para el cliente** y la opción de **aceptar los pedidos automáticamente** (entran directo como “Aceptados”; los que cargás a mano no).',
        '**Formas de entrega:** funciona igual que los tipos de reserva. Vienen **Retiro en el local**, **Delivery** y **En mesa**, y podés **cambiarles el nombre, ordenarlas, activarlas o desactivarlas y agregar las tuyas** (por ejemplo “Drive”, “Retiro en sucursal Centro” o “Envío por moto”). Cada una “se comporta como” retiro, delivery o en mesa: eso define qué datos se piden (teléfono; teléfono, dirección y costo de envío; o número de mesa). Dentro de cada una, en **Costos, tiempo, horarios y medios de pago**, elegís su **costo de envío** y **envío gratis desde** un monto (si es de tipo delivery), su **tiempo estimado**, sus **horarios propios** y **qué medios de pago acepta**. Si quitás una que ya tiene pedidos, queda desactivada (los pedidos viejos conservan su nombre).',
        '**Horarios de pedidos:** si encendés **Recibir pedidos solo en ciertos horarios**, elegís para cada día de la semana hasta 3 franjas (por ejemplo, de 12:00 a 15:00 y de 20:00 a 23:30). Una forma de entrega puede tener **horarios distintos** (por ejemplo, el delivery solo de noche). Además podés cargar **días en que no se toman pedidos** (feriados, vacaciones) y el **mensaje** que ve el cliente fuera de horario. Fuera de horario, la carta y el bot avisan cuándo vuelven a tomar pedidos; los pedidos que cargás a mano siempre se pueden.',
        '**Medios de pago:** también un catálogo propio. Vienen **Efectivo**, **Transferencia** y **Tarjeta**, y podés renombrarlos, ordenarlos, desactivarlos y **agregar los tuyos** (Mercado Pago, débito, un QR…). Cada medio tiene un **aviso** que ve el cliente al elegirlo (por ejemplo, “avisanos si necesitás cambio”) y **datos para pagar** (alias, CBU, link de pago) que se muestran recién al confirmar el pedido.',
      ] },
      { t: 'tip', x: 'Si estás fuera del horario de pedidos, arriba de la lista de Pedidos aparece un aviso que te dice cuándo se vuelve a recibir. El interruptor **Recibiendo pedidos** sigue valiendo siempre: apagado, no se toman pedidos aunque estés en horario.' },
      { t: 'p', x: '**Pedidos a la mesa:** imprimí la hoja de QR (Salón y mesas → QR de mesas). Cada QR abre la carta con el número de mesa ya cargado.' },
      { t: 'ojo', x: 'Todavía no cobra online ni calcula el envío por zona: el pago se coordina con el cliente. El aviso por WhatsApp al cambiar de estado es un botón manual.' },
    ],
  },

  // ───────────────────────── Clientes y marketing
  {
    id: 'clientes', grupo: 'Clientes y marketing', titulo: 'Clientes', modulo: 'clientes', resumen: 'Base de clientes, historial y etiquetas.',
    bloques: [
      { t: 'p', x: 'Cada persona que reservó, pidió o escribió queda como cliente, identificada por su **teléfono**. Podés buscar por nombre o teléfono y filtrar por **etiqueta** y por **origen** (de dónde llegó: WhatsApp, QR de la carta, Wifi…).' },
      { t: 'p', x: '**Por sede:** si el negocio tiene sedes, un filtro **Sede** deja solo los clientes que reservaron en esa sede (también respeta la sede elegida arriba). Con una sede elegida, “Reservas” y “Última reserva” cuentan solo las de esa sede.' },
      { t: 'p', x: 'La **ficha del cliente** reúne su teléfono, origen, desde cuándo es cliente, su cumpleaños, su tarjeta de fidelidad, sus vouchers, sus reseñas y el **historial de reservas**. Desde ahí podés corregir su nombre y emitirle un voucher.' },
      { t: 'p', x: '**Etiquetas:** sirven para clasificar (por ejemplo “post visita”, “VIP”). Se crean en Configuración → Etiquetas de clientes. Si tu negocio tiene el bot conectado, la etiqueta también se aplica en el chat del cliente.' },
    ],
  },
  {
    id: 'cumpleanos', grupo: 'Clientes y marketing', titulo: 'Cumpleaños', modulo: 'cumpleanos', resumen: 'Próximos cumpleaños y qué meses tienen más.',
    bloques: [
      { t: 'p', x: 'Lista los **próximos cumpleaños** de tus clientes (con la edad que cumplen). Se cargan solos cuando una reserva trae la fecha, o a mano con **Agregar cumpleaños**.' },
      { t: 'p', x: 'El **gráfico de barras** muestra cuántos cumpleaños hay en cada mes, para anticipar cuándo conviene hacer promociones. El saludo y el voucher de cumpleaños los manda el bot automáticamente.' },
    ],
  },
  {
    id: 'vouchers', grupo: 'Clientes y marketing', titulo: 'Vouchers', modulo: 'vouchers', resumen: 'Códigos de beneficio: emitir, ver y marcar como usados.',
    bloques: [
      { t: 'p', x: 'Un voucher es un código de beneficio (“1 postre de regalo”, “$5.000 de descuento”) asociado a un cliente y a una **campaña** (reseña, cumpleaños, retorno, fidelidad…). Puede estar **Vigente**, **Usado** o **Vencido**.' },
      { t: 'pasos', x: [
        'Los vouchers los **emite el bot solo** (por una reseña de 4 o 5 estrellas, por cumpleaños, por una campaña de retorno o por Fidelización) y aparecen al instante en la lista.',
        'También podés emitir uno a mano: **Nuevo voucher** → teléfono, beneficio, campaña, vencimiento (el código se genera solo, o lo escribís).',
        'Cuando el cliente lo usa en el local, tocá **Usado**. Tiene Deshacer.',
      ] },
      { t: 'tip', x: 'Los códigos no se repiten: un mismo teléfono recibe un solo voucher por campaña, y el sistema evita que dos campañas generen el mismo código.' },
    ],
  },
  {
    id: 'fidelizacion', grupo: 'Clientes y marketing', titulo: 'Fidelización por visitas', modulo: 'fidelizacion', resumen: 'Un premio automático al llegar a cierta cantidad de visitas.',
    bloques: [
      { t: 'p', x: 'Premia a quienes vuelven. Definís **reglas** (por ejemplo “a la 5.ª visita, 1 postre de regalo”, o “cada 10 visitas”) y el sistema emite solo el voucher cuando el cliente la cumple.' },
      { t: 'p', x: '**Qué es una visita:** un día distinto con una reserva confirmada ya pasada (criterio “confirmadas”, no pide trabajo extra) o con el botón **Llegó** apretado (criterio “asistencia”, más exacto). Solo se cuentan visitas **desde la fecha de inicio** que elijas: por defecto el día que lo activás, así no se premia el pasado a menos que quieras.' },
      { t: 'pasos', x: [
        'Entrá a Fidelización → **Ajustes** y elegí el criterio y desde cuándo se cuenta.',
        'Creá las **reglas**: cantidad de visitas, premio, vencimiento, y si se repite (“cada N”) o es única.',
        'Desde ese momento los premios se emiten solos (cuando se carga o cambia una reserva, y todos los días a la mañana). El botón **Emitir premios** lo fuerza.',
        'Ves el ranking de clientes con sus visitas, los premios emitidos y, en cada ficha de cliente, su tarjeta de fidelidad.',
      ] },
      { t: 'p', x: 'El **aviso al cliente** (“¡ganaste un premio!”) lo manda el bot; hoy está en etapa de prueba, así que consultá con Risto Suite si ya está activo en tu negocio.' },
    ],
  },
  {
    id: 'resenas', grupo: 'Clientes y marketing', titulo: 'Reseñas', modulo: 'resenas', resumen: 'Qué dicen los clientes y el resumen con IA.',
    bloques: [
      { t: 'p', x: 'Las reseñas llegan de la encuesta que hace el bot por WhatsApp. Ves el **puntaje promedio**, cuántas conseguiste y los comentarios; podés buscar por nombre, teléfono o texto y filtrar.' },
      { t: 'p', x: 'El botón **Resumen con IA** lee las reseñas que estás viendo (con los filtros aplicados) y genera conclusiones: qué elogian, qué critican y qué conviene mejorar.' },
    ],
  },
  {
    id: 'consultas', grupo: 'Clientes y marketing', titulo: 'Consultas y reclamos', modulo: 'consultas', resumen: 'Lo que el bot no supo responder y hay que atender.',
    bloques: [
      { t: 'p', x: 'Cuando un cliente escribe algo que el bot no resuelve (una consulta) o se queja (un reclamo), queda acá. Filtrás por **Pendientes / Resueltas** y por tipo.' },
      { t: 'pasos', x: ['Abrí el mensaje, respondé al cliente por WhatsApp y marcá la consulta como **Resuelta**.', 'Podés pedir un **Resumen con IA** para ver de qué se trata lo que más se repite.'] },
      { t: 'p', x: '**Sin respuesta automática:** el bot puede tomar el mensaje **sin contestarle nada al cliente** y avisar al equipo por WhatsApp (por ejemplo «📩 NUEVA CONSULTA · San Lorenzo / +54… / ¿Tienen menú sin TACC?»). La atención queda para vos, desde acá.' },
    ],
  },
  {
    id: 'campanas', grupo: 'Clientes y marketing', titulo: 'Campañas', modulo: 'campanas', resumen: 'Seguimiento de a quién se le mandó cada campaña.',
    bloques: [
      { t: 'p', x: 'Las campañas de marketing las **manda el bot de WhatsApp** (no se envían desde este panel). Cada envío queda registrado acá: ves cada campaña y **a qué clientes se les envió**. Sirve para no repetirle la misma campaña a la misma persona y para medir resultados.' },
    ],
  },
  {
    id: 'derivadas', grupo: 'Clientes y marketing', titulo: 'Derivadas', modulo: 'derivadas', resumen: 'Reservas de cena show que toma el bot y administra otra producción.',
    bloques: [{ t: 'p', x: 'Lista las reservas que el bot toma pero que **gestiona otra producción** (por ejemplo, ciertas cenas show). Acá las ves y las buscás por nombre, teléfono u observación, pero no se confirman desde este panel.' }],
  },
  {
    id: 'pausados', grupo: 'Clientes y marketing', titulo: 'Chats pausados, conversaciones y botón del bot', resumen: 'Cuando el bot le pasa el chat a una persona.',
    bloques: [
      { t: 'p', x: '**Chats pausados** (para encargados y administradores): cuando el bot deriva a un cliente a una persona, su chat queda **pausado** para que el bot no se meta. Acá ves quiénes están esperando y podés **reactivar** el chat (uno por uno o todos juntos) cuando terminaste. Pasado un tiempo, el bot vuelve a atender solo.' },
      { t: 'p', x: '**Silenciar al bot de un cliente** (negocios que usan BotConversa; para encargados, administradores y dueños): en la **ficha del cliente**, sección **Bot de WhatsApp**, podés silenciar al bot por **2 horas**, **24 horas** o **indefinidamente** (por ejemplo, mientras una persona del equipo conversa con ese cliente) y **reactivarlo** cuando quieras. Mientras está silenciado, la ficha lo indica y hasta cuándo. Si cada sede tiene su propio BotConversa, la ficha muestra un bloque por sede (solo las tuyas) y se silencia o reactiva **en la sede que elijas**; el estado es independiente en cada una. Las acciones que se ven son las que tienen su flujo configurado.' },
      { t: 'p', x: '**Conversaciones** (si está encendido): muestra los chats del bot de WhatsApp para leerlos.' },
      { t: 'p', x: 'El botón **Bot encendido / apagado** (arriba a la derecha, si tu negocio lo tiene) apaga al bot por completo: no responde ni registra mensajes. Una barra roja avisa mientras está apagado.' },
    ],
  },

  // ───────────────────────── Análisis
  {
    id: 'metricas', grupo: 'Análisis', titulo: 'Métricas', modulo: 'metricas', resumen: 'Gráficos de reservas y de pedidos, horarios fuertes y clientes recurrentes.',
    bloques: [
      { t: 'p', x: 'Elegís el período y ves los números de lo que use tu negocio: si tiene **Reservas** y **Pedidos**, aparecen dos pestañas arriba (**Reservas** y **Pedidos**); si usa solo uno, ves directamente ese. El período y la forma de agrupar la evolución valen para ambas.' },
      { t: 'p', x: '**Reservas:** promedio de personas por reserva, horario más reservado, evolución (por día, semana o mes), días más fuertes, horarios más reservados, reservas por estado (y por sede si hay varias) y clientes recurrentes (los que más vuelven).' },
      { t: 'p', x: '**Pedidos:** cantidad de pedidos, **ventas** (sin contar cancelados), **ticket promedio** y hora pico; evolución de pedidos y de ventas, días más fuertes, horas con más pedidos, **productos más pedidos**, pedidos por tipo (retiro, delivery, mesa), medios de pago, pedidos por estado y los clientes que más piden. Los pedidos no se registran por sede: con una sede elegida se ven los de todo el negocio.' },
      { t: 'p', x: '**Período:** elegís los últimos 7 a 180 días o un **rango de fechas** (hasta un año; el final no puede ser futuro). El rango vale para Reservas y para Pedidos.' },
      { t: 'p', x: '**Resumen con IA:** el botón arma un solo resumen del período que estás viendo, con **todo lo que tu negocio tiene habilitado** (reservas, pedidos, reseñas, consultas y reclamos; lo que no usás no aparece), y lo **compara con el período anterior**: los mismos días corridos inmediatamente antes (por ejemplo, para el 01-09 al 15-09 compara con el 17-08 al 31-08; el resumen lo indica con las fechas exactas). Dice qué anda bien, qué mirar de cerca y acciones sugeridas. Usa solo números agregados (nada de nombres ni teléfonos) y puede equivocarse: revisalo antes de decidir.' },
    ],
  },

  // ───────────────────────── Administración
  {
    id: 'configuracion', grupo: 'Administración', titulo: 'Configuración del negocio', solo: 'admin', resumen: 'Aforo, fechas bloqueadas, ubicaciones, sedes y más.',
    bloques: [
      { t: 'p', x: 'Las secciones están agrupadas (General, Reservas, Sitio de reservas, Pedidos, Clientes y Equipo): a la izquierda (o arriba, en el celular) hay un índice para saltar a cada una. **No hay botones de guardar**: los cambios se aplican solos apenas tocás un interruptor o un menú, y un instante después de dejar de escribir; al lado de cada sección ves “Guardando…” y “Guardado”. Si algo no es válido, te lo dice ahí mismo y no se guarda.' },
      { t: 'lista', x: [
        '**Negocio:** nombre, WhatsApp y datos generales.',
        '**Sedes:** si el negocio tiene varias, cada una con su aforo, fechas bloqueadas y WhatsApp.',
        '**Aforo:** cuántas personas entran. Podés poner un máximo general y **reglas por ubicación y franja horaria** (por ejemplo, SALÓN de 20:00 a 23:00: 60 personas). Con la opción **Incluir la hora final en la franja**, una franja de 20:00 a 21:30 cubre también las reservas de las 21:30 (y no las de las 21:31 en adelante); sin ella, la franja llega hasta justo antes de la hora final. Una reserva fuera de toda franja no cuenta para el aforo ni lo respeta. Avisa al llegar al 90 % y al cargar una reserva que lo supera. El sitio de reservas respeta estas reglas. Cada regla puede valer **solo ciertos días de la semana** o **solo un rango de fechas**: así tenés, por ejemplo, 120 personas los viernes y sábados y 60 de lunes a jueves, o un aforo especial para la semana de fin de año. Una reserva cuenta en todas las reglas que le corresponden, por eso para tener un aforo distinto por día cargás una regla por grupo de días (y no una general que las pise).',
        '**Días de apertura:** si el negocio (o una sede) **no abre todos los días**, marcás los días de la semana que abre habitualmente (por ejemplo jueves a sábado). El sitio de reservas muestra los demás días cerrados, no se pueden elegir, y el bot tampoco los ofrece. Cada sede puede tener sus propios días o usar los del negocio. Para una **semana especial** en que abre un día que normalmente no abre, lo sumás en “Días especiales que abre”. Para **cerrar un día puntual** que normalmente abre, usás “Fechas bloqueadas”.',
        '**Configurar por sede:** si el negocio tiene sedes, arriba de la pantalla elegís qué estás configurando: **Todo el negocio** o una **sede**. En una sede cada ajuste hereda lo del negocio hasta que lo **personalices** (casillero “Personalizar para esta sede”): ves el valor del negocio, no se puede editar, y al marcarlo la sede usa el suyo. Se puede personalizar por sede: **tipos de reserva** (si la sede los ofrece y en qué días), **confirmación** (cómo entran sus reservas), **parámetros** (alerta de aforo, turnos, estados que bloquean), **sitio de reservas** (días hacia adelante, anticipación, personas, textos, cumpleaños, cualquier ubicación, aviso de pocos lugares, tipos ofrecidos, horarios y mesa) y la **duración de las mesas**. El aforo, los días de apertura, las fechas bloqueadas, las ubicaciones, los planos y la numeración ya eran por sede. Los usuarios y las etiquetas son del negocio.',
        '**Si tu usuario tiene acceso a algunas sedes:** en Configuración ves y cambiás solamente esas sedes (no aparecen las demás ni la configuración de todo el negocio, como Usuarios o Etiquetas).',
        '**Fechas bloqueadas:** días (o franjas) en los que no se aceptan reservas, por ejemplo un feriado o un evento privado.',
        '**Tipos de reserva:** los que se ofrecen al cargar una reserva y en el sitio (Común, Cumpleaños, Cena show…). Cambiás el nombre, el orden, agregás los tuyos y desactivás los que no uses. Cada tipo tiene su **disponibilidad**: todos los días, solo ciertos días de la semana (por ejemplo Cena show, viernes y sábado) o solo fechas particulares (por ejemplo Cena de Año Nuevo, 31/12); fuera de esos días el sitio no lo ofrece. Si el bot crea un tipo nuevo, aparece como “Sin configurar” para que le pongas nombre.',
        '**Confirmación de reservas:** define si las reservas que llegan por el sitio o el bot **se confirman solas** o **quedan en “Nuevas”** para que un asesor las confirme. Elegís un resultado por defecto y le sumás **excepciones**: por cantidad de personas (por ejemplo, se confirman solas hasta 6 personas y las de más de 6 quedan en Nuevas), por tipo de reserva (Cena show siempre a mano), por fecha particular o rango de fechas (Año Nuevo se revisa todo), por días de la semana o por sede. Se revisan de arriba hacia abajo y manda la primera que coincide; una excepción por fecha va antes que las generales. Abajo hay un probador para ver qué pasaría con una reserva de ejemplo. El cliente recibe “Tu reserva está confirmada” o “Un asesor te la confirma en breve” según corresponda, y si modifica una reserva desde su link y el cambio cae en una excepción “en Nuevas”, la reserva vuelve a revisión. Las reservas que cargás vos a mano las dejás en el estado que elijas.',
        '**Parámetros de reservas:** a qué porcentaje del aforo se avisa (por defecto 90 %), los **turnos** del plano de mesas (Almuerzo 13:00, Cena 21:00… los que quieras) y **qué estados bloquean una mesa** en el sitio.',
        '**Sitio de reservas:** ver la sección “Sitio de reservas”.',
        '**Sedes** (si el negocio tiene varias): nombre, WhatsApp, dirección, link del mapa, aforo propio y, opcionalmente, **“Numerar las reservas de esta sede desde #1”**: el código de reserva de esa sede cuenta aparte (#1, #2, #3…) y es el que ven el cliente y tu equipo (en el panel, en el WhatsApp de la web y en los avisos). Las reservas que ya existían en la sede no cambian; las nuevas empiezan desde #1.',
        '**Ubicaciones:** las zonas del local (SALÓN, PLANTA ALTA, TERRAZA…). Se eligen al cargar una reserva, sirven para el aforo y para el sitio de reservas y el plano.',
        '**Pedidos** (si tu negocio los usa): recepción, formas de entrega, horarios de pedidos y medios de pago. Ver la sección “Pedidos”.',
        '**Etiquetas de clientes** para clasificarlos y hacer seguimiento.',
        '**Usuarios:** el dueño o el administrador dan de alta a su gente, eligen el rol (el administrador solo puede asignar encargado, staff o solo lectura), las sedes a las que accede cada uno, y pueden desactivarlos.',
      ] },
    ],
  },
  {
    id: 'que-se-configura', grupo: 'Administración', titulo: 'Qué podés configurar vos (sin pedir cambios)', solo: 'admin', resumen: 'Dónde se cambia cada cosa desde el panel, sin pedir ayuda.',
    bloques: [
      { t: 'tabla', cab: ['Quiero cambiar…', 'Dónde'], filas: [
        ['Los tipos de reserva (nombre, orden, activos y en qué días se ofrecen)', 'Configuración → Tipos de reserva'],
        ['Algo solo para una sede (tipos, confirmación, parámetros, sitio, mensajes, duración de mesas)', 'Configuración → elegí la sede arriba (“Configurando:”) y personalizá lo que quieras'],
        ['Si las reservas se confirman solas o las confirma un asesor (por cantidad de personas, tipo, fecha, día o sede)', 'Configuración → Confirmación de reservas'],
        ['Qué días abre el negocio o una sede, y los días especiales que abre', 'Configuración → Días de apertura'],
        ['A qué % de aforo se avisa, los turnos del plano, qué estados bloquean una mesa', 'Configuración → Parámetros de reservas'],
        ['Ubicaciones (SALÓN, TERRAZA…), aforo y fechas bloqueadas', 'Configuración → Ubicaciones, Aforo y Fechas bloqueadas'],
        ['Qué ofrece el sitio de reservas: tipos, horarios, días, personas y textos', 'Configuración → Sitio de reservas'],
        ['El plano: salones, mesas fijas o móviles, capacidades, duración de la mesa', 'Salón y mesas → Editar plano'],
        ['La carta y los pedidos (precios, fotos, envío, medios de pago)', 'Carta y Pedidos → Ajustes'],
        ['Cuándo se reciben pedidos y los días sin pedidos', 'Configuración → Pedidos → Horarios de pedidos (o el botón Ajustes de Pedidos)'],
        ['Las formas de entrega (retiro, delivery, en mesa o las tuyas), su costo de envío, tiempo y horarios', 'Configuración → Pedidos → Formas de entrega'],
        ['Los medios de pago (efectivo, transferencia, Mercado Pago…) y los datos para pagar', 'Configuración → Pedidos → Medios de pago'],
        ['Premios por visitas', 'Fidelización → Ajustes y reglas'],
        ['Usuarios, roles y sedes', 'Configuración → Usuarios'],
        ['Etiquetas de clientes', 'Configuración → Etiquetas'],
      ] },
      { t: 'p', x: '**Esto lo cambia Risto Suite por vos** (no se hace desde el panel): los textos y beneficios de las reseñas, los cumpleaños y los vouchers (por ejemplo “25 % OFF”), las campañas de retorno (cada cuánto, hasta cuándo vence y qué mensaje se manda) y la redacción de los mensajes que el bot manda al cambiar el estado de una reserva. Pedíselo cuando lo necesites; si es algo que cambiás seguido, avisá y se pasa al panel.' },
    ],
  },

  // ───────────────────────── Ayuda
  {
    id: 'problemas', grupo: 'Ayuda', titulo: 'Problemas frecuentes', resumen: 'Qué mirar cuando algo no aparece o no anda.',
    bloques: [
      { t: 'tabla', cab: ['Me pasa…', 'Qué hacer'], filas: [
        ['No veo un módulo en el menú', 'Ese módulo no está activado en tu negocio. Consultalo con Risto Suite.'],
        ['No veo los botones de acción', 'Tu usuario es de “solo lectura”, o no tiene permiso para esa pantalla.'],
        ['Cargué algo y no aparece', 'Mirá los filtros de arriba (período, estado, ubicación): puede estar filtrado. Probá recargar.'],
        ['El sitio de reservas dice “no encontrado”', 'Está apagado (Configuración → Sitio de reservas → Activo) o el negocio no tiene el módulo Reservas.'],
        ['Una reserva del sitio quedó en “Nuevas” (o se confirmó sola) y no esperaba eso', 'Mirá Configuración → Confirmación de reservas: puede haber una excepción por cantidad de personas, tipo, fecha o día. El probador de esa sección te dice cuál aplica. Desactivá o reordená la excepción (la primera que coincide manda).'],
        ['El sitio muestra un día como cerrado', 'Ese día de la semana no está entre los días de apertura (Configuración → Días de apertura) o tiene una fecha bloqueada de todo el día. Si es una semana especial, agregalo en “Días especiales que abre”.'],
        ['Un tipo de reserva no aparece en el sitio', 'Mirá su disponibilidad en Configuración → Tipos de reserva: puede ser solo de ciertos días de la semana o de fechas particulares.'],
        ['El sitio no avisa “quedan pocos lugares”', 'Revisá que esté activado (Configuración → Sitio de reservas → Aviso de pocos lugares), que el sector tenga una regla de aforo (Configuración → Aforo) y que los lugares libres sean menos que el número elegido. Un horario completo no avisa: se ve como “Completo”.'],
        ['El sitio no ofrece un horario', 'Puede estar completo (aforo), bloqueado (Fechas bloqueadas), en el pasado o dentro de la anticipación mínima.'],
        ['El cliente dice que no puede elegir una mesa', 'Está reservada (confirmada, pendiente de pago o revisar pago) a esa hora, o no sirve para esa cantidad de personas (capacidad mínima/máxima), o es fija y quiso juntarla.'],
        ['Un cliente dice que reservó en el sitio y no lo veo', 'Mirá el bloque “Solicitudes web esperando el WhatsApp” de Reservas: si su solicitud está ahí, todavía no mandó el mensaje o el bot no lo tomó. Registrala con “Registrar con su teléfono”. Si no está, la solicitud venció (48 h) o nunca se guardó.'],
        ['Dos clientes pidieron la misma mesa', 'Es posible mientras ninguna esté confirmada. Al asignar la segunda te avisa del choque; hablá con el cliente y cambiá una de las dos.'],
        ['La carta no me deja pedir / dice que estamos fuera de horario', 'Mirá Configuración → Pedidos: el interruptor “Recibiendo pedidos”, los **horarios de pedidos** (cada forma de entrega puede tener los suyos), los **días sin pedidos** y que la forma de entrega esté **activa**. Si el delivery está cerrado pero el retiro no, la carta solo ofrece el retiro.'],
        ['El voucher no llegó', 'Buscá el teléfono en Vouchers. Si no existe, el bot no lo emitió: revisá que el cliente tenga una reseña de 4 o 5 estrellas (campaña de reseña) y que no haya recibido ya uno.'],
        ['La pantalla se ve “congelada” después de guardar', 'Recargá la página. Si se repite, avisá al soporte.'],
      ] },
    ],
  },
  {
    id: 'glosario', grupo: 'Ayuda', titulo: 'Glosario', resumen: 'Las palabras que usa el sistema.',
    bloques: [
      { t: 'tabla', cab: ['Término', 'Significado'], filas: [
        ['Aforo', 'Cantidad máxima de personas que el local acepta, en total o por ubicación y franja horaria.'],
        ['Ubicación', 'Zona del local (SALÓN, PLANTA ALTA, TERRAZA…).'],
        ['Forma de entrega', 'Cómo recibe el cliente su pedido (retiro, delivery, en mesa o una propia del negocio).'],
        ['Mesa fija / móvil', 'La fija no se junta con otras; las móviles se pueden juntar entre sí.'],
        ['Capacidad mínima / máxima', 'Rango de personas para el que sirve una mesa o un grupo de mesas.'],
        ['Seña', 'Pago adelantado para asegurar la reserva (estado “Pendiente de pago”).'],
        ['Voucher', 'Código de beneficio con vencimiento, asociado a un cliente y a una campaña.'],
        ['Campaña', 'Una acción de marketing o un motivo de voucher (reseña, cumpleaños, retorno, fidelidad…).'],
        ['Derivada', 'Reserva que toma el bot pero administra otra producción.'],
        ['Sede', 'Cada local de un negocio que tiene varios.'],
        ['Módulo', 'Cada parte del CRM que se enciende o apaga por negocio.'],
        ['Bot', 'El asistente de WhatsApp del negocio: toma reservas, consultas y pedidos, y le pasa el chat a una persona cuando hace falta.'],
      ] },
    ],
  },
]
