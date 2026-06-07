---
name: tdd
description: Desarrollo dirigido por tests (red-green-refactor) para LosResis, app Expo / React Native + Supabase. Úsalo cuando quieras construir features o arreglar bugs con tests primero, menciones "red-green-refactor", o quieras tests de comportamiento. Incluye cómo montar el runner (no hay ninguno aún) y cómo mockear Supabase.
---

# Test-Driven Development — LosResis (Expo / React Native + Supabase)

## Filosofía

**Principio central**: los tests verifican comportamiento a través de interfaces públicas, no
detalles de implementación. El código puede cambiar entero; los tests no deberían.

**Buenos tests** son estilo integración: ejercitan rutas reales de código a través de APIs
públicas. Describen _qué_ hace el sistema, no _cómo_. "el residente puede crear una guardia
con fecha y duración válidas" te dice exactamente qué capacidad existe. Sobreviven a los
refactors porque no les importa la estructura interna.

**Malos tests** están acoplados a la implementación: mockean colaboradores internos, prueban
funciones privadas, o verifican por fuera (consultando la tabla de Supabase directamente en
vez de usar la interfaz). Señal de alarma: el test rompe al refactorizar aunque el
comportamiento no cambió.

Ver [tests.md](tests.md) para ejemplos y [mocking.md](mocking.md) para guía de mocking.

## Anti-patrón: rebanadas horizontales

**NO escribas todos los tests primero y luego toda la implementación.** Eso produce tests de
mierda que prueban comportamiento _imaginado_ y son insensibles a cambios reales.

```
MAL (horizontal):
  RED:   test1, test2, test3, test4, test5
  GREEN: impl1, impl2, impl3, impl4, impl5

BIEN (vertical, tracer bullets):
  RED→GREEN: test1→impl1
  RED→GREEN: test2→impl2
  ...
```

Un test → una implementación → repite. Cada test responde a lo que aprendiste del ciclo
anterior.

---

## Setup del runner (este proyecto AÚN no tiene tests)

A día de hoy LosResis **no tiene runner de tests ni archivos de test** (no hay `jest` en
`package.json` ni script `test`). La primera vez que uses este skill, monta el stack estándar
de Expo. Pregunta antes al usuario; no lo instales por sorpresa.

```bash
# Stack recomendado para Expo + React Native:
npx expo install -- --save-dev jest jest-expo @testing-library/react-native @testing-library/jest-native
```

`package.json`:
```json
{
  "scripts": { "test": "jest", "test:watch": "jest --watch" },
  "jest": {
    "preset": "jest-expo",
    "setupFilesAfterEnv": ["@testing-library/jest-native/extend-expect"],
    "transformIgnorePatterns": [
      "node_modules/(?!((jest-)?react-native|@react-native(-community)?|expo(nent)?|@expo(nent)?/.*|@react-navigation/.*|@supabase/.*))"
    ]
  }
}
```

**Qué priorizar testeando en esta app** (de más fácil/valioso a más caro):
1. **`services/*.js` y `utils/*`** — lógica pura y acceso a Supabase. El mejor ROI: testea el
   comportamiento mockeando el cliente Supabase en la frontera (ver abajo).
2. **`hooks/*`** — con `renderHook` de `@testing-library/react-native`.
3. **Componentes/pantallas** — con `render` + `@testing-library/react-native`, interactuando
   como un usuario (`fireEvent.press`, `findByText`) y aseverando lo que se ve, no el estado
   interno.

No intentes testear todo. Confirma con el usuario qué comportamientos importan más (rutas
críticas: crear guardia, lote de guardias, conexión/solicitud, agenda) y enfócate ahí.

---

## Mockear Supabase en la frontera

Supabase es un **límite de sistema** → mockéalo (ver [mocking.md](mocking.md)). El cliente usa
una API encadenada (`supabase.from('t').select().eq().single()`), así que el mock debe
devolver objetos encadenables que terminen en `{ data, error }`.

Diseña los servicios para que sean testeables: que el cliente entre por parámetro o sea
fácilmente mockeable por módulo. Ejemplo de mock por módulo:

```js
// jest.mock del módulo que exporta el cliente supabase
jest.mock('../config/supabase', () => {
  const result = { data: null, error: null };
  const chain = {
    select: jest.fn(() => chain),
    insert: jest.fn(() => chain),
    update: jest.fn(() => chain),
    delete: jest.fn(() => chain),
    eq: jest.fn(() => chain),
    order: jest.fn(() => chain),
    single: jest.fn(() => Promise.resolve(result)),
    maybeSingle: jest.fn(() => Promise.resolve(result)),
    then: (cb) => Promise.resolve(result).then(cb), // para await sin .single()
  };
  return { supabase: { from: jest.fn(() => chain), auth: {}, storage: {} }, __result: result };
});
```

En cada test fija qué devuelve la frontera (`__result.data = [...]` / `__result.error = {...}`)
y asevera **el comportamiento observable del servicio** (qué devuelve, qué error propaga),
no qué métodos del cliente se llamaron. Testea explícitamente los casos que el bug-review
vigila: `error` no nulo, `data` vacío/`null`, `.single()` con 0 o >1 filas.

> No mockees tus propios módulos internos ni helpers que controlas — solo la frontera
> (Supabase, red, tiempo, almacenamiento). Para tiempo/fechas (Agenda/Guardias dependen de
> fechas), usa `jest.useFakeTimers()` / inyecta la fecha.

---

## Flujo

### 1. Planificación

Al explorar el código, usa el glosario de dominio (`CONTEXT.md`) para que los nombres de los
tests y el vocabulario de las interfaces coincidan con el lenguaje del proyecto, y respeta los
ADRs (`docs/adr/`) del área que tocas.

Antes de escribir código:
- [ ] Confirma con el usuario qué cambios de interfaz hacen falta
- [ ] Confirma qué comportamientos testear (prioriza rutas críticas)
- [ ] Identifica oportunidades de [módulos profundos](deep-modules.md) (interfaz pequeña,
      implementación profunda)
- [ ] Diseña interfaces para la [testabilidad](interface-design.md)
- [ ] Lista los comportamientos a testear (no los pasos de implementación)
- [ ] Consigue aprobación del plan

Pregunta: "¿Cómo debería ser la interfaz pública? ¿Qué comportamientos importan más?"

### 2. Tracer bullet

Escribe UN test que confirme UNA cosa del sistema:

```
RED:   test del primer comportamiento → falla
GREEN: código mínimo para pasar → pasa
```

Esto prueba que el camino funciona de punta a punta.

### 3. Bucle incremental

Para cada comportamiento restante:

```
RED:   siguiente test → falla
GREEN: código mínimo para pasar → pasa
```

Reglas:
- Un test cada vez
- Solo el código suficiente para pasar el test actual
- No anticipes tests futuros
- Mantén los tests enfocados en comportamiento observable

### 4. Refactor

Cuando todos los tests pasen, busca candidatos a [refactor](refactoring.md):
- [ ] Extrae duplicación
- [ ] Profundiza módulos (mete complejidad detrás de interfaces simples)
- [ ] Aplica SOLID donde sea natural
- [ ] Considera qué revela el código nuevo sobre el existente
- [ ] Corre los tests tras cada paso de refactor

**Nunca refactorices en RED.** Llega a GREEN primero.

## Checklist por ciclo

```
[ ] El test describe comportamiento, no implementación
[ ] El test usa solo la interfaz pública
[ ] El test sobreviviría a un refactor interno
[ ] El código es mínimo para este test
[ ] No se añadieron features especulativas
```
