# Administración de correo y bases de datos

El inventario global pertenece a la sesión principal del administrador. Cuentas normales y sesiones suplantadas conservan su ámbito. Este módulo no cambia DNS ni activa dominios suspendidos.

## Instalación opcional

Ejecutar como root desde la distribución VIP:

```sh
python3 scripts/install-mail-admin.py
# Crear también un acceso SQL administrativo global, si no está provisionado:
python3 scripts/install-mail-admin.py --enable-sql-admin
```

Requiere Hestia, Exim, Dovecot, Roundcube y phpMyAdmin existentes. No instala ConfigServer, Node ni servicios residentes adicionales. Usa sesión, rol y CSRF nativos y un helper local con operaciones enumeradas. El respaldo privado está registrado en `/var/lib/vip-mail-admin/installer.json`.

`--enable-sql-admin` genera un usuario SQL exclusivo de localhost, contraseña aleatoria y permisos globales. No cambia contraseñas de root, panel ni clientes. Si existe ese usuario sin estado privado, se detiene para evitar sobrescribir credenciales ajenas. Credenciales y auditoría nunca deben publicarse.

## Bases, usuarios y privilegios

- **Crear nueva base de datos:** elegir propietario y usar el formulario nativo; registra base y usuario en la cuenta para gestión y respaldos.
- **phpMyAdmin · todas las bases:** acceso único administrativo a todas las bases del servidor.
- **Usuarios y permisos SQL:** creación de usuarios, asignación/revocación de privilegios y contraseñas desde phpMyAdmin.
- Los botones globales y el acceso lateral usan el ámbito administrativo solo cuando está habilitado. Los clientes mantienen su SSO limitado.

Crear bases directamente en phpMyAdmin no las registra automáticamente en Hestia. Crear primero desde Hestia para mantener propietario, cuotas y respaldos; contemplar usuarios/permisos SQL adicionales en la recuperación.

El navegador recibe un ticket aleatorio de un solo uso, ligado a su IP y válido durante 60 segundos; no recibe credenciales en el inventario. Después se usa la sesión nativa de phpMyAdmin.

## Operaciones de correo

| Necesidad | Acceso |
| --- | --- |
| Crear dominio | Selector de propietario → Crear dominio de correo |
| Crear dirección | Crear buzón |
| Contraseña, cuota y alias | Contraseña y ajustes |
| Reenvíos y respuesta automática | Contraseña y ajustes; controles nativos |
| Suspender/eliminar buzón | Buzones / suspender / eliminar; confirmación nativa |
| Configurar dominio y relay SMTP | Dominio y relay SMTP |
| Bandeja activa | Acceder a bandeja; Roundcube administrativo auditado |
| Mensajes suspendidos | Acceder a bandeja; vista rápida de solo lectura |

Roundcube usa un acceso maestro Dovecot exclusivo de loopback, sin cambiar contraseñas del buzón. Ticket inicial de un solo uso; sesión administrativa limitada a 30 minutos e IP de origen. Conceder este acceso al contenido del correo solo a administradores de confianza.

El hash maestro solo es legible por root y el grupo de autenticación Dovecot; la contraseña original permanece en almacenamiento privado de root. Las aplicaciones compartidas consumen tickets por un puente HTTPS exclusivo de loopback hacia el PHP nativo del panel. Se mantienen bloqueados los procesos externos en su PHP y no se concede sudo al usuario de phpMyAdmin/Roundcube. `--panel-port` permite adaptar el puerto del puente a otra instalación.

La vista rápida conserva la suspensión y no permite enviar. Muestra hasta 100 mensajes recientes de una consulta limitada a 20.000 archivos, 256 carpetas y cinco segundos; indica resultados parciales. La lectura privilegiada rechaza enlaces simbólicos y rutas externas al buzón. No se recorre el disco al abrir el panel.

## Herramientas tipo WHM

- **Cola:** hasta 1.000 registros, antigüedad, remitente, destinatarios y estado; lectura de cabeceras, cuerpo e historial.
- **Reintentar, congelar, descongelar, eliminar:** confirmación obligatoria. Reintentar puede enviar correos reales; no se ejecuta durante pruebas de interfaz.
- El borrado conserva primero una copia privada del spool y se rechaza si no puede respaldarse. Recuperar spool requiere intervención administrativa; no hay restauración automática desde el panel.
- **Seguimiento y rebotes:** eventos SMTP recientes, filtrables por correo, dominio, ID o texto; entradas, entregas, aplazamientos, fallos y rechazos. No equivale a confirmación de lectura del destinatario.
- **Relayers:** resumen de remitentes autenticados en los registros consultados; no representa todo el historial ni toda la configuración de relay.
- Consulta limitada a 2 MiB por archivo de log y 500 líneas visibles. No inventa eventos anteriores a la migración.

Respuestas automáticas se configuran en el buzón; respuestas SMTP y rebotes aparecen en Seguimiento. Antivirus, antispam y cortafuegos dependen de componentes realmente instalados. Este módulo no instala ni certifica todo el catálogo ConfigServer.

## Métricas y carga

Enumerar cuentas muestra dominio, IP, contacto, alta, cuota, disco, transferencia, plan y estado. Usa contadores nativos; la frecuencia depende de las tareas programadas del servidor. El recálculo manual tiene prioridad baja y puede tardar con cuentas grandes. No se ejecuta con cada página.

La barra administrativa muestra carga media de un minuto, RAM utilizada y disco libre al cargar, sin sondeo continuo. Carga media no es porcentaje de CPU. Búsquedas y filtros del inventario se ejecutan localmente.

## Reversión y validación

```sh
python3 scripts/install-mail-admin.py --uninstall
python3 tests/mail-admin.py
```

La reversión restaura archivos registrados y valida/recarga Dovecot. Conserva credenciales y auditoría privadas; no elimina el usuario SQL global ni datos de clientes. Revocar ese usuario es una operación SQL independiente.

Las pruebas locales no envían correo ni modifican bases reales. `tests/mail-admin.cjs` comprueba listas, permisos, consultas y formularios sin borrar ni reintentar mensajes. Los cambios reales deben probarse con recursos efímeros retirados al finalizar.
