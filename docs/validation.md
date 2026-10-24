# Validación de la versión 1.1.0

Revisión del 24 de octubre de 2026 sobre HestiaCP 1.10.5.

Añadido en 1.1.0: laterales de alta/edición, restauración del formulario de fondo, generador nativo de contraseña, confirmación al descartar cambios y ancho móvil de 390 px. Doble clic, clic derecho y preferencias por lista comprobados. Los POST de validación y éxito se interceptan y simulan: no se escriben recursos reales.

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
