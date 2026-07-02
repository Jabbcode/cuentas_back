# Plan 010: Cerrar la limpieza post-eliminación de Budgets/Tags (docs, ADR y restos de código)

> **Executor instructions**: Sigue este plan paso a paso. Ejecuta cada comando de
> verificación y confirma el resultado esperado antes de avanzar. Si ocurre algo
> de la sección "STOP conditions", detente y reporta — no improvises. Al terminar,
> actualiza tu fila de estado en `plans/README.md`.
>
> **Drift check (ejecutar primero)**: `git diff --stat 73b4102..HEAD -- .claude/project-state.md .claude/decisions/ADR-decisions.md src/lib/email/types.ts`
> Si project-state.md ya no lista Budgets/Tags, parte del plan está hecho — verifica
> cada step individualmente y marca como ya-hecho lo que aplique.

## Status

- **Priority**: P3
- **Effort**: S
- **Risk**: LOW
- **Depends on**: none
- **Category**: docs / tech-debt
- **Planned at**: commit `73b4102`, 2026-06-11

## Why this matters

El commit `394c846` (2026-06-02) eliminó las features Budgets y Tags del backend, pero
la documentación viva no se actualizó: `.claude/project-state.md` aún lista los
endpoints `/budgets` y `/tags` como implementados, y el ADR-007 sigue declarando al
modelo `Budget` (ya inexistente) como "fuente de verdad" con `Category.monthlyLimit`
como "legado pendiente de eliminar". Como estos archivos se cargan como contexto en
cada sesión de Claude Code, la información falsa contamina futuras propuestas. Además
quedó un campo huérfano en los tipos de email.

## Current state

- `.claude/project-state.md`:
  - Líneas 67–71: sección "### ✅ Presupuestos (FEAT-011)" con endpoints GET/POST/PATCH/DELETE `/budgets` — **ya no existen** (no hay `budgets` en `src/routes/`).
  - Líneas 86–89: sección "### ✅ Tags (FEAT-016)" con `GET /tags` y filtro `?tag=` — ya no existen.
  - Línea 6: "Última actualización: 2026-06-01" (anterior a la eliminación).
  - Línea 123: deuda técnica menciona "`Category.monthlyLimit` campo legado pendiente eliminar".
- `.claude/decisions/ADR-decisions.md`, ADR-007 (líneas 78–86): "El modelo `Budget` ...
  es la única fuente de verdad para límites por categoría. `Category.monthlyLimit`
  queda como campo legado... pendiente de eliminar (REFACTOR-001)".
- Realidad del código HOY:
  - `prisma/schema.prisma:87` — `monthlyLimit Decimal?` existe en Category; no hay modelo Budget ni Tag.
  - `src/services/dashboard.service.ts:51,58,82` — `getByCategory` SELECT-ea y devuelve `monthlyLimit` al frontend.
  - Es decir: `monthlyLimit` es ahora el ÚNICO mecanismo de límites y está en uso — el ADR dice lo contrario.
- `src/lib/email/types.ts:5` — `budget?: number;` en `CategoryEmailData`: ningún
  productor lo setea ni la plantilla lo lee (verificar con `grep -rn "\.budget" src/`).
- Nota: `src/scripts/` (14 scripts one-off) y `docs/` están en `.gitignore` (solo
  locales) — NO son parte del repo y NO se tocan en este plan.

## Commands you will need

| Purpose   | Command            | Expected on success |
|-----------|--------------------|---------------------|
| Typecheck | `npx tsc --noEmit` | exit 0              |
| Tests     | `npm test` (si existe) | todos pasan     |

## Scope

**In scope**:
- `.claude/project-state.md`
- `.claude/decisions/ADR-decisions.md` (solo ADR-007)
- `src/lib/email/types.ts`

**Out of scope** (NO tocar):
- `prisma/schema.prisma` — NO eliminar `monthlyLimit`: está en uso por el dashboard.
  La decisión correcta es documentarlo como vigente, no borrarlo.
- `src/scripts/`, `docs/` — gitignorados, locales.
- El resto de ADRs y secciones de project-state.

## Git workflow

- Branch: `feature/010-post-budgets-cleanup`
- Commit: `docs: actualizar project-state y ADR-007 tras eliminación de Budgets/Tags`
- NO pushear ni abrir PR salvo que el operador lo indique.

