# Virtual IA Panel

Extensión de presentación para HestiaCP. El código reutilizable vive en `src`; nunca incluir credenciales, sesiones, inventario de servidores, respaldos ni datos de clientes. Mantener las operaciones de cuentas, correo, bases de datos y cortafuegos en rutas nativas con sus permisos y tokens. No añadir endpoints privilegiados ni reemplazar la autenticación de Hestia.

El instalador debe ser reversible y respaldar solamente los archivos que modifica. Separar la instalación del panel de la provisión de cuentas o migración de datos. Validar sintaxis y navegación proporcionalmente al cambio. Documentar cambios y límites en README y CHANGELOG.
