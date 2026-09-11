#!/usr/bin/env bash
# build-changelog.sh — genera un CHANGELOG agrupado por prefijo de rama para un
# rango de commits (normalmente entre dos tags publicados).
#
# Uso:
#   build-changelog.sh <from-ref> <to-ref> [--only-paths '<regex-extended>']
#
# <from-ref>/<to-ref>: cualquier ref de git válido (tag, SHA, rama). El rango
# se resuelve como `git log <from-ref>..<to-ref>`.
#
# Categorización: por cada commit del rango se resuelven las PRs asociadas vía
# `gh api repos/{owner}/{repo}/commits/{sha}/pulls` (funciona con merge commits
# y con squash-merges). La categoría sale del prefijo de `head.ref` (la rama de
# la PR) antes de la primera "/"; si el prefijo no es reconocido, se usa el
# prefijo estilo commit convencional del título de la PR (`feat:`, `fix:`…); si
# tampoco, cae en OTROS.
#
# --only-paths: si se pasa, solo se incluyen PRs cuyo diff toca al menos un
# fichero cuya ruta matchea la regex dada (ERE, la misma sintaxis de `grep -E`).
# Pensado para reutilizarse filtrando por 'prisma/' en el changelog de BD.
#
# Requiere: gh (autenticado) y jq. Sin dependencias nuevas — ambos ya vienen
# preinstalados en ubuntu-latest.
#
# Salida: Markdown por stdout, una sección "### CATEGORIA" por cada categoría
# con al menos una entrada, cada entrada como "* [#N](url) título".

set -euo pipefail

usage() {
  echo "Uso: $0 <from-ref> <to-ref> [--only-paths '<regex-extended>']" >&2
  exit 1
}

FROM_REF=""
TO_REF=""
ONLY_PATHS=""

while [[ $# -gt 0 ]]; do
  case "$1" in
    --only-paths)
      [[ $# -lt 2 || -z "$2" ]] && usage
      ONLY_PATHS="$2"
      shift 2
      ;;
    -h | --help)
      usage
      ;;
    *)
      if [[ -z "$FROM_REF" ]]; then
        FROM_REF="$1"
      elif [[ -z "$TO_REF" ]]; then
        TO_REF="$1"
      else
        usage
      fi
      shift
      ;;
  esac
done

[[ -z "$FROM_REF" || -z "$TO_REF" ]] && usage

command -v gh >/dev/null || { echo "Falta 'gh' en el PATH" >&2; exit 1; }
command -v jq >/dev/null || { echo "Falta 'jq' en el PATH" >&2; exit 1; }

REPO="$(gh repo view --json nameWithOwner --jq .nameWithOwner)"

# Orden fijo de las secciones en la salida.
SECTIONS=(FEAT FIXES HOTFIX SECURITY REFACTOR PERF DB OTROS)

# Prefijo de rama/título (ya en minúsculas) -> sección del changelog.
category_for_prefix() {
  case "$1" in
    feature | feat) echo "FEAT" ;;
    fix) echo "FIXES" ;;
    hotfix) echo "HOTFIX" ;;
    security) echo "SECURITY" ;;
    refactor) echo "REFACTOR" ;;
    perf) echo "PERF" ;;
    db) echo "DB" ;;
    docs | chore | style | test) echo "OTROS" ;;
    *) echo "" ;;
  esac
}

TMP_DIR="$(mktemp -d)"
trap 'rm -rf "$TMP_DIR"' EXIT

for section in "${SECTIONS[@]}"; do
  : >"$TMP_DIR/$section"
done
SEEN_PRS="$TMP_DIR/seen_prs"
: >"$SEEN_PRS"

while IFS= read -r sha; do
  [[ -z "$sha" ]] && continue

  # `gh` escribe el objeto de error JSON en stdout y sale != 0 ante 4xx/5xx.
  # Capturamos el fallo SIN concatenar (nada de `|| echo`, que dejaría dos
  # documentos JSON y engañaría al chequeo de abajo) y avisamos por stderr.
  if ! prs_json=$(gh api "repos/${REPO}/commits/${sha}/pulls" 2>/dev/null); then
    echo "warn: no se pudieron resolver las PRs de ${sha} (gh api falló); se ignora" >&2
    prs_json="[]"
  fi
  # Defensa extra: si la respuesta no es un array JSON, tratarla como "sin PRs".
  if ! jq -e 'type == "array"' <<<"$prs_json" >/dev/null 2>&1; then
    echo "warn: respuesta inesperada de gh api para ${sha}; se ignora" >&2
    prs_json="[]"
  fi

  while IFS= read -r pr; do
    [[ -z "$pr" ]] && continue

    number=$(jq -r '.number // empty' <<<"$pr")
    # Sin número usable no hay entrada de changelog posible; y evita usar un valor
    # no numérico como clave de deduplicación o de orden.
    [[ "$number" =~ ^[0-9]+$ ]] || continue
    grep -qx "$number" "$SEEN_PRS" && continue
    echo "$number" >>"$SEEN_PRS"

    title=$(jq -r '.title // ""' <<<"$pr")
    url=$(jq -r '.html_url // ""' <<<"$pr")
    head_ref=$(jq -r '.head.ref // ""' <<<"$pr")
    [[ "$head_ref" == "null" ]] && head_ref=""

    if [[ -n "$ONLY_PATHS" ]]; then
      # Traer primero todos los ficheros y luego filtrar: evita que `grep -q`
      # cierre el pipe de `--paginate` a media descarga (SIGPIPE + pipefail).
      pr_files=$(
        gh api "repos/${REPO}/pulls/${number}/files" --paginate --jq '.[].filename' 2>/dev/null \
          || true
      )
      grep -Eq "$ONLY_PATHS" <<<"$pr_files" || continue
    fi

    branch_prefix="${head_ref%%/*}"
    category=$(category_for_prefix "$(tr '[:upper:]' '[:lower:]' <<<"$branch_prefix")")

    if [[ -z "$category" ]]; then
      title_prefix=$(sed -nE 's/^([A-Za-z]+)(\([^)]*\))?!?:[[:space:]]*(.*)$/\1/p' <<<"$title")
      category=$(category_for_prefix "$(tr '[:upper:]' '[:lower:]' <<<"$title_prefix")")
    fi
    [[ -z "$category" ]] && category="OTROS"

    # Si el título viene con prefijo estilo commit convencional, se muestra sin
    # él — la sección ya indica la categoría, mantenerlo sería redundante.
    display_title="$title"
    stripped_title=$(sed -nE 's/^[A-Za-z]+(\([^)]*\))?!?:[[:space:]]*(.*)$/\2/p' <<<"$title")
    [[ -n "$stripped_title" ]] && display_title="$stripped_title"

    # printf (no echo): un título que empiece por '-' o traiga barras invertidas
    # no debe interpretarse como flags ni como escapes. Se antepone el número
    # tabulado para ordenar por PR sin que un '#' en el título rompa la clave.
    printf '%s\t* [#%s](%s) %s\n' "$number" "$number" "$url" "$display_title" \
      >>"$TMP_DIR/$category"
  done < <(jq -c '.[]' <<<"$prs_json")
done < <(git log "${FROM_REF}..${TO_REF}" --pretty=%H)

for section in "${SECTIONS[@]}"; do
  if [[ -s "$TMP_DIR/$section" ]]; then
    echo "### $section"
    sort -n "$TMP_DIR/$section" | cut -f2-
    echo
  fi
done
