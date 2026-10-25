# Estado y continuidad — VIP

## Entrega 1.3.5 — administración y respaldos

- Implementados y desplegados módulos opcionales de correo/SQL y políticas de respaldo. PHP compartido mantiene los procesos externos bloqueados; tickets consumidos por un puente exclusivo de loopback al PHP nativo de Hestia.
- Inventarios administrativos de cron, claves públicas y transferencia; operaciones de cuentas permanecen en rutas nativas. Menú compacto, ayuda contextual, métricas de servidor en texto y fechas día/mes/año según zona configurada.
- Las políticas de respaldo permiten cuentas, contenido, conexiones existentes, horarios y retención; cola de políticas coincidentes, auditoría y retención limitada a objetos propios. Consultar [la guía y sus límites](backups.md).
- Validado con recursos efímeros: SSO SQL desde el puerto alternativo y reapertura con/sin sesión SQL, creación de base y buzón, cambio de contraseña, SSO Roundcube, inventarios globales, zona horaria nativa, ayuda compacta y móvil. Respaldo SQL subido a un destino externo, descargado y restaurado realmente en otra base temporal; recursos de prueba eliminados.
- Activación de respaldos es una decisión operativa: se pueden guardar políticas pausadas y configurarlas antes de habilitarlas. Conectar un destino no activa una política. No sustituir tareas del origen hasta validar el relevo. Consultar la entrega GitHub para el estado de publicación.
- Pendientes de producto: asistente OAuth web para proveedores nuevos, restauración guiada de respaldos parciales e inventario histórico de archivos externos ajenos a esta instalación. No son funciones implementadas por mostrar una conexión existente.
- Explorador integrado con año de cuatro dígitos y 24 horas; Roundcube aplica fecha y zona después de cargar preferencias. Utilidad opcional reversible para la zona del PHP interno, sin cambiar la zona del sistema. Comprobaciones del instalador y formato correctas.
- Inventarios, selectores, exportación y contador de alojamiento excluyen administradores. Cabeceras ordenables con valores numéricos y selección preservada; comprobación automatizada de filtros, teclado y orden en ambos sentidos.
- La distribución 1.3.5 incluye únicamente código y documentación genéricos. Consultar el tag y la entrega de GitHub para comprobar publicación y CI; cuentas, credenciales y configuración del despliegue permanecen fuera del repositorio.
- La historia anterior describe el estado de cada entrega. No usar sus pendientes de migración o credenciales como inventario actual ni ejecutar limpieza de cuentas por instrucciones históricas.

## Entrega 1.3.4 — correo y bases globales

- Implementados inventarios administrativos por propietario para dominios/buzones de correo y bases de datos, con búsqueda y filtro. Se consultan solo al abrir cada servicio y seleccionan campos sin contraseñas, hashes ni claves SSO.
- Gestión mediante cambio de cuenta y formularios nativos: contraseña y ajustes del buzón, listado de buzones y edición SQL. Se mantienen vistas propias explícitas; no se modifica el aislamiento de cuentas normales.
- Enlace phpMyAdmin encadena el cambio de cuenta con el SSO nativo. Si no existe un enlace SSO compatible, queda en el listado nativo de bases; nunca crea credenciales globales ni cambia contraseñas para entrar.
- Validado en sesión administrativa real: todos los registros de correo y SQL, apertura del formulario nativo de contraseña con el propietario correcto, ausencia de inventario global al entrar en la cuenta, móvil sin desbordamiento e inicio de sesión SSO efectivo en phpMyAdmin. No se guardaron cambios ni se activaron recursos suspendidos.

## Entrega 1.3.3 — dominios y archivos por propietario

- Inventario global de dominios para administradores mediante consultas nativas de lectura, con campos públicos seleccionados y sin credenciales. Solo se consulta en la página de dominios; las sesiones de cuentas o suplantadas no reciben el inventario global.
- Tabla con propietario, alias, IP, disco y SSL, filtros locales y accesos nativos a la cuenta y sus archivos. Las operaciones de edición siguen en las páginas nativas de cada cuenta.
- Enumerar las cuentas en Panel. El módulo opcional de archivos autorizado permite recorrer y editar la raíz real como administrador. Las cuentas normales conservan su ámbito.
- Validado en sesión real: todos los dominios y propietarios, filtros, móvil, cambio nativo a una cuenta y gestor de archivos de esa cuenta. La sesión suplantada no recibe el inventario global. Se corrigió el usuario efectivo de presentación para respetar la cuenta seleccionada. Sin errores JavaScript.
- Instalador reversible validado; recursos desplegados con respaldo. Guía de importación cPanel documentada como función nativa por CLI; la extensión no añade un endpoint privilegiado de carga o restauración.
- Archivos muestra `/`, `/home` y las carpetas reales dentro de un solo gestor. Validado recorrido administrativo, operaciones con la identidad web real y aislamiento de una cuenta normal. Tamaños de carpetas bajo demanda con caché; instalación y límites en `root-files.md`.
- Vista previa con enlaces directos por sitio mediante el proxy existente, sin descargas ni cambios DNS. HTTP 200 comprobado en las rutas preparadas; los recorridos autenticados y la equivalencia por dominio real deben validarse antes del corte. Una sola opción activa en los menús compartidos por ruta.

