# Instalar VIP en otro servidor

VIP es una extensión de presentación para una instalación existente de HestiaCP. No es un instalador del sistema operativo ni reemplaza sus servicios. Compatibilidad probada: **HestiaCP 1.10.5**, Linux y Python 3.10 o posterior. No se garantiza compatibilidad con versiones anteriores o futuras sin revisión.

## 1. Preparar Hestia

1. Instala Hestia mediante su [guía oficial](https://hestiacp.com/docs/introduction/getting-started). Define tu propio hostname, IP y administrador. Puedes elegir `vipadmin`; VIP no impone ese nombre.
2. Conserva las credenciales generadas y las llaves SSH en un gestor de secretos. Cada servidor necesita credenciales distintas; este repositorio no trae contraseñas ni llaves compartidas.
3. Comprueba que puedes iniciar sesión en Hestia y conserva una sesión SSH de recuperación. Habilita HTTPS con un certificado válido para tu hostname siguiendo la [documentación SSL](https://hestiacp.com/docs/server-administration/ssl-certificates).
4. Si deseas archivos integrados, instala el gestor de archivos nativo de Hestia. VIP verifica su compatibilidad antes de aplicar cambios.

El certificado del panel, los certificados de sitios y los certificados de correo tienen ámbitos diferentes. Un certificado para el hostname no cubre automáticamente los dominios de las cuentas. Configura SSL de cada sitio en sus opciones web. No retires un sitio usado para emitir o renovar certificados sin preparar antes un método de renovación independiente.

## 2. Descargar e instalar

En el servidor, con una cuenta que pueda usar `sudo`:

```sh
git clone https://github.com/Virtual-IA-Technologies/Free-hosting-panel.git
cd Free-hosting-panel
git checkout v1.2.0
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
