#!/usr/bin/env bash
# changed-paths.sh — ¿el diff entre dos commits toca algún fichero cuya ruta
# matchea una regex ERE? Única implementación de la detección de rutas: la
# comparten release.yml, release-preview.yml y db-release.yml.
#
# Uso:
#   changed-paths.sh <base-sha> <head-sha> <regex-ERE>
#
# Códigos de salida:
#   0  -> al menos un fichero del diff matchea la regex
#   1  -> ningún fichero matchea
#   2  -> error (argumentos, falta `gh`, o la API de comparación falló)
#
# El diff se obtiene de `gh api repos/{repo}/compare/{base}...{head}` (funciona
# igual con merge commits y squash-merges). El repo sale de $GITHUB_REPOSITORY
# o, en su defecto, de `gh repo view`. Requiere `gh` autenticado (GH_TOKEN).
# Un fallo de la API se reporta por stderr y NO se enmascara como "sin cambios".

set -euo pipefail

usage() {
  echo "Uso: $0 <base-sha> <head-sha> <regex-ERE>" >&2
  exit 2
}

[[ $# -eq 3 ]] || usage

BASE="$1"
HEAD="$2"
REGEX="$3"

[[ -n "$BASE" && -n "$HEAD" && -n "$REGEX" ]] || usage

command -v gh >/dev/null || { echo "changed-paths: falta 'gh' en el PATH" >&2; exit 2; }

REPO="${GITHUB_REPOSITORY:-}"
if [[ -z "$REPO" ]]; then
  REPO="$(gh repo view --json nameWithOwner --jq .nameWithOwner)"
fi

if ! files=$(gh api "repos/${REPO}/compare/${BASE}...${HEAD}" --jq '.files[].filename'); then
  echo "changed-paths: 'gh api compare' falló para ${BASE}...${HEAD} en ${REPO}" >&2
  exit 2
fi

if printf '%s\n' "$files" | grep -qE "$REGEX"; then
  exit 0
fi
exit 1
