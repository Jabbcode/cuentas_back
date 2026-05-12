# SPEC: REFACTOR-BE-006 — Crear capa repositories/

## Qué se pide

Crear `src/repositories/` como única capa de acceso a Prisma. Cada archivo encapsula todas las queries Prisma de su entidad y exporta funciones nombradas individualmente. Esta tarea NO modifica ningún service — solo crea los archivos de repository. La migración de los services para consumir los repositories es responsabilidad de REFACTOR-BE-007.

---

## Contexto de Notion (tareas Done relacionadas)

- [REFACTOR-BE-002] — Estableció el patrón de funciones exportadas individualmente en `lib/utils/debt.utils.ts`. Confirma que la convención es named exports individuales, sin clases, sin default export.
- [REFACTOR-BE-005] — Estableció que el tipo de retorno de queries Prisma debe usar `Prisma.XWhereInput` en lugar de `Record<string, unknown>`. Relevante para las firmas tipadas de los repositories.

---

## Contexto de código

- `src/lib/prisma.ts` — Exporta `export const prisma`. Los repositories lo importan como `import { prisma } from '../lib/prisma.js'`.
- `src/lib/errors.ts` — Exporta `NotFoundError`, `ConflictError`, `ValidationError`. Los repositories pueden importarlas para el caso de `findByIdAndUser` que lanza si no existe.
- `src/services/accounts.service.ts` — Usa: `prisma.account.findMany`, `prisma.account.findFirst`, `prisma.account.create`, `prisma.account.update`, `prisma.account.delete`, `prisma.transfer.create`, `prisma.transfer.findMany`, `prisma.$transaction` (transferFunds). `updateAccountBalance` usa `findFirst` + `update` con lógica de negocio — la parte Prisma se separa en `findByIdAndUser` + `updateBalance`.
- `src/services/transactions.service.ts` — Usa: `prisma.transaction.findMany`, `prisma.transaction.count`, `prisma.transaction.findFirst`, `prisma.transaction.create`, `prisma.transaction.update`, `prisma.transaction.delete`, `prisma.transaction.groupBy`, `prisma.category.findMany` (en getTransactionSummary), `prisma.receiptItem.findMany`.
- `src/services/categories.service.ts` — Usa: `prisma.category.findMany`, `prisma.category.findFirst`, `prisma.category.create`, `prisma.category.update`, `prisma.category.delete`, `prisma.transaction.count` (para validar antes de delete).
- `src/services/debts.service.ts` — Usa: `prisma.debt.create`, `prisma.debt.findMany`, `prisma.debt.findFirst`, `prisma.debt.update`, `prisma.debt.delete`, `prisma.account.findFirst`, `prisma.recurringDebtPayment.findFirst`, `prisma.recurringDebtPayment.update`, `prisma.fixedExpense.findFirst`, `prisma.transaction.findFirst`, `prisma.$transaction` (en payDebt — este bloque permanece en el service, no en el repository).
- `src/services/budgets.service.ts` — Usa: `prisma.budget.findMany`, `prisma.budget.findFirst`, `prisma.budget.create`, `prisma.budget.update`, `prisma.budget.delete`, `prisma.transaction.groupBy`, `prisma.transaction.aggregate`, `prisma.notification.findFirst`, `prisma.user.findUnique` (para preferencias).
- `src/services/notifications.service.ts` — Usa: `prisma.notification.findMany`, `prisma.notification.count`, `prisma.notification.findFirst`, `prisma.notification.update`, `prisma.notification.updateMany`, `prisma.notification.delete`, `prisma.notification.create`, `prisma.user.findUnique`, `prisma.user.update`.
- `src/services/fixed-expenses.service.ts` — Usa: `prisma.fixedExpense.findMany`, `prisma.fixedExpense.findFirst`, `prisma.fixedExpense.create`, `prisma.fixedExpense.update`, `prisma.fixedExpense.delete`, `prisma.transaction.updateMany`, `prisma.transaction.findFirst`, `prisma.recurringDebtPayment.findUnique`, `prisma.recurringDebtPayment.update`, `prisma.account.findMany`, `prisma.category.findFirst`, `prisma.category.create`.
- `src/services/tags.service.ts` — Usa: `prisma.tag.findMany`, `prisma.tag.findFirst`, `prisma.tag.delete`, `prisma.tag.upsert`.
- `src/services/recurring-debt-payments.service.ts` — Usa: `prisma.debt.findFirst`, `prisma.account.findFirst`, `prisma.recurringDebtPayment.create`, `prisma.recurringDebtPayment.findMany`, `prisma.recurringDebtPayment.findFirst`, `prisma.recurringDebtPayment.update`, `prisma.recurringDebtPayment.delete`.
- `src/services/auth.service.ts` — Usa: `prisma.user.findUnique`, `prisma.user.create`. Estas queries son simples y específicas de autenticación — se incluyen en `user.repository.ts`.
- `src/services/settings.service.ts` — Usa: `prisma.user.findUnique`, `prisma.user.findFirst`, `prisma.user.update`, `prisma.user.delete`, `prisma.account.count`, `prisma.transaction.count`, `prisma.category.count`, `prisma.fixedExpense.count`, `prisma.debt.count`, `prisma.transaction.findFirst`.
- `src/services/dashboard.service.ts` — Usa: `prisma.account.findMany`, `prisma.transaction.findMany`, `prisma.fixedExpense.findMany` (con queries de agregación en memoria — no nuevas queries Prisma).
- `src/services/credit-cards.service.ts` — Usa: `prisma.account.findFirst`, `prisma.transaction.findMany`, `prisma.creditCardPayment.findFirst`, `prisma.creditCardPayment.create`, `prisma.fixedExpense.findFirst`.
- `src/services/receipts.service.ts` — Usa: `prisma.transaction.findFirst`, `prisma.transaction.findMany`. Queries de búsqueda de duplicados.
- `src/services/projection.service.ts` — Usa: `prisma.fixedExpense.findMany` únicamente.

