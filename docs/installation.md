# Instalar VIP en otro servidor

VIP es una extensión de presentación para una instalación existente de HestiaCP. No es un instalador del sistema operativo ni reemplaza sus servicios. Compatibilidad probada: **HestiaCP 1.10.5**, Linux y Python 3.10 o posterior. No se garantiza compatibilidad con versiones anteriores o futuras sin revisión.

## 1. Preparar Hestia

1. Instala Hestia mediante su [guía oficial](https://hestiacp.com/docs/introduction/getting-started). Define tu propio hostname, IP y administrador. Puedes elegir `vipadmin`; VIP no impone ese nombre.
2. Conserva las credenciales generadas y las llaves SSH en un gestor de secretos. Cada servidor necesita credenciales distintas; este repositorio no trae contraseñas ni llaves compartidas.
3. Comprueba que puedes iniciar sesión en Hestia y conserva una sesión SSH de recuperación. Habilita HTTPS con un certificado válido para tu hostname siguiendo la [documentación SSL](https://hestiacp.com/docs/server-administration/ssl-certificates).
4. Si deseas archivos integrados, instala el gestor de archivos nativo de Hestia. VIP verifica su compatibilidad antes de aplicar cambios.

Para que el administrador recorra el servidor desde `/`, instala por separado el [módulo opcional de archivos](root-files.md). El tema no amplía por sí solo los permisos del gestor.

El certificado del panel, los certificados de sitios y los certificados de correo tienen ámbitos diferentes. Un certificado para el hostname no cubre automáticamente los dominios de las cuentas. Configura SSL de cada sitio en sus opciones web. No retires un sitio usado para emitir o renovar certificados sin preparar antes un método de renovación independiente.

## 2. Descargar e instalar

En el servidor, con una cuenta que pueda usar `sudo`:

```sh
git clone https://github.com/Virtual-IA-Technologies/Free-hosting-panel.git
cd Free-hosting-panel
git checkout v1.3.3
sudo python3 scripts/install.py --dry-run --default-theme medium
sudo python3 scripts/install.py --default-theme medium
```

Se incluyen los artefactos compilados en `dist/`: **no necesitas Node en producción**. El instalador crea un respaldo privado, genera los puentes desde los recursos nativos instalados y muestra la ruta de reversión. No descarga ni ejecuta un instalador remoto.

Opciones independientes:

| Opción | Función |
| --- | --- |
| `--app-name "Mi Panel"` | Nombre visible del panel |
| `--default-theme medium` | Tema inicial: `night`, `graphite`, `medium` o `light` |
| `--login-theme graphite` | Tema del login, independiente del panel |
| `--login-style single` | Usuario y contraseña juntos; admite `steps` o `preserve` |
| `--phpmyadmin-port`, `--account-port`, `--webmail-port` | Enlazar servicios ya instalados; no abrir puertos |
| `--without-file-manager` | Mantener el gestor nativo; no generar su integración |
| `--hestia-root /ruta/hestia` | Instalar en otra ruta de Hestia |
| `--apply-to-existing-users` | Asignar expresamente el tema VIP a usuarios existentes |
| `--dry-run` | Verificar compatibilidad sin cambiar archivos |

La instalación conserva usuarios, contraseñas, hostname, IP, dominios, DNS y certificados. Las preferencias de apariencia del panel se conservan por usuario. El login usa su propio tema y el estilo nativo indicado. El instalador no limpia datos ni provisiona cuentas. Para activar servicios y firewall por separado, consulta [accesos por puerto](service-access.md).

## Módulos opcionales

La instalación anterior basta para la interfaz, pestañas, navegación y controles nativos de servicios. No instala Node, terminal, paquetes de correo ni motores SQL. Reiniciar un servicio requiere confirmar su acción nativa; no se reinicia nada durante la instalación visual.

### Gestor de versiones y PHP

Solo si necesitas administrar paquetes desde el panel:

```sh
sudo python3 scripts/install-software.py --dry-run
sudo python3 scripts/install-software.py
```

Añade un servicio Python local con socket Unix, sin puerto público. Usa el Python del sistema, no requiere pip ni Node. Las consultas se hacen bajo demanda; solo se consulta progreso mientras hay un trabajo visible. No aplica actualizaciones automáticamente. Consulta [operaciones, seguridad y reversión](software-manager.md). Es independiente del instalador visual.

### Estilo opcional de webmail

Requiere Roundcube moderno ya instalado y accesible:

```sh
sudo python3 scripts/install-webmail-theme.py --dry-run
sudo python3 scripts/install-webmail-theme.py
```

Si webmail abre sin CSS/JS o logo y devuelve 404 en `/static.php/skins/`, regenera únicamente el listener de webmail usando su puerto elegido:

```sh
sudo python3 scripts/access-service.py webmail --port 2096 --dry-run
sudo python3 scripts/access-service.py webmail --port 2096
```

Esto requiere el servicio PHP-FPM, certificado y Roundcube nativos. No añade reglas de firewall salvo que se pida expresamente con la opción correspondiente. Cambia 2096 por tu puerto. El controlador permite recursos estáticos de skins/plugins/program; bloquea otras rutas PHP y configuración privada. Conserva la ruta de respaldo mostrada por cada instalador. Para retirar el tema usa `sudo python3 scripts/install-webmail-theme.py --restore /opt/virtual-ia-panel/webmail-theme-backups/FECHA`; el listener tiene su reversión propia en [accesos por puerto](service-access.md).

## Versiones y actualizaciones

Abre **Panel → Versiones y actualizaciones**. La pestaña **Software** consulta los paquetes instalados y candidatos de web, base de datos, correo, DNS y seguridad; **PHP y extensiones** permite preparar instalaciones en paralelo y cambios de módulos; **Historial** muestra las operaciones. Primero se prepara un plan y después se confirma su ejecución. Requiere el gestor opcional descrito arriba. **Actualizaciones de Hestia** es una pantalla distinta y solo lista los paquetes internos del panel. Instalar VIP no actualiza PHP ni los servicios automáticamente.

## Reiniciar servicios

Como administrador, abre **Panel → Estado del servidor** y usa **Reiniciar** en el servicio correspondiente. Se conserva la confirmación, el token y los permisos de Hestia. No requiere instalar el gestor opcional, Node ni una terminal. Reinicia solo el servicio necesario; hacerlo puede interrumpir brevemente sus conexiones.

Para mantener una instalación ligera, basta el instalador visual: usa recursos estáticos compilados y no añade un proceso residente. El gestor de paquetes y el tema webmail son opcionales e independientes. Node solo se utiliza en desarrollo o CI, fuera del VPS.

## 3. Validar y empezar

- Entra por `https://TU_HOSTNAME:8083/`. Comprueba acceso administrativo y acceso de una cuenta normal.
- Revisa el tema claro/oscuro, navegación móvil, laterales de alta/edición, cancelación y archivos.
- Crea las cuentas y dominios reales mediante Hestia cuando estés listo. Cada cuenta tiene sus propios permisos, directorios y panel de alojamiento.
- Configura PHP, correo, firewall, respaldos y claves API en sus ámbitos nativos. Consulta [integraciones y límites](integrations.md).
- Google Drive, OneDrive y otros destinos requieren autorizar tu propia cuenta y probar un respaldo y una restauración. No se conectan proveedores automáticamente.

## Actualizar

Primero lee el CHANGELOG y respalda el servidor. Descarga una versión publicada, ejecuta `--dry-run` y reinstala usando las mismas opciones de nombre, tema y archivos que elegiste. La reinstalación cambia la huella de los recursos y renueva su caché.

Después de actualizar Hestia o FileGator, vuelve a ejecutar el instalador y las pruebas: los puentes se generan a partir de los archivos nativos de esa instalación. El hook repone la última copia instalada, pero no certifica compatibilidad con otra versión de Hestia. No edites a mano los paquetes minificados ni los archivos originales del proveedor.

## Revertir

Usa la ruta exacta que mostró tu instalación:

```sh
sudo python3 scripts/uninstall.py /opt/virtual-ia-panel/backups/FECHA
```

Esto revierte los archivos y preferencias registrados de esa instalación. No restaura datos de clientes ni sustituye un respaldo completo. Los respaldos del instalador pueden contener configuración anterior del servidor: consérvalos privados y fuera del repositorio.

## Desarrollar y verificar

Con Node 22 o posterior y Python 3.10 o posterior:

```sh
npm ci
npm run build
npm run check
npm run test:installer
```

Las pruebas de navegador requieren Chrome/Chromium y credenciales de un servidor de revisión; su configuración está en [tests/README.md](../tests/README.md). No definas credenciales en archivos versionados. Las pruebas locales del instalador no requieren Linux, root ni un servidor real.
