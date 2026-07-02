# Plan 009: Unificar los límites de mes en una util `getMonthRange` (eliminar el patrón 23:59:59)

> **Executor instructions**: Sigue este plan paso a paso. Ejecuta cada comando de
> verificación y confirma el resultado esperado antes de avanzar. Si ocurre algo
> de la sección "STOP conditions", detente y reporta — no improvises. Al terminar,
> actualiza tu fila de estado en `plans/README.md`.
>
> **Drift check (ejecutar primero)**: `git diff --stat 73b4102..HEAD -- src/services/dashboard.service.ts src/services/fixed-expenses.service.ts src/services/credit-cards.service.ts src/lib/cron.ts src/lib/utils/date.utils.ts`
> Los planes 005 y 008 tocan fixed-expenses y credit-cards — drift esperado. Lo
> invariante a verificar: el patrón `new Date(..., +1, 0, 23, 59, 59)` sigue presente
> en los sitios listados. Ejecuta el grep del Step 1 y reconcilia la lista real.

## Status

- **Priority**: P3
- **Effort**: S
- **Risk**: LOW
- **Depends on**: plans/002-vitest-baseline.md; ejecutar DESPUÉS de 005 y 008 (tocan los mismos archivos)
- **Category**: bug
- **Planned at**: commit `73b4102`, 2026-06-11

## Why this matters

El "fin de mes" se calcula en ~8 sitios con `new Date(y, m + 1, 0, 23, 59, 59)` + `lte`,
que excluye el último segundo del mes (las transacciones con timestamp entre 23:59:59.001
y 23:59:59.999 del último día quedan fuera de resúmenes y del check de duplicados de
gastos fijos). Es un margen pequeño, pero el patrón está duplicado y cada copia es una
oportunidad de divergencia. El fix estándar: límite exclusivo — `start = día 1 del mes`,
`end = día 1 del mes siguiente`, comparando con `gte start` / `lt end`.

## Current state

Sitios con el patrón (verificar con el grep del Step 1):

- `src/services/dashboard.service.ts:9, 47, 127, 173` — getSummary, getByCategory,
  getMonthlySummary, getFixedVsVariable.
- `src/services/fixed-expenses.service.ts:189, 270` — autoGenerateFixedExpenseTransactions
  (tras plan 005 puede haber cambiado de forma — conservar su semántica),
  getFixedExpensesSummary.
- `src/services/credit-cards.service.ts:313-314` — payCreditCardStatement (check de
  pago mensual del fixed expense).
- `src/lib/cron.ts:75-76` — resumen mensual por email.

Patrón actual (ejemplo en `dashboard.service.ts:8-9`):
```ts
const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59);
// ...después: date: { gte: startOfMonth, lte: endOfMonth }
```

Utils puras existentes en `src/lib/utils/date.utils.ts` (solo `calculateNextDueDate`).
Convención: utils puras sin imports de React/Prisma, exportadas con nombre.

## Commands you will need

| Purpose   | Command            | Expected on success |
|-----------|--------------------|---------------------|
| Typecheck | `npx tsc --noEmit` | exit 0              |
| Tests     | `npm test`         | todos pasan         |
| Build     | `npm run build`    | exit 0              |

## Scope

**In scope**:
- `src/lib/utils/date.utils.ts` (nueva util + test)
- `src/lib/utils/__tests__/date.utils.test.ts`
- Los archivos listados en Current state (solo las líneas del patrón y sus comparaciones `lte` → `lt`)

**Out of scope** (NO tocar):
- `getCutoffDates`/`getPaymentDueDate` (períodos de tarjeta — semántica distinta, no mensual).
- `getDaysBetween` y su `Math.ceil` — deliberadamente fuera (cambia la UX de alertas).
- Cualquier query que NO sea un rango de mes calendario.

## Git workflow

- Branch: `feature/009-month-boundaries`
- Commit: `fix: límites de mes con rango exclusivo vía getMonthRange`
- NO pushear ni abrir PR salvo que el operador lo indique.

## Steps

### Step 1: Inventario real

