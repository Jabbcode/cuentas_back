# Plan 008: Eliminar los N+1 en el resumen de tarjetas y en el sync de gastos fijos recurrentes

> **Executor instructions**: Sigue este plan paso a paso. Ejecuta cada comando de
> verificación y confirma el resultado esperado antes de avanzar. Si ocurre algo
> de la sección "STOP conditions", detente y reporta — no improvises. Al terminar,
> actualiza tu fila de estado en `plans/README.md`.
>
> **Drift check (ejecutar primero)**: `git diff --stat 73b4102..HEAD -- src/services/credit-cards.service.ts src/services/fixed-expenses.service.ts src/repositories/fixed-expense.repository.ts`
> El plan 005 toca `fixed-expenses.service.ts` (función autoGenerate, distinta de las
> de este plan) — drift esperado ahí. Si las funciones citadas abajo difieren de los
> excerpts, es STOP.

## Status

- **Priority**: P2
- **Effort**: M
- **Risk**: MED
- **Depends on**: plans/002-vitest-baseline.md (red mínima); ejecutar después de 005 para evitar conflictos en fixed-expenses.service.ts
- **Category**: perf
- **Planned at**: commit `73b4102`, 2026-06-11

## Why this matters

Dos hotspots emiten una cascada de queries por elemento:

1. `getCreditCardsSummary` llama a `getCreditCardStatement` por tarjeta, y cada
   statement ejecuta ~4 queries (transacciones del período actual, del cerrado, pago
   del período, cuenta) → con 5 tarjetas, ~20 queries por carga del dashboard. En
   Render (DB con latencia por round-trip) esto domina el tiempo de respuesta.
2. `getFixedExpensesSummary` ejecuta DOS syncs secuenciales en cada GET del resumen:
   `syncCreditCardFixedExpenses` (que a su vez llama a `getCreditCardStatement` por
   tarjeta — multiplicador del punto 1) y `syncRecurringDebtPaymentFixedExpenses`
   (1–2 queries `findFirst` por pago recurrente dentro del loop).

## Current state

- `src/services/credit-cards.service.ts`:
  - `getCreditCardStatement(accountId, userId)` (líneas 44–186): por tarjeta hace
    `accountRepo.findByIdAndUser` (48), `transactionRepo.findMany` período actual
    (69–78), `transactionRepo.findMany` período cerrado (81–90),
    `creditCardPaymentRepo.findFirst` (104–108).
  - `getCreditCardsSummary(userId)` (líneas 191–238):
    ```ts
    const summaries = await Promise.all(
      creditCards
        .filter((card) => card.cutoffDay && card.paymentDueDay)
        .map((card) => getCreditCardStatement(card.id, userId))
    );
    ```
  - Los períodos difieren por tarjeta (dependen de `card.cutoffDay`), así que no se
    puede hacer una única query por período global — pero SÍ una única query de
    transacciones que cubra el rango más antiguo y particionar en memoria.
- `src/services/fixed-expenses.service.ts`:
  - `getFixedExpensesSummary` (261–312): llama a ambos syncs al inicio (263, 266).
  - `syncRecurringDebtPaymentFixedExpenses` (407–488): loop sobre pagos mensuales
    activos; por cada uno, `fixedExpenseRepo.findFirst({ userId, recurringDebtPaymentId })`
    (líneas 434–437 y 446–449).
- `prisma/schema.prisma`: `FixedExpense.recurringDebtPaymentId` es `@unique` (línea 153)
  y tiene índice — un único `findMany` con `recurringDebtPaymentId: { in: [...] }`
  devuelve a lo sumo un fixed expense por pago.

## Commands you will need

| Purpose   | Command            | Expected on success |
|-----------|--------------------|---------------------|
| Typecheck | `npx tsc --noEmit` | exit 0              |
| Tests     | `npm test`         | todos pasan         |
| Build     | `npm run build`    | exit 0              |

## Scope

**In scope**:
- `src/services/credit-cards.service.ts` (refactor interno de statement/summary)
- `src/services/fixed-expenses.service.ts` (solo `syncRecurringDebtPaymentFixedExpenses`)
- `src/repositories/credit-card-payment.repository.ts` (añadir `findMany` si falta)

**Out of scope** (NO tocar):
- El SHAPE de la respuesta de `GET /api/credit-cards/summary` y del statement — el
  frontend depende de él. Este plan es solo de cómo se obtienen los datos.
- `payCreditCardStatement`, `autoGenerateFixedExpenseTransactions` (plan 005),
  `syncCreditCardFixedExpenses` (se beneficia indirectamente del punto 1).
- Cualquier cambio de schema/índices.

## Git workflow

- Branch: `feature/008-n-plus-one-queries`
- Commit: `refactor: batch de queries en credit cards summary y sync de recurrentes`
- NO pushear ni abrir PR salvo que el operador lo indique.

## Steps

### Step 1: Extraer el cálculo de statement a una función pura sobre datos precargados

En `credit-cards.service.ts`, refactorizar `getCreditCardStatement` en dos partes:

