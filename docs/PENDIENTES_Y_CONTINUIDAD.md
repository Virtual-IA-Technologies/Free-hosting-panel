# Estado y continuidad — VIP

## Entrega 1.3.0 — 24/10/2026

- **Implementado:** acceso «Estado de los servicios» debajo de Inicio; botón Reiniciar visible sin hover, con ruta, permisos, token y confirmación nativos de Hestia. No se añade un backend para reiniciar servicios.
- **Ligereza:** interfaz con recursos estáticos compilados; sin Node, terminal ni procesos adicionales para la presentación. El servidor revisado tiene `WEB_TERMINAL=false`, sin paquetes Node/terminal ni repositorio NodeSource. El gestor opcional existente usa aproximadamente 13 MiB de RAM; no es necesario para reiniciar servicios y no se instala junto al tema.
- **Otras mejoras retomadas:** pestañas de configuración, carga diferida del gestor opcional y corrección del controlador estático de Roundcube. Los módulos opcionales conservan instalación independiente.
- **Validado:** artefactos reproducibles; dos pruebas del instalador; 18 pruebas del broker; controles del endpoint con fixtures; interfaz simulada del gestor; pestañas, teclado y móvil. En el servidor real: sesión administrativa nativa, once pestañas de servidor, campos y tokens conservados, validación, grupos Alpine, inventario, rechazo anónimo/CSRF/suplantación de actor. Sin instalar paquetes ni actualizar índices.
- **Desplegado:** recursos de presentación 1.3.0, con respaldo reversible y opciones existentes conservadas. Sintaxis PHP correcta, fuentes y recursos instalados coincidentes; cuatro accesos HTTPS válidos y rutas privadas bloqueadas. Sin servicios fallidos ni incidencias en `dpkg --audit`.
- **Publicación:** esta entrega se identifica mediante el tag `v1.3.0`; consultar GitHub para el resultado del flujo de CI y los archivos de distribución.

## Límites y pendientes reales

- No se ejecutan reinicios de servicios solo para probar la interfaz. El administrador confirma cada reinicio cuando lo necesita.
- La prueba real de cuenta normal y suplantación de sesión del gestor opcional sigue pendiente; los controles de rol se comprobaron con fixtures. No se crearon cuentas temporales. No confundir suplantación de sesión con el rechazo del campo `actor` falsificado, que sí se probó en vivo.
- No se instalaron nuevas ramas PHP ni actualizaciones de aplicaciones. Una operación idempotente anterior de GD ya habilitado comprobó respaldo, validación y recuperación FPM sin instalar paquetes.
- La entrega de correo, autenticación de buzones/SQL reales, restauración de respaldos y conectores externos requieren comprobación propia de cada despliegue. La guía contextual de correo no configura DNS ni garantiza entrega.
- No se iniciaron migraciones de clientes ni cambios de DNS. Las migraciones requieren instrucciones y compatibilidad de cada proyecto, respaldos y restauración probada antes de transferir datos.

## Retomar

Leer `AGENTS.md` y `LECTURA_OBLIGATORIA.md`, consultar este estado y revisar únicamente diferencias nuevas. Mantener credenciales, respaldos, detalles SSH e inventarios privados fuera del repositorio. Para clonar, instalar, actualizar o revertir, seguir [installation.md](installation.md).
