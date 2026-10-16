#!/usr/bin/env bash
# Ejecuta flujos de Maestro con el residente de pruebas.
# Uso: scripts/e2e.sh e2e/flows/<flujo>.yaml [más flujos...]
# Credenciales en ~/.config/losresis/e2e.env (E2E_EMAIL, E2E_PASSWORD), fuera del repo.
# Las capturas (takeScreenshot) y los logs quedan en $E2E_OUTPUT_DIR, nunca en el repo.
# Ojo: el commands.json de Maestro incluye las variables en claro; resúmelo con
# scripts/e2e-summary.mjs, que las oculta.
set -euo pipefail

CREDENTIALS="${HOME}/.config/losresis/e2e.env"
if [[ ! -f "$CREDENTIALS" ]]; then
  echo "Falta $CREDENTIALS con E2E_EMAIL y E2E_PASSWORD" >&2
  exit 2
fi
# shellcheck disable=SC1090
source "$CREDENTIALS"

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
  --test-output-dir "$OUTPUT_DIR" \
  "${FLOWS[@]}"
echo "Capturas y logs en $OUTPUT_DIR"