## Entrega 1.3.2 — detalles de registros

- Corregida la extracción de valores del detalle: normaliza espacios del HTML, excluye acciones y etiquetas móviles repetidas, separa nombre y correo y recupera los títulos de columna.
- Presentación compacta en dos columnas, con ajuste de texto en pantallas pequeñas. Sin consultas ni dependencias nuevas.
- Validado en sesión administrativa real: etiquetas y valores, correo separado, cuotas, escritorio y móvil de 390 px, cierre con Escape y ausencia de errores JavaScript. Dos pruebas del instalador correctas. Desplegado con respaldo; JS/CSS coinciden con los artefactos locales. Sin Node ni servicios adicionales.

## Entrega 1.3.1 — 24/10/2026

- Estado del servidor y Versiones y actualizaciones visibles juntos en Panel. La pantalla nativa de Hestia explica su alcance y enlaza al gestor de software. Cabeceras legibles en temas claros.
- Desplegado con respaldo; probado en sesión administrativa real el recorrido Hestia → gestor → PHP y extensiones, nueve grupos de software, móvil y ausencia de errores JavaScript. No se instalaron ni actualizaron paquetes.
- Recursos estáticos; no se añaden procesos ni sondeos con estos accesos. Instalación y actualización de paquetes siguen siendo operaciones separadas y confirmadas.
- Migración pendiente: faltan dominios/origen, volumen real y compatibilidad. Antes de cambiar DNS, comprobar restauración de respaldo, correo real y funcionamiento de cada aplicación.


## Entrega 1.3.0 — 24/10/2026

- **Implementado:** acceso «Estado de los servicios» debajo de Inicio; botón Reiniciar visible sin hover, con ruta, permisos, token y confirmación nativos de Hestia. No se añade un backend para reiniciar servicios.
- **Ligereza:** interfaz con recursos estáticos compilados; sin Node, terminal ni procesos adicionales para la presentación. El servidor revisado tiene `WEB_TERMINAL=false`, sin paquetes Node/terminal ni repositorio NodeSource. El gestor opcional existente usa aproximadamente 13 MiB de RAM; no es necesario para reiniciar servicios y no se instala junto al tema.
- **Otras mejoras retomadas:** pestañas de configuración, carga diferida del gestor opcional y corrección del controlador estático de Roundcube. Los módulos opcionales conservan instalación independiente.
- **Validado:** artefactos reproducibles; dos pruebas del instalador; 18 pruebas del broker; controles del endpoint con fixtures; interfaz simulada del gestor; pestañas, teclado y móvil. En el servidor real: sesión administrativa nativa, once pestañas de servidor, campos y tokens conservados, validación, grupos Alpine, inventario, rechazo anónimo/CSRF/suplantación de actor. Sin instalar paquetes ni actualizar índices.
- **Desplegado:** recursos de presentación 1.3.0, con respaldo reversible y opciones existentes conservadas. Sintaxis PHP correcta, fuentes y recursos instalados coincidentes; cuatro accesos HTTPS válidos y rutas privadas bloqueadas. Sin servicios fallidos ni incidencias en `dpkg --audit`.
- **Publicación:** esta entrega se identifica mediante el tag `v1.3.0`; consultar GitHub para el resultado del flujo de CI y los archivos de distribución.

## Límites y pendientes reales

- No se ejecutan reinicios de servicios solo para probar la interfaz. El administrador confirma cada reinicio cuando lo necesita.
- La prueba real de cuenta normal y suplantación de sesión del gestor opcional sigue pendiente; los controles de rol se comprobaron con fixtures. No se crearon cuentas temporales. No confundir suplantación de sesión con el rechazo del campo `actor` falsificado, que sí se probó en vivo.
- No se instalaron nuevas ramas PHP ni actualizaciones de aplicaciones. Una operación idempotente anterior de GD ya habilitado comprobó respaldo, validación y recuperación FPM sin instalar paquetes.
- La entrega de correo, autenticación de buzones/SQL reales, restauración de respaldos y conectores externos requieren comprobación propia de cada despliegue. La guía contextual de correo no configura DNS ni garantiza entrega.
- No se iniciaron migraciones de clientes ni cambios de DNS. Las migraciones requieren instrucciones y compatibilidad de cada proyecto, respaldos y restauración probada antes de transferir datos.

## Retomar

Leer `AGENTS.md` y `LECTURA_OBLIGATORIA.md`, consultar este estado y revisar únicamente diferencias nuevas. Mantener credenciales, respaldos, detalles SSH e inventarios privados fuera del repositorio. Para clonar, instalar, actualizar o revertir, seguir [installation.md](installation.md).
