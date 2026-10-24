# Integraciones y almacenamiento

El apartado Developers ofrece las claves nativas de Hestia, un perfil de conexión sin secretos y accesos HTTPS editables. Añadir un acceso no conecta automáticamente la API de esa aplicación. No se almacenan claves en localStorage.

## Proveedores de almacenamiento

No se fija cuenta ni proveedor. Se usa la configuración de Rclone del servidor. Google Drive, OneDrive, S3, SFTP, WebDAV, Dropbox, Box y los demás proveedores disponibles se consultan con:

```sh
python3 scripts/storage.py providers
sudo python3 scripts/storage.py connect
sudo python3 scripts/storage.py list
sudo python3 scripts/storage.py test NOMBRE_REMOTO
```

`connect` abre el asistente interactivo oficial de Rclone. El proveedor puede pedir consentimiento OAuth, claves, endpoint o contraseña según su protocolo. En un servidor sin navegador, seguir el flujo oficial de autorización remota: https://rclone.org/remote_setup/. Una sesión de Google o Microsoft del navegador no concede por sí misma acceso al servidor. No copiar tokens al repositorio.

Después de autorizar, configurar el remoto y ruta en **Respaldos y destinos**. Para retención GFS usar **Retención de respaldos** con un repositorio Restic compatible. La propuesta 7 diarias, 4 semanales y 3 mensuales es editable; no se aplica antes de conectar el repositorio. Guardar por separado la clave de recuperación generada para cada usuario, fuera del servidor y del repositorio.

El número de copias locales se modifica en los planes de cada cuenta; la propuesta es 2. Los horarios globales se editan por SSH en el crontab de `hestiaweb`; conservar los demás trabajos nativos. La retención semanal/mensual conserva puntos de recuperación y no crea por sí misma una programación semanal o mensual. Verificar un respaldo y restauración antes de migrar datos reales.

## API y asistentes de IA

Usar access/secret keys individuales y perfiles de comandos limitados. El servidor permite restringir IP de origen. Documentación: https://hestiacp.com/docs/server-administration/rest-api.

Para un asistente se necesita además un adaptador autenticado que traduzca herramientas a comandos permitidos de la API. Esta versión no incluye un servidor MCP, no conecta ChatGPT/Claude ni ejecuta instrucciones de una IA. La integración debe empezar con lectura, mantener auditoría y requerir confirmación para cambios. No compartir la contraseña SSH ni publicar una API de ejecución de shell.

## PHP: ámbitos distintos

- **Servidor**: versiones instaladas, versión predeterminada y extensiones instaladas por versión mediante paquetes del sistema.
- **Dominio**: selección PHP / Backend en las opciones avanzadas del sitio, dentro de su cuenta.
- **Límites personalizados**: pool o plantilla propios por dominio y versión. No modificar las plantillas nativas si se necesita conservar cambios ante actualizaciones.
- **Editor PHP global de Hestia 1.10.5**: su implementación concatena configuraciones y aplica el resultado a varios `php.ini`. El panel lo identifica como editor compartido; no se presenta como editor por versión o por cuenta.

La instalación de antivirus, extensiones PHP o herramientas externas sigue siendo una operación del sistema. El panel expone los servicios instalados; no muestra instaladores ficticios.
