# Versiones de la app

Un fichero por versión (`<version>.md`) con todo lo que lleva: tareas de ClickUp, otros cambios y
el checklist de publicación. Lo mantiene la skill `/clickup-task`.

## Ciclo de vida

1. **Abrir versión.** Producto marca cada tarea de ClickUp con un tag de versión (`1.0.93`). La
   primera tarea con un tag que aún no tiene fichero pone esa versión en `expo.version`, suma 1 a
   `ios.buildNumber` y `android.versionCode` en `app.json` y crea `<version>.md` con
   `Estado: en desarrollo`. Solo se sube la versión **una vez por versión**, no por tarea.
2. **Sumar tareas.** Cada tarea de ClickUp añade su entrada en «Tareas» y, idealmente, va en su
   propio commit en `main` con el número de la tarea en el mensaje (`#113 Nóminas: …`). Así una
   tarea se puede revertir sin arrastrar las demás.
3. **Cerrar versión.** Se recorre el «Checklist de publicación» del fichero: tests, regresión con
   todos los flujos de Maestro de la versión, `/bug-review`, migraciones, móvil físico, build y
   envío a tiendas.
4. **Publicada.** `Estado: publicada`, `Publicada: <fecha>` y tag `v<version>` en el commit que se
   compiló. La siguiente tarea abre la versión siguiente.

## Reglas

- La versión de una tarea la da su tag de ClickUp. Puede haber varias versiones `en desarrollo`
  a la vez (p. ej. una en QA y la siguiente abierta); `app.json` lleva siempre la más alta.
- Un build enviado a TestFlight o a una vía de pruebas de Play **ya gasta** su versión y su build:
  aunque no llegue a tiendas, lo siguiente va en una versión nueva. Al hacer `eas submit`, apunta
  en el fichero `Enviada a TestFlight: <fecha> (build N, commit X)`.
- Las migraciones de una versión tienen que funcionar con la versión anterior ya publicada
  (se aplican antes de que salga la app nueva).
- Si algo se publica por EAS Update en vez de por build, se apunta igualmente en la versión cuyo
  runtime lo recibe.
