# Explorador administrativo opcional

El tema conserva el gestor nativo por cuenta. Para habilitar el recorrido real del servidor desde `/`, instala además este módulo como root, desde la carpeta clonada:

```sh
python3 scripts/install-root-files.py
```

Requiere el FileGator compatible instalado por Hestia y sus permisos sudo nativos. No instala paquetes, claves SSH de root, procesos residentes ni Node. Solo una sesión administrativa sin suplantación utiliza el adaptador raíz. Una cuenta normal o una sesión que administra una cuenta sigue usando su adaptador SFTP nativo en `/home/usuario`. El CLI verifica también el rol; el navegador no elige el actor.

En Archivos, la raíz contiene las carpetas reales del servidor. Entra en `home` y en la cuenta deseada para ver `web/dominio/public_html`, correo y archivos privados. Las rutas se muestran completas en el panel.

La columna de tamaño mantiene el tamaño real de cada archivo. En carpetas, **Calcular** obtiene el total del contenido con prioridad baja, sin seguir enlaces ni cruzar discos; el resultado se conserva cinco minutos. Solo permite un cálculo simultáneo y lo interrumpe a los 25 segundos. No recorre el disco automáticamente ni ejecuta tareas periódicas.

El administrador puede crear, editar, subir, descargar, copiar, mover, renombrar y cambiar permisos de archivos regulares. Las sustituciones y borrados de archivos de hasta 64 MiB guardan una copia privada en `/opt/virtual-ia-panel/root-files-state`, junto con auditoría de cambios. Conservan propietario y permisos al editar. Esas copias no sustituyen los respaldos del servidor y necesitan la política de retención del administrador.

El adaptador rechaza reemplazar o borrar directorios principales del sistema, archivos virtuales de `/proc`, `/sys`, `/dev` y `/run`, y sobrescrituras sin copia de archivos mayores de 64 MiB. El borrado de carpetas exige que estén vacías. Compresión, extracción y descarga múltiple quedan deshabilitadas en la sesión raíz porque el archivador nativo de Hestia está limitado a cada cuenta; siguen disponibles en el gestor normal.

Para desinstalar y restaurar exactamente los archivos nativos guardados:

```sh
python3 scripts/install-root-files.py --uninstall
```

Después de actualizar Hestia/FileGator, revisa compatibilidad y reinstala el módulo por separado. El instalador del tema no lo activa automáticamente. La restauración usa el manifiesto privado del módulo; no borra archivos de cuentas ni sus respaldos.
