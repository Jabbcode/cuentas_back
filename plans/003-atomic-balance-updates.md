# Plan 003: Hacer atómicas las actualizaciones de saldo (transacción + balance en un solo $transaction)

> **Executor instructions**: Sigue este plan paso a paso. Ejecuta cada comando de
> verificación y confirma el resultado esperado antes de avanzar. Si ocurre algo
> de la sección "STOP conditions", detente y reporta — no improvises. Al terminar,
> actualiza tu fila de estado en `plans/README.md`.
>
> **Drift check (ejecutar primero)**: `git diff --stat 73b4102..HEAD -- src/services/transactions.service.ts src/services/accounts.service.ts src/repositories/account.repository.ts`
> Si algún archivo in-scope cambió, compara los excerpts de "Current state" con el
> código vivo; si no coinciden, es STOP.

## Status

- **Priority**: P1
- **Effort**: M
- **Risk**: MED
- **Depends on**: plans/002-vitest-baseline.md
- **Category**: bug
- **Planned at**: commit `73b4102`, 2026-06-11

## Why this matters

Crear, editar o borrar una transacción ejecuta 2–4 escrituras de DB separadas (crear el
row + leer saldo + escribir saldo nuevo) sin `prisma.$transaction`. Si el proceso muere
o falla una query intermedia, el saldo de la cuenta queda corrupto en silencio. Además
`updateAccountBalance` es read-modify-write: dos requests concurrentes pierden una de las
dos actualizaciones. Los scripts locales del autor (`fix-nan-initial-balance.ts`,
`fix-credit-card-balances.ts`...) demuestran que la corrupción de saldos ya ocurrió en
producción. El repo ya tiene el patrón correcto en `transferFunds` — hay que extenderlo.

## Current state

- `src/services/transactions.service.ts`:
  - `createTransaction` (líneas 70–104): `transactionRepo.create(...)` y DESPUÉS
    `await updateAccountBalance(data.accountId, userId, data.amount, data.type)` (línea 101). Dos escrituras sin transacción.
  - `updateTransaction` (líneas 106–139): revierte el balance viejo (109), hace
    `transactionRepo.update` (126), aplica el balance nuevo (131). Tres escrituras + lecturas, sin transacción.
  - `deleteTransaction` (líneas 141–153): revierte balance (145) y LUEGO borra (152) —
    si el delete falla, el saldo ya quedó mal.
- `src/services/accounts.service.ts`:
  - `updateAccountBalance` (líneas 91–107): `findByIdAndUser` → calcula
    `newBalance = current ± amount` en JS → `accountRepo.updateBalance(accountId, newBalance)`. Read-modify-write no atómico.
  - **Ejemplar a imitar** — `transferFunds` (líneas 70–83):
    ```ts
    return prisma.$transaction(async (tx) => {
      await tx.account.update({ where: { id: fromAccountId }, data: { balance: { decrement: amount } } });
      await tx.account.update({ where: { id: toAccountId }, data: { balance: { increment: amount } } });
      return tx.transfer.create({ ... });
    });
    ```
- `src/repositories/account.repository.ts` — tiene `updateBalance(id, newBalance)` (set
  absoluto, línea 40) y `decrementBalance(id, amount)` (atómico, línea 44).
- `createTransaction` es llamado por `fixed-expenses.service.ts` (x2),
  `credit-cards.service.ts` (x3) y `debts.service.ts` — **la firma
  `(data: CreateTransactionInput, userId: string)` NO puede cambiar**.
- Convención: los services pueden importar `prisma` directamente para `$transaction`
  (precedente: `accounts.service.ts:1` y `fixed-expenses.service.ts:1`).

## Commands you will need

| Purpose   | Command            | Expected on success |
|-----------|--------------------|---------------------|
| Typecheck | `npx tsc --noEmit` | exit 0              |
| Tests     | `npm test`         | todos pasan         |
| Build     | `npm run build`    | exit 0              |

## Scope

**In scope**:
- `src/services/transactions.service.ts`
- `src/services/accounts.service.ts` (solo `updateAccountBalance`)
- `src/services/__tests__/` (crear, si se añaden tests de la lógica pura extraída)

**Out of scope** (NO tocar):
- `transferFunds` — ya es correcto.
- `debts.service.ts`, `credit-cards.service.ts`, `fixed-expenses.service.ts` — llaman a
  `createTransaction`/`payDebt` y tienen sus propios problemas de atomicidad multi-paso,
  pero ampliarlo aquí dispara el blast radius. Se benefician automáticamente de que
  `createTransaction` sea atómico por dentro.
- La firma pública de `createTransaction`, `updateTransaction`, `deleteTransaction`.
- El shape de las respuestas HTTP.

## Git workflow

- Branch: `feature/003-atomic-balance-updates` (desde `develop`)
- Commit: `fix: saldo y transacción en un único prisma.$transaction (atomicidad)`
- NO pushear ni abrir PR salvo que el operador lo indique.

## Steps

### Step 1: Hacer atómico `updateAccountBalance`

En `src/services/accounts.service.ts`, reescribir `updateAccountBalance` para usar
increment/decrement nativo con verificación de ownership en el WHERE, y aceptar un
cliente de transacción opcional:

