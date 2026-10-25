# Validación de interfaz

Ejecuta las pruebas de navegador del mismo administrador de forma secuencial: el servidor puede interferir entre sesiones concurrentes. `login.cjs` admite los formularios nativos de uno y dos pasos sin evitar 2FA.

`npm run test:access` verifica el login grafito de un paso, recuperación, móvil, enlaces y servicios por puerto configurados. No envía solicitudes de recuperación, no manda correos ni crea recursos. La entrega de correo y el acceso con buzones/usuarios SQL reales se validan después de crearlos.

`npm run test:refresh` usa un contexto temporal de administrador: recarga tres veces Inicio y una Archivos, comprueba persistencia, ausencia de duplicados y de errores HTTP/JavaScript, y registra tiempos y transferencia de recursos propios. Simula la opción del gestor nativo solo en esa página de prueba, sin cambiar la configuración del servidor.

`ui.cjs` realiza una prueba de integración sobre un servidor de revisión. Necesita Node, `playwright-core` y Chrome; admite `VIP_BROWSER_EXECUTABLE` para otra instalación Chromium. Definir mediante un mecanismo seguro `VIP_BASE_URL` (sin barra final), `VIP_USERNAME` y `VIP_PASSWORD`; ejecutar `node tests/ui.cjs`.

La prueba no cambia datos de clientes ni reglas de red. Comprueba login, contraste claro, enlaces protegidos, gráficos específicos, detalle visible, personalización, fondos, persistencia, restablecimiento, cuotas, separación, móvil y gestor de archivos integrado. Las preferencias que modifica pertenecen al contexto de navegador temporal de la prueba. No guarda sesiones ni contraseñas en el repositorio.

`npm run test:files` usa las mismas variables para comprobar carpetas, navegación, lista/cuadrícula, contraste, ancho móvil, controles táctiles y acceso al gestor nativo al simular un fallo de descarga. No crea ni elimina archivos. `VIP_SCREENSHOT` permite guardar capturas fuera del repositorio.

`npm run test:account` requiere las mismas variables con una cuenta de alojamiento normal. Comprueba el contexto sin métricas globales, ausencia de herramientas de administración, ayuda de dominio y SQL, y el gestor de archivos de esa cuenta. No modifica recursos.

`npm run test:installer` solo requiere Python y usa un directorio temporal: verifica dry-run sin mutaciones, copias adaptadas de FileGator, conservación de originales y rechazo de una versión incompatible. No instala Hestia ni usa acceso root.

Validación de una versión: `npm run build`, `npm run check`, `npm run test:installer`; después instalar en el servidor de revisión con respaldo y ejecutar `npm run test:ui` y `npm run test:files`. Estas pruebas no certifican envío de correo, restauración de respaldos, resolución DNS externa ni operaciones con datos reales; esos servicios se verifican al configurar cada servidor.

`npm run test:interactions`: laterales, gestos, cancelación y móvil. Intercepta los POST de prueba en el navegador; no crea ni modifica recursos reales. `npm run test:refresh` comprueba también el arranque con JavaScript retrasado y la recuperación nativa si falla el recurso.

`node tests/accounts.cjs` usa filas simuladas sin servidor: exclusión de administradores, contador y filtros, orden numérico ascendente/descendente, teclado y conservación de casillas. Requiere Chrome/Chromium; `VIP_BROWSER_EXECUTABLE` permite indicar su ejecutable.
