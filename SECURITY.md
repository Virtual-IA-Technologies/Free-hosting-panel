# Seguridad

La versión mantenida de esta extensión es 1.2.x, probada con HestiaCP 1.10.5. Mantén también actualizado el sistema operativo y sus servicios; VIP no sustituye su mantenimiento.

- No publiques contraseñas, claves SSH/API, tokens de sesión, archivos `.env`, respaldos ni datos de clientes.
- Usa credenciales y llaves diferentes por servidor. Conserva las claves privadas en un gestor seguro; solo las claves públicas deben registrarse en el servicio correspondiente.
- Las rutas y formularios conservan la autenticación, permisos, tokens y confirmaciones de Hestia. VIP no añade una API privilegiada.
- Las preferencias del navegador contienen apariencia y accesos externos, nunca claves API. No pegues enlaces con tokens en los accesos externos.
- Usa API con permisos mínimos y restricciones de origen. No expongas ejecución de shell ni concedas acceso administrativo directo a un asistente de IA.
- Prueba instalación, actualización, reversión y permisos de una cuenta normal antes de usar una nueva versión con datos reales.

Para informar una vulnerabilidad, utiliza **Security → Report a vulnerability** en GitHub si está disponible. No abras una incidencia pública con detalles explotables, credenciales o datos personales. Si el canal privado no está habilitado, pide un canal privado a los responsables mediante una incidencia sin detalles técnicos sensibles.

No hay una auditoría de seguridad independiente ni un compromiso de tiempo de respuesta. Consulta [la validación y sus límites](docs/validation.md).