---

## Repositories a crear y sus métodos

### `src/repositories/account.repository.ts`

```typescript
export async function findAllByUser(userId: string): Promise<Account[]>
// prisma.account.findMany({ where: { userId }, orderBy: { createdAt: 'desc' } })

export async function findByIdAndUser(id: string, userId: string): Promise<Account | null>
// prisma.account.findFirst({ where: { id, userId } })

export async function findCreditCardsByUser(
  userId: string,
  filters?: { paymentAccountId?: { not: null }; cutoffDay?: { not: null }; paymentDueDay?: { not: null } }
): Promise<Account[]>
// prisma.account.findMany({ where: { userId, type: 'credit_card', ...filters } })

export async function countByUser(
  userId: string,
  where?: Prisma.AccountWhereInput
): Promise<number>
// prisma.account.count({ where: { userId, ...where } })

export async function create(data: Prisma.AccountCreateInput): Promise<Account>
// prisma.account.create({ data })

export async function update(id: string, data: Prisma.AccountUpdateInput): Promise<Account>
// prisma.account.update({ where: { id }, data })

export async function updateBalance(id: string, newBalance: number): Promise<Account>
// prisma.account.update({ where: { id }, data: { balance: newBalance } })

export async function decrementBalance(id: string, amount: number): Promise<Account>
// prisma.account.update({ where: { id }, data: { balance: { decrement: amount } } })

export async function remove(id: string): Promise<Account>
// prisma.account.delete({ where: { id } })

export async function createTransfer(data: Prisma.TransferCreateInput): Promise<Transfer & { fromAccount: Account; toAccount: Account }>
// prisma.transfer.create({ data, include: { fromAccount: true, toAccount: true } })

export async function findTransfersByAccount(
  accountId: string,
  userId: string
): Promise<(Transfer & { fromAccount: Account; toAccount: Account })[]>
// prisma.transfer.findMany({ where: { userId, OR: [{ fromAccountId: accountId }, { toAccountId: accountId }] }, include: ..., orderBy: { date: 'desc' } })
```

