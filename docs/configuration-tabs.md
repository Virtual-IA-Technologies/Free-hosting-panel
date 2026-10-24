# Pestañas de configuración

Adaptación progresiva para HestiaCP 1.10.5. Se revisaron sus 77 plantillas de páginas oficiales buscando grupos `details` y el grupo nativo `showAdvanced`. La revisión de código no equivale a probar las 77 páginas en un servidor.

| Ruta | Grupos adaptados |
| --- | --- |
| `/edit/server/` | 11: básicas, actualizaciones, web/PHP, DNS, correo, bases de datos, respaldos, incrementales, SSL, seguridad y extensiones |
| `/edit/server/whitelabel/` | General y logotipo |
| `/add/package/`, `/edit/package/` | Web, DNS, correo, bases de datos, sistema y recursos; solo las secciones presentes según permisos y servicios |
| `/edit/web/` | Básicas y avanzadas; enlace `#vip-php` abre el backend del dominio |
| `/edit/user/` | Básicas y avanzadas; enlace `#vip-php` abre PHP CLI de la cuenta |
| `/add/db/`, `/add/dns/`, `/add/mail-account/` | Básicas y avanzadas |

Las otras 68 plantillas no contienen esos grupos. Los selectores de valores, menús de acciones, árboles de archivos y campos condicionales (por ejemplo habilitar SSL, redirección o autenticación) conservan su comportamiento nativo. Las rutas que no están en la lista no se transforman automáticamente. Si Hestia cambia la estructura, se conserva el control nativo en vez de adivinar la agrupación.

Los campos permanecen dentro del mismo formulario y ámbito Alpine. No se duplican, deshabilitan ni cambian nombres, valores, tokens o método de envío. También se conserva el orden de los valores de `FormData`. La sección activa mantiene sus subsecciones de seguridad abiertas. Los mensajes generales del servidor permanecen sobre las pestañas; los campos marcados con `aria-invalid` o `is-invalid` abren su sección. La validación HTML abre y enfoca el primer campo inválido, aunque se encuentre en otra pestaña.

En Servidor se conservan `#vip-php`, `#vip-mail`, `#vip-security`, `#vip-backups` y `#vip-retention`. Los identificadores nativos también permiten enlaces directos. Las flechas cambian de pestaña; Inicio/Fin seleccionan la primera/última; Tab entra al contenido. En móvil la fila se desplaza horizontalmente. Si el recurso JavaScript no se ejecuta, no se añade el CSS de ocultación a los grupos: permanece la estructura nativa.

Los formularios laterales usan el mismo inicializador después de cargar sus controles nativos. No se instala ningún endpoint para estas pestañas.

## Verificación

`npm run test:tabs` prueba campos, token, enlaces, primer inválido entre varias pestañas, teclado, móvil, inicialización lateral y alternativa sin JavaScript con una fixture local. `VIP_BROWSER_EXECUTABLE` permite indicar Chrome/Chromium.

Opcionalmente, `VIP_NATIVE_TEMPLATES` apunta a `web/templates/pages` de la distribución oficial 1.10.5. La prueba lee las nueve plantillas relevantes, elimina bloques PHP sin ejecutarlos y compara los campos antes y después de recorrer sus pestañas. Esto comprueba estructura y serialización, pero no reemplaza una prueba del guardado y de Alpine en Hestia real. Las pruebas autenticadas usan los assets locales mediante `VIP_PREVIEW_ASSET_ROOT` y deben ejecutarse secuencialmente por administrador.
