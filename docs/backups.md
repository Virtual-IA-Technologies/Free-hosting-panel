# Respaldos administrables

El administrador abre **Copias de seguridad** y encuentra cuatro pestañas: copias actuales, programación, destinos y configuración nativa. Las cuentas normales y suplantadas conservan sus respaldos nativos, sin acceso a las políticas globales ni a las credenciales externas.

## Instalar

```sh
python3 scripts/install-backup-admin.py
# Si Hestia utiliza otra carpeta local:
python3 scripts/install-backup-admin.py --native-backup-dir /ruta/de/respaldos
```

Requiere Hestia y sus servicios existentes; Rclone instalado/configurado por root para destinos externos. No instala Node, un servidor OAuth ni un servicio residente. El instalador añade un cron de comprobación por minuto, inactivo sin políticas habilitadas. Conserva la configuración anterior para revertir.

## Configurar una política

1. Elegir una o varias cuentas y contenido: cuenta completa, bases SQL, archivos web o mensajes de correo.
2. Elegir almacenamiento local o una conexión Rclone disponible. La subcarpeta es relativa, nunca una ruta del sistema.
3. Seleccionar frecuencia diaria, semanal, mensual o expresiones cron personalizadas. Admite varias expresiones y zona horaria por política.
4. Definir cuántas copias locales conservar y retención externa por días, semanas, meses o ventana de horas. Cero desactiva una categoría, pero debe quedar alguna retención válida.
5. Guardar y confirmar. Una política nueva empieza pausada; activar cuando destino, primera copia y restauración estén verificados. **Ejecutar ahora** permite una copia manual incluso estando pausada.

Las políticas son editables; no hay retención ni proveedor obligatorio. Los trabajos comparten un solo trabajador de prioridad baja. Si coinciden horarios, las políticas pendientes esperan al trabajador; varias ejecuciones vencidas de una misma política se agrupan en una sola. No se promete una copia exacta cada minuto cuando la generación tarda más que el intervalo.

El panel consulta el inventario al abrir o actualizar. Durante una tarea visible consulta solo su estado cada cinco segundos; al ocultar la pestaña detiene el sondeo. El código específico de respaldos se descarga únicamente en esta pantalla.

## Destinos y credenciales

Conectar proveedores mediante Rclone en una sesión administrativa del servidor; usar su flujo OAuth cuando corresponda. Google Drive, OneDrive, S3 y otros proveedores dependen de las capacidades/configuración de Rclone. El panel lista las conexiones existentes y comprueba lectura; esta versión no incorpora un asistente OAuth web universal.

La configuración privada está en `/root/.config/rclone/rclone.conf`, con acceso exclusivo de root. Nunca pegar tokens en el navegador, documentación, repositorio o archivos de distribución. Migrar una autorización existente requiere consentimiento específico y transferencia privada, conservando el origen hasta validar el relevo.

Los nuevos objetos se crean bajo `VIP/<instalación>/<política>/<cuenta>/`. La retención solo elimina objetos registrados de esa política e instalación; no toca carpetas ni respaldos de un servidor anterior. Cambiar destino o subcarpeta crea otro identificador para preservar las copias anteriores. Eliminar una programación conserva sus archivos.

Las copias históricas del servidor anterior no aparecen automáticamente en el inventario nuevo. Permanecen en su almacenamiento; no se eliminan ni se presentan como copias creadas por VIP.

## Qué incluye y cómo recuperar

| Contenido | Formato y recuperación |
| --- | --- |
| Cuenta completa | Formato nativo Hestia, con metadatos y exclusiones nativas; restaurar con las herramientas nativas de Hestia. |
| Bases | SQL comprimido, bases registradas en la cuenta, rutinas/eventos/triggers; importar en un entorno aislado antes de sustituir datos. No incluye usuarios SQL globales ajenos al propietario. |
| Web | Archivo tar.gz del directorio web de la cuenta. No incluye por sí solo bases ni configuración completa de alojamiento. |
| Correo | Archivo tar.gz de los mensajes de la cuenta. No sustituye el respaldo completo de metadatos y configuración de correo. |

SQL usa `--single-transaction`: comprobar consistencia de tablas no transaccionales y cambios de esquema concurrentes. No hay restauración automática de SQL, web o correo desde este módulo. Las copias locales administradas pueden descargarse desde el panel; los archivos nativos se administran/descargan en la vista de su cuenta. Los objetos externos se recuperan con el proveedor o Rclone.

La transferencia comprueba el tamaño remoto. Esto no demuestra recuperabilidad: validar descarga y restauración periódicamente, además de revisar errores y capacidad. No desactivar respaldos del origen solo porque exista una política nueva.

## Hora, auditoría y reversión

Las fechas visibles usan `dd/mm/aaaa` y la zona horaria configurada del servidor; cada política conserva su zona explícita. Los nombres de archivo mantienen UTC y los registros técnicos originales no se reescriben.

Estado, políticas, historial, archivos privados y auditoría viven en `/var/lib/vip-backup-admin`, accesible solo por root. El inventario del navegador no contiene rutas privadas ni tokens. Las operaciones requieren sesión administrativa nativa, CSRF, confirmación y parámetros enumerados. No se aceptan comandos arbitrarios.

```sh
python3 tests/backups.py
python3 scripts/install-backup-admin.py --uninstall
```

La desinstalación espera a que termine la tarea activa, restaura archivos registrados y conserva copias, auditoría y credenciales. No borra datos externos.
