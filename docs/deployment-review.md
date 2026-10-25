# Comprobación de un despliegue

La instalación de VIP y la validación de las aplicaciones alojadas son procesos separados. Un HTTP 200 no demuestra que una operación comercial funcione.

1. Comparar A, AAAA, MX y delegación pública con las IP asignadas en Hestia. Comprobar también alias y subdominios; no mover nameservers compartidos sin revisar todas sus zonas.
2. Validar Nginx, Apache, PHP-FPM, servicios fallidos, espacio y registros recientes. Probar TLS sin desactivar su verificación y conservar cookies al seguir redirecciones de acceso.
3. Probar con una sesión de revisión propia los listados, consultas y descargas. No reutilizar cookies de personas ni recorrer automáticamente enlaces que puedan guardar, anular o enviar datos.
4. Separar renderizar un documento existente, generar un archivo local y emitir un documento nuevo. Algunos generadores guardan un PDF y devuelven una respuesta vacía: comprobar el archivo, su cabecera y lectura con un analizador PDF.
5. Probar QR y firmas en aislamiento con datos y claves efímeros. Esta prueba no acredita la vigencia del certificado productivo ni la aceptación del receptor. Consultar WSDL o salud confirma conectividad, no una emisión aceptada.
6. Revisar descargas públicas de respaldos, logs y material criptográfico sin mostrar su contenido. Protegerlas mediante configuración propia persistente; no modificar las plantillas nativas generadas. Conservar los respaldos fuera de la raíz pública. Esta protección requiere configuración explícita y no se instala con el tema.
7. Registrar los recursos temporales antes de probar y retirarlos al terminar. No eliminar tablas, ficheros históricos o respaldos por parecer huérfanos: comprobar referencias, propietario y recuperación primero.
8. Antes de un corte, verificar sincronización final, cron único y recuperación. Las operaciones reales de correo, CPE o integraciones externas requieren su prueba operativa específica.

El informe de cada instalación debe quedar privado, con pruebas aprobadas, fallos y límites. No publicar dominios, inventarios, datos, cookies, claves ni respaldos en este repositorio.
