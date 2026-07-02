# Plan 004: Ownership en profundidad — userId en los WHERE de update/delete y validación de FKs ajenas

> **Executor instructions**: Sigue este plan paso a paso. Ejecuta cada comando de
> verificación y confirma el resultado esperado antes de avanzar. Si ocurre algo
> de la sección "STOP conditions", detente y reporta — no improvises. Al terminar,
> actualiza tu fila de estado en `plans/README.md`.
>
> **Drift check (ejecutar primero)**: `git diff --stat 73b4102..HEAD -- src/services/transactions.service.ts src/repositories/transaction.repository.ts src/repositories/account.repository.ts src/services/accounts.service.ts`
> Nota: el plan 003 modifica `transactions.service.ts` y `accounts.service.ts` ANTES
> que este plan — eso es drift esperado. Lo que debe coincidir es la estructura
> descrita (ownership check separado del write). Si el plan 003 no está DONE en
> `plans/README.md`, es STOP: ejecutarlo primero.

## Status

- **Priority**: P1
- **Effort**: M
- **Risk**: LOW
- **Depends on**: plans/003-atomic-balance-updates.md
- **Category**: security
- **Planned at**: commit `73b4102`, 2026-06-11

## Why this matters

La regla crítica del repo es "userId filtering obligatorio en todas las queries", pero
hoy se cumple solo a medias: los services verifican ownership con una lectura previa y
LUEGO llaman a repos cuyo `update`/`remove` filtra solo por `id` (TOCTOU + un futuro
caller que olvide el check previo escribe sobre datos ajenos). Peor: `createTransaction`
y `updateTransaction` aceptan `accountId`/`categoryId`/`fixedExpenseId` del body y los
conectan SIN comprobar que pertenezcan al usuario — un usuario autenticado puede crear
o mover una transacción apuntando a la cuenta de otro usuario (el row queda persistido
con la referencia ajena aunque el balance update posterior falle con 404).

## Current state

- `src/repositories/transaction.repository.ts`:
  ```ts
  // líneas 42-48
  export async function update(id: string, data: ..., include?: ...) {
    return prisma.transaction.update({ where: { id }, data, include });
  }
  // líneas 57-59
  export async function remove(id: string): Promise<Transaction> {
    return prisma.transaction.delete({ where: { id } });
  }
  ```
- `src/repositories/account.repository.ts` — mismo patrón: `update(id, data)` línea 36,
  `remove(id)` línea 51.
- `src/services/transactions.service.ts` (tras plan 003 envuelto en `$transaction`,
  estructura equivalente):
  - `createTransaction`: conecta `account: { connect: { id: data.accountId } }`,
    `category: { connect: { id: data.categoryId } }`, `fixedExpense: { connect ... }`
    sin validar ownership. El balance update posterior valida la cuenta (lanza
    NotFound), pero el create ya ocurrió → en `$transaction` el rollback lo cubre para
    la CUENTA; `categoryId` y `fixedExpenseId` ajenos siguen pasando sin error.
  - `updateTransaction`: copia `data.accountId`/`data.categoryId`/`data.fixedExpenseId`
    a `updateData` sin validar ownership.
- Patrón existente de ownership-en-WHERE que sirve de ejemplar:
  `transactionRepo.findByIdAndUser` usa `findFirst({ where: { id, userId } })`, y el
  plan 003 dejó `updateAccountBalance` con `updateMany({ where: { id, userId } })` +
  check de `count`.
- Prisma: `update`/`delete` solo aceptan WHERE por campo único → para WHERE compuesto
  se usa `updateMany`/`deleteMany` + check de `count` (no devuelven el row).

## Commands you will need

| Purpose   | Command            | Expected on success |
|-----------|--------------------|---------------------|
| Typecheck | `npx tsc --noEmit` | exit 0              |
| Tests     | `npm test`         | todos pasan         |
| Build     | `npm run build`    | exit 0              |

## Scope

**In scope**:
- `src/repositories/transaction.repository.ts` — `update` y `remove` reciben `userId`
- `src/repositories/account.repository.ts` — `update` y `remove` reciben `userId`
- `src/services/transactions.service.ts` — validación de FKs + pasar userId a repos
- `src/services/accounts.service.ts` — pasar userId a repos
- Callers directos de esos repos que el typecheck señale

**Out of scope** (NO tocar):
- El resto de repositorios (category, debt, fixed-expense, notification, recurring...) —
  mismo patrón, pero ampliarlo aquí multiplica el churn; queda como follow-up anotado
  en Maintenance.
- Los controllers y schemas Zod — la validación de ownership es de la capa service.
- El shape de las respuestas HTTP.

## Git workflow

- Branch: `feature/004-ownership-defense-in-depth` (desde `develop`)
- Commit: `fix: userId en WHERE de update/delete y validación de ownership de FKs`
- NO pushear ni abrir PR salvo que el operador lo indique.

## Steps

### Step 1: Repos de transaction y account con userId en el WHERE

En `transaction.repository.ts`:

