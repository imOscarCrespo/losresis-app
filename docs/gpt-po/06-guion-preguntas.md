# Guion de preguntas y plantilla de tarea

## Definición de "lista" (la tarea no se entrega hasta que estos 8 puntos están resueltos)

1. **Repo/superficie**: en qué repo pasa y en qué pantalla del móvil o ruta del panel.
2. **Quién**: qué rol lo hace o lo sufre (Residente, Residente con acceso social, Estudiante,
   Owner, Responsable de especialidad, Médico del equipo, Miembro del servicio).
3. **Qué pasa hoy** y **qué debería pasar** (bug) o **qué se quiere poder hacer** (feature).
4. **Punto de entrada**: desde dónde llega el usuario a eso (botón, tab, menú, push, enlace).
5. **Reglas de visibilidad**: quién SÍ lo ve y quién NO debe verlo nunca.
6. **Datos**: qué se guarda, qué se muestra, si hace falta un campo o tabla nuevos
   (→ migración en `losresis-db`) y si toca un catálogo estático.
7. **Casos límite**: vacío, sin conexión, sin permiso, sin plantilla publicada, valores 0,
   año de residencia distinto, especialidad sin datos.
8. **Criterios de aceptación**: frases verificables en formato "dado / cuando / entonces".

## Preguntas para un BUG

- ¿En la app o en el panel? ¿En qué pantalla o sección exactamente?
- ¿Con qué rol y, si aplica, qué especialidad y año de residencia?
- ¿Qué pasos hay que dar para verlo? (paso 1, paso 2, paso 3)
- ¿Qué esperabas ver y qué viste?
- ¿Pasa siempre o solo a veces? ¿A todos los usuarios o solo a uno?
- ¿Desde cuándo? ¿Coincide con algún cambio o con un build nuevo?
- ¿En iPhone, Android o navegador? ¿Qué versión de la app / build de TestFlight?
- ¿Hay mensaje de error, pantalla en blanco o simplemente falta un dato?
- ¿Tienes captura o vídeo?
- ¿Bloquea al usuario (no puede seguir), le ensucia el dato, o es solo estético?
- Si hay un caso concreto: dime el caso **sin nombre de paciente y sin NHC**.

## Preguntas para una FUNCIÓN NUEVA o un CAMBIO

- ¿Para quién es y qué problema real le resuelve?
- ¿Desde dónde entra? ¿Sustituye algo que ya existe o convive con ello?
- ¿Cuál es el camino feliz, paso a paso, desde que entra hasta que termina?
- ¿Quién NO debe poder verlo ni hacerlo?
- ¿Qué se guarda y quién puede editarlo o borrarlo después?
- ¿Hay que avisar a alguien (notificación push, aviso en el panel, email)?
- ¿Qué se ve la primera vez, cuando todavía no hay nada?
- ¿Qué pasa si el hospital no ha publicado plantilla / no hay tutor / no hay datos?
- ¿Es irreversible algo de lo que se hace? ¿Hay que confirmar antes?
- ¿Qué queda explícitamente fuera de esta tarea (v2)?
- ¿Cómo sabremos que funciona? ¿Qué mirarías para darla por buena?
- ¿Corre prisa? ¿Depende de un hospital concreto o de una fecha?

## Preguntas para un TEXTO o un AVISO

- Texto actual exacto y texto nuevo exacto.
- ¿Dónde aparece: pantalla, notificación push, email, panel?
- ¿Cambia solo el texto o también cuándo se dispara?

## Plantilla de salida

```markdown
# [BUG|FEATURE|CAMBIO] Título en una línea, en lenguaje de dominio

**Repos afectados:** losresis-app | losresis-panel | losresis-db
**Superficie:** pantalla de la app / ruta del panel
**Rol afectado:** ...
**Prioridad:** bloqueante | alta | normal | baja
**Requiere migración en losresis-db:** sí / no / a confirmar
**Requiere regenerar catálogo estático:** sí / no

## Contexto
Dos o tres frases: qué hace hoy el sistema y por qué esto importa al usuario.
Términos del glosario en negrita.

## Comportamiento actual
(bug: qué ocurre. feature: qué no se puede hacer hoy.)

## Comportamiento esperado
Descripción del resultado, no de la implementación.

## Pasos para reproducir  ← solo en bugs
1.
2.
3.

## Reglas y visibilidad
- Quién sí, quién no.
- Qué es de solo lectura.
- Qué es irreversible.

## Datos
- Entidades y tablas implicadas (si se conocen).
- Campos nuevos necesarios.

## Casos límite
- Vacío:
- Sin permiso:
- Sin conexión:
- Otros:

## Criterios de aceptación
- [ ] Dado ..., cuando ..., entonces ...
- [ ] ...

## Fuera de alcance
- ...

## Decisiones de producto ya tomadas que aplican
- ADR nnnn — ...

## Supuestos y preguntas abiertas para el desarrollo
- Supuesto: ... (confirmar si es falso)
- Pregunta: ...
```
