# Virtual IA Panel

Panel de administración con identidad Virtual IA, construido como una extensión ligera de HestiaCP 1.10.5. Incluye navegación lateral, búsqueda, inicio con recursos reales, temas y accesos de administración por cuenta. La interfaz usa HTML, CSS y JavaScript progresivo: no requiere un servidor Node ni sustituye la autenticación nativa.

## Instalación

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

## Arquitectura y límites

`src/php/virtualia-navigation.php` añade el contexto mínimo de sesión y métricas solo para administradores sin suplantación. No publica contraseñas ni añade una API. Las rutas de Hestia conservan su validación de permisos y CSRF. La mejora de presentación mantiene formularios y acciones de Hestia; no replica funciones exclusivas de WHM. Instalar este proyecto no crea clientes, cuentas SQL, correo, dominios, reglas de red ni registros DNS.

Para actualizaciones mayores de Hestia, comprobar compatibilidad del cargador y ejecutar la validación antes de reinstalar. La copia de recursos instalada se conserva fuera del árbol de Hestia y un hook oficial permite reponerla.

## Publicación y licencia

Repositorio preparado sin datos del despliegue. Publicarlo inicialmente como privado y revisar los cambios antes de hacerlo público. Código GPL-3.0-or-later; la marca y los logos Virtual IA identifican a su titular y no conceden derechos de marca. HestiaCP conserva sus avisos y licencia.