## Steps

### Step 1: Actualizar `.claude/project-state.md`

1. Eliminar la sección "### ✅ Presupuestos (FEAT-011)" completa (líneas 67–71).
2. Eliminar la sección "### ✅ Tags (FEAT-016)" completa (líneas 86–89).
3. Actualizar "Última actualización" a la fecha de ejecución.
4. En "📊 Cambios Recientes", añadir al inicio:
   `- **CHORE (PR #31 — 2026-06-02):** Eliminadas las features Budgets y Tags (modelos, rutas, services). Category.monthlyLimit pasa a ser el único mecanismo de límites por categoría.`
5. En "🔧 Deuda Técnica", reemplazar la línea de `Category.monthlyLimit` por:
   `- ⚠️ Notificaciones de límite de categoría: revisar si checkBudgetAndNotify sobrevivió a la eliminación de Budgets (tipo de notificación 'category_limit' existe en schema)`.

**Verify**: `grep -n "budgets\|Tags (FEAT-016)" .claude/project-state.md` → 0 coincidencias en secciones de endpoints

### Step 2: Actualizar ADR-007

Reescribir el ADR-007 conservando el original como historia. Formato sugerido (mantener
el estilo de los demás ADRs del archivo):

```markdown
## ADR-007: Budget como fuente de verdad para límites de gasto

**Fecha:** 2026-04-21 | **Estado:** Reemplazada (2026-06-02)

**Decisión original:** El modelo `Budget` era la única fuente de verdad para límites
por categoría; `Category.monthlyLimit` quedaba como legado.

**Reemplazo (2026-06-02, PR #31):** Las features Budgets y Tags fueron eliminadas del
producto. `Category.monthlyLimit` vuelve a ser el único mecanismo de límites por
categoría y está en uso (dashboard getByCategory). REFACTOR-001 (eliminar monthlyLimit)
queda cancelado.
```

**Verify**: `grep -n "Reemplazada" .claude/decisions/ADR-decisions.md` → 1 coincidencia

### Step 3: Eliminar el campo huérfano de email

Primero verificar que nadie lo usa: `grep -rn "\.budget\b" src/` → solo definición.
Luego en `src/lib/email/types.ts` eliminar la línea `budget?: number;`.

**Verify**: `npx tsc --noEmit` → exit 0

### Step 4: Verificación del estado de las notificaciones de límite

Investigación de solo-lectura (sin cambios de código): ¿quedó vivo algún flujo que
genere notificaciones `category_limit` tras eliminar Budgets?
`grep -rn "category_limit\|categoryLimit" src/` y reportar el hallazgo en
project-state (la línea de deuda del Step 1.5 ya lo recoge). Si existe código muerto
de notificación de límites, NO eliminarlo — solo documentarlo en el reporte final.

## Test plan

- Sin tests nuevos (cambios de docs + eliminación de campo no usado). Gate: typecheck.

## Done criteria

- [ ] project-state.md sin secciones de Budgets/Tags, fecha actualizada, cambio reciente anotado
- [ ] ADR-007 marcado como Reemplazada con la realidad actual de monthlyLimit
- [ ] `src/lib/email/types.ts` sin `budget?`
- [ ] `npx tsc --noEmit` → exit 0
- [ ] Reporte del Step 4 (estado de notificaciones category_limit) incluido
- [ ] `git status` sin archivos fuera del scope
- [ ] Fila actualizada en `plans/README.md`

## STOP conditions

- `grep -rn "\.budget\b" src/` muestra un uso real del campo → no eliminarlo; reporta.
- El ADR-007 actual difiere del excerpt (alguien ya lo actualizó) → reconcilia, no dupliques.

## Maintenance notes

- Decisión de producto pendiente (para el dueño): ¿se quieren notificaciones de límite
  por categoría basadas en `monthlyLimit`? El tipo `category_limit` existe en el schema
  de Notification y las preferencias (`categoryLimit: true` en el default de
  notificationPreferences), pero el generador vivía en budgets.service (eliminado).
  Si se quiere recuperar, es una tarea nueva (FEAT), no parte de esta limpieza.
- Los 14 scripts locales de `src/scripts/` son fixes one-off históricos; si los data-fix
  recurren, considerar un sistema versionado (hallazgo de dirección registrado en
  plans/README.md, no planificado).
