# Gestor administrativo opcional

Implementación candidata para HestiaCP **1.10.5** en Linux con APT/dpkg y Python 3.10 o posterior. Su validación y despliegue se registran en `PENDIENTES_Y_CONTINUIDAD.md`. Instalar la presentación no instala este módulo ni paquetes del sistema.

## Uso y alcance

Salud del sistema → **Versiones y actualizaciones** abre `/list/server/#vip-software`. El código de esta vista se descarga al abrirla. Las pestañas muestran software, PHP/extensiones e historial. Si el endpoint no existe o el servicio está detenido, se informa el estado y se ofrecen las rutas nativas. Solo se consulta progreso mientras la vista está abierta y hay una operación activa; no hay sondeos globales.

Se leen versiones instaladas y candidatas de la caché APT real. **Planificar actualización de índices** permite actualizar esa caché mediante un plan confirmado. Las familias permitidas incluyen Hestia y su PHP interno, Apache, Nginx, PHP de alojamiento, SQL, correo, DNS y herramientas de seguridad. Un componente sin paquete permitido se muestra como desconocido: puede no existir o haberse instalado fuera de APT. No se deduce vulnerabilidad comparando una versión base con upstream. El catálogo PHP indica soporte y fecha de revisión, con [fuente oficial](https://www.php.net/supported-versions.php); no inventa versiones upstream.

Las actualizaciones de servicios se limitan a mantenimiento de la rama instalada. Una versión upstream distinta de Hestia requiere revisar compatibilidad de VIP, aunque conserve la misma rama. Los cambios de rama de SQL, Apache, Nginx, correo y DNS también requieren una revisión independiente. No se ofrece una actualización indiscriminada del sistema operativo, cambio de repositorios, eliminación de paquetes ni downgrade.

PHP 8.4/8.5 se puede instalar en paralelo cuando los repositorios y el instalador nativo compatible lo permiten. Se fija la alternativa CLI existente para que instalar otra rama no cambie el PHP predeterminado. La configuración se completa con una copia privada del instalador nativo cuyo bloque APT se sustituye por los paquetes ya planificados; si la estructura cambia se rechaza la operación. No se modifican selecciones de los dominios. El PHP interno del panel, el predeterminado y los backends de las cuentas se muestran por separado.

Las extensiones se habilitan/deshabilitan en FPM y CLI de una rama compartida. La vista distingue su configuración por SAPI; después de modificar se comprueban los módulos efectivos y el servicio FPM. Se protegen `curl`, `intl`, `mbstring`, `mysql`, `xml` y `zip` en todas las ramas para cubrir consumidores compartidos cuya detección no sea concluyente. No se presenta un editor de `php.ini` por cuenta.

## Seguridad y planes

El endpoint PHP usa `inc/main.php` de Hestia: sesión, IP, vencimiento, rol actual y origen nativos. Además exige administrador sin suplantación, POST y `verify_csrf`. El actor se obtiene exclusivamente de la sesión. Los parámetros extra, acciones desconocidas y confirmaciones ausentes se rechazan.

PHP habla con `/run/vip-software/control.sock`: no hay listener HTTP del broker, shell ni comandos proporcionados por el navegador. El directorio/socket se limita a root y al grupo del proceso web; `SO_PEERCRED` verifica el UID. Ese proceso web es parte de la frontera de confianza del módulo. Quien comprometa el proceso autenticador podría solicitar las operaciones permitidas: el broker no sustituye el aislamiento del sistema.

Cada plan dura diez minutos y pertenece a un administrador. Se guarda en privado y se consume una sola vez. Antes de ejecutar se contrastan inventario, configuración PHP, selección CLI, argumentos y simulación de dependencias. Cada paquete simulado se fija a su versión; se rechazan retiradas, SQL nuevo, cambios de rama SQL y degradaciones. Las operaciones son excluyentes dentro del broker; APT conserva además sus propios bloqueos. La aplicación de paquetes se ejecuta en un hilo independiente de la petición HTTP.

## Instalación, actualización y reversión

Como root, desde una copia revisada de este proyecto:

```sh
python3 scripts/install-software.py --dry-run
python3 scripts/install-software.py
systemctl status vip-software
```

`--hestia-root` permite otra ruta compatible y `--web-user` indica el usuario real del proceso web, normalmente `hestiaweb`. No se habilitan puertos ni se crea ninguna cuenta. Los archivos administrativos se guardan en `/opt/vip-software`; el endpoint es `web/vip/software/index.php`. El instalador respalda únicamente los siete archivos que modifica, incluyendo servicio y hook. El hook de Hestia repone el endpoint después de actualizar el panel, sin reiniciar el broker. El instalador visual conserva sus opciones independientes de puertos, apariencia y certificados.

Para actualizar, volver a ejecutar el instalador opcional. Rechaza una operación activa y espera a que el broker finalice antes de detenerse. El servicio procesa SIGTERM y no interrumpe deliberadamente APT; no usar `kill -9` ni detener el servidor durante una transacción.

Cada instalación imprime su directorio de respaldo. Para desinstalar esa entrega o recuperar los archivos anteriores:

```sh
python3 scripts/install-software.py --restore /var/lib/vip-software/installer-backups/FECHA
```

Se verifica que los archivos instalados no hayan cambiado antes de restaurarlos; si hubo modificaciones posteriores requiere revisión manual. Se recuperan permisos y estado anterior del servicio. No se borran historial ni respaldos, y no se desinstalan paquetes que el gestor haya instalado. Si se revierte por separado un instalador visual anterior que respaldó un hook antiguo, reinstalar el módulo opcional para reponer su hook.

## Respaldos y recuperación

Estado, planes, auditoría y respaldos están en `/var/lib/vip-software`, accesible solo por root. Cada operación que cambia software guarda inventario y configuración gestionada y comprueba que los servicios antes activos continúen activos. Antes de actualizar SQL se exige un volcado completo con bloqueo de tablas, rutinas, eventos y triggers usando el archivo local de acceso nativo de Hestia (`conf/.mysql.localhost` o `conf/.mysql.127.0.0.1`); si falta o falla el volcado no se instalan paquetes. Hay que reservar espacio y ventana de mantenimiento, y probar restauración con datos de prueba antes de usarlo con clientes.

FPM se valida antes de recargar. Si falla la operación de módulos, se restauran los enlaces anteriores de FPM/CLI y se vuelve a validar y recargar. Los paquetes instalados permanecen. El historial diferencia ese resultado de una recuperación que requiera intervención.

**Restaurar configuración no es degradar paquetes ni recuperar una base de datos.** Los respaldos de configuración no son un snapshot completo del servidor. No hay rollback automático de paquetes ni restauración SQL automática. El reinicio del servidor se indica cuando existe `reboot-required`, pero no se ejecuta.

Tras una interrupción brusca los trabajos quedan marcados como interrumpidos y se bloquean nuevos planes. Revisar APT/dpkg, servicios y respaldos; después, con el servicio detenido y sin otro gestor de paquetes en uso:

```sh
systemctl stop vip-software
python3 /opt/vip-software/software_agent.py --acknowledge-interrupted
systemctl start vip-software
```

Este reconocimiento exige root y `dpkg --audit` limpio. Registra la revisión; no reanuda ni repite la operación interrumpida. Las consultas del sistema tienen límites de tiempo; las transacciones APT/SQL no se matan por vencer una petición del navegador. Una operación atascada requiere diagnóstico administrativo.

## Comprobaciones

`npm run test:software` usa paquetes y procesos simulados y estado temporal privado. Cubre listas permitidas, retiradas, degradaciones, ramas SQL, versiones fijadas, expiración/actor/inventario del plan, repetición, exclusión, fallo de volcado y recuperación FPM.

`npm run test:software-endpoint` prueba los controles del endpoint con una fixture de autenticación nativa; no certifica el ciclo real de sesión de Hestia. `npm run test:software-ui` prueba la interfaz con respuestas simuladas, confirmación, progreso, carga diferida, ausencia de sondeos al salir y móvil/teclado.

Antes de publicar hay que comprobar además en Linux la instalación/reversión, permisos efectivos del socket, peticiones PHP con sesión real, una operación controlada y conservación de servicios, accesos y renovación TLS. No instalar ni actualizar servicios reales solo para cumplir una prueba.
