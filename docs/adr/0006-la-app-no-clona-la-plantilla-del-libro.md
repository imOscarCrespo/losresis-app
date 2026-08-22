# La app no clona la plantilla del Libro

## Status

accepted

## Contexto y decisión

Sembrar el **Libro del Residente** desde la **Plantilla del Libro** estaba
implementado **tres veces**, y las tres divergían:

| | sella `libro_book.template_id` | sella `libro_node.template_node_id` | clona las columnas nuevas |
|---|---|---|---|
| `apply_libro_template_for_user` (trigger de alta) | no | no | sí |
| `switchLibroYearToTemplate` (esta app, en el cliente) | sí | **no** | **no** |
| `sync_libro_template_for_user` | solo mira libros con `template_id` | empareja **por** `template_node_id` | sí |

Eso producía dos fallos concretos. Uno: un residente que migraba desde la app
recibía sus rotaciones **sin duración ni centro** y sus competencias **sin
descripción**, porque el clon del cliente no conocía esas columnas. Dos: llamar a
`sync` sobre un libro migrado desde la app **duplicaba todos sus nodos**, porque
el `UPDATE ... WHERE template_node_id = ...` no encontraba nada y caía al
`INSERT`, y el `DELETE` de bajas exige `template_node_id IS NOT NULL`.

Se decide que **la app no clona**: toda la lógica plantilla→libro vive en
`losresis-db` y la app solo llama. `apply_libro_template_for_user` sella
`template_id` y `template_node_id`, una RPC hace el borrado+siembra de **Migrar a
la plantilla**, un backfill sella lo ya sembrado, y la app llama a
`sync_libro_template_for_user` al abrir el Libro y al tirar para refrescar.

## Considered Options

- **Arreglar el clon del cliente** (añadirle las columnas que faltaban y el
  sellado). Era lo más rápido y no tocaba otro repo, pero deja tres copias de la
  misma lógica en dos repos: el siguiente campo de plantilla se olvidaría en el
  cliente exactamente igual que se olvidaron estos cinco.
- **No sincronizar nunca**: aceptar que un cambio en una plantilla publicada solo
  afecte a residentes futuros. Cero riesgo de duplicar nodos y cero backfill, pero
  el tutor añade una competencia y sus residentes actuales no la ven jamás.

## Consequences

- **El sync se llama al abrir el Libro, no en tiempo real.** La función es
  idempotente, así que no hay nada que coordinar; y nadie mira su libro mientras
  su tutor lo edita. Una suscripción realtime resembraría la estructura bajo los
  dedos de quien está registrando algo.
- **El backfill es barato hoy y no lo será mañana.** Hay 614 nodos sin sellar,
  pero los libros con `template_id` son de **un solo usuario de prueba**. Sellar
  emparejando por nombre y posición es seguro ahora; con hospitales reales dentro
  deja de serlo.
- Cualquier columna nueva de plantilla entra en `apply` **y** en `sync`, y ya no
  hay un tercer sitio donde olvidarla.
