# Actividad del servidor

Módulo opcional instalado por separado con `sudo python3 scripts/install-activity-admin.py`. Para observar solicitudes activas: añadir `--observe-requests`. Para retirarlo: el mismo comando con `--uninstall`. Actualizar también los recursos del tema mediante el instalador habitual. No añade servicios residentes ni cambia archivos de las aplicaciones o DNS.

En **Inicio del servidor**, el enlace **N conexiones**, dentro de la tarjeta Carga del sistema, realiza una sola consulta ligera. El detalle se descarga al abrirlo; actualización manual por defecto. La opción cada cinco segundos funciona únicamente con el diálogo abierto y la pestaña visible.

- Conexiones TCP establecidas en 80/443, agrupadas por IP: no representan usuarios, sesiones autenticadas ni solicitudes PHP simultáneas.
- Procesos: cuenta, pool PHP, estado, CPU muestreada durante 250 ms, RAM RSS y edad del proceso. 100 % de CPU equivale a un núcleo. Se muestran hasta cien procesos ordenados por CPU/RAM. RSS compartida no puede sumarse como memoria exclusiva.
- SQL: estado y duración de consultas activas sin texto SQL, parámetros ni contraseñas. No permite finalizar consultas ni el servicio SQL.
- Pulsar un pool PHP abre su detalle. Si está instrumentado y ejecutando una solicitud, muestra IP, método, ruta sin parámetros, script y duración. Si no hay metadatos actuales no atribuye una ruta anterior al PID. La coincidencia con la IP del administrador se señala; puede ser una red compartida y no identifica con certeza a una persona. No recoge usuarios internos, cookies, formularios ni contraseñas.
- Solicitudes recientes: lectura acotada de logs Apache por dominio (Nginx cuando no hay log Apache), ocho entradas por log y cien en total. Se omiten parámetros e identificadores largos de rutas. Son registros de solicitudes completadas, no una asociación entre URL y PID. No se muestra el usuario interno de cada aplicación.

**Finalizar** solo aparece para trabajadores PHP-FPM no privilegiados de cuentas de alojamiento. Exige confirmación y una selección firmada que caduca en noventa segundos. Se verifica PID, propietario, hora de inicio, ejecutable, pool y arranque del sistema. Se usa pidfd para evitar actuar sobre otro proceso si se reutiliza el PID. Envía únicamente SIGTERM; no SIGKILL, grupos de procesos ni órdenes arbitrarias. Puede interrumpir una operación en curso. El estado del sistema puede cambiar inmediatamente después de cualquier muestra; FPM puede sustituir al trabajador automáticamente.

Solo está disponible en la sesión principal del administrador, con rol y CSRF nativos. Las cuentas normales y sesiones suplantadas quedan excluidas. La auditoría local de intención y envío de señal y la clave de firma permanecen en `/var/lib/vip-activity-admin`, privada de root. El instalador conserva respaldo recuperable de los archivos reemplazados; desinstalar no borra auditoría ni clave.

La observación añade un prepend por cuenta a pools de alojamiento existentes y recarga PHP-FPM de forma gradual tras validar sintaxis. No sobrescribe otro prepend ni amplía open_basedir: omite pools incompatibles. Escribe metadatos temporales por PID en `~/tmp/vip-activity-live`, legibles solo por la cuenta y root, y los retira al finalizar. Tras un corte brusco puede quedar un archivo; se valida existencia del proceso y fecha de inicio para no mostrarlo como solicitud actual. El helper no sigue enlaces simbólicos al leerlos. Las aplicaciones pueden modificar archivos propios: es observabilidad, no evidencia forense ni identidad autenticada. Una regeneración de pools por Hestia puede requerir reaplicar la instalación opcional.

## Firewall y protección automática

La actividad y el firewall muestran la IP pública de la conexión del administrador. Su fila indica «Tu IP» y no ofrece bloquearla. El helper también rechaza bloquearla, incluso con una petición manipulada. Respeta IP locales, exclusiones nativas y lista blanca. Con VPN o cambio de red esta IP puede cambiar; no es la IP privada del equipo.

Pulsar una IP abre sus conexiones, solicitudes recientes y trabajadores PHP cuya solicitud activa observada tiene esa IP: ruta, duración, CPU y RAM. No atribuye procesos inactivos ni consultas SQL. Se conserva el límite de cien procesos por muestra; una IP compartida no identifica a una persona.

El escritorio Firewall presenta IP bloqueadas, Lista negra, Lista blanca, Protección automática e Historial. El inventario lee registros nativos por IP/cadena, fecha y hora del servidor. Indica la regla o servicio del bloqueo y el motivo manual registrado; no inventa el intento exacto de bloqueos antiguos. Las operaciones pasan por comandos nativos Hestia, con confirmación, rol, CSRF y auditoría. Las reglas de puertos y las pantallas nativas siguen disponibles.

La lista negra añade una IPv4 a WEB (80/443), con motivo obligatorio, hasta que se retire. La lista blanca admite IPv4/red y excluye de los límites web de este módulo; retira sus bloqueos web. No abre puertos ni desactiva SSH, correo o protección del panel. Si la red contiene bloqueos de otro servicio, se exige revisarlos antes de añadir la excepción. La IP administrativa actual se protege al guardar. No se permite excluir toda Internet (/0).

Dos reglas independientes, inicialmente desactivadas, utilizan Fail2Ban existente:

- Solicitudes: jail `vip-web-rate`, cadena `VIPWEB`, logs Apache; umbral 100–100000 dentro de 10–3600 segundos. Cuenta también solicitudes válidas.
- Conexiones: jail `vip-web-connections`, cadena `VIPCON`; un cron breve cada minuto consulta `ss` y registra IP que supera 20–10000 conexiones TCP web establecidas. Fail2Ban bloquea por ese evento. La respuesta puede tardar hasta un minuto más el intervalo de lectura de Fail2Ban; no evita saturación volumétrica ni cuenta los flujos HTTP/2 como conexiones separadas. El cron solo existe mientras se habilita esta regla, sin otro daemon.

Ambas cadenas afectan HTTP/HTTPS (80/443), comparten lista blanca y duración de 60–86400 segundos. Una IP puede representar a varios usuarios. Al guardar se valida Fail2Ban y se recuperan archivos anteriores si falla. Desactivar una regla retira sus bloqueos automáticos; se conservan los de otros servicios. El historial muestra cambios manuales y detecciones propias, no todo el historial de Fail2Ban. La configuración y la auditoría permanecen privadas en el servidor.

La interfaz se inspira en las operaciones rápidas y Connection Tracking de ConfigServer Firewall, sin instalar CSF ni sustituir el firewall existente. Referencia: [Connection Tracking de CSF](https://aetherinox.github.io/csf-firewall/usage/configuration/).

Los diálogos cierran al pulsar el fondo exterior. Los formularios laterales conservan su comprobación de cambios sin guardar y operaciones en curso.