```ts
import type { Prisma } from '@prisma/client';

export async function updateAccountBalance(
  accountId: string,
  userId: string,
  amount: number,
  type: 'expense' | 'income',
  tx: Prisma.TransactionClient = prisma
) {
  const result = await tx.account.updateMany({
    where: { id: accountId, userId },
    data: { balance: type === 'income' ? { increment: amount } : { decrement: amount } },
  });

  if (result.count === 0) {
    throw new NotFoundError('Cuenta no encontrada');
  }
}
```

Notas: `updateMany` permite WHERE compuesto `{ id, userId }` (update simple solo acepta
únicos); `count === 0` reemplaza el check de existencia previo. El valor de retorno
anterior (la cuenta) no lo usa ningún caller — verificar con
`grep -rn "updateAccountBalance" src/` que todos los callers ignoran el retorno; si
alguno lo usa, es STOP.

**Verify**: `npx tsc --noEmit` → exit 0

### Step 2: Envolver `createTransaction` en `$transaction`

En `src/services/transactions.service.ts`, importar `prisma` (`import { prisma } from '../lib/prisma.js';`)
y envolver el cuerpo:

```ts
export async function createTransaction(data: CreateTransactionInput, userId: string) {
  return prisma.$transaction(async (tx) => {
    const transaction = await tx.transaction.create({
      data: { /* mismo objeto data que hoy construye transactionRepo.create */ },
      include: { /* mismos includes que hoy */ },
    });
    await updateAccountBalance(data.accountId, userId, data.amount, data.type, tx);
    return transaction;
  });
}
```

Mantener EXACTAMENTE el mismo objeto `data` e `include` que el código actual (líneas
71–99) — solo cambia que se ejecuta vía `tx` y dentro del `$transaction`.

**Verify**: `npx tsc --noEmit` → exit 0

### Step 3: Envolver `updateTransaction` y `deleteTransaction`

Mismo patrón. En `updateTransaction`: el `getTransactionById` (ownership check) puede
quedar fuera del `$transaction`; dentro van: revertir balance viejo → `tx.transaction.update`
→ aplicar balance nuevo. En `deleteTransaction`: dentro del `$transaction`, primero
`tx.transaction.delete({ where: { id } })` y después revertir el balance (invertir el
orden actual: hoy revierte antes de borrar). Conservar la construcción de `updateData`
y los `include` tal cual.

**Verify**: `npx tsc --noEmit` → exit 0
**Verify**: `npm test` → todos pasan (los tests del plan 002 no tocan services, deben seguir verdes)

### Step 4: Verificación manual del flujo completo

Con la app local corriendo contra una DB de desarrollo (`npm run dev`):
1. Crear una transacción expense de 10 → el saldo de la cuenta baja exactamente 10.
2. Editarla a 25 → el saldo neto refleja −25 (no −35 ni −10).
3. Editarla cambiando de cuenta A a cuenta B → A recupera el importe, B lo descuenta.
4. Borrarla → ambos saldos vuelven al valor inicial.
Anotar los cuatro resultados en el reporte final.

## Test plan

- Tests unitarios donde sea posible sin DB: ninguno nuevo obligatorio (la lógica es
  I/O). La cobertura real de esto vendrá con tests de integración (diferido, ver plan
  002 Maintenance).
- Obligatorio: la verificación manual del Step 4, documentada.

## Done criteria

- [ ] `npx tsc --noEmit` → exit 0; `npm test` → exit 0; `npm run build` → exit 0
- [ ] `grep -n "updateBalance" src/services/accounts.service.ts` → 0 coincidencias
      (ya no se usa el set absoluto en este flujo)
- [ ] `grep -c "\$transaction" src/services/transactions.service.ts` → ≥ 3
- [ ] Verificación manual del Step 4 documentada con los 4 casos OK
- [ ] `git status` sin archivos fuera del scope
- [ ] Fila actualizada en `plans/README.md`

## STOP conditions

- Algún caller usa el valor de retorno de `updateAccountBalance` (Step 1).
- `updateAccountBalance` se llama desde un sitio que ya está dentro de otro
  `$transaction` (Prisma no anida transacciones interactivas) — `grep -rn "updateAccountBalance" src/`
  y revisar cada caller antes del Step 1; si hay anidamiento, reporta.
- Los excerpts de "Current state" no coinciden con el código (drift).
- La verificación manual del Step 4 da un saldo incorrecto tras dos intentos de fix.

## Maintenance notes

- Tras este plan, `accountRepo.updateBalance` (set absoluto) puede quedar sin usos —
  comprobar con grep y, si es así, señalarlo en el PR (eliminarlo es trivial pero que
  lo decida el revisor).
- `payDebt` en `debts.service.ts` y `payCreditCardStatement` en `credit-cards.service.ts`
  siguen siendo multi-paso no atómico a su nivel (crean varias transacciones + registros).
  Deuda conocida, deliberadamente fuera de este plan.
- Si se añade soporte multi-moneda o decimales estrictos, revisar el increment/decrement
  con `number` (hoy toda la app mezcla Decimal→Number; ver plan 009 maintenance).
