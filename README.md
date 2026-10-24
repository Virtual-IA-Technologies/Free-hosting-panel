# Virtual IA Panel

Panel de administración con identidad Virtual IA, construido como una extensión ligera de HestiaCP 1.10.5. Incluye navegación lateral, búsqueda, inicio con recursos reales, temas y accesos de administración por cuenta. La interfaz usa HTML, CSS y JavaScript progresivo: no requiere un servidor Node ni sustituye la autenticación nativa.

Login grafito con usuario y contraseña juntos, recuperación nativa y [servicios por puertos independientes](docs/service-access.md). Los servicios adicionales son opcionales y se provisionan expresamente; instalar el tema no abre puertos ni crea cuentas.

La versión 1.3.1 incorpora [pestañas de configuración](docs/configuration-tabs.md) y un [gestor administrativo opcional](docs/software-manager.md) para versiones, PHP y extensiones. El gestor tiene instalación separada y conserva autenticación, roles y CSRF nativos. Su estado de validación y publicación figura en [continuidad](docs/PENDIENTES_Y_CONTINUIDAD.md).

## Instalación

Versión 1.3.1. Los artefactos optimizados están en `dist`; el servidor no necesita Node. Para modificar recursos: `npm ci`, `npm run build`, `npm run check` y `npm run test:installer` en el equipo de desarrollo.

Requiere HestiaCP 1.10.5, Python 3.10 o posterior, el cargador `web/js/custom_scripts` y FileGator instalado en `web/fm/dist`. El instalador comprueba la estructura compatible de FileGator antes de modificar archivos. Clona la versión publicada en el servidor y ejecuta como root:

```sh
git clone --branch v1.3.1 --depth 1 https://github.com/Virtual-IA-Technologies/Free-hosting-panel.git
cd Free-hosting-panel
python3 scripts/install.py --dry-run --default-theme medium
python3 scripts/install.py --default-theme medium
```

El instalador crea un respaldo privado con manifiesto y actualiza la marca, el tema predeterminado y los recursos propios. Las actualizaciones de archivos son atómicas. La opción de usuarios existentes es explícita; sin ella conserva sus preferencias de tema.

Opciones por servidor, sin editar código:

```sh
python3 scripts/install.py --dry-run --app-name "VIP - Mi Panel" --default-theme medium
python3 scripts/install.py --app-name "VIP - Mi Panel" --default-theme medium
# Para usar el gestor nativo o instalar sin FileGator compatible:
python3 scripts/install.py --without-file-manager --default-theme medium
```

`--default-theme` admite `night`, `graphite`, `medium` y `light` para usuarios sin preferencias guardadas; cada usuario conserva su elección dentro del panel. El login usa por separado `--login-theme graphite`, sin reutilizar antiguas preferencias claras del navegador. `--login-style single|steps|preserve` controla el formulario nativo. `--app-name` configura el título y nombre del panel; `--hestia-root` admite otra ruta de Hestia. `--without-file-manager` omite las copias adaptadas de FileGator. `--phpmyadmin-port`, `--account-port` y `--webmail-port` enlazan servicios existentes; no los abren. La configuración pública contiene solamente nombre, temas, puertos, modo de archivos y versión de recursos. No debe contener secretos. Para cambiarla, vuelve a ejecutar el instalador con las opciones elegidas.

Cada instalación calcula una huella del contenido y opciones para versionar CSS y JavaScript: las recargas pueden reutilizar los recursos en caché, mientras que una actualización obtiene URLs nuevas automáticamente. Las páginas autenticadas conservan la política nativa de Hestia.

Para revertir una instalación concreta:

```sh
python3 scripts/uninstall.py /opt/virtual-ia-panel/backups/FECHA
```

Consulta la [instalación paso a paso](docs/installation.md) para actualizaciones, reversión, gestor opcional y estilo webmail. No se instala Node.js ni una terminal en el servidor.

## Uso

Crear y editar abre un lateral con los formularios, tokens y validaciones nativas. Cerrar con cambios pide confirmación; el formulario completo sigue disponible ante errores de carga. El puente de comportamiento nativo se genera al instalar y se descarga solo al abrir el primer formulario. Tras actualizar Hestia, vuelve a ejecutar el instalador y las pruebas para regenerar los recursos compatibles. El hook conserva una copia de los recursos de la última instalación; no garantiza compatibilidad con una nueva versión de Hestia.

En las listas compatibles, doble clic abre la edición disponible o el detalle; clic derecho y el botón de tres puntos muestran las acciones que ofrece la fila. `Enter` y `Mayús+F10` permiten acceder con teclado. La preferencia de doble clic (editar, detalle o desactivado) se guarda por lista y usuario en este navegador. Las confirmaciones de borrado y los permisos siguen siendo nativos. El gestor de archivos conserva sus propios gestos.

Durante la recarga aparece un indicador CSS de «Cargando…», sin descargar un GIF. Si el recurso VIP falla, el panel nativo vuelve a estar disponible tras ocho segundos. El modo sin JavaScript conserva la interfaz nativa.

