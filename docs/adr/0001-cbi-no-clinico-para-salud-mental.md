# Usar el CBI (no el MBI) y un framing no clínico para la sección de Salud mental

Para medir el bienestar del residente elegimos el **Copenhagen Burnout Inventory (CBI)**
en lugar del Maslach Burnout Inventory (MBI), aunque el MBI es el instrumento dominante en
la literatura española (≈76% de los estudios). El MBI requiere licencia comercial de pago
(Mind Garden: mínimo $2.75/uso, prohíbe la distribución en apps abiertas), lo que es
incompatible con un despliegue gratuito a escala. El CBI es de dominio público, está
validado en español y mide tres dimensiones equivalentes.

Además, presentamos los resultados deliberadamente **sin niveles ni umbrales**
(bajo/moderado/alto, "zona de alerta"): no existen cortes validados del CBI para residentes
MIR españoles, y etiquetar una puntuación como "alta" constituiría una afirmación clínica
que la app no está habilitada para hacer. Mostramos la puntuación y su **evolución temporal**
como autoconocimiento, y los recursos de ayuda están siempre accesibles, nunca disparados
por una cifra.

## Consecuencias

- El texto exacto de los 19 ítems debe ser la **versión española validada** del CBI, no una
  traducción propia; usar una traducción ad-hoc anularía la validez que justifica la elección.
- No habrá función `getScoreLevel` ni lógica condicionada a umbrales en el cliente.
- Si en el futuro se necesita cribado clínico real (depresión, ansiedad), se añadirían
  instrumentos validados específicos (PHQ-9, GAD-7) como escalado opcional, no reinterpretando
  el CBI.

## Estado

accepted — 2026-06-06
