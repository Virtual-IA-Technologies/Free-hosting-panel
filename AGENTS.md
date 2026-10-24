# Virtual IA Panel

Antes de cualquier tarea, leer y aplicar [LECTURA_OBLIGATORIA.md](LECTURA_OBLIGATORIA.md). Es obligatoria para este proyecto y sus trabajos remotos: ejecución ágil, respuestas breves, reutilización del contexto y pruebas proporcionales sin repeticiones innecesarias. Para retomar mejoras en curso, consultar [el informe de pendientes](docs/PENDIENTES_Y_CONTINUIDAD.md) sin asumir que lo documentado como pendiente ya está implementado.

Extensión de presentación para HestiaCP. El código reutilizable vive en `src`; nunca incluir credenciales, sesiones, inventario de servidores, respaldos ni datos de clientes. Mantener las operaciones de cuentas, correo, bases de datos y cortafuegos en rutas nativas con sus permisos y tokens. No añadir endpoints privilegiados ni reemplazar la autenticación de Hestia.

El instalador debe ser reversible y respaldar solamente los archivos que modifica. Separar la instalación del panel de la provisión de cuentas o migración de datos. Validar sintaxis y navegación proporcionalmente al cambio. Documentar cambios y límites en README y CHANGELOG.

Excepción autorizada expresamente por el usuario el 24/10/2026: módulo administrativo opcional para versiones, actualizaciones y extensiones PHP. Debe usar autenticación/roles/CSRF nativos, un broker local con operaciones enumeradas, planes previos, confirmación y auditoría. Nunca permitir shell, comandos, rutas de paquetes ni repositorios arbitrarios enviados desde el navegador. Mantenerlo separado de la extensión visual y de las migraciones de clientes.