```ts
export async function update(
  id: string,
  userId: string,
  data: Prisma.TransactionUpdateInput,
  include?: Prisma.TransactionInclude
): Promise<Transaction> {
  const result = await prisma.transaction.updateMany({ where: { id, userId }, data: data as Prisma.TransactionUpdateManyMutationInput });
  if (result.count === 0) throw new NotFoundError('Transacción no encontrada');
  return prisma.transaction.findFirstOrThrow({ where: { id, userId }, include });
}

export async function remove(id: string, userId: string): Promise<void> {
  const result = await prisma.transaction.deleteMany({ where: { id, userId } });
  if (result.count === 0) throw new NotFoundError('Transacción no encontrada');
}
```

(importar `NotFoundError` de `../lib/errors.js`). Atención: si `data` contiene updates
de relación tipo `{ connect: ... }` incompatible con `UpdateManyMutationInput`, el
typecheck lo dirá — en ese caso los services deben pasar FKs escalares
(`accountId: '...'` en vez de `account: { connect }}`), que es lo que
`updateTransaction` ya hace hoy vía `updateData`. Mismo cambio en
`account.repository.ts` (los datos de update de cuenta usan `connect` para
`paymentAccount` — ahí conservar `prisma.account.update` pero con un
`findFirstOrThrow({ where: { id, userId } })` previo DENTRO de la misma función, y
documentar con un comentario que el check vive en el repo).

**Verify**: `npx tsc --noEmit` → falla SOLO en los callers que aún no pasan userId (esperado, se arregla en Step 2)

### Step 2: Actualizar callers

`grep -rn "transactionRepo.update\|transactionRepo.remove\|accountRepo.update\|accountRepo.remove" src/`
y pasar el `userId` que cada service ya tiene en su firma. Callers conocidos:
`transactions.service.ts` (update línea ~126, remove línea ~152),
`accounts.service.ts` (updateAccount, deleteAccount).

**Verify**: `npx tsc --noEmit` → exit 0

### Step 3: Validar ownership de FKs en `createTransaction` y `updateTransaction`

En `transactions.service.ts`, añadir un helper privado al final del archivo:

```ts
async function assertOwnership(
  userId: string,
  refs: { accountId?: string; categoryId?: string; fixedExpenseId?: string | null },
  tx: Prisma.TransactionClient = prisma
) {
  if (refs.accountId) {
    const ok = await tx.account.findFirst({ where: { id: refs.accountId, userId }, select: { id: true } });
    if (!ok) throw new NotFoundError('Cuenta no encontrada');
  }
  if (refs.categoryId) {
    const ok = await tx.category.findFirst({ where: { id: refs.categoryId, userId }, select: { id: true } });
    if (!ok) throw new NotFoundError('Categoría no encontrada');
  }
  if (refs.fixedExpenseId) {
    const ok = await tx.fixedExpense.findFirst({ where: { id: refs.fixedExpenseId, userId }, select: { id: true } });
    if (!ok) throw new NotFoundError('Gasto fijo no encontrado');
  }
}
```

Llamarlo al inicio del `$transaction` de `createTransaction` (con
`data.accountId`, `data.categoryId`, `data.fixedExpenseId`) y de `updateTransaction`
(solo con los campos presentes en `data`).

**Verify**: `npx tsc --noEmit` → exit 0
**Verify**: `npm test` → todos pasan

### Step 4: Verificación manual

Con dos usuarios en la DB local (A y B):
1. Como A, `POST /api/transactions` con `accountId` de B → 404, y NO se crea row
   (verificar en Prisma Studio: `npm run db:studio`).
2. Como A, `PUT /api/transactions/:id` (transacción de A) con `categoryId` de B → 404,
   la transacción conserva su categoría original.
3. Como A, `DELETE /api/transactions/:idDeB` → 404, la transacción de B sigue existiendo.

## Test plan

- Sin DB de test aún (ver plan 002), la cobertura es la verificación manual del Step 4 —
  documentar los 3 casos en el reporte.
- Cuando exista la capa de integración, estos 3 casos son los primeros a automatizar.

## Done criteria

- [ ] `npx tsc --noEmit` → exit 0; `npm test` → exit 0; `npm run build` → exit 0
- [ ] `grep -n "where: { id }" src/repositories/transaction.repository.ts` → 0 coincidencias en update/remove
- [ ] `grep -n "assertOwnership" src/services/transactions.service.ts` → ≥ 3 (helper + 2 llamadas)
- [ ] Verificación manual del Step 4 documentada (3 casos → 404 sin efectos)
- [ ] `git status` sin archivos fuera del scope
- [ ] Fila actualizada en `plans/README.md`

## STOP conditions

- El plan 003 no está DONE (este plan edita el mismo código).
- `updateMany` rechaza por tipos los datos que los services pasan hoy y la conversión a
  FKs escalares exige cambiar schemas Zod o controllers → reporta en vez de ampliar scope.
- Encuentras un endpoint que LEGÍTIMAMENTE referencia datos de otro usuario (no debería
  existir en esta app single-user-per-data, pero si aparece, reporta).

## Maintenance notes

- Follow-up diferido: aplicar el mismo patrón a los repos restantes (category, debt,
  fixed-expense, recurring-debt-payment, notification). El patrón queda establecido en
  transaction/account.repository — copiarlo.
- Revisor: comprobar que ningún flujo interno (cron, syncs de fixed-expenses) llamaba a
  los repos modificados sin userId real — el typecheck del Step 2 los habrá señalado todos.
- Si algún día se añade compartición de cuentas entre usuarios, este modelo de ownership
  cambia entero (tabla de membresía, no FK directa).
