# Plan 002: Establecer baseline de verificación — Vitest + tests de caracterización de las utils puras

> **Executor instructions**: Sigue este plan paso a paso. Ejecuta cada comando de
> verificación y confirma el resultado esperado antes de avanzar. Si ocurre algo
> de la sección "STOP conditions", detente y reporta — no improvises. Al terminar,
> actualiza tu fila de estado en `plans/README.md`.
>
> **Drift check (ejecutar primero)**: `git diff --stat 73b4102..HEAD -- package.json src/lib/utils .github/workflows/ci.yml`
> Si algún archivo in-scope cambió, compara los excerpts de "Current state" con el
> código vivo; si no coinciden, es STOP.

## Status

- **Priority**: P1
- **Effort**: M
- **Risk**: LOW
- **Depends on**: none
- **Category**: tests
- **Planned at**: commit `73b4102`, 2026-06-11

## Why this matters

El backend maneja dinero (saldos, deudas, tarjetas) con 0% de cobertura de tests y sin
test runner instalado. La única verificación hoy es `npx tsc --noEmit`. Los planes 003,
004, 005, 008 y 009 refactorizan lógica de dinero; sin una red de tests, cada uno es un
salto sin cuerda. Este plan instala Vitest y escribe tests de **caracterización** (fijan
el comportamiento ACTUAL, incluso si es discutible) para las funciones puras de
`src/lib/utils/` — las más baratas de testear (sin mocks de React, DB ni red).

## Current state

- `package.json` — sin script `test`, sin runner en devDependencies. Scripts actuales:
  `dev`, `build`, `start`, `typecheck`, `format`, `prepare`, `db:*`.
- `tsconfig.json` — `module: NodeNext`, `target: ES2022`, `strict: true`. El código usa
  ESM con extensiones `.js` en los imports.
- `src/lib/utils/` — funciones puras sin imports de React ni Prisma:
  - `date.utils.ts` — `calculateNextDueDate(frequency, dayOfMonth, dayOfWeek, fromDate)`
  - `credit-card.utils.ts` — `getCutoffDates(cutoffDay)`, `getPaymentDueDate(cutoffDate, paymentDueDay)`, `getDaysBetween(from, to)` (usa `Math.ceil` — caracterizar tal cual), `normalizeToUTC(date)`
  - `transaction.utils.ts` — `buildTransactionWhereInput(userId, filters)`
  - `debt.utils.ts` — leer el archivo y caracterizar sus exports
  - `projection.utils.ts` — leer el archivo y caracterizar sus exports
- `.github/workflows/ci.yml` — job `lint-and-build`: npm ci → prisma generate →
  prisma validate → `npx tsc --noEmit` → `npm run build`. Sin paso de tests.
- Nota: `getCutoffDates()` llama internamente a `new Date()` (hoy) — sus tests deben
  usar fake timers (`vi.setSystemTime`).

## Commands you will need

| Purpose   | Command                              | Expected on success |
|-----------|--------------------------------------|---------------------|
| Install   | `npm install --save-dev vitest`      | exit 0              |
| Typecheck | `npx tsc --noEmit`                   | exit 0              |
| Tests     | `npm test`                           | todos pasan         |
| Build     | `npm run build`                      | exit 0              |

## Scope

**In scope**:
- `package.json` (script `test`, devDependency `vitest`)
- `vitest.config.ts` (crear, en la raíz)
- `src/lib/utils/__tests__/*.test.ts` (crear)
- `.github/workflows/ci.yml` (añadir paso de tests)
- `tsconfig.json` SOLO si hace falta excluir `vitest.config.ts` del build

**Out of scope** (NO tocar):
- CUALQUIER archivo de producción en `src/` fuera de crear la carpeta `__tests__/`.
  Regla dura: si un test revela un bug (p. ej. el `Math.ceil` de `getDaysBetween`, o
  límites de mes con `23:59:59`), NO corregir el código — escribir el test que asegura
  el comportamiento actual y anotar el hallazgo en el reporte final. Otros planes
  corrigen los bugs y actualizarán los tests.
- Tests de integración con DB — fuera de alcance de este plan (ver Maintenance notes).

## Git workflow

- Branch: `feature/002-vitest-baseline` (desde `develop`)
- Commits: `test: instalar Vitest y baseline de tests para lib/utils`, `chore: añadir paso de tests al CI`
- NO pushear ni abrir PR salvo que el operador lo indique.

## Steps

### Step 1: Instalar Vitest y configurar

`npm install --save-dev vitest`. Crear `vitest.config.ts` en la raíz:

```ts
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts'],
  },
});
```

Añadir a `package.json` scripts: `"test": "vitest run"` y `"test:watch": "vitest"`.
Si `npm run build` falla porque `tsc` intenta compilar `vitest.config.ts`, está fuera
de `src/` así que no debería; si los tests dentro de `src/` rompen el build (van a
`dist/`), añadir `"exclude"` de `src/**/__tests__/**` y `src/**/*.test.ts` en
`tsconfig.json` y verificar que `npm run typecheck` sigue cubriendo los tests o crear
un `tsconfig.test.json`; elegir la opción más simple que mantenga ambos comandos en verde.

