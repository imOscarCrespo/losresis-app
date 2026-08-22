#!/usr/bin/env bash
# Regenera el paquete de Conocimiento del GPT de producto a partir de los repos.
# Uso: bash docs/gpt-po/refresh.sh   (desde losresis-app)
set -e
SH="$HOME/code/losresis-shared"
OUT="$SH/losresis-app/docs/gpt-po"
APP="$SH/losresis-app"; PAN="$SH/losresis-panel"
{ echo "# Glosario de dominio — LosResis APP (React Native / Expo)"; echo; echo "> Fuente: losresis-app/CONTEXT.md. Usa SIEMPRE estos términos exactos al redactar tareas."; echo; sed '1d' "$APP/CONTEXT.md"; } > "$OUT/01-glosario-app.md"
{ echo "# Glosario de dominio — LosResis PANEL (Next.js) y modelo compartido"; echo; cat "$PAN/CONTEXT.md"; echo; echo "---"; echo; echo "# Modelo de datos compartido"; echo; cat "$PAN/docs/SHARED_CONTEXT.md"; } > "$OUT/02-glosario-panel.md"
{ echo "# Reglas técnicas obligatorias de los repos LosResis"; echo; echo "## === Reglas de losresis-app ==="; echo; sed '1d' "$APP/AGENTS.md"; echo; echo "## === Reglas de losresis-panel ==="; echo; sed '1d' "$PAN/AGENTS.md"; } > "$OUT/03-reglas-tecnicas.md"
{ echo "# Decisiones de producto ya tomadas (ADRs)"; echo;
  echo "## ADRs de losresis-app"; echo; for f in "$APP"/docs/adr/*.md; do echo "### $(basename "$f")"; echo; cat "$f"; echo; done
  echo "## ADRs de losresis-panel"; echo; for f in "$PAN"/docs/adr/*.md; do echo "### $(basename "$f")"; echo; cat "$f"; echo; done
} > "$OUT/04-decisiones-adr.md"
echo "Regenerado 01–04. 05-mapa-repos.md y 06-guion-preguntas.md se mantienen a mano."
