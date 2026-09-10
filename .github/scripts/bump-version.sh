#!/usr/bin/env bash
# bump-version.sh — calcula la siguiente versión semver a partir de una versión
# actual y un tipo de bump. Única implementación del bump: la comparten
# release.yml, release-preview.yml y db-release.yml.
#
# Uso:
#   bump-version.sh <version-actual X.Y.Z> <patch|minor|major>
#
# Salida: la nueva versión "X.Y.Z" por stdout (una línea). Los errores van por
# stderr y devuelven código != 0 — nada se enmascara.

set -euo pipefail

usage() {
  echo "Uso: $0 <X.Y.Z> <patch|minor|major>" >&2
  exit 2
}

[[ $# -eq 2 ]] || usage

CURRENT="$1"
BUMP="$2"

if [[ ! "$CURRENT" =~ ^[0-9]+\.[0-9]+\.[0-9]+$ ]]; then
  echo "bump-version: versión actual inválida: '$CURRENT' (se esperaba X.Y.Z)" >&2
  exit 2
fi

IFS='.' read -r major minor patch <<<"$CURRENT"

case "$BUMP" in
  major) major=$((major + 1)); minor=0; patch=0 ;;
  minor) minor=$((minor + 1)); patch=0 ;;
  patch) patch=$((patch + 1)) ;;
  *)
    echo "bump-version: tipo de bump inválido: '$BUMP' (patch|minor|major)" >&2
    exit 2
    ;;
esac

printf '%s.%s.%s\n' "$major" "$minor" "$patch"
