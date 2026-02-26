These rules override default behavior.
They must always be followed unless explicitly instructed otherwise.

# 📱 React Native — Reglas de Desarrollo Obligatorias

## 🎯 Objetivo

Escribir código claro, reutilizable, eficiente y coherente con la arquitectura actual del proyecto.

---

## 🔎 Proceso obligatorio antes de implementar

1. Analizar los archivos y flujo relacionados con la tarea.
2. Identificar componentes, hooks, servicios o utilidades reutilizables.
3. Verificar si ya existe lógica similar antes de crear código nuevo.
4. Si hay dudas o ambigüedad, preguntar antes de asumir.
5. En cambios relevantes, explicar brevemente el plan antes de implementar.

---

## ♻️ Reutilización y arquitectura

- Reutilizar el máximo código posible.
- No duplicar lógica.
- Mantener separación de responsabilidades (UI / lógica / servicios).
- Respetar la estructura y patrones actuales del proyecto.
- No introducir nuevas dependencias sin justificación clara.
- Priorizar refactorización antes que creación innecesaria.

---

## 🚫 Restricciones estrictas

- No inventar APIs, endpoints, funciones o estructuras inexistentes.
- No asumir comportamientos no confirmados.
- No modificar código no relacionado con la tarea.
- No romper contratos de tipos, props o navegación.
- No sobre-ingenierizar soluciones simples.

---

## ⚡ Performance y buenas prácticas (React Native)

- Evitar renders innecesarios.
- Usar `React.memo`, `useCallback` y `useMemo` solo cuando aporte valor real.
- Evitar funciones inline en JSX si afectan rendimiento.
- Mantener el estado lo más local posible.
- Configurar correctamente `FlatList` y listas grandes.
- Evitar lógica pesada dentro del render.
- Cuidar dependencias en `useEffect`.

---

## 🧠 Estándares de código

- Código simple, legible y consistente.
- Nombres descriptivos y coherentes.
- Mantener consistencia con el estilo existente.
- Explicar brevemente decisiones técnicas no evidentes.
- Priorizar mantenibilidad a largo plazo.

---

## 🛑 Principio clave

Si la mejor solución es reutilizar o refactorizar en lugar de crear código nuevo, hacerlo.
Si se detecta un problema estructural relevante, señalarlo antes de implementar.