`grep -rn "23, 59, 59" src/` → listar todos los sitios. Compara con Current state y
trabaja sobre la lista real (los planes 005/008 pudieron mover líneas).

### Step 2: Crear la util

En `src/lib/utils/date.utils.ts`:

```ts
/**
 * Rango de un mes calendario: [start, end) — usar gte: start y lt: end.
 * `month` es 0-indexado (como Date). end = medianoche del día 1 del mes siguiente.
 */
export function getMonthRange(year: number, month: number): { start: Date; end: Date } {
  return {
    start: new Date(year, month, 1),
    end: new Date(year, month + 1, 1),
  };
}
```

Tests en `src/lib/utils/__tests__/date.utils.test.ts` (añadir al archivo del plan 002):
junio 2026 → start 1 jun 00:00, end 1 jul 00:00; diciembre → end 1 ene del año
siguiente; febrero bisiesto (2028) → end 1 mar 2028.

**Verify**: `npm test` → todos pasan

### Step 3: Sustituir el patrón sitio por sitio

En cada sitio del inventario:

```ts
// antes
const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59);
...date: { gte: startOfMonth, lte: endOfMonth }

// después
const { start: startOfMonth, end: endOfMonth } = getMonthRange(now.getFullYear(), now.getMonth());
...date: { gte: startOfMonth, lt: endOfMonth }
```

CRÍTICO: cada `lte: endOfMonth` que use el rango debe pasar a `lt: endOfMonth` — un
`lte` con el nuevo end incluiría el instante 00:00:00.000 del mes siguiente.
Caso especial `dashboard.service.ts:getMonthlySummary` (línea 126): recibe `month`
1-indexado — ahí es `getMonthRange(year, month - 1)`.
Caso especial `cron.ts:75-76`: ya calcula `prevMonth/prevYear` — usar
`getMonthRange(prevYear, prevMonth)`.

Importar con `import { getMonthRange } from '../lib/utils/date.utils.js';` (ajustar
profundidad relativa; recuerda la extensión `.js`).

**Verify** tras cada archivo: `npx tsc --noEmit` → exit 0

### Step 4: Barrido final

**Verify**: `grep -rn "23, 59, 59" src/` → 0 coincidencias
**Verify**: `grep -rn "getMonthRange" src/ | wc -l` → ≥ 8 (1 definición + ~7-8 usos)
**Verify**: `npm test` → todos pasan (si algún test de caracterización del plan 002
fijaba el comportamiento 23:59:59, actualizarlo y anotar el cambio en el reporte)

## Test plan

- Tests de `getMonthRange` (Step 2).
- Verificación manual: `GET /api/dashboard/summary` y `GET /api/fixed-expenses/summary`
  devuelven los mismos valores que antes con datos normales (cualquier diferencia
  implicaría transacciones en el segundo final del mes — improbable en dev).

## Done criteria

- [ ] `grep -rn "23, 59, 59" src/` → 0
- [ ] `npx tsc --noEmit` → exit 0; `npm test` → exit 0; `npm run build` → exit 0
- [ ] Ningún `lte: endOfMonth` sobrevive donde `endOfMonth` venga de `getMonthRange` (`grep -rn "lte: endOfMonth" src/` → 0)
- [ ] `git status` sin archivos fuera del scope
- [ ] Fila actualizada en `plans/README.md`

## STOP conditions

- Un sitio del inventario usa el `endOfMonth` para algo más que comparar fechas
  (p. ej. lo devuelve en la respuesta API) — cambiar el valor devuelto al frontend
  está fuera de scope; reporta ese sitio.
- Los planes 005/008 no están DONE y hay conflictos en fixed-expenses/credit-cards.

## Maintenance notes

- Regla a partir de ahora (para review): cualquier rango de mes nuevo usa
  `getMonthRange` + `lt`; el patrón `23:59:59` no debe reaparecer.
- Pendiente conocido y excluido: fechas construidas en hora local del servidor (Render
  corre en UTC; si los usuarios están en España, los límites de mes locales difieren
  1-2h de los UTC). Resolver eso es un cambio de producto (timezone del usuario), no
  de este plan.