---

### `src/repositories/transaction.repository.ts`

```typescript
export async function findMany(
  where: Prisma.TransactionWhereInput,
  options?: { include?: Prisma.TransactionInclude; orderBy?: Prisma.TransactionOrderByWithRelationInput; take?: number; skip?: number }
): Promise<Transaction[]>
// prisma.transaction.findMany({ where, ...options })

export async function count(where: Prisma.TransactionWhereInput): Promise<number>
// prisma.transaction.count({ where })

export async function findByIdAndUser(
  id: string,
  userId: string,
  include?: Prisma.TransactionInclude
): Promise<Transaction | null>
// prisma.transaction.findFirst({ where: { id, userId }, include })

export async function findFirst(
  where: Prisma.TransactionWhereInput,
  include?: Prisma.TransactionInclude
): Promise<Transaction | null>
// prisma.transaction.findFirst({ where, include })

export async function create(
  data: Prisma.TransactionCreateInput,
  include?: Prisma.TransactionInclude
): Promise<Transaction>
// prisma.transaction.create({ data, include })

export async function update(
  id: string,
  data: Prisma.TransactionUpdateInput,
  include?: Prisma.TransactionInclude
): Promise<Transaction>
// prisma.transaction.update({ where: { id }, data, include })

export async function updateMany(
  where: Prisma.TransactionWhereInput,
  data: Prisma.TransactionUpdateManyMutationInput
): Promise<Prisma.BatchPayload>
// prisma.transaction.updateMany({ where, data })

export async function remove(id: string): Promise<Transaction>
// prisma.transaction.delete({ where: { id } })

export async function groupByCategory(
  where: Prisma.TransactionWhereInput
): Promise<{ categoryId: string | null; type: string; _sum: { amount: Prisma.Decimal | null }; _count: { _all: number } }[]>
// prisma.transaction.groupBy({ by: ['categoryId', 'type'], where, _sum: { amount: true }, _count: { _all: true } })

export async function aggregate(
  where: Prisma.TransactionWhereInput
): Promise<{ _sum: { amount: Prisma.Decimal | null } }>
// prisma.transaction.aggregate({ where, _sum: { amount: true } })

export async function findReceiptItems(transactionId: string): Promise<ReceiptItem[]>
// prisma.receiptItem.findMany({ where: { transactionId }, orderBy: { createdAt: 'asc' } })

export async function countByUser(userId: string): Promise<number>
// prisma.transaction.count({ where: { userId } })

export async function findFirstByUser(
  userId: string,
  orderBy: Prisma.TransactionOrderByWithRelationInput
): Promise<{ date: Date } | null>
// prisma.transaction.findFirst({ where: { userId }, orderBy, select: { date: true } })
```

---

### `src/repositories/category.repository.ts`

```typescript
export async function findAllByUser(
  userId: string,
  type?: 'expense' | 'income'
): Promise<Category[]>
// prisma.category.findMany({ where: { userId, ...(type && { type }) }, orderBy: { name: 'asc' } })

export async function findByIdAndUser(id: string, userId: string): Promise<Category | null>
// prisma.category.findFirst({ where: { id, userId } })

export async function findFirst(where: Prisma.CategoryWhereInput): Promise<Category | null>
// prisma.category.findFirst({ where })

export async function findMany(
  where: Prisma.CategoryWhereInput,
  select?: Prisma.CategorySelect
): Promise<Category[]>
// prisma.category.findMany({ where, select })

export async function countByUser(userId: string): Promise<number>
// prisma.category.count({ where: { userId } })

export async function create(data: Prisma.CategoryCreateInput): Promise<Category>
// prisma.category.create({ data })

export async function update(id: string, data: Prisma.CategoryUpdateInput): Promise<Category>
// prisma.category.update({ where: { id }, data })

export async function remove(id: string): Promise<Category>
// prisma.category.delete({ where: { id } })
```

---

### `src/repositories/debt.repository.ts`