**Verify**: `npx vitest run` → "no test files found" o 0 tests, exit sin crash
**Verify**: `npm run build` → exit 0

### Step 2: Tests de `date.utils.ts`

Crear `src/lib/utils/__tests__/date.utils.test.ts`. Casos mínimos para
`calculateNextDueDate` (usar fechas fijas como `fromDate`, no `new Date()`):

- monthly, dayOfMonth=15, desde el 2026-06-10 → 2026-06-15
- monthly, dayOfMonth=15, desde el 2026-06-15 → 2026-07-15 (si hoy es el día, salta al mes siguiente — caracterizar lo que haga el código)
- monthly, dayOfMonth=null → usa día 1
- monthly, dayOfMonth=31, desde el 2026-06-10 → caracterizar el resultado real (JS Date desborda al mes siguiente; asertar lo que devuelva)
- weekly, dayOfWeek=1 (lunes), desde un miércoles → próximo lunes
- weekly mismo día de la semana → +7 días
- biweekly → +14 días

**Verify**: `npm test` → todos pasan

### Step 3: Tests de `credit-card.utils.ts`

Crear `src/lib/utils/__tests__/credit-card.utils.test.ts`. Para `getCutoffDates` usar
`vi.useFakeTimers()` + `vi.setSystemTime(new Date(2026, 5, 10))` y restaurar en
`afterEach`. Casos:

- `getCutoffDates(5)` con hoy=10 jun → lastCutoff 5 jun, nextCutoff 5 jul
- `getCutoffDates(20)` con hoy=10 jun → lastCutoff 20 may, nextCutoff 20 jun
- `getPaymentDueDate(corte 5 jun, dueDay 20)` → 20 jun; `(corte 20 jun, dueDay 5)` → 5 jul
- `getDaysBetween`: mismo instante → 0; +36 horas → 2 (documenta el `Math.ceil` actual con un comentario `// caracterización: Math.ceil redondea hacia arriba`)
- `normalizeToUTC(2026-06-10T18:30 local)` → 2026-06-10T00:00:00.000Z

**Verify**: `npm test` → todos pasan

### Step 4: Tests de `transaction.utils.ts`, `debt.utils.ts` y `projection.utils.ts`

Leer cada archivo primero. Para `buildTransactionWhereInput`: caso sin filtros (solo
userId), caso con rango de fechas, caso con categoryIds múltiples, caso con
minAmount/maxAmount. Para `debt.utils.ts` y `projection.utils.ts`: un test por export
con caso feliz + un edge (lista vacía, cero, null según aplique). Mínimo razonable:
~25-40 asserts en total entre los 5 archivos.

**Verify**: `npm test` → todos pasan
**Verify**: `npx tsc --noEmit` → exit 0

### Step 5: Añadir tests al CI

En `.github/workflows/ci.yml`, añadir después del paso "TypeScript compilation check":

```yaml
      - name: Run tests
        run: npm test
```

**Verify**: el YAML es válido (`npx js-yaml .github/workflows/ci.yml` o revisar indentación contra los pasos existentes)

## Test plan

Este plan ES el test plan. Resultado esperado: 5 archivos `*.test.ts` nuevos, todos en
verde, ejecutables con `npm test` en <30s, sin tocar código de producción.

## Done criteria

- [ ] `npm test` → exit 0, ≥25 tests pasando
- [ ] `npx tsc --noEmit` → exit 0
- [ ] `npm run build` → exit 0 y `dist/` no contiene archivos `*.test.js`
- [ ] `git diff --stat` solo muestra archivos del scope
- [ ] CI tiene paso `npm test`
- [ ] Reporte final lista los comportamientos sospechosos encontrados (sin corregirlos)
- [ ] Fila actualizada en `plans/README.md`

## STOP conditions

- `debt.utils.ts` o `projection.utils.ts` resultan NO ser puros (importan Prisma o
  hacen I/O) → testea solo los puros y reporta.
- Vitest no arranca con `module: NodeNext` tras un intento razonable de config → reporta
  el error exacto en vez de cambiar tsconfig de producción.
- Un test revela un bug → NO lo corrijas (ver Out of scope); caracteriza y reporta.

## Maintenance notes

- Los planes 003/005/009 cambiarán comportamiento que estos tests fijan (límites de mes,
  clamp de dueDay). Esos planes deben ACTUALIZAR los tests afectados — es lo esperado.
- Siguiente capa diferida: tests de integración de services con DB de prueba
  (testcontainers o DATABASE_URL de test). Diferido por esfuerzo; los planes 003/004
  incluyen verificación manual mientras tanto.
- Convención establecida: tests junto al código en `__tests__/`, sufijo `.test.ts`.
