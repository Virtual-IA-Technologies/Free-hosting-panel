# Cambios

## 1.3.6 — 2026-10-24

- Inicio y barra administrativa reutilizan la misma instantánea de memoria, carga y disco por petición. Elimina lecturas redundantes sin añadir procesos, cachés persistentes ni cambios de permisos.
- Guía de revisión de despliegue: DNS, TLS, sesiones, documentos, integraciones y protección de artefactos privados; distingue lectura, generación local y emisión real.

## 1.3.5 — 2026-10-24

- Respaldos opcionales por cuentas/contenido, destino local o Rclone, múltiples horarios y retención configurable; inventario, descarga, auditoría y cola sin servicio residente nuevo.
- Menú y acciones compactos, ayuda contextual, inventarios globales de cron/claves SSH/tráfico y acceso a SSL por propietario.
- Fechas visibles día/mes/año con la zona horaria real del servidor; reloj administrativo y programación por zona sin depender de la configuración del navegador.
- SSO SQL compatible con el puerto alternativo del panel y reapertura; Roundcube completa la sesión nativa sin cambiar claves de buzones.
- Accesos globales a phpMyAdmin y usuarios/permisos SQL mediante tickets de un uso; cuentas normales aisladas.
- Módulo opcional para bandejas, cola, seguimiento, rebotes y relayers; confirmación y respaldo privado antes de borrar mensajes de cola.
- Listado de cuentas con dominio, IP, cuota, disco, tráfico, estado y filtros; recálculo manual de baja prioridad.
- Administradores excluidos de inventarios y selectores de alojamiento, CSV y contador de cuentas. Cabeceras con orden ascendente/descendente y comparación numérica para cuotas y consumo, conservando la selección nativa.
- Eliminada la leyenda redundante de acceso VIP. Fechas del explorador y Roundcube en día/mes/año y 24 horas; utilidad opcional y reversible para alinear la zona del PHP interno del panel con la del servidor.
- Barra administrativa con carga, RAM y disco libre; sin sondeos ni procesos residentes nuevos.
- Vista rápida limitada para correo suspendido; lectura protegida contra enlaces simbólicos y rutas externas.

## 1.3.4 — 2026-10-24

- Correo y bases de datos de todas las cuentas en la vista administrativa, con propietario, búsqueda y filtros. Las cuentas normales y las sesiones suplantadas mantienen su ámbito.
- Accesos al formulario nativo de contraseña y ajustes de cada buzón. Las listas incluyen recursos suspendidos; mostrarlos no los reactiva ni modifica DNS.
- Entrada a phpMyAdmin desde la base seleccionada mediante el cambio de cuenta y SSO nativos, sin solicitar ni revelar contraseñas SQL en la interfaz global. Si no hay SSO, conserva el listado nativo.
- Consultas de inventario solo al abrir el servicio, con campos seleccionados; sin sondeos, procesos ni dependencias nuevos.

## 1.3.3 — 2026-10-24

- Dominios del servidor con propietario, alias, IP, disco y SSL; filtros locales por dominio y cuenta. Solo administradores; las cuentas normales conservan su lista propia.
- Enumerar las cuentas en Panel, acceso nativo a Archivos por cuenta y selector de carpetas `/home/usuario` en Archivos del administrador.
- Inventario de lectura consultado únicamente al abrir Dominios, sin sondeos ni servicios adicionales; gestión y archivos conservan la suplantación autorizada y los tokens nativos.
- Una sola opción activa en el menú: Versiones y actualizaciones deja de resaltar también Estado del servidor.
- Explorador raíz opcional para el administrador, integrado con la sesión nativa y operaciones locales enumeradas; las cuentas normales conservan su aislamiento. Tamaños de carpetas bajo demanda, caché y prioridad baja. Instalador y reversión independientes.
- Vista previa mediante enlaces directos configurados por sitio en el servidor; sin descargas ni cambios DNS desde el tema.

## 1.3.2 — 2026-10-24

- Detalles de registros compactos con etiquetas de la tabla, nombre y correo separados, y valores sin espacios de indentación ni accesos concatenados. Diseño adaptable sin consultas adicionales.

## 1.3.1 — 2026-10-24

