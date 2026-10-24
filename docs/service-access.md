# Accesos independientes por puerto

La extensión visual no abre puertos ni instala aplicaciones al ejecutarse. Estos servicios se habilitan **expresamente** con los scripts administrativos siguientes, después de revisar firewall, certificado y dependencias. No requieren dominios de alojamiento ni crean usuarios.

| Servicio | Puerto de ejemplo | Autenticación |
| --- | --- | --- |
| Panel principal | 8083, o el puerto existente de Hestia | Cuenta Hestia y sus permisos/2FA |
| Acceso adicional de cuentas | 2087 | La misma autenticación nativa de Hestia |
| phpMyAdmin | 2083 | Usuario SQL o SSO nativo por base de datos |
| Webmail | 2096 | Dirección de correo y contraseña del buzón |
| IMAP cifrado | 993 | Credenciales del buzón; servicio nativo |
| Envío SMTP cifrado | 465 o 587 con STARTTLS | Credenciales del buzón; servicio nativo |

Son ejemplos configurables, no una asignación obligatoria ni los puertos estándar de cPanel. El acceso 2087 añade otro listener al servidor nativo: no utiliza un proxy y conserva la IP real del cliente. **El puerto no separa permisos de administrador y cliente**. Cada cuenta recibe la interfaz y recursos autorizados por Hestia; un administrador continúa siendo administrador por cualquiera de sus listeners. Los puertos del mismo hostname tampoco aíslan las cookies del navegador.

## Preparar y habilitar

Requiere Nginx, el certificado del panel, los scripts CLI de Hestia y los componentes nativos correspondientes. Para phpMyAdmin se reutiliza `phpmyadmin.inc`; para webmail se requiere Roundcube en `/var/lib/roundcube`. El script detecta `public_html/index.php` en versiones recientes y mantiene compatibilidad con la estructura anterior. Se utiliza el socket PHP instalado `/run/php/www.sock`.

```sh
sudo python3 scripts/phpmyadmin-service.py --port 2083 --dry-run
sudo python3 scripts/access-service.py accounts --port 2087 --dry-run
sudo python3 scripts/access-service.py webmail --port 2096 --dry-run
```

Si la revisión es correcta:

```sh
sudo python3 scripts/phpmyadmin-service.py --port 2083
sudo python3 scripts/access-service.py accounts --port 2087
sudo python3 scripts/access-service.py webmail --port 2096
```

Estos comandos crean listeners IPv4; la accesibilidad externa depende de **todas** las capas de red y firewall. La opción **`--open-firewall` abre el puerto TCP a Internet (`0.0.0.0/0`) usando Hestia**. Úsala solamente si has decidido ofrecer el servicio públicamente. Para acceso restringido, administra reglas por IP en el firewall de Hestia y en el proveedor antes de activar el listener. La opción `--ipv6` habilita también ese protocolo; administra su firewall por separado antes de utilizarla.

Los scripts verifican sintaxis, respaldan la configuración y revierten sus cambios si falla la aplicación. Los servicios web se recargan sin sustituir aplicaciones ni contraseñas. Guardan un manifiesto privado en `/opt/virtual-ia-panel/service-backups/FECHA`.

Después, enlaza los servicios existentes desde el panel:

```sh
sudo python3 scripts/install.py --default-theme medium --login-theme graphite \
  --phpmyadmin-port 2083 --account-port 2087 --webmail-port 2096
```

Una opción de puerto igual a `0` omite el acceso adicional; no apaga un servicio ya instalado ni elimina su regla de firewall. Los enlaces usan el hostname o IP del acceso actual y HTTPS; no fijan datos de otro servidor. Se preservan los tokens de los enlaces SSO nativos. Hestia puede limitar SSO al acceso por hostname; el formulario SQL directo sigue disponible por IP.

## Login y recuperación

El instalador activa por defecto el formulario nativo de usuario y contraseña juntos (`LOGIN_STYLE=old`). `--login-style steps` conserva el flujo por pasos y `--login-style preserve` no cambia el ajuste actual. El login y la recuperación usan `--login-theme graphite`, independiente del tema elegido dentro de cada cuenta. No se guardan contraseñas ni se evita la verificación 2FA.

El enlace «Olvidé mi contraseña» depende de la política nativa. Un administrador puede habilitarla expresamente:

```sh
sudo /usr/local/hestia/bin/v-change-sys-config-value POLICY_SYSTEM_PASSWORD_RESET yes
```

La recuperación solicita usuario y correo registrado. La entrega del mensaje requiere correo saliente operativo; ver el formulario no certifica la entrega. Nunca cambies una contraseña basándote solo en el correo escrito por quien visita el login.

## Certificados para hostname e IP

Un certificado del hostname no valida una conexión por IP. Se puede emitir un certificado que incluya ambos identificadores. Let's Encrypt admite certificados para IP con el perfil `shortlived`; requieren renovación automatizada. Usa Certbot **5.4 o posterior** para validación webroot por IP y consulta su [guía oficial](https://letsencrypt.org/2026/03/11/shorter-certs-certbot).

El desafío HTTP debe estar disponible por el puerto 80 para cada identificador solicitado, independientemente de las cuentas de alojamiento. No añadas una IP que no esté asignada y correctamente encaminada al servidor. Empieza con `--staging`, en directorios separados, y solo emite el certificado público cuando la validación funcione. No instales un certificado de pruebas en producción.

Certbot permite importar la renovación mediante un hook:

```sh
# Ejecutar manualmente después de una emisión válida:
sudo python3 scripts/deploy-panel-certificate.py --lineage /RUTA/REAL/DEL/LINEAGE
# En un deploy-hook de Certbot, RENEWED_LINEAGE proporciona la ruta:
sudo python3 scripts/deploy-panel-certificate.py
```

El hook verifica vigencia y correspondencia de la clave, respalda el certificado anterior y utiliza el CLI nativo de Hestia. Recarga Nginx y los servicios que actualiza Hestia. Conserva scripts y claves privados con permisos restringidos. Configura un temporizador de renovación, por ejemplo cada seis horas con demora aleatoria corta, y prueba `certbot renew --dry-run --no-random-sleep-on-renew` usando tus directorios reales. Monitoriza fallos y caducidad: un temporizador activo no garantiza por sí solo la renovación.

La extensión no emite certificados ni modifica DNS automáticamente. Los certificados de dominios web y correo siguen siendo independientes de las cuentas y deben configurarse para cada nombre utilizado.

## Actualizar o retirar servicios

Tras una actualización de Hestia/Nginx, revisa y vuelve a aplicar el listener adicional; el proveedor puede reemplazar su configuración. El servicio phpMyAdmin necesita que el alias nativo siga siendo `/phpmyadmin`; revisa su configuración si cambias `DB_PMA_ALIAS`. Valida también Roundcube y su socket PHP tras actualizar sus paquetes.

Para revertir un servicio, consulta el manifiesto de su instalación: restaura `config.before` (o `vip-phpmyadmin.conf.before` para phpMyAdmin) sobre el `target` registrado. Si `hadConfig` es falso, retira únicamente ese archivo nuevo. Elimina solo los identificadores de `addedFirewallRules` con el CLI nativo `v-delete-firewall-rule`. Comprueba la sintaxis y recarga el Nginx correspondiente antes de cerrar la sesión SSH de recuperación. Retirar la extensión visual no desinstala estos servicios ni sus reglas.

No se crean buzones, bases de datos o cuentas de prueba durante estas operaciones. Sin un buzón o usuario SQL existente podrás ver el formulario, pero no iniciar sesión en ese servicio.