```typescript
export async function create(data: Prisma.DebtCreateInput): Promise<Debt>
// prisma.debt.create({ data })

export async function findAllByUser(
  where: Prisma.DebtWhereInput,
  include?: Prisma.DebtInclude
): Promise<Debt[]>
// prisma.debt.findMany({ where, include, orderBy: [{ status: 'asc' }, { dueDate: 'asc' }] })

export async function findByIdAndUser(
  id: string,
  userId: string,
  include?: Prisma.DebtInclude
): Promise<Debt | null>
// prisma.debt.findFirst({ where: { id, userId }, include })

export async function countByUser(userId: string): Promise<number>
// prisma.debt.count({ where: { userId } })

export async function update(id: string, data: Prisma.DebtUpdateInput): Promise<Debt>
// prisma.debt.update({ where: { id }, data })

export async function remove(id: string): Promise<void>
// prisma.debt.delete({ where: { id } })
```

---

### `src/repositories/budget.repository.ts`

```typescript
export async function findAllByUserAndPeriod(
  userId: string,
  month: number,
  year: number,
  include?: Prisma.BudgetInclude
): Promise<Budget[]>
// prisma.budget.findMany({ where: { userId, month, year }, include, orderBy: { category: { name: 'asc' } } })

export async function findByIdAndUser(
  id: string,
  userId: string,
  include?: Prisma.BudgetInclude
): Promise<Budget | null>
// prisma.budget.findFirst({ where: { id, userId }, include })

export async function findFirst(where: Prisma.BudgetWhereInput): Promise<Budget | null>
// prisma.budget.findFirst({ where })

export async function create(
  data: Prisma.BudgetCreateInput,
  include?: Prisma.BudgetInclude
): Promise<Budget>
// prisma.budget.create({ data, include })

export async function update(
  id: string,
  data: Prisma.BudgetUpdateInput,
  include?: Prisma.BudgetInclude
): Promise<Budget>
// prisma.budget.update({ where: { id }, data, include })

export async function remove(id: string): Promise<Budget>
// prisma.budget.delete({ where: { id } })
```

---

### `src/repositories/notification.repository.ts`

```typescript
export async function findAllByUser(userId: string): Promise<Notification[]>
// prisma.notification.findMany({ where: { userId }, orderBy: { createdAt: 'desc' }, take: 50 })

export async function countUnread(userId: string): Promise<number>
// prisma.notification.count({ where: { userId, read: false } })

export async function findByIdAndUser(id: string, userId: string): Promise<Notification | null>
// prisma.notification.findFirst({ where: { id, userId } })

export async function findFirst(where: Prisma.NotificationWhereInput): Promise<Notification | null>
// prisma.notification.findFirst({ where })

export async function create(data: Prisma.NotificationCreateInput): Promise<Notification>
// prisma.notification.create({ data })

export async function update(id: string, data: Prisma.NotificationUpdateInput): Promise<Notification>
// prisma.notification.update({ where: { id }, data })

export async function updateMany(
  where: Prisma.NotificationWhereInput,
  data: Prisma.NotificationUpdateManyMutationInput
): Promise<Prisma.BatchPayload>
// prisma.notification.updateMany({ where, data })

export async function remove(id: string): Promise<Notification>
// prisma.notification.delete({ where: { id } })
```

---

### `src/repositories/fixed-expense.repository.ts`