- Inicio: `/list/user/#inicio`; cuentas: `/list/user/#cuentas`. Estado del servidor aparece debajo de Inicio en Panel; Reiniciar conserva la acción, token y confirmación de Hestia para cada servicio instalado.
- Configuración usa pestañas debajo de la barra de acciones, ancho completo y un solo título. Correo incluye una guía de DKIM, SPF, DMARC y PTR; este último se configura en el proveedor de la IP. Consulta la guía contextual «Entrega de correo» en la lista y edición de dominios de correo.
- Roundcube tiene un [estilo opcional](docs/installation.md#estilo-opcional-de-webmail) y soporte para sus recursos `static.php`; no cambia la autenticación ni crea buzones.
- Cuentas: crear, administrar recursos, suspender o eliminar mediante los controles nativos. Los accesos de correo, web y bases de datos entran en el contexto de la cuenta elegida mediante la suplantación nativa protegida por token.
- El espacio se administra mediante planes y la asignación del plan a cada cuenta. La cuota no aumenta físicamente el disco del VPS.
- Cortafuegos: reglas, direcciones y bloqueos en las pantallas de Hestia; el tema no modifica reglas de red.
- phpMyAdmin: abrir la base desde el icono nativo de acceso único en Bases de datos. Las claves del sistema operativo y las credenciales SQL son independientes.
- Temas por navegador y usuario: Azul noche, Grafito, Medium y Claro. Medium combina contenido claro con menú grafito oscuro y letras claras. Los errores y operaciones peligrosas mantienen su significado visual.
- Personalizar apariencia (engranaje junto al tema): escala de 80 a 125 %, imágenes independientes para menú/contenido, intensidad y restablecimiento. Los fondos se optimizan en el navegador y no se envían al servidor. Se aceptan JPG, PNG y WebP; el almacenamiento es local a cada usuario/navegador.
- Indicadores específicos por vista: Disco muestra particiones, inodos y tasas de I/O cuando están presentes en el informe; Memoria muestra RAM y swap; CPU muestra carga de 1, 5 y 15 minutos; Red muestra contadores por interfaz. La carga no equivale a utilización de CPU. Los valores se leen al abrir la página y el detalle técnico permanece visible. Las cuotas de cuentas con límite incluyen barras de uso.
- El gestor de archivos se abre dentro del panel, conservando navegación, sesión y permisos nativos. Se carga únicamente al abrir Archivos y documentos.
- Archivos incluye ancho completo, cabecera única, carpetas de la ubicación actual, árbol nativo, búsqueda, subir nivel, vistas lista/cuadrícula y acciones nativas de edición, copia, movimiento, compresión y permisos. La mejora se descarga únicamente al abrir Archivos; su vista se recuerda por usuario y navegador.
- Panel incluye accesos frecuentes a Dominios y Bases de datos. Cada dominio tiene un acceso SSL / HTTPS que abre su edición nativa; cada cuenta entra con sus propias credenciales y mantiene el aislamiento de sus recursos.
- Inicio incorpora una guía para preparar alojamiento; las cuentas incluyen acceso directo a DNS. Zonas DNS e IP muestran el alcance de cada configuración, conservando los formularios nativos.

## Hostname, dominios y DNS

El hostname identifica el servidor, por ejemplo `panel.example.com`; su registro A/AAAA puede apuntar a una IP diferente de `example.com`. El puerto 8083 es el acceso al panel y no forma parte del registro DNS. Puedes alojar dominios que controles de cualquier extensión: primero crea la cuenta y añade el dominio web; después cambia los registros en el proveedor DNS autoritativo. No es necesario mover el dominio principal usado para nombrar el servidor.

Para probar antes de mover el DNS, consulta **Dominios web → Probar antes del DNS**. Añadir temporalmente la IP y el dominio al archivo `hosts` de tu PC permite acceder al sitio nuevo sin afectar a otros visitantes. En IP compartida, la IP sola abre el sitio predeterminado; esta extensión no habilita rutas `/~usuario`. Un alias temporal compartible requiere configurar el nombre DNS asociado a la IP y sus registros; Hestia admite generarlo para dominios nuevos. HTTPS sigue necesitando un certificado válido.

Si conservas un proveedor DNS externo, administra allí A/AAAA, CNAME, MX y TXT. Si usarás el DNS de Hestia, crea la zona y delega los nameservers en el registrador; registra glue records cuando corresponda. Crear una zona local no cambia la delegación pública. Mantén los MX del proveedor actual si no migrarás correo. Revisa también AAAA para evitar que IPv6 siga enviando visitas al servidor anterior.

**Zonas DNS** permite editar registros y parámetros de zona; **Direcciones IP** administra IP del servidor, que deben estar asignadas por el proveedor. La IP del sitio se selecciona en su configuración web: modificar DNS no asigna una nueva IP al VPS. Los permisos del usuario, su plan y los servicios instalados determinan las funciones disponibles.

La administración global y las cuentas equivalen aproximadamente a WHM y cPanel: crea cuentas desde Administración y entra en cada una para administrar sus dominios, DNS, correo, bases de datos, archivos y tareas. No hay paridad completa con cPanel; se exponen las funciones reales de Hestia.

Cada cuenta recibe su directorio `/home/usuario/`: sitios en `web/dominio/public_html/`, mensajes en `mail/` y configuración asociada en `conf/`. La configuración de control de Hestia también reside en `/usr/local/hestia/data/users/usuario/`; MySQL/MariaDB almacena sus datos en el directorio del servicio, fuera de `/home`. Las bases y sus usuarios reciben el prefijo de la cuenta. No basta copiar `/home` para migrar una cuenta completa: usa los respaldos nativos de Hestia, que incluyen los recursos seleccionados y sus exportaciones SQL.

La cuenta y el plan agrupan permisos y límites, pero los dominios web, zonas DNS, dominios de correo, buzones y bases se crean expresamente. Un cliente puede gestionar varios dominios en su cuenta; usa cuentas separadas cuando necesites aislar propietarios y credenciales. El gestor de archivos usa el contexto de esa cuenta.

phpMyAdmin tiene dos entradas: el botón general o URL directa pide un usuario SQL existente; el icono de acceso único junto a una base permite entrar a esa base sin otro login si SSO está habilitado. No hay acceso global automático con la contraseña del panel. Consulta [bases de datos y SSO](https://hestiacp.com/docs/server-administration/databases).

Referencias: [DNS](https://hestiacp.com/docs/user-guide/dns), [dominios web](https://hestiacp.com/docs/user-guide/web-domains) y [delegación DNS](https://hestiacp.com/docs/server-administration/dns).

## Reutilizar en otro servidor

El proyecto no incluye usuarios, cuentas reales, dominios, direcciones IP ni credenciales. La navegación usa rutas relativas y el contexto autenticado de Hestia; el perfil API usa el origen actual. El instalador conserva el administrador principal, hostname, IP, DNS y certificados existentes. `vipadmin` puede usarse como nombre de administrador al instalar Hestia, pero esta extensión no lo crea ni fija una contraseña. Los fondos personales se guardan en el navegador y no forman parte de la plantilla.

Para un servidor nuevo, instalar primero Hestia con sus propios parámetros y después esta extensión. Mantener las copias de despliegues y clientes fuera de este repositorio. No ejecutar scripts de limpieza de un servidor como parte de la instalación de la plantilla.

## Arquitectura y límites

En **Herramientas y Developers** hay accesos directos a PHP global, destinos, retención incremental, correo y claves API. Se abre la sección nativa correspondiente sin alterar sus formularios. Developers permite exportar un perfil sin secretos y guardar accesos externos por navegador. Proveedores, autorización inicial, alcance PHP y pendientes de IA se describen en [Integraciones](docs/integrations.md).

El panel carga un CSS y un JS propios por pantalla; el login usa un paquete separado. Los recursos se minifican con una versión fijada de esbuild y se validan con `npm run check`. No se cachean páginas autenticadas ni se agregan bibliotecas de interfaz en producción.

El inicio se construye solo en su pantalla; las lecturas de métricas del sistema se limitan a Inicio y Estado/Recursos. FileGator y sus estilos se cargan bajo demanda y se montan sin iframe, con selectores CSS limitados a su contenedor. Se generan copias adaptadas de sus recursos instalados; no se modifican los originales. Si falla la carga, se ofrece el gestor nativo. Tras actualizar Hestia/FileGator, ejecuta el instalador y las pruebas nuevamente para regenerar las copias compatibles.

`src/php/virtualia-navigation.php` añade el contexto mínimo de sesión y métricas solo para administradores sin suplantación. No publica contraseñas ni añade una API. Las rutas de Hestia conservan su validación de permisos y CSRF. La mejora de presentación mantiene formularios y acciones de Hestia; no replica funciones exclusivas de WHM. Instalar este proyecto no crea clientes, cuentas SQL, correo, dominios, reglas de red ni registros DNS.

Para actualizaciones mayores de Hestia, comprobar compatibilidad del cargador y ejecutar la validación antes de reinstalar. La copia de recursos instalada se conserva fuera del árbol de Hestia y un hook oficial permite reponerla.

La validación de esta revisión y sus límites se detallan en [Validación](docs/validation.md). Las pruebas de administrador, archivos y cuenta normal están separadas para usar las credenciales correspondientes sin incluirlas en el proyecto.

Los enlaces de recursos con parámetros incluyen el token de la sesión nativa. Se deben seguir desde la navegación del panel; no compartir ni reutilizar URLs con tokens de otra sesión. No se desactiva la comprobación de CSRF o del origen.

## Publicación y licencia

Repositorio público: [Free-hosting-panel](https://github.com/Virtual-IA-Technologies/Free-hosting-panel). Código GPL-3.0-or-later; la marca y los logos Virtual IA identifican a su titular y no conceden derechos de marca. HestiaCP conserva sus avisos y licencia. No se incluyen credenciales, llaves ni datos de un despliegue. Consulta la [guía de instalación](docs/installation.md), [seguridad](SECURITY.md) y [contribuciones](CONTRIBUTING.md).
