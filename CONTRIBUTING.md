# Contribuir

1. Abre una incidencia con el comportamiento esperado, versión de Hestia, navegador y pasos mínimos. Oculta nombres de clientes, IP privadas, tokens y credenciales de capturas y registros.
2. Trabaja en una rama. Cambia `src/`, regenera `dist/` y actualiza documentación y CHANGELOG.
3. Ejecuta `npm ci`, `npm run build`, `npm run check` y `npm run test:installer`. Para cambios de interfaz, usa un servidor de revisión y las pruebas de navegador correspondientes.
4. Incluye en la propuesta qué cambia, qué se comprobó y cualquier límite conocido.

Conserva rutas, permisos y tokens nativos. No añadas endpoints privilegiados, contraseñas predeterminadas, dominios de despliegue, migraciones de clientes ni scripts de limpieza automática. Los componentes deben funcionar en escritorio y móvil, con teclado y en todos los temas.

El código aportado se distribuye bajo GPL-3.0-or-later. Conserva los avisos de Hestia y terceros. La licencia del código no concede derechos sobre las marcas.