- Estado del servidor y Versiones y actualizaciones juntos en Panel; acceso directo desde la pantalla nativa de actualizaciones de Hestia, explicando su alcance.
- Accesos de servicios, software y Hestia sin nuevas consultas ni procesos; cabeceras de tablas legibles en temas claros.
- Guía explícita de actualizaciones: PHP/extensiones, software e historial, con plan y confirmación; instalar la interfaz no actualiza paquetes.


## 1.3.0 — 2026-10-24

- Pestañas accesibles en nueve formularios de configuración, incluidos Servidor, planes, marca blanca y opciones avanzadas de cuentas, dominios, DNS, SQL y correo. Se conservan campos, tokens, orden de envío y controles condicionales nativos.
- Gestor administrativo opcional separado: versiones/candidatas reales, soporte PHP, planes confirmados, endpoint con sesión/rol/CSRF nativos y broker por socket Unix. Instalador independiente, auditoría, respaldos y recuperación de módulos FPM.
- Carga diferida del gestor, estado de instalación real, selección PHP preservada y ausencia de sondeos al salir. Pruebas locales de pestañas, broker, endpoint e interfaz; validación de despliegue registrada en continuidad.

- Configuración a ancho completo, título único y pestañas debajo de las acciones nativas.
- Estado de los servicios debajo de Inicio en Panel y botón Reiniciar visible para cada servicio nativo instalado, conservando permisos y confirmación. Sin terminal ni dependencia Node en producción.
- Roundcube moderno: recursos CSS/JS/logo servidos por `static.php` y plugin visual VIP opcional, reversible y sin cambios de buzones.
- Guía contextual de DKIM, SPF, DMARC, PTR y relay; instrucciones de clonación, instalación, actualización y reversión para otros servidores.

## 1.2.2

- La opción actual del menú mantiene el mismo fondo uniforme del hover, sin franja celeste y con texto legible.

## 1.2.1

- Menú sin fondo azul ni franja celeste de selección; hover de un solo color y página actual indicada discretamente, conservando foco de teclado.
- Webmail detecta el directorio `public_html` de las versiones recientes de Roundcube, con compatibilidad con la estructura anterior.
- Prueba de recuperación espera la carga del tema antes de comprobarlo.
- Validación externa de los cuatro puertos, formularios de cuentas y webmail y bloqueo de configuración privada, sin crear recursos de clientes.

## 1.2.0

- Login grafito independiente del tema del panel, usuario y contraseña juntos mediante el formulario nativo y recuperación según la política de Hestia. Autenticación y 2FA conservadas.
- Puertos de phpMyAdmin, acceso de cuentas y webmail configurables en los enlaces, sin guardar hostname/IP en el código.
- Provisionamiento explícito y separado de servicios: phpMyAdmin nativo, listener adicional de Hestia sin proxy y Roundcube por HTTPS. Firewall público solo con opción expresa; IPv6 opcional.
- Hook CLI para importar certificados renovados mediante Hestia, con respaldo y verificación de clave/vigencia. Guía para certificados de IP y renovación automatizada.
- Pruebas de login, recuperación sin envío de correos, servicios, TLS externo y puertos; pruebas previas compatibles con login de uno o dos pasos.

## 1.1.1

- Formularios laterales de archivos sin el zoom heredado de FileGator, evitando desbordamientos durante la apertura.
- Prueba de archivos con selección explícita de los recursos locales al usar el modo de revisión; comprobación de límites antes de terminar la animación.
- Guía pública de instalación, seguridad y contribuciones; dependencia de pruebas fijada y verificación automática de artefactos, instalador y patrones de secretos.

## 1.1.0

- Formularios nativos de crear y editar en un lateral, con validación, cancelación de cambios y recuperación de errores. Confirmaciones destructivas conservadas.
- Doble clic configurable por lista; clic derecho, menú de acciones y acceso con teclado a los controles ofrecidos por Hestia.
- Formularios de archivos y carpetas en lateral, conservando las operaciones nativas del gestor.
- Indicador ligero de carga al recargar; oculta el diseño anterior y recupera el panel nativo si falla el recurso principal.
- Puente de formularios generado desde el JavaScript nativo instalado, descargado solo al abrir un formulario. Sin nuevos endpoints ni dependencias de ejecución.
- Pruebas de escritorio y móvil, validación y envío simulado sin modificar cuentas.

## 1.0.3

