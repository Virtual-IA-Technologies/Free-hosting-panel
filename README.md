# Virtual IA Panel

Panel de administración con identidad Virtual IA, construido como una extensión ligera de HestiaCP 1.10.5. Incluye navegación lateral, búsqueda, inicio con recursos reales, temas y accesos de administración por cuenta. La interfaz usa HTML, CSS y JavaScript progresivo: no requiere un servidor Node ni sustituye la autenticación nativa.

## Instalación

Versión 0.4.1. Los artefactos optimizados están en `dist`; el servidor no necesita Node. Para modificar recursos: `npm ci`, `npm run build` y `npm run check` en el equipo de desarrollo.

Requiere HestiaCP instalado y su cargador `web/js/custom_scripts`. Copiar este proyecto al servidor y ejecutar como root:

```sh
python3 scripts/install.py --dry-run
python3 scripts/install.py --apply-to-existing-users
```

El instalador crea un respaldo privado con manifiesto y actualiza la marca, el tema predeterminado y los recursos propios. Las actualizaciones de archivos son atómicas. La opción de usuarios existentes es explícita; sin ella conserva sus preferencias de tema.

Para revertir una instalación concreta:

```sh
python3 scripts/uninstall.py /opt/virtual-ia-panel/backups/FECHA
```

## Uso

- Inicio: `/list/user/#inicio`; cuentas: `/list/user/#cuentas`.
- Cuentas: crear, administrar recursos, suspender o eliminar mediante los controles nativos. Los accesos de correo, web y bases de datos entran en el contexto de la cuenta elegida mediante la suplantación nativa protegida por token.
- El espacio se administra mediante planes y la asignación del plan a cada cuenta. La cuota no aumenta físicamente el disco del VPS.
- Cortafuegos: reglas, direcciones y bloqueos en las pantallas de Hestia; el tema no modifica reglas de red.
- phpMyAdmin: abrir la base desde el icono nativo de acceso único en Bases de datos. Las claves del sistema operativo y las credenciales SQL son independientes.
- Temas por navegador y usuario: Azul noche, Grafito y Claro. Los errores y operaciones peligrosas mantienen su significado visual.
- Personalizar apariencia (engranaje junto al tema): escala de 80 a 125 %, imágenes independientes para menú/contenido, intensidad y restablecimiento. Los fondos se optimizan en el navegador y no se envían al servidor. Se aceptan JPG, PNG y WebP; el almacenamiento es local a cada usuario/navegador.
- Indicadores específicos por vista: Disco muestra particiones, inodos y tasas de I/O cuando están presentes en el informe; Memoria muestra RAM y swap; CPU muestra carga de 1, 5 y 15 minutos; Red muestra contadores por interfaz. La carga no equivale a utilización de CPU. Los valores se leen al abrir la página y el detalle técnico permanece visible. Las cuotas de cuentas con límite incluyen barras de uso.
- El gestor de archivos se abre dentro del panel, conservando navegación, sesión y permisos nativos. Se carga únicamente al abrir Archivos y documentos.
- Archivos incluye ancho completo, cabecera única, carpetas de la ubicación actual, árbol nativo, búsqueda, subir nivel, vistas lista/cuadrícula y acciones nativas de edición, copia, movimiento, compresión y permisos. La mejora se descarga únicamente al abrir Archivos; su vista se recuerda por usuario y navegador.
- Panel incluye accesos frecuentes a Dominios y Bases de datos. Cada dominio tiene un acceso SSL / HTTPS que abre su edición nativa; cada cuenta entra con sus propias credenciales y mantiene el aislamiento de sus recursos.

## Reutilizar en otro servidor

El proyecto no incluye usuarios, cuentas reales, dominios, direcciones IP ni credenciales. La navegación usa rutas relativas y el contexto autenticado de Hestia; el perfil API usa el origen actual. El instalador conserva el administrador principal, hostname, IP, DNS y certificados existentes. `vipadmin` puede usarse como nombre de administrador al instalar Hestia, pero esta extensión no lo crea ni fija una contraseña. Los fondos personales se guardan en el navegador y no forman parte de la plantilla.

Para un servidor nuevo, instalar primero Hestia con sus propios parámetros y después esta extensión. Mantener las copias de despliegues y clientes fuera de este repositorio. No ejecutar scripts de limpieza de un servidor como parte de la instalación de la plantilla.

## Arquitectura y límites

En **Herramientas y Developers** hay accesos directos a PHP global, destinos, retención incremental, correo y claves API. Se abre la sección nativa correspondiente sin alterar sus formularios. Developers permite exportar un perfil sin secretos y guardar accesos externos por navegador. Proveedores, autorización inicial, alcance PHP y pendientes de IA se describen en [Integraciones](docs/integrations.md).

El panel carga un CSS y un JS propios por pantalla; el login usa un paquete separado. Los recursos se minifican con una versión fijada de esbuild y se validan con `npm run check`. No se cachean páginas autenticadas ni se agregan bibliotecas de interfaz en producción.

`src/php/virtualia-navigation.php` añade el contexto mínimo de sesión y métricas solo para administradores sin suplantación. No publica contraseñas ni añade una API. Las rutas de Hestia conservan su validación de permisos y CSRF. La mejora de presentación mantiene formularios y acciones de Hestia; no replica funciones exclusivas de WHM. Instalar este proyecto no crea clientes, cuentas SQL, correo, dominios, reglas de red ni registros DNS.

Para actualizaciones mayores de Hestia, comprobar compatibilidad del cargador y ejecutar la validación antes de reinstalar. La copia de recursos instalada se conserva fuera del árbol de Hestia y un hook oficial permite reponerla.

Los enlaces de recursos con parámetros incluyen el token de la sesión nativa. Se deben seguir desde la navegación del panel; no compartir ni reutilizar URLs con tokens de otra sesión. No se desactiva la comprobación de CSRF o del origen.

## Publicación y licencia

Repositorio preparado sin datos del despliegue. Publicarlo inicialmente como privado y revisar los cambios antes de hacerlo público. Código GPL-3.0-or-later; la marca y los logos Virtual IA identifican a su titular y no conceden derechos de marca. HestiaCP conserva sus avisos y licencia.
