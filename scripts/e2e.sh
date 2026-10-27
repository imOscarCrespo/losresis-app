#!/usr/bin/env bash
# Ejecuta flujos de Maestro con el residente de pruebas.
# Uso: scripts/e2e.sh e2e/flows/<flujo>.yaml [más flujos...]
# Credenciales en ~/.config/losresis/e2e.env (E2E_EMAIL, E2E_PASSWORD), fuera del repo.
# Para flujos de estudiante: E2E_CREDENTIALS=~/.config/losresis/e2e-student.env scripts/e2e.sh ...
# Residente creado por el hospital (#100): E2E_CREDENTIALS=~/.config/losresis/e2e-hospital.env
# Las capturas (takeScreenshot) y los logs quedan en $E2E_OUTPUT_DIR, nunca en el repo.
# Ojo: el commands.json de Maestro incluye las variables en claro; resúmelo con
# scripts/e2e-summary.mjs, que las oculta.
set -euo pipefail

CREDENTIALS="${E2E_CREDENTIALS:-${HOME}/.config/losresis/e2e.env}"
if [[ ! -f "$CREDENTIALS" ]]; then
  echo "Falta $CREDENTIALS con E2E_EMAIL y E2E_PASSWORD" >&2
  exit 2
fi
# shellcheck disable=SC1090
source "$CREDENTIALS"

# URL y anon key públicas del proyecto, para los scripts de preparación de e2e/scripts/.
APP_ENV="$(cd "$(dirname "$0")/.." && pwd)/.env"
SUPABASE_URL="$(grep -m1 '^EXPO_PUBLIC_SUPABASE_URL=' "$APP_ENV" | cut -d= -f2- | tr -d '"')"
SUPABASE_ANON_KEY="$(grep -m1 '^EXPO_PUBLIC_SUPABASE_ANON_KEY=' "$APP_ENV" | cut -d= -f2- | tr -d '"')"

# Cuenta owner del panel del Hospital E2E, para los flujos que preparan datos como
# Docencia (p. ej. generar una evaluación). Opcional: sin el fichero van vacías.
PANEL_CREDENTIALS="${E2E_PANEL_CREDENTIALS:-${HOME}/.config/losresis/e2e-panel.env}"
PANEL_OWNER_EMAIL=""
PANEL_OWNER_PASSWORD=""
# Tutor (speciality_manager de MFyC) del mismo hospital, para los flujos que
# revisan como tutor (p. ej. la revisión de casos clínicos).
PANEL_TUTOR_EMAIL=""
PANEL_TUTOR_PASSWORD=""
if [[ -f "$PANEL_CREDENTIALS" ]]; then
  PANEL_OWNER_EMAIL="$(grep -m1 '^PANEL_OWNER_EMAIL=' "$PANEL_CREDENTIALS" | cut -d= -f2-)"
  PANEL_OWNER_PASSWORD="$(grep -m1 '^PANEL_OWNER_PASSWORD=' "$PANEL_CREDENTIALS" | cut -d= -f2-)"
  PANEL_TUTOR_EMAIL="$(grep -m1 '^PANEL_TUTOR_EMAIL=' "$PANEL_CREDENTIALS" | cut -d= -f2- || true)"
  PANEL_TUTOR_PASSWORD="$(grep -m1 '^PANEL_TUTOR_PASSWORD=' "$PANEL_CREDENTIALS" | cut -d= -f2- || true)"
fi

MAESTRO="${MAESTRO:-$HOME/.maestro/bin/maestro}"
OUTPUT_DIR="${E2E_OUTPUT_DIR:-${TMPDIR:-/tmp}/losresis-e2e}"
mkdir -p "$OUTPUT_DIR"

FLOWS=()
for flow in "$@"; do
  FLOWS+=("$(cd "$(dirname "$flow")" && pwd)/$(basename "$flow")")
done

cd "$OUTPUT_DIR"
"$MAESTRO" test \
  -e E2E_EMAIL="$E2E_EMAIL" \
  -e E2E_PASSWORD="$E2E_PASSWORD" \
  -e E2E_NEW_PASSWORD="${E2E_NEW_PASSWORD:-}" \
  -e SUPABASE_URL="$SUPABASE_URL" \
  -e SUPABASE_ANON_KEY="$SUPABASE_ANON_KEY" \
  -e PANEL_OWNER_EMAIL="$PANEL_OWNER_EMAIL" \
  -e PANEL_OWNER_PASSWORD="$PANEL_OWNER_PASSWORD" \
  -e PANEL_TUTOR_EMAIL="$PANEL_TUTOR_EMAIL" \
  -e PANEL_TUTOR_PASSWORD="$PANEL_TUTOR_PASSWORD" \
  --test-output-dir "$OUTPUT_DIR" \
  "${FLOWS[@]}"
echo "Capturas y logs en $OUTPUT_DIR"