- Nombre del panel, tema inicial y modo del gestor configurables por opciones del instalador, sin datos de despliegue en el código.
- Gestor nativo opcional para servidores sin FileGator compatible.
- Versionado automático de recursos según contenido y opciones para renovar la caché al actualizar.
- Ruta del logo recibido de FileGator resuelta desde /fm/, evitando solicitudes 404 al navegar o recargar Archivos.
- Prueba de tres recargas, persistencia del tema, caché, carga diferida, recarga directa de Archivos y opción de gestor nativo.

## 1.0.2

- Accesos frecuentes sin destinos duplicados y menú de cuentas normales sin duplicar Dominios y Bases de datos.
- Versión de recursos actualizada para renovar la caché al instalar la revisión final.

## 1.0.1

- Tema Medium: contenido claro, menú grafito oscuro y letras claras, con persistencia por usuario y navegador.

- FileGator integrado sin iframe, con estilos limitados al gestor y copias adaptadas de los recursos nativos, sin modificar los originales.
- Corrección del ancho de acciones de archivos en cuadrícula móvil y acceso al gestor nativo ante fallos de carga.
- Botón Nuevo sin marco duplicado y diálogos de archivo/carpeta centrados sobre la navegación, probados en escritorio y móvil.
- Inicio construido solo en su pantalla y métricas del sistema leídas únicamente en Inicio y Recursos.
- Accesos frecuentes a dominios, zonas DNS e IP; acceso DNS por cuenta, guía desde cPanel y aclaraciones sobre hostname, delegación e IP.
- Ayuda para pruebas antes de cambiar DNS, organización de cuentas bajo /home y acceso único a phpMyAdmin por base de datos.
- Marca VIP en el título y pie conservando los avisos originales de Hestia.
- Prueba local del instalador sin privilegios: generación del puente, compatibilidad, conservación de originales y dry-run sin modificaciones.
- Pruebas de navegación DNS/IP, carga diferida, ausencia de métricas innecesarias y recuperación del gestor ante error de red.
- Validación de navegación y archivos con una cuenta de alojamiento normal, sin herramientas globales ni métricas del administrador.

## 0.4.1

- Dominios y Bases de datos añadidos al grupo Panel.
- Gestor de archivos a ancho completo, sin cabecera duplicada, con carpetas laterales, árbol nativo, búsqueda y vistas lista/cuadrícula.
- Mejora de archivos cargada bajo demanda; acciones y permisos nativos conservados.
- Acceso SSL / HTTPS por dominio y explicación del aislamiento por cuenta.
- Documentación de portabilidad sin IP, hostname, cuentas ni credenciales preconfiguradas.

## 0.4.0

- Recursos minificados y agrupados: dos solicitudes propias por pantalla; login separado.
- Compilación reproducible con esbuild fijado y artefactos incluidos para instalar sin Node.
- Accesos a las secciones nativas de PHP, destinos, retención, correo y API.
- Developers con exportación de perfil sin claves y accesos HTTPS externos editables.
- Aviso del alcance compartido del editor PHP global; diferenciación de configuración por dominio.
- Asistente de almacenamiento mediante Rclone, sin proveedor ni cuenta fija, y documentación de conexiones pendientes.
- Validación real de navegación, temas, gráficos, archivos, accesos externos y secciones de configuración.

## 0.3.4

- Alojamiento antes de Configuración del servidor.
- Gráficos diferenciados por disco, memoria, CPU y red; informe técnico visible.
- Gestor de archivos integrado y sincronizado con los colores del panel.
- Fondos pintados directamente, previsualización e intensidad inicial legible.
- Conservación del token nativo al navegar entre vistas de recursos.
- Respaldo de restauración independiente para cada versión del instalador.

## 0.3.0

- Logo de texto oscuro para el tema claro, sin recuadros.
- Corrección de contraste en hover, contenido técnico y estados activos claros.
- Personalización de escala y fondos de menú/contenido, con imágenes optimizadas y persistencia local.
- Gráficos de recursos con datos reales, barras de cuotas y detalle técnico desplegable.

## 0.2.0

- Proyecto instalable y reversible, separado de la provisión de servidores.
- Marca Virtual IA Panel, acceso VIP y logo vectorial ligero.
- Tres temas, tipografía fina y espaciado uniforme entre herramientas y contenido.
- Acciones de web, correo, bases de datos y recursos visibles por cuenta.
- Presentación consistente de formularios, tablas, estados y servicios en escritorio y móvil.