```typescript
export async function findAllByUser(
  userId: string,
  filters?: Prisma.FixedExpenseWhereInput,
  include?: Prisma.FixedExpenseInclude,
  orderBy?: Prisma.FixedExpenseOrderByWithRelationInput[]
): Promise<FixedExpense[]>
// prisma.fixedExpense.findMany({ where: { userId, ...filters }, include, orderBy })

export async function findByIdAndUser(
  id: string,
  userId: string,
  include?: Prisma.FixedExpenseInclude
): Promise<FixedExpense | null>
// prisma.fixedExpense.findFirst({ where: { id, userId }, include })

export async function findFirst(
  where: Prisma.FixedExpenseWhereInput
): Promise<FixedExpense | null>
// prisma.fixedExpense.findFirst({ where })

export async function countByUser(userId: string): Promise<number>
// prisma.fixedExpense.count({ where: { userId } })

export async function create(
  data: Prisma.FixedExpenseCreateInput,
  include?: Prisma.FixedExpenseInclude
): Promise<FixedExpense>
// prisma.fixedExpense.create({ data, include })

export async function update(
  id: string,
  data: Prisma.FixedExpenseUpdateInput,
  include?: Prisma.FixedExpenseInclude
): Promise<FixedExpense>
// prisma.fixedExpense.update({ where: { id }, data, include })

export async function remove(id: string): Promise<FixedExpense>
// prisma.fixedExpense.delete({ where: { id } })
```

---

### `src/repositories/tag.repository.ts`

```typescript
export async function findAllByUser(
  userId: string,
  nameFilter?: string,
  include?: Prisma.TagInclude
): Promise<Tag[]>
// prisma.tag.findMany({ where: { userId, ...(nameFilter ? { name: { contains: nameFilter, mode: 'insensitive' } } : {}) }, orderBy: { name: 'asc' }, include })

export async function findByIdAndUser(id: string, userId: string): Promise<Tag | null>
// prisma.tag.findFirst({ where: { id, userId } })

export async function upsert(
  userId: string,
  name: string
): Promise<Tag>
// prisma.tag.upsert({ where: { userId_name: { userId, name } }, update: {}, create: { name, userId } })

export async function remove(id: string): Promise<Tag>
// prisma.tag.delete({ where: { id } })
```

---

### `src/repositories/recurring-debt-payment.repository.ts`

```typescript
export async function create(
  data: Prisma.RecurringDebtPaymentCreateInput,
  include?: Prisma.RecurringDebtPaymentInclude
): Promise<RecurringDebtPayment>
// prisma.recurringDebtPayment.create({ data, include })

export async function findAllByUser(
  userId: string,
  debtId?: string,
  include?: Prisma.RecurringDebtPaymentInclude
): Promise<RecurringDebtPayment[]>
// prisma.recurringDebtPayment.findMany({ where: { userId, ...(debtId && { debtId }) }, include, orderBy: [{ isActive: 'desc' }, { nextDueDate: 'asc' }] })

export async function findByIdAndUser(
  id: string,
  userId: string,
  include?: Prisma.RecurringDebtPaymentInclude
): Promise<RecurringDebtPayment | null>
// prisma.recurringDebtPayment.findFirst({ where: { id, userId }, include })

export async function findFirst(
  where: Prisma.RecurringDebtPaymentWhereInput
): Promise<RecurringDebtPayment | null>
// prisma.recurringDebtPayment.findFirst({ where })

export async function findUnique(id: string): Promise<RecurringDebtPayment | null>
// prisma.recurringDebtPayment.findUnique({ where: { id } })

export async function findDuePayments(
  today: Date,
  include?: Prisma.RecurringDebtPaymentInclude
): Promise<RecurringDebtPayment[]>
// prisma.recurringDebtPayment.findMany({ where: { isActive: true, nextDueDate: { lte: today }, debt: { status: { not: 'paid' } } }, include })

export async function update(
  id: string,
  data: Prisma.RecurringDebtPaymentUpdateInput,
  include?: Prisma.RecurringDebtPaymentInclude
): Promise<RecurringDebtPayment>
// prisma.recurringDebtPayment.update({ where: { id }, data, include })

export async function remove(id: string): Promise<void>
// prisma.recurringDebtPayment.delete({ where: { id } })
```

---

### `src/repositories/user.repository.ts`

