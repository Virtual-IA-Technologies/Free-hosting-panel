# Validación de interfaz

`ui.cjs` realiza una prueba de integración sobre un servidor de revisión. Necesita Node, `playwright-core` y Chrome; admite `VIP_BROWSER_EXECUTABLE` para otra instalación Chromium. Definir mediante un mecanismo seguro `VIP_BASE_URL` (sin barra final), `VIP_USERNAME` y `VIP_PASSWORD`; ejecutar `node tests/ui.cjs`.

La prueba no cambia datos de clientes ni reglas de red. Comprueba login, contraste claro, enlaces protegidos, gráficos específicos, detalle visible, personalización, fondos, persistencia, restablecimiento, cuotas, separación, móvil y gestor de archivos integrado. Las preferencias que modifica pertenecen al contexto de navegador temporal de la prueba. No guarda sesiones ni contraseñas en el repositorio.
