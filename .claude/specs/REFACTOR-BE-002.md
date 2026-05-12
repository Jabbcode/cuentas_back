# SPEC: REFACTOR-BE-002 — Descomponer payDebt + eliminar circular import

## Qué se pide

Descomponer la función `payDebt` en `debts.service.ts` para que tenga responsabilidad única (máximo 20 líneas, solo orquesta). Eliminar el `await import('./transactions.service.js')` dinámico que existe para evitar una dependencia circular. Extraer la lógica de intereses a `lib/utils/debt.utils.ts`. Extraer la lógica de side effects de pagos recurrentes a una función privada dentro del mismo service.

---

## Diagnóstico exacto de la dependencia circular

La dependencia circular existe porque:

- `debts.service.ts` necesita llamar a `createTransaction` de `transactions.service.ts` (para registrar el gasto del gasto fijo vinculado al pago recurrente)
- `recurring-debt-payments.service.ts` importa `* as debtsService` de `debts.service.ts` para llamar `payDebt` desde `processPendingRecurringPayments`
- Si `debts.service.ts` importara `transactions.service.ts` de forma estática, el grafo sería: `debts` → `transactions` y `recurring-debt-payments` → `debts`. No es circular directo. El circular real es: `debts` → `transactions` → (no importa debts), así que **la circularidad no viene de transactions.service**, sino de que el autor asumió que sí existía y usó dynamic import preventivamente.

**Verificación real del grafo de imports:**
- `transactions.service.ts` importa: `prisma`, `errors`, `accounts.service`, `notifications.service`, `tags.service` — **no importa debts.service**
- Por lo tanto: el `await import('./transactions.service.js')` en `debts.service.ts` es innecesario — no existe circularidad real. Se puede reemplazar con un import estático normal.

**La causa raíz** es que `payDebt` hace demasiado: mezcla lógica de negocio pura (cálculo de intereses), orquestación de BD (dentro de `prisma.$transaction`), y side effects post-transacción (pagos recurrentes + gastos fijos). La solución es separar cada responsabilidad sin necesidad de restructurar el grafo de dependencias.

---

## Contexto de Notion (tareas relacionadas)

- [REFACTOR-BE-001] — Implementó custom error classes (`AppError`, `NotFoundError`, `ConflictError`, `ValidationError`, `ForbiddenError`) en `src/lib/errors.ts`. Ya completado. `debts.service.ts` ya los usa correctamente.

---

## Contexto de código

- `src/services/debts.service.ts` — Contiene `payDebt` (~195 líneas totales en esa función). Tiene dos funciones privadas actuales: `calculateInterest` y `getDebtStatus`. Usa `await import('./transactions.service.js')` en línea 320 dentro del bloque de side effects.
- `src/services/transactions.service.ts` — Expone `createTransaction(data: CreateTransactionInput, userId: string)`. No importa `debts.service` — no hay circularidad real.
- `src/services/recurring-debt-payments.service.ts` — Expone `calculateNextDueDate(frequency, dayOfMonth, dayOfWeek, fromDate)` como función exportada pura. También llama a `debtsService.payDebt` en `processPendingRecurringPayments`. Esta es la dependencia que sí existe: `recurring-debt-payments` → `debts`.
- `src/lib/errors.ts` — Clases de error ya disponibles, no requiere modificación.
- `src/lib/` — No existe subdirectorio `utils/`. Debe crearse.

---

## Archivos a tocar

| Archivo | Cambio |
|---------|--------|
| `src/lib/utils/debt.utils.ts` | Crear — mover `calculateInterest`, `getDebtStatus` y añadir `calculateDebtPaymentBreakdown` |
| `src/services/debts.service.ts` | Eliminar funciones privadas extraídas, eliminar `await import`, añadir import estático de `createTransaction`, añadir función privada `handleRecurringPaymentSideEffects`, reducir `payDebt` a orquestador |

Solo estos dos archivos. `transactions.service.ts` y `recurring-debt-payments.service.ts` no se tocan.

