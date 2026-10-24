# Lectura obligatoria: trabajo ágil y eficiente

Estas instrucciones se aplican a toda tarea en este proyecto, incluidos cambios remotos. Leer este archivo y `AGENTS.md` al iniciar; reutilizar su contenido durante la conversación. En el workspace original también aplica `D:/WWW/EFICIENCIA_OBLIGATORIA.md`. Las instrucciones explícitas del usuario tienen prioridad.

## Forma de trabajo

1. Localizar el punto del cambio con búsquedas concretas (`rg`); leer solo los archivos necesarios.
2. Reutilizar contexto, decisiones aprobadas y comprobaciones vigentes. No reinvestigar ni releer por rutina.
3. Ejecutar el cambio mínimo que resuelva la solicitud completa. No introducir refactorizaciones ni dependencias ajenas al objetivo.
4. Validar primero con la comprobación más específica y barata que detecte un fallo real.
5. Ampliar pruebas solo por riesgos concretos, errores o cambios nuevos. No repetir suites, builds ni verificaciones equivalentes sin motivo.
6. Registrar el resultado y pendientes con claridad; distinguir implementado, validado, desplegado y publicado.

## Autonomía y comunicación

- Proceder directamente con las tareas autorizadas y decisiones técnicas rutinarias; no pedir nuevamente permisos ya concedidos.
- Preguntar únicamente si falta información imprescindible, hay alternativas de consecuencias importantes o riesgo de pérdida irreversible sin recuperación suficiente.
- Respuestas breves, en español: resultado, validación relevante y limitación real. Evitar introducciones largas, repetir la solicitud o narrar cada comando.
- Durante trabajos largos, comunicar avances útiles; no sustituir la ejecución con planes extensos.
- Reservar informes extensos para cuando el usuario los solicite o sean necesarios para continuidad.

## Inspección y pruebas proporcionales

- Agrupar lecturas y comprobaciones independientes cuando reduzca tiempo; ejecutar secuencialmente operaciones dependientes y cambios sobre el mismo estado.
- Documentación: revisar rutas, enlaces, exactitud y diferencias; no requiere build ni pruebas de navegador.
- CSS o JavaScript: comprobar sintaxis y el comportamiento afectado; probar móvil/teclado cuando cambie la interacción.
- Formularios y permisos: comprobar autenticación, roles, tokens y conservación de campos según el cambio.
- Operaciones privilegiadas: comprobar listas permitidas, rechazo de entradas inválidas, vista previa, auditoría y recuperación antes de ejecutarlas.
- Despliegue: verificar versión y servicios afectados. No repetir toda la batería si no cambió nada relacionado.
- Si una prueba falla, identificar y corregir la causa antes de repetirla. Evitar ciclos de prueba sin cambios.
- Las comprobaciones visuales subjetivas pueden dejarse al usuario con una indicación breve; verificar directamente los errores técnicos que sea razonable automatizar.

## Seguridad y límites

- Ahorrar tokens nunca justifica omitir protección de producción, integridad de datos ni comprobaciones indispensables.
- No incluir credenciales, llaves, sesiones, respaldos, inventarios privados ni datos de clientes en código, documentación pública o salidas.
- Mantener autenticación, permisos y CSRF nativos. Respetar el alcance de la excepción administrativa descrita en `AGENTS.md`.
- Separar extensión visual, gestor administrativo opcional, despliegue y migración de datos.
- No cambiar DNS, motores de base de datos, versiones mayores ni borrar recursos como efecto lateral de una mejora visual.
- No afirmar que un pendiente está terminado por existir un archivo parcial. Registrar la evidencia y el siguiente paso concreto.

Flujo esperado: localizar → modificar → validar lo necesario → entregar.