1. `buildStatement(account, transactions, payments, today)` — función que recibe la
   tarjeta, TODAS sus transacciones expense desde `previousCutoff`, y sus pagos, y
   calcula períodos/balances/alertas con la MISMA lógica actual (líneas 58–185).
   Particiona las transacciones en memoria: período actual = `date >= lastCutoff`,
   período cerrado = `previousCutoff <= date < lastCutoff`.
2. `getCreditCardStatement(accountId, userId)` — conserva su firma y comportamiento:
   carga la cuenta, sus transacciones y pagos (3 queries) y llama a `buildStatement`.

**Verify**: `npx tsc --noEmit` → exit 0

### Step 2: Batch en `getCreditCardsSummary`

Reescribir para que haga un número FIJO de queries (no proporcional a tarjetas):

1. `accountRepo.findCreditCardsByUser(userId)` (ya existe).
2. Calcular por tarjeta sus `previousCutoff` (con `getCutoffDates`) y tomar el mínimo.
3. UNA query: `transactionRepo.findMany({ accountId: { in: cardIds }, userId, type: 'expense', date: { gte: minPreviousCutoff } }, ...)` con los mismos includes que hoy.
4. UNA query de pagos: añadir en `credit-card-payment.repository.ts` un
   `findMany(where)` si no existe, y traer los pagos con `accountId: { in: cardIds }`.
5. Agrupar en memoria por `accountId` (Map) y llamar a `buildStatement` por tarjeta.
6. El resto del summary (totales, upcomingPayments, alerts) queda igual.

**Verify**: `npx tsc --noEmit` → exit 0

### Step 3: Batch en `syncRecurringDebtPaymentFixedExpenses`

Antes del loop:

```ts
const existingFixedExpenses = await fixedExpenseRepo.findMany(
  { userId, recurringDebtPaymentId: { in: monthlyActive.map((p) => p.id) } }
);
const fixedExpenseByPaymentId = new Map(
  existingFixedExpenses.map((fe) => [fe.recurringDebtPaymentId, fe])
);
```

(si `fixedExpenseRepo` no expone `findMany(where)` genérico, añadirlo siguiendo el
patrón de `transaction.repository.ts:findMany`). Dentro del loop, sustituir ambos
`findFirst` por `fixedExpenseByPaymentId.get(payment.id)`.

**Verify**: `npx tsc --noEmit` → exit 0
**Verify**: `npm test` → todos pasan

### Step 4: Verificación de equivalencia

Con datos locales (mínimo 2 tarjetas con cutoffDay distinto y transacciones en ambos
períodos): capturar la respuesta JSON de `GET /api/credit-cards/summary` ANTES del
refactor (en `main`/`develop`) y DESPUÉS, y comparar — deben ser idénticas salvo
campos de timestamp. Documentar la comparación en el reporte.

## Test plan

- Tests unitarios para `buildStatement` (ahora es pura): crear
  `src/services/__tests__/credit-cards.statement.test.ts` con: tarjeta con transacciones
  en ambos períodos → balances correctos; período cerrado pagado → `isPaid: true` y
  `available` no descuenta el cerrado; sin transacciones → balances 0, sin alertas;
  uso ≥90% → alerta error. Usar `vi.setSystemTime` para fijar "hoy".
- Mínimo 6 asserts nuevos.

## Done criteria

- [ ] `npx tsc --noEmit` → exit 0; `npm test` → exit 0 (incl. tests nuevos de buildStatement); `npm run build` → exit 0
- [ ] `getCreditCardsSummary` no contiene llamadas a `getCreditCardStatement` dentro de un map/loop (`grep -n "getCreditCardStatement" src/services/credit-cards.service.ts` → solo la definición y usos fuera del summary)
- [ ] `grep -n "findFirst" src/services/fixed-expenses.service.ts` dentro de `syncRecurringDebtPaymentFixedExpenses` → 0
- [ ] Comparación antes/después de la respuesta del summary documentada como idéntica
- [ ] `git status` sin archivos fuera del scope
- [ ] Fila actualizada en `plans/README.md`

## STOP conditions

- La respuesta del summary difiere antes/después en algo más que timestamps tras dos
  intentos de corrección — la equivalencia es el requisito central.
- `buildStatement` necesita datos que no se pueden precargar en las 2 queries batch.
- Los excerpts no coinciden con el código (drift, p. ej. plan 005 sin aterrizar y
  conflicto de merge).

## Maintenance notes

- `syncCreditCardFixedExpenses` sigue llamando a `getCreditCardStatement` por tarjeta;
  tras este plan puede reutilizar el mismo batch — follow-up natural, fuera de scope.
- Si se añade paginación o más períodos al statement, `buildStatement` es el único
  sitio a tocar — mantenerla pura (sin I/O) es la invariante a vigilar en review.
- Los dos syncs dentro de `getFixedExpensesSummary` (escrituras en un GET) son un
  code smell aparte (side effects en lectura); documentado, no resuelto aquí.
