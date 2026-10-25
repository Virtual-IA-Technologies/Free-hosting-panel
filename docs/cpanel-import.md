# Respaldos completos de cPanel

HestiaCP incluye el comando administrativo `v-import-cpanel`. No hay que instalar Node, una terminal web ni otro servicio para disponer de él. La compatibilidad debe comprobarse con la versión instalada y un respaldo completo real; un archivo `.tar.gz` cualquiera o una copia parcial de archivos no equivale a un respaldo de cuenta cPanel.

## Antes de importar

- El respaldo debe proceder de una fuente de confianza y mantenerse en almacenamiento privado. Contiene contraseñas cifradas, claves y datos de clientes; no se publica en GitHub ni en carpetas web.
- Verificar integridad, espacio libre y contenido: usuario, dominios, alias, bases, correo y dependencias fuera de `public_html`.
- El importador crea una cuenta nueva. Rechaza cuentas existentes y no sirve como sincronización final de una migración activa. No ejecutar sobre cuentas ya migradas.
- Preparar la importación en staging y conservar el origen y el archivo íntegro para recuperación. No cambiar DNS antes de validar las aplicaciones.

## Límites del importador instalado

El script oficial advierte problemas de certificados con formatos recientes de cPanel y que no actualiza DKIM. También restaura trabajos cron. Por eso no debe presentarse como una restauración universal de un clic sin revisar su comportamiento:

1. Planificar dominios, alias y docroots, evitando copiar el mismo proyecto a dos carpetas.
2. Mantener cron y envíos productivos desactivados durante las pruebas.
3. Verificar y restaurar certificados y DKIM, así como reenvíos, catchall, cuotas y hashes de buzones.
4. Comprobar configuración PHP, rutas privadas, sesiones y compatibilidad del código con la versión de destino.
5. Validar archivos y bases restauradas, funcionamiento con una cuenta real y sincronización final antes del corte.

El importador es una operación administrativa por SSH/CLI. La pantalla nativa de restauración de Hestia usa su propio formato de respaldo; esta extensión visual todavía no incorpora una carga gráfica de respaldos cPanel ni modifica ese formato. La migración permanece separada de la instalación del tema y del gestor de software.

Fuentes oficiales: [importador cPanel](https://github.com/hestiacp/hestiacp/blob/main/bin/v-import-cpanel), [restauración de Hestia](https://hestiacp.com/docs/user-guide/backups). Consultar también el archivo instalado antes de operar; la rama publicada puede diferir de la versión del servidor.