---

## Firmas de funciones nuevas/movidas

### `src/lib/utils/debt.utils.ts`

```
calculateInterest(
  remainingAmount: number,
  interestRate: number,
  interestType: string
): number
```
Movida desde `debts.service.ts` — misma lógica, sin cambios.

```
getDebtStatus(
  remainingAmount: number,
  dueDate: Date | null
): string
```
Movida desde `debts.service.ts` — misma lógica, sin cambios.

```
calculateDebtPaymentBreakdown(
  remainingAmount: number,
  paymentAmount: number,
  interestRate: number | null,
  interestType: string | null
): { principal: number; interest: number; newRemainingAmount: number }
```
Nueva función pura que encapsula toda la lógica de cálculo de líneas 190–208 de `debts.service.ts`.

### `src/services/debts.service.ts` — función privada nueva

```
async function handleRecurringPaymentSideEffects(
  debtId: string,
  userId: string,
  accountId: string,
  amount: number
): Promise<void>
```
Extrae el bloque de líneas 286–357. Usa import estático de `createTransaction` desde `transactions.service.js` (reemplaza el dynamic import). Usa import estático de `calculateNextDueDate` desde `recurring-debt-payments.service.js` (ya existe en línea 3).

---

## Orden de implementación (sin romper el build en ningún paso)

1. **Crear `src/lib/utils/debt.utils.ts`** con las tres funciones (`calculateInterest`, `getDebtStatus`, `calculateDebtPaymentBreakdown`). El archivo es nuevo — no rompe nada existente.

2. **Modificar `src/services/debts.service.ts`**:
   a. Añadir import estático de `createTransaction` desde `./transactions.service.js`
   b. Añadir import de las tres utils desde `../lib/utils/debt.utils.js`
   c. Eliminar las dos funciones privadas `calculateInterest` y `getDebtStatus`
   d. Añadir la función privada `handleRecurringPaymentSideEffects` (extrae las líneas 286–357, usa `createTransaction` estático)
   e. Reescribir `payDebt` para que solo orqueste: validaciones → `calculateDebtPaymentBreakdown` → `prisma.$transaction` (get/create categoría + crear transaction + actualizar balance + crear debtPayment + actualizar debt) → `handleRecurringPaymentSideEffects`

3. **Verificar `npx tsc --noEmit` — 0 errores**

El paso 1 es independiente y seguro. El paso 2 es una operación atómica sobre un solo archivo — si falla el build, es en ese archivo y es visible inmediatamente.

---

## Acceptance criteria verificables

- [ ] `payDebt` tiene máximo 20 líneas (contar físicamente)
- [ ] Ninguna línea de `debts.service.ts` contiene `await import(`
- [ ] `src/lib/utils/debt.utils.ts` existe y exporta `calculateInterest`, `getDebtStatus`, `calculateDebtPaymentBreakdown`
- [ ] `handleRecurringPaymentSideEffects` existe como función privada (no exportada) en `debts.service.ts`
- [ ] `transactions.service.ts` aparece en los imports estáticos de `debts.service.ts`
- [ ] `npx tsc --noEmit` — 0 errores
- [ ] El comportamiento de `payDebt` es idéntico al actual (mismos inputs → mismos outputs y side effects)

---

## Fuera de scope

- No modificar `recurring-debt-payments.service.ts` — `processPendingRecurringPayments` llama a `payDebt` y eso sigue funcionando igual
- No modificar `transactions.service.ts`
- No extraer la lógica del `prisma.$transaction` interno — la atomicidad de BD es responsabilidad de `payDebt` como orquestador y debe permanecer ahí
- No crear un `DebtRepository` ni abstracciones adicionales (eso es REFACTOR-BE-006)
- No refactorizar `getDebts`, `createDebt` ni otras funciones del service aunque tengan mejoras posibles

## Preguntas abiertas

Ninguna. El scope está completamente definido por la tarea y el código existente.
