# Validación 1.3.0

Compilación reproducible, dos pruebas del instalador, 18 del broker y controles del endpoint con fixtures: correctos. Interfaz simulada del gestor y pestañas: correctas. La prueba autenticada sobre Hestia real verificó once pestañas, campos/tokens, móvil, Alpine, inventario, rechazo anónimo, CSRF y actor falsificado; no instaló paquetes ni actualizó índices. Los recursos desplegados coinciden con los compilados y los cuatro accesos HTTPS son válidos.

El reinicio conserva la ruta y confirmación nativas; se verifica su visibilidad sin ejecutar reinicios innecesarios. La cuenta normal y suplantación de sesión del gestor opcional siguen pendientes en vivo; se verificaron con fixtures. No se crearon cuentas de prueba. Véase [continuidad](PENDIENTES_Y_CONTINUIDAD.md).

# Validación de la versión 1.2.0

Revisión del 24 de octubre de 2026 sobre HestiaCP 1.10.5.

En 1.2.0 se comprobó el login de un paso, grafito incluso con una preferencia clara antigua, formulario móvil y recuperación nativa. No se enviaron mensajes ni se certificó entrega SMTP. phpMyAdmin responde por su puerto dedicado, muestra el formulario SQL sin errores de controluser y bloquea sus rutas internas. El certificado del servidor de revisión valida externamente el hostname y la IP principal en los puertos del panel y de phpMyAdmin. La renovación de corta duración se simuló correctamente con la CA de pruebas y se verificó el temporizador activo. Los servicios opcionales de cuentas/webmail requieren habilitación explícita y validación en cada despliegue; instalar el tema no abre sus puertos.

También se verificó que la URL antigua de phpMyAdmin redirige al puerto HTTPS sin bucles, tanto por hostname como por IP. Los scripts de cuentas y webmail pasaron su comprobación de prerrequisitos sin abrir sus puertos. Los accesos y el firewall del servidor de revisión no forman parte del código público.

En 1.2.1, tras autorización expresa de apertura, se habilitaron los accesos adicionales de cuentas y webmail en el servidor de revisión. Se comprobó HTTPS válido por hostname e IP, formularios nativos y acceso bloqueado a la configuración privada de Roundcube. La prueba de navegador comprobó los cuatro accesos configurados. No se enviaron correos ni se crearon buzones o cuentas de clientes; la autenticación con usuarios reales de SQL/correo se verifica al provisionarlos.

En 1.1.1 se corrigió el zoom heredado de los formularios de archivos. La prueba verifica los límites al abrir, sin esperar a que una animación oculte el desbordamiento, y conserva la comprobación móvil.

Añadido en 1.1.1: laterales de alta/edición, restauración del formulario de fondo, generador nativo de contraseña, confirmación al descartar cambios y ancho móvil de 390 px. Doble clic, clic derecho y preferencias por lista comprobados. Los POST de validación y éxito se interceptan y simulan: no se escriben recursos reales.

La prueba de recarga retrasa la descarga del JavaScript y comprueba que se oculta el diseño nativo, se muestra «Cargando…» y aparece el panel al terminar. También aborta la descarga para verificar la recuperación nativa tras ocho segundos. Ambas pruebas pasaron en el servidor de revisión, sin errores JavaScript ni respuestas HTTP de error en el recorrido normal.

- Compilación y correspondencia de los artefactos minificados con el código fuente.
- Instalador: dry-run sin modificaciones, conservación de FileGator original y rechazo de estructura incompatible.
- Administración: navegación, DNS/IP, recursos por vista, tokens nativos, temas y persistencia de apariencia.
- Medium: contenido claro, menú grafito oscuro y contraste mínimo 4.5:1 en los elementos comprobados.
- Archivos: carga diferida, carpeta principal/subir nivel, lista/cuadrícula, contraste claro/oscuro, escritorio/móvil y recuperación al fallar la descarga.
- Nuevo: botón sin marco duplicado; diálogos de Carpeta y Archivo por encima del menú y dentro de pantalla en escritorio y móvil.
- Cuenta normal: contexto propio sin métricas globales, ausencia de herramientas administrativas, ayudas web/SQL y gestor de archivos.
- La prueba de cuenta normal corresponde a 1.0.2; la cuenta de revisión se retiró después y no se recreó en 1.0.3.
- Sin errores JavaScript en los recorridos comprobados.
- Recargas de Inicio y Archivos sin errores HTTP, conservando tema y evitando controles duplicados; transferencia de recursos propios medida con la caché del navegador.
- Opciones del instalador, huellas reproducibles y modo nativo sin FileGator comprobados en directorios temporales.

Las comprobaciones de interfaz no crean ni eliminan archivos o recursos de clientes. No certifican entrega de correo, emisión de certificados, restauraciones de respaldos ni operaciones de aplicaciones alojadas. Esas validaciones corresponden al despliegue de cada servidor y cuenta.

La extensión no crea cuentas de alojamiento, sitios, zonas DNS, buzones ni bases de datos. No contiene credenciales ni configuración de un servidor concreto. Conserva las acciones, permisos y confirmaciones nativas de Hestia.