```typescript
export async function findByEmail(email: string): Promise<User | null>
// prisma.user.findUnique({ where: { email } })

export async function findById(
  id: string,
  select?: Prisma.UserSelect
): Promise<User | null>
// prisma.user.findUnique({ where: { id }, select })

export async function findFirst(where: Prisma.UserWhereInput): Promise<User | null>
// prisma.user.findFirst({ where })

export async function create(data: Prisma.UserCreateInput): Promise<User>
// prisma.user.create({ data })

export async function update(
  id: string,
  data: Prisma.UserUpdateInput,
  select?: Prisma.UserSelect
): Promise<User>
// prisma.user.update({ where: { id }, data, select })

export async function remove(id: string): Promise<User>
// prisma.user.delete({ where: { id } })
```

---

### `src/repositories/credit-card-payment.repository.ts`

```typescript
export async function findFirst(
  where: Prisma.CreditCardPaymentWhereInput
): Promise<CreditCardPayment | null>
// prisma.creditCardPayment.findFirst({ where })

export async function create(data: Prisma.CreditCardPaymentCreateInput): Promise<CreditCardPayment>
// prisma.creditCardPayment.create({ data })
```

---

## Archivos a tocar

| Archivo | Cambio |
|---------|--------|
| `src/repositories/account.repository.ts` | Crear |
| `src/repositories/transaction.repository.ts` | Crear |
| `src/repositories/category.repository.ts` | Crear |
| `src/repositories/debt.repository.ts` | Crear |
| `src/repositories/budget.repository.ts` | Crear |
| `src/repositories/notification.repository.ts` | Crear |
| `src/repositories/fixed-expense.repository.ts` | Crear |
| `src/repositories/tag.repository.ts` | Crear |
| `src/repositories/recurring-debt-payment.repository.ts` | Crear |
| `src/repositories/user.repository.ts` | Crear |
| `src/repositories/credit-card-payment.repository.ts` | Crear |

Ningún service existente se modifica en esta tarea.

---

## Convenciones de cada archivo

Cada repository sigue esta estructura:

```typescript
import { prisma } from '../lib/prisma.js';
import type { Prisma, <ModelName> } from '@prisma/client';
// Solo si lanza errores:
// import { NotFoundError } from '../lib/errors.js';

export async function findByIdAndUser(id: string, userId: string): Promise<ModelName | null> {
  return prisma.<model>.findFirst({ where: { id, userId } });
}
// ... demás funciones
```

Reglas:
- Solo `import { prisma }` y tipos de `@prisma/client` — ningún otro import del proyecto
- Named exports individuales — sin clase, sin objeto, sin default export
- Sin lógica de negocio — una función = una operación Prisma
- Los tipos de retorno son los tipos Prisma directos (no se wrappean)
- Los parámetros `include?` y `select?` son opcionales — el caller decide qué fields necesita

---

## Propuesta

1. Crear el directorio `src/repositories/` (si no existe).
2. Crear los 11 archivos en orden: empezar por los más simples (`user`, `tag`, `credit-card-payment`), luego los medianos (`category`, `budget`, `notification`), luego los complejos (`account`, `transaction`, `debt`, `fixed-expense`, `recurring-debt-payment`).
3. Cada archivo se crea completo y compila de forma independiente — no hay dependencias entre repositories.
4. Ejecutar `npx tsc --noEmit` al final — 0 errores requerido.

No se toca ningún service. No se crean barrel exports (`index.ts`). Los consumers (services en REFACTOR-BE-007) importarán directamente desde `'../repositories/<entity>.repository.js'`.

---

## Fuera de scope

- Modificar cualquier service existente — eso es REFACTOR-BE-007.
- Crear un `src/repositories/index.ts` barrel — genera acoplamiento innecesario.
- Extraer queries internas de `prisma.$transaction` en `debts.service.ts` y `fixed-expenses.service.ts` — el bloque atómico permanece en el service; el repository no puede wrappear una transacción que orquesta múltiples modelos.
- Añadir lógica de negocio en repositories (validaciones de ownership que lanzan, cálculos, etc.) — solo si es `findByIdAndUser` que puede retornar `null` o no (el service decide si lanzar `NotFoundError`).
- Modificar el schema de Prisma.
- Crear tests.

---

## Preguntas abiertas

Ninguna. El scope está completamente definido por el código existente y los SPECs aprobados.
