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
  /** admin = dueño, administrador o superadmin; superadmin = solo superadmin */
  solo?: 'admin' | 'superadmin'
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
      { t: 'p', x: 'La barra de pestañas muestra **solo los módulos que tu negocio tiene encendidos**. Si falta algo que esperabas ver, no es un error: ese módulo está apagado y lo enciende el superadmin (ver “Módulos”).' },
      { t: 'p', x: 'Para salir, usá el botón **Salir** (arriba a la derecha). Si dejaste la pantalla abierta mucho tiempo, igual cierra la sesión.' },
      { t: 'tip', x: 'En el celular la barra de pestañas se desliza hacia los costados, y las tablas se convierten en tarjetas.' },
      { t: 'tip', x: 'Todas las fechas se ven y se escriben **día-mes-año** (por ejemplo 26-10-2026). En los campos de fecha podés escribir solo los números (26102026) o tocar el calendario, que empieza en lunes.' },
      { t: 'tip', x: 'Las pantallas se actualizan solas (reservas nuevas, pedidos, vouchers). Cuando entra una reserva o un pedido nuevo suena un aviso y aparece una notificación. Si algo no cambia, recargá la página.' },
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
        ['Superadmin', 'Es el rol de Risto Suite: ve todos los negocios, crea negocios y usuarios, y enciende o apaga los módulos de cada uno.'],
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
        '**Aviso para el equipo:** el mismo webhook (y la respuesta del bot cuando entra, se modifica o se cancela una reserva desde el sitio) trae un campo `notificacion_equipo` con un texto armado para que el local se entere de qué pasó, por ejemplo «🟢 NUEVA RESERVA · San Lorenzo / #5 Facundo Vilches / 📅 Sábado 31-10-2026 · 21:00 / 👥 6 personas / 📍 SALÓN». Se reenvía desde BotConversa a un contacto o grupo del equipo (ver la guía de conexión de BotConversa).',
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
      { t: 'p', x: '**Modo servicio.** Elegís la fecha y el momento (**Ahora**, una hora o Almuerzo / Cena). Cada mesa se pinta según su estado: libre, reservada, **llegó** (amarillo), ocupada o fuera de servicio. Tocás una mesa y se abre su panel. Abajo ves la **lista de reservas del día**:' },
      { t: 'lista', x: [
        '**Asignar / Cambiar:** elegís la mesa (o varias, si son móviles y se juntan). Si otra reserva ya tiene esa mesa a esa hora, te avisa y podés forzarlo.',
        '**Sugerir:** el sistema propone la mesa más justa para la cantidad de personas, o dos o tres móviles juntas.',
        '**Llegó → Sentar → Liberar:** marcan que el cliente llegó, que se sentó (la mesa pasa a Ocupada) y que se fue (la mesa vuelve a Libre).',
        '**Ocupar sin reserva:** para gente que llega sin reservar; anotás cuántos son.',
      ] },
      { t: 'p', x: '**Mesas fijas y móviles.** Cada mesa tiene **capacidad mínima y máxima** (por ejemplo, de 2 a 4). Una mesa **fija** no se puede juntar con otras. Las **móviles** (borde punteado) se pueden juntar entre sí: la capacidad del grupo es la suma de los mínimos hasta la suma de los máximos. No se pueden juntar una fija con una móvil, ni dos fijas.' },
      { t: 'p', x: '**Modo editar** (botón **Editar plano**, para dueño, administrador y encargado). Podés crear **salones** (ancho y alto), agregar mesas, **varias mesas** de una vez, y **carteles** (BARRA, ESCENARIO, ENTRADA…). Las mesas se arrastran con el mouse y no se pisan entre sí. En cada mesa editás número, capacidad mínima y máxima, forma y si es **Móvil**. En cada salón elegís su **Ubicación del CRM** (SALÓN, PLANTA ALTA…): así el sitio de reservas sabe qué plano mostrar cuando el cliente elige esa ubicación.' },
      { t: 'p', x: '**Sillas.** Cada mesa dibuja una silla por lugar (su capacidad máxima), repartidas por sus lados o alrededor si es redonda. En cada **salón** elegís el estilo de las sillas (redondas, cuadradas, con respaldo o sin sillas) y su color. En cada **mesa** podés **girarla** (de a 15° o 90°, o escribir los grados), sacarle las sillas de un lado (por ejemplo si está contra la pared) o quitárselas. Se ven igual en el servicio, al elegir mesa al cargar una reserva y en el sitio de reservas. El giro es solo el dibujo: el lugar que ocupa en el plano no cambia.' },
      { t: 'p', x: '**Planos activos e inactivos.** Podés tener varios planos guardados aunque no los uses (por ejemplo, el salón de invierno o una distribución para eventos). En modo editar, cada plano tiene el botón **Activar / Desactivar este plano**. Un plano **inactivo** conserva todas sus mesas, pero no aparece en el servicio, no se ofrece al asignar mesas ni en el sitio de reservas, y no entra en el QR de mesas. Cuando lo reactivás vuelve todo como estaba. Si el módulo Salón y mesas está apagado para el negocio, tampoco se usa ningún plano (siguen guardados).' },
      { t: 'p', x: '**Duración de la mesa:** cuánto tiempo se considera ocupada una mesa reservada (por defecto 120 minutos). Dos reservas chocan si caen a menos de esa duración una de otra.' },
      { t: 'tip', x: '**Hoja de QR de las mesas** (/qr-mesas): imprime un QR por mesa que lleva a la carta con la mesa ya cargada, para pedir desde la mesa (necesita Carta y Pedidos).' },
    ],
  },
  {
    id: 'sitio-reservas', grupo: 'Operación diaria', titulo: 'Sitio de reservas (versión de prueba)', modulo: 'reservas', resumen: 'La página pública donde el cliente elige día y mesa, y la reserva se registra cuando escribe por WhatsApp.',
    bloques: [
      { t: 'p', x: 'Es una página pública, sin login: **crm.ristosuite.app/reservar/club-fellini-bar** (cambia el final según el negocio). El enlace se puede compartir por Instagram, WhatsApp o un QR. Está marcada como **“Sitio de prueba”**. Necesita que el negocio tenga cargado su **WhatsApp** (Configuración → Negocio).' },
      { t: 'p', x: '**La idea:** igual que los pedidos de Toque, el cliente no “reserva” en la web: **arma su solicitud y la termina de confirmar por WhatsApp**. La reserva real **no existe hasta que llega su mensaje**. Así no se acumulan reservas fantasma de gente que abandonó a la mitad, y el teléfono es el de quien escribe (por eso el formulario **no pide teléfono**).' },
      { t: 'p', x: '**Si el negocio tiene sedes**, el primer paso es **“¿En qué sede?”** y cada sede se comporta como un negocio propio: usa **su WhatsApp** (si la sede no tiene, el del negocio), **sus ubicaciones** (las que cargaste para esa sede más las generales), **su aforo y sus fechas bloqueadas**, **su plano de mesas** (una sede puede tener plano y otra no: la que no tiene deja que un asesor elija la mesa), y opcionalmente **sus horarios y su mensaje**. La reserva queda en la sede elegida. Una sede se ofrece solo si está activa, no está apagada para la web y tiene un WhatsApp al que escribir. Si queda una sola sede, el sitio no pregunta. Cada sede tiene su enlace directo (`/reservar/<negocio>?sede=<nombre de la sede>`) que se copia en Configuración.' },
      { t: 'p', x: '**Cómo lo vive el cliente:**' },
      { t: 'pasos', x: [
        'Elige **día, cantidad de personas, ubicación, tipo de reserva y horario**. Todo sale de lo que tenés configurado en el CRM: las ubicaciones, los tipos, los horarios, el aforo y las fechas bloqueadas. Un horario completo o cerrado aparece como “Completo” o “Cerrado”.',
        'Elige su mesa **tocando el plano**, o toca **“Que un asesor la elija”**. Las mesas que no sirven para su grupo se ven “No apta”; las que ya tienen una reserva **confirmada, pendiente de pago o en revisión de pago** se ven “Reservada” y no se pueden tocar.',
        'Deja su nombre y comentarios, y toca **Reservar y enviar por WhatsApp**.',
        'Se guarda la **solicitud en espera** (con un **código** de 6 caracteres) y se abre **WhatsApp con un mensaje ya escrito** (“SOLICITUD DE RESERVA…” con el código y todos los datos). El cliente tiene que **enviarlo sin cambiarlo**: ese es el paso que registra la reserva.',
      ] },
      { t: 'p', x: '**Qué pasa del lado del local:**' },
      { t: 'pasos', x: [
        'Cuando el mensaje llega, **el bot** lo reconoce por la frase “SOLICITUD DE RESERVA” y su código, y **crea la reserva** con el teléfono de quien escribió. Aparece en **Reservas** como **Nueva**, con la marca “[Sitio de prueba]” en observaciones y las mesas ya asignadas si las eligió el cliente. El bot le contesta que la recibió.',
        'Hablás con el cliente y la **confirmás** (o la pasás a **Pendiente de pago** si pedís seña). Recién ahí la mesa queda **bloqueada** para los demás en el sitio.',
        'Si el bot no la tomó (todavía no está configurada la regla, o el cliente escribió cambiando el texto), la solicitud queda en el bloque **“Solicitudes web esperando el WhatsApp”** de **Reservas**. Buscás su código en el chat de WhatsApp, tocás **“Registrar con su teléfono”**, escribís el número con el que te escribió y se crea la reserva.',
        'Si el cliente nunca escribe, la solicitud no molesta: no ocupa mesa ni aforo, vence a las **48 horas** y se borra sola. También podés **descartarla** (el tachito).',
      ] },
      { t: 'p', x: '**Cancelar o modificar una reserva desde un link.** Cada reserva tiene su propio link (`/reservar/<negocio>/r/<código>`) que el bot le manda al cliente junto con la confirmación. Ahí el cliente puede **cancelar** o **modificar** (día, hora o cantidad de personas, con los mismos horarios y aforo del sitio). Pedirlo **no cambia nada todavía**: se abre WhatsApp con un mensaje ya escrito (“CANCELACIÓN DE RESERVA - …” o “MODIFICACIÓN DE RESERVA - …”, con un código) y el cambio se aplica recién cuando ese mensaje llega **desde el mismo teléfono con el que se hizo la reserva**. Si lo manda otro número, no se toca nada y el chat se deriva a una persona: así nadie puede cancelar o cambiar reservas ajenas. Una modificación borra la mesa asignada (hay que reasignarla), deja una nota y, si el local revisa cada reserva, la vuelve a “Nueva”. Los textos que contesta el bot se editan en Configuración → Mensajes del bot.' },
      { t: 'ojo', x: 'Si entre que el cliente armó la solicitud y mandó el mensaje la mesa se ocupó o el horario se completó, **igual se crea la reserva** (el cliente ya escribió), pero **sin mesa** y con un aviso en las observaciones para que un asesor la resuelva con él.' },
      { t: 'ojo', x: 'Una reserva **“Nueva” no bloquea** la mesa: dos clientes pueden pedir la misma mientras ninguna esté confirmada. Si pasa, al asignar la segunda el sistema te avisa del choque y vos resolvés con el cliente.' },
      { t: 'p', x: '**Configuración del sitio** (dueño, administrador): en **Configuración → Sitio de reservas (prueba)**.' },
      { t: 'lista', x: [
        '**Activo:** apagado, el enlace muestra “no encontrado”.',
        '**Sedes en el sitio** (si el negocio tiene sedes): por cada sede, si se ofrece en el sitio, sus propios horarios, si deja elegir mesa en el plano y su mensaje. Lo que quede vacío hereda lo del sitio. El WhatsApp de cada sede se carga en Sedes.',
        '**El cliente puede elegir su mesa:** si lo apagás, siempre decide un asesor.',
        '**Tipos de reserva que se ofrecen:** tildás cuáles (Común, Cumpleaños, Cena show…). Cada tipo se ofrece solo los días en que está disponible (se configura en Tipos de reserva).',
        '**Dirección del sitio: del negocio o de una sede.** El sitio del negocio es `/reservar/<identificador del negocio>` y deja elegir la sede. Si una sede necesita su **propio sitio** (por ejemplo, porque las otras sedes ya tienen el suyo), en Configuración → elegí la sede arriba → Sitio de reservas → **Dirección propia del sitio** (por ejemplo `nenina-san-lorenzo`). El sitio queda en `/reservar/nenina-san-lorenzo` y muestra **solo esa sede**: el cliente no elige sede, el título lleva el nombre de la sede y todo (horarios, ubicaciones, plano, WhatsApp, mensajes) es el de esa sede. La dirección no se puede repetir con la de otra sede ni con la de un negocio. Si la sede apaga Reservas o se desactiva, esa dirección deja de funcionar.',
        '**Publicarlo en otro dominio (por ejemplo reservas.ristosuite.app/nenina-san-lorenzo).** Un dominio solo puede estar en un proyecto de Vercel, así que si `reservas.ristosuite.app` pertenece a otro proyecto, en ESE proyecto se agrega una regla que reenvíe la dirección al CRM (en su `vercel.json`): `{ "rewrites": [{ "source": "/nenina-san-lorenzo", "destination": "https://crm.ristosuite.app/reservar/nenina-san-lorenzo" }] }`. Con `rewrites` la dirección del navegador queda en `reservas.ristosuite.app/nenina-san-lorenzo`; con `redirects` (mismo formato, más `"permanent": false`) el navegador pasa a `crm.ristosuite.app/reservar/nenina-san-lorenzo`. Cada sede nueva con dirección propia necesita su regla.',
        '**Aviso de pocos lugares:** cuando a un horario de un sector (ubicación) le quedan pocos lugares, el sitio lo avisa debajo de la hora: **“Quedan pocos lugares”** (recomendado: avisa que se está llenando sin mostrar la capacidad del local) o **“Quedan 6 lugares”** (el número exacto; “Queda 1 lugar” en singular). Elegís desde cuántos lugares libres avisar (por defecto 10) y podés cambiar el texto (por ejemplo, “¡Últimas mesas!”). Los lugares son personas, como en el aforo. Se calcula con tus **reglas de aforo** por ubicación y franja: un sector sin regla de aforo nunca avisa. Con “cualquier ubicación” avisa solo si en todos los sectores quedan pocos. Viene apagado.',
        '**Horarios por día de la semana:** además de los horarios generales, podés poner horarios distintos para cada día (por ejemplo, los sábados también al mediodía). El día que dejes vacío usa los generales. Cada **sede** también puede tener horarios distintos según el día de la semana (se abre desde la tarjeta de la sede); el orden es: horarios de la sede para ese día, horarios de la sede, horarios del sitio para ese día, horarios del sitio.',
        '**Cualquier ubicación disponible:** una opción más junto a tus ubicaciones para que el cliente reserve sin elegir lugar ni mesa. Solo aparece si tenés dos o más ubicaciones. El horario se ofrece si **entra en al menos una ubicación** según el aforo de cada una (y los topes generales y fechas bloqueadas); cuando llega el WhatsApp se le asigna la **primera ubicación con lugar, en el orden en que cargaste las ubicaciones**. Si en el medio se llenaron todas, la reserva igual se crea, sin ubicación y con una nota para que la resuelvas. Podés cambiar el texto de la opción.',
        '**Horarios:** una lista separada por coma (13:00, 21:00). Vacío = usa los horarios que más se usan en tus reservas.',
        '**Días hacia adelante, anticipación mínima y rango de personas.** Y un **mensaje** que ve el cliente (por ejemplo: “Tolerancia de 15 minutos”).',
        '**Preguntar el cumpleaños:** agrega al formulario el día y el mes de cumpleaños, siempre **opcional** para el cliente (los dos o ninguno). Si lo completa, se guarda en la reserva y en su ficha para el módulo Cumpleaños, y va en el mensaje de WhatsApp.',
        '**Modo prueba:** muestra el cartel “Sitio de prueba” y marca las reservas “[Sitio de prueba]”. Apagalo para publicarlo de verdad.',
        '**Título y subtítulo** de la página (por defecto, el nombre del local y “Reservá tu mesa”).',
        '**Cuánto espera la solicitud** (horas) y **máximo de mesas por reserva** (cuántas móviles se pueden juntar).',
        '**Mensaje de WhatsApp:** el texto que se arma para el cliente. Podés cambiar las líneas y el orden con variables como {nombre} o {hora}; una línea cuyo dato esté vacío no se incluye. **Tiene que llevar {codigo}**. Abajo ves una vista previa.',
      ] },
      { t: 'tip', x: 'Para probarlo: abrí el enlace desde tu celular, armá una solicitud con tu nombre, enviá el mensaje de WhatsApp y mirá cómo aparece la reserva en Reservas. Después cancelala.' },
    ],
  },
  {
    id: 'shows', grupo: 'Operación diaria', titulo: 'Shows', modulo: 'shows', resumen: 'Cartelera y cupos de shows (en preparación).',
    bloques: [
      { t: 'p', x: 'La carpeta del módulo existe y se enciende desde Administración, pero **todavía no tiene pantallas completas**. Está pensado para la cartelera de shows y eventos, con entradas y cupos. Mientras tanto, las cenas show se manejan como un **tipo de reserva** (“Cena show”).' },
    ],
  },
  {
    id: 'carta', grupo: 'Operación diaria', titulo: 'Carta digital', modulo: 'carta', resumen: 'El menú online: categorías, productos, fotos y precios.',
    bloques: [
      { t: 'p', x: 'Armás la carta de tu negocio y los clientes la ven en una página pública: **crm.ristosuite.app/carta/<tu-negocio>**, sin necesidad de login. Funciona sola (solo para mirar) o junto con Pedidos.' },
      { t: 'pasos', x: [
        'Creá las **categorías** (Entradas, Platos, Postres…). Podés ordenarlas y ocultarlas.',
        'Agregá **productos**: nombre, descripción, precio (o **variantes** con su precio, por ejemplo Chico / Grande), **foto** y **etiquetas** (recomendado, vegano, sin TACC, picante…). Las fotos se achican solas.',
        'Usá el interruptor **Disponible / Agotado** para marcar lo que se terminó sin borrarlo. También podés **destacar** u **ocultar** un producto.',
        '**Importar texto:** pegás una lista con el formato “Categoría | Producto | Precio | Descripción” y se cargan todos juntos.',
        'En **Ajustes** elegís si se muestran precios, el título y un mensaje. Desde ahí sacás también el **QR** de la carta para imprimir.',
      ] },
      { t: 'tip', x: 'El enlace de la carta se puede cargar en la variable del bot de BotConversa que usa el menú, para que el bot mande siempre la carta actualizada.' },
    ],
  },
  {
    id: 'pedidos', grupo: 'Operación diaria', titulo: 'Pedidos', modulo: 'pedidos', resumen: 'Pedidos de retiro, delivery y mesa que llegan desde la carta.',
    bloques: [
      { t: 'p', x: 'Los clientes arman su pedido desde la carta pública (agregan productos, eligen retiro, delivery o mesa, forma de pago y dejan sus datos). **Los precios siempre los recalcula el servidor desde la carta**: el cliente no puede cambiarlos.' },
      { t: 'pasos', x: [
        'Activá **“Recibiendo pedidos”** (interruptor en la pantalla de Pedidos). Apagado, la carta sigue visible pero no se puede pedir.',
        'Cada pedido nuevo suena, avisa y aparece como tarjeta con sus ítems. Con el botón de **siguiente paso** lo avanzás: Aceptado → Preparando → Listo → (En camino) → Entregado.',
        'Podés **cancelar** un pedido con motivo, **reabrirlo**, **imprimir el ticket** (formato 80 mm) o **avisar al cliente por WhatsApp** con un clic (abre WhatsApp con un mensaje según el estado).',
        'También podés cargar un **pedido manual** (por ejemplo, uno que llegó por teléfono).',
      ] },
      { t: 'p', x: '**Ajustes:** recibir retiro, delivery y/o pedidos a la mesa; costo de envío fijo; pedido mínimo; tiempo estimado; medios de pago (efectivo, transferencia, tarjeta) y los datos para transferir; y un mensaje para el cliente.' },
      { t: 'p', x: '**Pedidos a la mesa:** imprimí la hoja de QR (Salón y mesas → QR de mesas). Cada QR abre la carta con el número de mesa ya cargado.' },
      { t: 'ojo', x: 'Todavía no cobra online ni calcula el envío por zona: el pago se coordina con el cliente. El aviso por WhatsApp al cambiar de estado es un botón manual.' },
    ],
  },

  // ───────────────────────── Clientes y marketing
  {
    id: 'clientes', grupo: 'Clientes y marketing', titulo: 'Clientes', modulo: 'clientes', resumen: 'Base de clientes, historial y etiquetas.',
    bloques: [
      { t: 'p', x: 'Cada persona que reservó, pidió o escribió queda como cliente, identificada por su **teléfono**. Podés buscar por nombre o teléfono y filtrar por **etiqueta** y por **origen** (de dónde llegó: WhatsApp, QR de la carta, Wifi…).' },
      { t: 'p', x: 'La **ficha del cliente** reúne su teléfono, origen, desde cuándo es cliente, su cumpleaños, su tarjeta de fidelidad, sus vouchers, sus reseñas y el **historial de reservas**. Desde ahí podés corregir su nombre y emitirle un voucher.' },
      { t: 'p', x: '**Etiquetas:** sirven para clasificar (por ejemplo “post visita”, “VIP”). Se crean en Configuración → Etiquetas de clientes. Si el negocio usa BotConversa, al etiquetar acá también se etiqueta allá.' },
    ],
  },
  {
    id: 'cumpleanos', grupo: 'Clientes y marketing', titulo: 'Cumpleaños', modulo: 'cumpleanos', resumen: 'Próximos cumpleaños y qué meses tienen más.',
    bloques: [
      { t: 'p', x: 'Lista los **próximos cumpleaños** de tus clientes (con la edad que cumplen). Se cargan solos cuando una reserva trae la fecha, o a mano con **Agregar cumpleaños**.' },
      { t: 'p', x: 'El **gráfico de barras** muestra cuántos cumpleaños hay en cada mes, para anticipar cuándo conviene hacer promociones. El saludo y el voucher de cumpleaños los manda el flujo automático del bot (ver “Automatizaciones”).' },
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
      { t: 'p', x: 'El **aviso al cliente** (“¡ganaste un premio!”) lo manda un flujo de n8n, que hoy está en modo de prueba (ver “Automatizaciones”).' },
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
    ],
  },
  {
    id: 'campanas', grupo: 'Clientes y marketing', titulo: 'Campañas', modulo: 'campanas', resumen: 'Seguimiento de a quién se le mandó cada campaña.',
    bloques: [
      { t: 'p', x: 'Las campañas de marketing las **manda un flujo de n8n** (no se envían desde el CRM). Cada envío queda registrado acá: ves cada campaña y **a qué clientes se les envió**. Sirve para no repetirle la misma campaña a la misma persona y para medir resultados.' },
    ],
  },
  {
    id: 'derivadas', grupo: 'Clientes y marketing', titulo: 'Derivadas', modulo: 'derivadas', resumen: 'Reservas de cena show que toma el bot y administra otra producción.',
    bloques: [{ t: 'p', x: 'Lista las reservas que el bot toma pero que **gestiona otra producción** (por ejemplo, ciertas cenas show). Acá las ves y las buscás por nombre, teléfono u observación, pero no se confirman desde este panel.' }],
  },
  {
    id: 'pausados', grupo: 'Clientes y marketing', titulo: 'Chats pausados, conversaciones y botón del bot', resumen: 'Cuando el bot le pasa el chat a una persona.',
    bloques: [
      { t: 'p', x: '**Chats pausados** (para encargados y administradores): cuando el bot deriva a un cliente a una persona, su chat queda **pausado** para que el bot no se meta. Acá ves quiénes están esperando y podés **reactivar** el chat (uno por uno o todos juntos) cuando terminaste. Pasado un tiempo (que se configura), el bot vuelve a atender solo.' },
      { t: 'p', x: '**Conversaciones** (si está encendido): muestra los chats del bot de WhatsApp para leerlos.' },
      { t: 'p', x: 'El botón **Bot encendido / apagado** (arriba a la derecha, si tu negocio lo tiene) apaga al bot por completo: no responde ni registra mensajes. Una barra roja avisa mientras está apagado.' },
    ],
  },

  // ───────────────────────── Análisis
  {
    id: 'metricas', grupo: 'Análisis', titulo: 'Métricas', modulo: 'metricas', resumen: 'Gráficos de reservas, horarios y clientes recurrentes.',
    bloques: [{ t: 'p', x: 'Elegís el período y ves: **promedio de personas por reserva**, **horario más reservado**, la **evolución** de reservas (por día, semana o mes), los **días más fuertes**, los **horarios más reservados**, las reservas **por estado** (y por sede si hay varias) y los **clientes recurrentes** (los que más vuelven). Se calculan con las reservas, así que sin Reservas los gráficos quedan vacíos.' }],
  },

  // ───────────────────────── Administración
  {
    id: 'configuracion', grupo: 'Administración', titulo: 'Configuración del negocio', solo: 'admin', resumen: 'Aforo, fechas bloqueadas, ubicaciones, sedes y más.',
    bloques: [
      { t: 'p', x: 'Arriba hay un índice para saltar a cada sección. Cada una se guarda por separado.' },
      { t: 'lista', x: [
        '**Negocio:** nombre, WhatsApp y datos generales.',
        '**Sedes:** si el negocio tiene varias, cada una con su aforo, fechas bloqueadas y WhatsApp.',
        '**Aforo:** cuántas personas entran. Podés poner un máximo general y **reglas por ubicación y franja horaria** (por ejemplo, SALÓN de 20:00 a 23:00: 60 personas). Avisa al llegar al 90 % y al cargar una reserva que lo supera. El sitio de reservas respeta estas reglas. Cada regla puede valer **solo ciertos días de la semana** o **solo un rango de fechas**: así tenés, por ejemplo, 120 personas los viernes y sábados y 60 de lunes a jueves, o un aforo especial para la semana de fin de año. Una reserva cuenta en todas las reglas que le corresponden, por eso para tener un aforo distinto por día cargás una regla por grupo de días (y no una general que las pise).',
        '**Días de apertura:** si el negocio (o una sede) **no abre todos los días**, marcás los días de la semana que abre habitualmente (por ejemplo jueves a sábado). El sitio de reservas muestra los demás días cerrados, no se pueden elegir, y el bot tampoco los ofrece. Cada sede puede tener sus propios días o usar los del negocio. Para una **semana especial** en que abre un día que normalmente no abre, lo sumás en “Días especiales que abre”. Para **cerrar un día puntual** que normalmente abre, usás “Fechas bloqueadas”.',
        '**Configurar por sede:** si el negocio tiene sedes, arriba de la pantalla elegís qué estás configurando: **Todo el negocio** o una **sede**. En una sede cada ajuste hereda lo del negocio hasta que lo **personalices** (casillero “Personalizar para esta sede”): ves el valor del negocio, no se puede editar, y al marcarlo la sede usa el suyo. Se puede personalizar por sede: **tipos de reserva** (si la sede los ofrece y en qué días), **confirmación** (cómo entran sus reservas), **parámetros** (alerta de aforo, turnos, estados que bloquean), **sitio de reservas** (días hacia adelante, anticipación, personas, validez, textos, cumpleaños, cualquier ubicación, aviso de pocos lugares, tipos ofrecidos, horarios y mesa), **mensajes del bot** y la **duración de las mesas**. El aforo, los días de apertura, las fechas bloqueadas, las ubicaciones, los planos y la numeración ya eran por sede. Los usuarios, las etiquetas y la conexión con el bot son del negocio.',
        '**Fechas bloqueadas:** días (o franjas) en los que no se aceptan reservas, por ejemplo un feriado o un evento privado.',
        '**Tipos de reserva:** los que se ofrecen al cargar una reserva y en el sitio (Común, Cumpleaños, Cena show…). Cambiás el nombre, el orden, agregás los tuyos y desactivás los que no uses. Cada tipo tiene su **disponibilidad**: todos los días, solo ciertos días de la semana (por ejemplo Cena show, viernes y sábado) o solo fechas particulares (por ejemplo Cena de Año Nuevo, 31/12); fuera de esos días el sitio no lo ofrece. Si el bot crea un tipo nuevo, aparece como “Sin configurar” para que le pongas nombre.',
        '**Confirmación de reservas:** define si las reservas que llegan por el sitio o el bot **se confirman solas** o **quedan en “Nuevas”** para que un asesor las confirme. Elegís un resultado por defecto y le sumás **excepciones**: por cantidad de personas (por ejemplo, se confirman solas hasta 6 personas y las de más de 6 quedan en Nuevas), por tipo de reserva (Cena show siempre a mano), por fecha particular o rango de fechas (Año Nuevo se revisa todo), por días de la semana o por sede. Se revisan de arriba hacia abajo y manda la primera que coincide; una excepción por fecha va antes que las generales. Abajo hay un probador para ver qué pasaría con una reserva de ejemplo. El cliente recibe “Tu reserva está confirmada” o “Un asesor te la confirma en breve” según corresponda, y si modifica una reserva desde su link y el cambio cae en una excepción “en Nuevas”, la reserva vuelve a revisión. Las reservas que cargás vos a mano las dejás en el estado que elijas.',
        '**Parámetros de reservas:** a qué porcentaje del aforo se avisa (por defecto 90 %), los **turnos** del plano de mesas (Almuerzo 13:00, Cena 21:00… los que quieras) y **qué estados bloquean una mesa** en el sitio.',
        '**Sitio de reservas:** ver la sección “Sitio de reservas”.',
        '**Mensajes del bot:** los textos que el bot le contesta al cliente cuando llega su solicitud (reserva recibida o confirmada, ya registrada, no encontrada, avisos…). Cada uno trae su original y podés restaurarlo.',
        '**Sedes** (si el negocio tiene varias): nombre, WhatsApp, dirección, link del mapa, aforo propio y, opcionalmente, **“Numerar las reservas de esta sede desde #1”**: el código de reserva de esa sede cuenta aparte (#1, #2, #3…) y es el que ven el cliente y tu equipo (en el panel, en el WhatsApp de la web y en los avisos). Las reservas que ya existían en la sede no cambian; las nuevas empiezan desde #1.',
        '**Ubicaciones:** las zonas del local (SALÓN, PLANTA ALTA, TERRAZA…). Se eligen al cargar una reserva, sirven para el aforo y para el sitio de reservas y el plano.',
        '**Etiquetas de clientes** y **Pausa automática de chats** (cuánto tiempo queda pausado un chat derivado).',
        '**Usuarios:** el dueño o el administrador dan de alta a su gente, eligen el rol (el administrador solo puede asignar encargado, staff o solo lectura), las sedes a las que accede cada uno, y pueden desactivarlos.',
      ] },
    ],
  },
  {
    id: 'que-se-configura', grupo: 'Administración', titulo: 'Qué podés configurar vos (sin pedir cambios)', solo: 'admin', resumen: 'Dónde se cambia cada cosa. Nada de esto requiere tocar código.',
    bloques: [
      { t: 'tabla', cab: ['Quiero cambiar…', 'Dónde'], filas: [
        ['Los tipos de reserva (nombre, orden, activos y en qué días se ofrecen)', 'Configuración → Tipos de reserva'],
        ['Algo solo para una sede (tipos, confirmación, parámetros, sitio, mensajes, duración de mesas)', 'Configuración → elegí la sede arriba (“Configurando:”) y personalizá lo que quieras'],
        ['Si las reservas se confirman solas o las confirma un asesor (por cantidad de personas, tipo, fecha, día o sede)', 'Configuración → Confirmación de reservas'],
        ['Qué días abre el negocio o una sede, y los días especiales que abre', 'Configuración → Días de apertura'],
        ['A qué % de aforo se avisa, los turnos del plano, qué estados bloquean una mesa', 'Configuración → Parámetros de reservas'],
        ['Ubicaciones (SALÓN, TERRAZA…), aforo y fechas bloqueadas', 'Configuración → Ubicaciones, Aforo y Fechas bloqueadas'],
        ['Qué ofrece el sitio de reservas: tipos, horarios, días, personas, textos, mensaje de WhatsApp, modo prueba', 'Configuración → Sitio de reservas'],
        ['Lo que el bot le contesta al cliente cuando reserva por el sitio', 'Configuración → Mensajes del bot'],
        ['El plano: salones, mesas fijas o móviles, capacidades, duración de la mesa', 'Salón y mesas → Editar plano'],
        ['La carta y los pedidos (precios, fotos, envío, medios de pago)', 'Carta y Pedidos → Ajustes'],
        ['Premios por visitas', 'Fidelización → Ajustes y reglas'],
        ['A quién avisar y con qué estados cuando cambia una reserva', 'Configuración → Funciones del negocio (superadmin)'],
        ['Qué módulos tiene el negocio', 'Configuración → Funciones del negocio / Administración (superadmin)'],
        ['Usuarios, roles y sedes', 'Configuración → Usuarios'],
        ['Etiquetas de clientes y pausa automática de chats', 'Configuración → Etiquetas y Chats pausados'],
      ] },
      { t: 'p', x: '**Todavía necesita ayuda técnica** (se cambia en n8n o en la base, no desde el panel): los textos y beneficios de los flujos de reseñas, cumpleaños y vouchers (por ejemplo “25 % OFF”), las campañas de retorno (días, vencimiento, plantillas de WhatsApp) y la redacción de los avisos de estado por BotConversa. Si necesitás cambiar alguno con frecuencia, avisá y se pasa al panel.' },
    ],
  },
  {
    id: 'usuarios', grupo: 'Administración', titulo: 'Administración: negocios y usuarios', solo: 'superadmin', resumen: 'Crear negocios y usuarios y asignar módulos (superadmin).',
    bloques: [
      { t: 'p', x: 'La pestaña **Administración** (solo superadmin) tiene dos lugares:' },
      { t: 'lista', x: [
        '**Negocios:** crear un negocio nuevo (nombre, identificador —es el que va en las direcciones públicas, por ejemplo /carta/club-fellini-bar—, WhatsApp), activarlo o desactivarlo y elegir sus **módulos**.',
        '**Usuarios:** crear usuarios (usuario, nombre y contraseña), asignarles uno o más negocios con un **rol** en cada uno y, si hace falta, limitarlos a ciertas sedes. También se pueden desactivar.',
      ] },
      { t: 'tip', x: 'Un usuario nuevo entra con su usuario y contraseña en la pantalla de ingreso. Si olvidó la contraseña, la cambiás vos desde Administración → Usuarios.' },
    ],
  },
  {
    id: 'modulos', grupo: 'Administración', titulo: 'Módulos: encender y apagar', solo: 'superadmin', resumen: 'Qué módulos tiene cada negocio y cuáles “conviene” juntar.',
    bloques: [
      { t: 'p', x: 'Cada negocio tiene **solo los módulos que vos le enciendas**. Un módulo apagado desaparece del menú y su dirección redirige al inicio. Se maneja desde Administración → Negocios (al crear o editar) y desde Configuración → **Funciones del negocio**.' },
      { t: 'p', x: '**Módulos por sede.** El negocio define qué módulos tiene y **cada sede puede apagar los que no usa** (por ejemplo, una sede sin plano de mesas, o sin pedidos). Una sede **nunca** puede tener un módulo que el negocio no tiene. Se elige en Configuración → Funciones del negocio → **Módulos por sede** (una grilla con las sedes y los módulos del negocio). Al mirar esa sede (selector de sede de arriba) el módulo desaparece del menú y su dirección redirige al inicio; el sitio de reservas deja de ofrecer la sede si apagó Reservas, o el plano si apagó Salón y mesas. Con “todas las sedes” se ve un módulo si lo usa alguna. Solo se pueden apagar por sede los módulos operativos (Reservas, Salón y mesas, Shows, Carta, Pedidos, Consultas y Derivadas); Clientes, Cumpleaños, Vouchers y el resto son del negocio entero.' },
      { t: 'p', x: 'Hay **atajos** para configurar de un clic (“Solo reservas”, “Reservas con carta”, “Reservas y pedidos”, “Todo”…), y después ajustás casilla por casilla. Cada módulo es independiente, pero algunos **“conviene”** con otros: al encenderlo se tildan también los que lo acompañan, y la pantalla explica por qué. Podés destildarlos.' },
      { t: 'tabla', cab: ['Módulo', 'Conviene con', 'Por qué'], filas: [
        ['Salón y mesas', 'Reservas', 'Las mesas se asignan a las reservas.'],
        ['Pedidos', 'Carta', 'Los pedidos se arman con productos de la carta. Carta sirve sola (menú para mirar) pero Pedidos sin Carta obliga a escribir cada pedido a mano.'],
        ['Fidelización', 'Reservas, Clientes, Vouchers', 'Las visitas salen de las reservas y el premio es un voucher asociado al cliente.'],
        ['Cumpleaños, Vouchers, Reseñas, Campañas', 'Clientes', 'Cada dato se asocia a un cliente y se ve en su ficha.'],
        ['Métricas, Derivadas', 'Reservas', 'Se calculan con las reservas.'],
      ] },
    ],
  },
  {
    id: 'funciones', grupo: 'Administración', titulo: 'Funciones del negocio: bot, BotConversa y avisos', solo: 'superadmin', resumen: 'Apagado del bot, conexión con BotConversa y avisos al cliente.',
    bloques: [
      { t: 'p', x: 'En Configuración → **Funciones del negocio** (solo superadmin):' },
      { t: 'lista', x: [
        '**Botón de apagar el bot:** muestra u oculta el interruptor del encabezado.',
        '**BotConversa:** activa la sincronización de etiquetas con BotConversa (se guarda la clave de forma segura).',
        '**Avisos al cliente:** a dónde se manda el aviso cuando alguien cambia el estado de una reserva (BotConversa o un webhook de n8n), con qué estados avisa (por ejemplo confirmada, pendiente de pago y cancelada) y, si hay sedes, un destino propio por sede.',
        '**Módulos:** las casillas de cada módulo.',
      ] },
    ],
  },
  {
    id: 'automatizaciones', grupo: 'Administración', titulo: 'Automatizaciones (n8n y BotConversa)', solo: 'superadmin', resumen: 'Qué hace cada flujo, cómo se corre y qué cuidar.',
    bloques: [
      { t: 'p', x: 'El CRM es la base de datos y el panel. Los mensajes de WhatsApp los mandan **BotConversa** (el bot de cada negocio) y **n8n** (los flujos automáticos). Se hablan llamando a **funciones de la base** (`bot_crear_reserva`, `bot_emitir_voucher`, `bot_reserva_web_confirmar`…). El detalle técnico de cada una está en el documento **docs/bot-scripts.md** del repositorio de la base.' },
      { t: 'tabla', cab: ['Flujo', 'Para qué', 'Cómo se dispara'], filas: [
        ['Origen del cliente / Calificación / Respuesta negativa / Emitir voucher (Fellini)', 'Los cuatro pasos de la encuesta de reseña: registran de dónde vino el cliente, su puntaje, su queja y emiten el voucher si calificó bien.', 'Los llama BotConversa por webhook (automático).'],
        ['Confirmar reserva web (Fellini)', 'Cuando el cliente manda “SOLICITUD DE RESERVA … Código: XXXXXX” desde el sitio de reservas, crea la reserva con su teléfono y devuelve el texto para contestarle.', 'Webhook (BotConversa, por palabra clave). Hoy está inactivo: se activa en n8n cuando esté lista la regla.'],
        ['Confirmar reserva web (Nenina)', 'Lo mismo para Nenina: sirve a las tres sedes (la sede ya viene guardada en la solicitud).', 'Webhook (BotConversa, por palabra clave). Hoy está inactivo: se activa en n8n cuando esté lista la regla.'],
        ['Emitir voucher de retorno (BotConversa)', 'Entrega el voucher de la campaña de retorno al cliente que responde.', 'Webhook (automático).'],
        ['Campaña de marketing de retorno (Fellini)', 'Manda la difusión a clientes cuya última reserva confirmada fue hace entre 10 y 60 días, con o sin voucher, hasta un límite por corrida.', 'Manual: lo corrés vos desde n8n.'],
        ['Avisar premios de fidelidad (Fellini)', 'Avisa a los clientes que ganaron un premio de Fidelización.', 'Manual (hoy inactivo, modo de prueba).'],
        ['Cumpleaños y encuestas (otros negocios)', 'Saludos de cumpleaños y encuestas de reseña.', 'Automático por horario.'],
      ] },
      { t: 'p', x: '**Correr la campaña de retorno:**' },
      { t: 'pasos', x: [
        'Abrí el flujo en n8n y mirá el nodo **Configuración**: `crear_voucher` (con o sin voucher), `desde_dias` y `hasta_dias`, `vence_fecha` (DD-MM-AAAA), `beneficio`, `limite_envios` (50 por defecto; 0 = sin límite) y las plantillas de WhatsApp.',
        'Dejá **modo_prueba = true** la primera vez: arma todo pero no manda mensajes reales. Revisá el resultado.',
        'Cuando esté bien, poné modo_prueba en false y ejecutá. Los que ya recibieron la campaña se saltean solos, así que podés correr de nuevo mañana con otro lote de 50 u 80 sin repetir a nadie.',
        'Cada envío queda en **Campañas** y cada voucher en **Vouchers**.',
      ] },
      { t: 'ojo', x: 'Antes de modificar un flujo por API o desde el editor de n8n, **asegurate de que nadie lo tenga abierto en otra pestaña**: si alguien guarda una copia vieja, pisa tus cambios sin avisar. Después de cada cambio, recargá y verificá.' },
      { t: 'ojo', x: 'Para que los mensajes de plantilla funcionen, el nombre de cada plantilla tiene que existir y estar aprobado en WhatsApp. Algunos flujos tienen un nombre provisorio (por ejemplo `fellini_retorno` o `fellini_premio`) que hay que reemplazar por el real.' },
      { t: 'p', x: '**Reserva del sitio web → WhatsApp.** Cuando el cliente manda “SOLICITUD DE RESERVA … Código: XXXXXX”, el bot tiene que llamar a `bot_reserva_web_confirmar` con el negocio, el teléfono de quien escribe y el texto del mensaje. Eso **crea la reserva** (antes de eso solo existe una solicitud en espera) y devuelve sus datos para que el bot conteste. En Fellini está armado el flujo de n8n **“Fellini - Confirmar reserva web (BotConversa)”**: en BotConversa solo hay que crear una regla por palabra clave **SOLICITUD DE RESERVA** que lo llame (situación 29 de docs/bot-scripts.md).' },
    ],
  },

  // ───────────────────────── Ayuda
  {
    id: 'problemas', grupo: 'Ayuda', titulo: 'Problemas frecuentes', resumen: 'Qué mirar cuando algo no aparece o no anda.',
    bloques: [
      { t: 'tabla', cab: ['Me pasa…', 'Qué hacer'], filas: [
        ['No veo un módulo en el menú', 'Está apagado en tu negocio. Pedile al superadmin que lo encienda (Configuración → Funciones del negocio).'],
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
        ['Mesa fija / móvil', 'La fija no se junta con otras; las móviles se pueden juntar entre sí.'],
        ['Capacidad mínima / máxima', 'Rango de personas para el que sirve una mesa o un grupo de mesas.'],
        ['Seña', 'Pago adelantado para asegurar la reserva (estado “Pendiente de pago”).'],
        ['Voucher', 'Código de beneficio con vencimiento, asociado a un cliente y a una campaña.'],
        ['Campaña', 'Una acción de marketing o un motivo de voucher (reseña, cumpleaños, retorno, fidelidad…).'],
        ['Derivada', 'Reserva que toma el bot pero administra otra producción.'],
        ['Superadmin', 'Usuario de Risto Suite que administra todos los negocios y sus módulos.'],
        ['Sede', 'Cada local de un negocio que tiene varios.'],
        ['Módulo', 'Cada parte del CRM que se enciende o apaga por negocio.'],
        ['Webhook', 'Dirección a la que un sistema le avisa a otro que pasó algo (así hablan BotConversa y n8n con el CRM).'],
      ] },
    ],
  },
]
