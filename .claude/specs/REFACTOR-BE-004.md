# SPEC: REFACTOR-BE-004 — updateAccountBalance debe verificar userId

## Qué se pide

Agregar verificación de ownership (`userId`) en `updateAccountBalance` antes de modificar el balance de una cuenta. La función actualmente busca la cuenta solo por `id` usando `findUnique`, sin confirmar que pertenezca al usuario autenticado. Se debe agregar `userId` como parámetro, cambiar la query a `findFirst({ where: { id, userId } })`, y actualizar todos los callers.

---

## Contexto de Notion (tareas Done relacionadas)

- [REFACTOR-BE-001] — Implementó custom error classes en `src/lib/errors.ts`: `AppError`, `NotFoundError`, `ConflictError`, `ValidationError`, `ForbiddenError`. El patrón establecido es lanzar `new NotFoundError('mensaje')` cuando una entidad no se encuentra o no pertenece al usuario — exactamente lo que requiere esta tarea.
- [REFACTOR-BE-002] — Descompuso `payDebt`. Contexto relevante: `debts.service.ts` ya NO llama a `updateAccountBalance` directamente. En la versión actual post-REFACTOR-BE-002, `payDebt` actualiza el balance dentro de un `prisma.$transaction` usando `tx.account.update({ where: { id }, data: { balance: { decrement } } })` — es decir, bypass directo de `updateAccountBalance`. El grep confirma esto.

---

## Hallazgo crítico: discrepancia entre la tarea y el código actual

La tarea menciona `src/services/debts.service.ts` como uno de los callers de `updateAccountBalance`. El grep sobre `src/` confirma que `debts.service.ts` NO llama a `updateAccountBalance` en ninguna línea — el balance en `payDebt` se actualiza directamente en el `prisma.$transaction` interno (línea 226: `tx.account.update`).

Los callers reales de `updateAccountBalance` son exactamente 4 llamadas, todas en `transactions.service.ts`:

- Línea 126: dentro de `createTransaction` — `await updateAccountBalance(data.accountId, data.amount, data.type)`
- Línea 138–142: dentro de `updateTransaction` — revertir balance anterior (tipo invertido)
- Línea 172–175: dentro de `updateTransaction` — aplicar nuevo balance
- Línea 185–188: dentro de `deleteTransaction` — revertir balance al eliminar

`debts.service.ts` no requiere ningún cambio.

---

## Contexto de código

- `src/services/accounts.service.ts` líneas 99–119 — definición actual de `updateAccountBalance`. Usa `prisma.account.findUnique({ where: { id } })` sin `userId`. No lanza error de ownership — solo lanza `NotFoundError` si el `id` no existe en absoluto.
- `src/services/transactions.service.ts` líneas 126, 138–142, 172–175, 185–188 — los 4 call sites. En todos los casos el `userId` está disponible como parámetro de la función contenedora (`createTransaction`, `updateTransaction`, `deleteTransaction`), por lo que pasarlo es inmediato sin necesidad de reestructuración.
- `src/lib/errors.ts` — `NotFoundError` disponible, ya importado en `accounts.service.ts` (línea 7).

---

## Archivos a tocar

| Archivo | Cambio |
|---------|--------|
| `src/services/accounts.service.ts` | Agregar `userId: string` como segundo parámetro de `updateAccountBalance`; cambiar `findUnique({ where: { id } })` a `findFirst({ where: { id, userId } })`; sin otros cambios |
| `src/services/transactions.service.ts` | Agregar `userId` como segundo argumento en los 4 call sites (líneas 126, 138, 172, 185) |

`src/services/debts.service.ts` — no se toca. No es caller de `updateAccountBalance`.

---

## Propuesta

1. En `accounts.service.ts`: modificar la firma de `updateAccountBalance` para recibir `userId: string` como segundo parámetro. Cambiar la query interna de `findUnique({ where: { id } })` a `findFirst({ where: { id, userId } })`. El mensaje de error (`'Cuenta no encontrada'`) se mantiene igual — es el patrón establecido en el resto del service (ver `getAccountById` línea 17–25).

2. En `transactions.service.ts`: actualizar los 4 call sites pasando `userId` como segundo argumento. En los tres contextos (`createTransaction`, `updateTransaction`, `deleteTransaction`), el `userId` ya está disponible como parámetro de la función — no requiere cambios de firma ni propagación adicional.

3. Verificar `npx tsc --noEmit` — 0 errores.

El orden es seguro si se hacen en un solo commit atómico: cambiar la firma primero rompe el build hasta que los callers se actualicen, por lo que ambos cambios deben aplicarse en la misma operación.

---

## Detalle de cada call site en `transactions.service.ts`

| Función | Línea | Call actual | Call nuevo |
|---------|-------|-------------|------------|
| `createTransaction` | 126 | `updateAccountBalance(data.accountId, data.amount, data.type)` | `updateAccountBalance(data.accountId, data.amount, data.type, userId)` — o bien como 2do param según la nueva firma |
| `updateTransaction` (revert) | 138–142 | `updateAccountBalance(existing.accountId, Number(existing.amount), existing.type === 'income' ? 'expense' : 'income')` | agregar `userId` |
| `updateTransaction` (apply) | 172–175 | `updateAccountBalance(updated.accountId, Number(updated.amount), updated.type as 'expense' \| 'income')` | agregar `userId` |
| `deleteTransaction` (revert) | 185–188 | `updateAccountBalance(transaction.accountId, Number(transaction.amount), transaction.type === 'income' ? 'expense' : 'income')` | agregar `userId` |

Nota: la nueva firma de `updateAccountBalance` queda como:
`updateAccountBalance(accountId: string, userId: string, amount: number, type: 'expense' | 'income')`
O bien manteniendo el orden actual e insertando `userId` al final:
`updateAccountBalance(accountId: string, amount: number, type: 'expense' | 'income', userId: string)`

El orden recomendado es insertar `userId` como segundo parámetro para ser consistente con el patrón establecido en todo el service (`getAccountById(id, userId)`, `updateAccount(id, data, userId)`, `deleteAccount(id, userId)`).

**Firma final recomendada:**
`updateAccountBalance(accountId: string, userId: string, amount: number, type: 'expense' | 'income')`

---

## Fuera de scope

- No modificar `payDebt` en `debts.service.ts` — el balance se actualiza dentro de `prisma.$transaction` directamente y ya verifica ownership en línea 197 (`findFirst({ where: { id: data.accountId, userId } })`) antes de llegar a esa parte.
- No refactorizar la lógica de balance (decrement/increment) en `updateAccountBalance` — el cálculo manual `currentBalance +/- amount` no está pedido en esta tarea.
- No modificar el `prisma.account.update` final en `updateAccountBalance` — sigue usando `where: { id: accountId }` para el update (el `findFirst` ya garantizó ownership).
- No agregar tests — no está en los criterios de aceptación.
- No tocar controllers, routes ni schemas.

---

## Preguntas abiertas

Ninguna. El scope está completamente definido por la tarea y el código verificado.
