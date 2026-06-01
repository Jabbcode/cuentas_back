# SPEC: REFACTOR-BE-007 — Migrar services para consumir repositories

## Qué se pide

Eliminar `import { prisma }` de todos los services que lo usan hoy. Cada llamada a `prisma.X.method(...)` se reemplaza por la función equivalente del repository creado en REFACTOR-BE-006. Los bloques `prisma.$transaction(...)` que orquestan múltiples modelos permanecen en el service — no se migran.

---

## Contexto de Notion (tareas Done relacionadas)

- [REFACTOR-BE-006] — Creó los 11 repositories con sus firmas exactas. Este SPEC se basa exclusivamente en esas firmas. Ninguna query nueva se inventará.

---

## Contexto de código

- `src/lib/prisma.ts` — Exporta `prisma`. Al terminar esta tarea ningún service debe importarlo.
- `src/repositories/*.ts` — Los 11 repositories creados en BE-006. Cada service los importa directamente desde su ruta (no hay barrel index).
- `src/services/*.ts` — 15 services a modificar. Ver detalle por service abajo.

---

## Gaps identificados (queries sin método en el repository)

Las siguientes queries existen en los services pero NO tienen método en el repository de BE-006. El builder debe tratarlas como **permanecen en el service con `prisma` local**:

| Service | Query sin equivalente | Razón |
|---------|----------------------|-------|
| `tags.service.ts` | `prisma.tag.findMany` con `include: { transactions: { include: { transaction } } }` (en `getTagsSummary`) | El repository solo define `findAllByUser` con `include?: Prisma.TagInclude` — es compatible, usar el repo con ese include |
| `fixed-expenses.service.ts` | `prisma.fixedExpense.findMany` con `include: { user: { select: { id: true } } }` (en `autoGenerateFixedExpenseTransactions`) | `findAllByUser` del repo requiere `userId` — aquí la query busca **todos** los usuarios. Es una query global de cron. **Permanece con prisma local.** |
| `fixed-expenses.service.ts` | `prisma.recurringDebtPayment.findMany` con `include: { debt }` (en `syncRecurringDebtPaymentFixedExpenses`) | `findAllByUser` del repo acepta `include` — es compatible, usar el repo |
| `dashboard.service.ts` | `prisma.account.findMany` con `select` (no `include`) | `findAllByUser` retorna `Account[]` completo. El service hace `.select` — **usar el repo y filtrar en memoria** (ya lo hace hoy para los campos `balance`, `type`, `creditLimit`) |
| `receipts.service.ts` | `prisma.transaction.findFirst` con `include: { account, category }` | `findFirst(where, include?)` del repo lo soporta — es compatible |
| `settings.service.ts` | `prisma.transaction.findFirst` con `orderBy` y `select: { date }` | `findFirstByUser(userId, orderBy)` del repo lo cubre — es compatible |

**Único gap real que requiere `prisma` local en el service:**

- `fixed-expenses.service.ts` → función `autoGenerateFixedExpenseTransactions`: usa `prisma.fixedExpense.findMany` sin filtro de `userId` (busca todos los users). Este patrón no tiene equivalente en `fixed-expense.repository.ts` (que siempre filtra por `userId`). **Esta query permanece con `prisma` directo** — el service mantiene `import { prisma }` solo para esta función.

---

## Mapeo por service

### `src/services/accounts.service.ts`

**Import eliminar:** `import { prisma } from '../lib/prisma.js'`

**Imports nuevos:**
```
import * as accountRepo from '../repositories/account.repository.js'
```

| Línea actual | Reemplazar por |
|---|---|
| `prisma.account.findMany({ where: { userId }, orderBy: { createdAt: 'desc' } })` | `accountRepo.findAllByUser(userId)` |
| `prisma.account.findFirst({ where: { id, userId } })` en `getAccountById` | `accountRepo.findByIdAndUser(id, userId)` |
| `prisma.account.create({ data: { ...data, userId } })` | `accountRepo.create({ ...data, userId })` |
| `prisma.account.update({ where: { id }, data })` en `updateAccount` | `accountRepo.update(id, data)` |
| `prisma.account.delete({ where: { id } })` en `deleteAccount` | `accountRepo.remove(id)` |
| `prisma.account.findFirst({ where: { id: fromAccountId, userId } })` en `transferFunds` | `accountRepo.findByIdAndUser(fromAccountId, userId)` |
| `prisma.account.findFirst({ where: { id: toAccountId, userId } })` en `transferFunds` | `accountRepo.findByIdAndUser(toAccountId, userId)` |
| `prisma.transfer.findMany({ where: { userId, OR: [...] }, include: ..., orderBy })` en `getTransfersByAccount` | `accountRepo.findTransfersByAccount(accountId, userId)` |
| `prisma.account.findFirst({ where: { id: accountId, userId } })` en `updateAccountBalance` | `accountRepo.findByIdAndUser(accountId, userId)` |
| `prisma.account.update({ where: { id: accountId }, data: { balance: newBalance } })` en `updateAccountBalance` | `accountRepo.updateBalance(accountId, newBalance)` |

**Permanece con prisma (dentro de `$transaction`):**
El bloque `prisma.$transaction(async (tx) => { tx.account.update x2 + tx.transfer.create })` en `transferFunds` permanece intacto — usa el cliente de transacción `tx`, no `prisma` directamente.

---

### `src/services/transactions.service.ts`

**Import eliminar:** `import { prisma } from '../lib/prisma.js'`

**Imports nuevos:**
```
import * as transactionRepo from '../repositories/transaction.repository.js'
import * as categoryRepo from '../repositories/category.repository.js'
```

| Línea actual | Reemplazar por |
|---|---|
| `prisma.transaction.findMany({ where, include: {...}, orderBy: { date: 'desc' }, take: limit, skip: offset })` en `getTransactions` | `transactionRepo.findMany(where, { include: {...}, orderBy: { date: 'desc' }, take: limit, skip: offset })` |
| `prisma.transaction.count({ where })` en `getTransactions` | `transactionRepo.count(where)` |
| `prisma.transaction.findFirst({ where: { id, userId }, include: {...} })` en `getTransactionById` | `transactionRepo.findByIdAndUser(id, userId, include)` |
| `prisma.transaction.create({ data: {...}, include: {...} })` en `createTransaction` | `transactionRepo.create(data, include)` |
| `prisma.transaction.update({ where: { id }, data: updateData, include: {...} })` en `updateTransaction` | `transactionRepo.update(id, updateData, include)` |
| `prisma.transaction.delete({ where: { id } })` en `deleteTransaction` | `transactionRepo.remove(id)` |
| `prisma.transaction.groupBy({ by: ['categoryId', 'type'], where, _sum: {...}, _count: {...} })` en `getTransactionSummary` | `transactionRepo.groupByCategory(where)` |
| `prisma.category.findMany({ where: { id: { in: categoryIds } }, select: {...} })` en `getTransactionSummary` | `categoryRepo.findMany({ id: { in: categoryIds } }, select)` |
| `prisma.receiptItem.findMany({ where: { transactionId }, orderBy: { createdAt: 'asc' } })` en `getReceiptItems` | `transactionRepo.findReceiptItems(transactionId)` |

**Nota:** `getTransactionSummary` construye `where` como `Record<string, unknown>` — al pasar a `transactionRepo.groupByCategory(where)` el tipo debe ser `Prisma.TransactionWhereInput`. Hacer cast explícito: `transactionRepo.groupByCategory(where as Prisma.TransactionWhereInput)`. Agregar `import type { Prisma } from '@prisma/client'`.

---

### `src/services/categories.service.ts`

**Import eliminar:** `import { prisma } from '../lib/prisma.js'`

**Imports nuevos:**
```
import * as categoryRepo from '../repositories/category.repository.js'
import * as transactionRepo from '../repositories/transaction.repository.js'
```

| Línea actual | Reemplazar por |
|---|---|
| `prisma.category.findMany({ where: { userId, ...(type && { type }) }, orderBy: { name: 'asc' } })` en `getCategories` | `categoryRepo.findAllByUser(userId, type)` |
| `prisma.category.findFirst({ where: { id, userId } })` en `getCategoryById` | `categoryRepo.findByIdAndUser(id, userId)` |
| `prisma.category.create({ data: { ...data, userId } })` | `categoryRepo.create({ ...data, userId })` |
| `prisma.category.update({ where: { id }, data })` | `categoryRepo.update(id, data)` |
| `prisma.transaction.count({ where: { categoryId: id } })` en `deleteCategory` | `transactionRepo.count({ categoryId: id })` |
| `prisma.category.delete({ where: { id } })` | `categoryRepo.remove(id)` |
| `prisma.transaction.findMany({ where: { categoryId, userId, type: 'expense', date: {...} } })` en `getCategorySpending` | `transactionRepo.findMany({ categoryId, userId, type: 'expense', date: {...} })` |

---

### `src/services/debts.service.ts`

**Import eliminar:** `import { prisma } from '../lib/prisma.js'`

**Imports nuevos:**
```
import * as debtRepo from '../repositories/debt.repository.js'
import * as accountRepo from '../repositories/account.repository.js'
import * as recurringRepo from '../repositories/recurring-debt-payment.repository.js'
import * as fixedExpenseRepo from '../repositories/fixed-expense.repository.js'
import * as transactionRepo from '../repositories/transaction.repository.js'
```

| Línea actual | Reemplazar por |
|---|---|
| `prisma.debt.create({ data: { userId, creditor, ... } })` en `createDebt` | `debtRepo.create({ userId, creditor, ... })` |
| `prisma.debt.findMany({ where, include: { payments, _count }, orderBy })` en `getDebts` | `debtRepo.findAllByUser(where, include)` |
| `prisma.debt.findFirst({ where: { id: debtId, userId }, include: { payments } })` en `getDebtById` | `debtRepo.findByIdAndUser(debtId, userId, include)` |
| `prisma.debt.findFirst({ where: { id: debtId, userId } })` en `updateDebt` | `debtRepo.findByIdAndUser(debtId, userId)` |
| `prisma.debt.update({ where: { id: debtId }, data: {...} })` en `updateDebt` | `debtRepo.update(debtId, data)` |
| `prisma.debt.findFirst({ where: { id: debtId, userId } })` en `deleteDebt` | `debtRepo.findByIdAndUser(debtId, userId)` |
| `prisma.debt.delete({ where: { id: debtId } })` en `deleteDebt` | `debtRepo.remove(debtId)` |
| `prisma.recurringDebtPayment.findFirst({ where: { debtId, isActive: true, frequency: 'monthly' } })` en `handleRecurringPaymentSideEffects` | `recurringRepo.findFirst({ debtId, isActive: true, frequency: 'monthly' })` |
| `prisma.recurringDebtPayment.update({ where: { id }, data: { nextDueDate, lastProcessed } })` en `handleRecurringPaymentSideEffects` | `recurringRepo.update(recurringPayment.id, { nextDueDate: newNextDueDate, lastProcessed: new Date() })` |
| `prisma.fixedExpense.findFirst({ where: { userId, recurringDebtPaymentId: recurringPayment.id, isActive: true } })` en `handleRecurringPaymentSideEffects` | `fixedExpenseRepo.findFirst({ userId, recurringDebtPaymentId: recurringPayment.id, isActive: true })` |
| `prisma.transaction.findFirst({ where: { fixedExpenseId: fixedExpense.id, date: { gte, lte } } })` en `handleRecurringPaymentSideEffects` | `transactionRepo.findFirst({ fixedExpenseId: fixedExpense.id, date: { gte: startOfMonth, lte: endOfMonth } })` |
| `prisma.debt.findFirst({ where: { id: debtId, userId } })` en `payDebt` | `debtRepo.findByIdAndUser(debtId, userId)` |
| `prisma.account.findFirst({ where: { id: data.accountId, userId } })` en `payDebt` | `accountRepo.findByIdAndUser(data.accountId, userId)` |
| `prisma.debt.findMany({ where: { userId } })` en `getDebtsSummary` | `debtRepo.findAllByUser({ userId })` |

**Permanece con prisma (dentro de `$transaction` en `payDebt`):**
```
prisma.$transaction(async (tx) => {
  tx.category.findFirst / tx.category.create
  tx.transaction.create
  tx.account.update
  tx.debtPayment.create
  tx.debt.update
})
```
Este bloque es atómico y permanece intacto — usa `tx` interno.

---

### `src/services/budgets.service.ts`

**Import eliminar:** `import { prisma } from '../lib/prisma.js'`

**Imports nuevos:**
```
import * as budgetRepo from '../repositories/budget.repository.js'
import * as transactionRepo from '../repositories/transaction.repository.js'
import * as notificationRepo from '../repositories/notification.repository.js'
import * as userRepo from '../repositories/user.repository.js'
```

| Línea actual | Reemplazar por |
|---|---|
| `prisma.budget.findMany({ where: { userId, month, year }, include: { category }, orderBy })` en `getBudgets` | `budgetRepo.findAllByUserAndPeriod(userId, month, year, { category: categorySelect })` |
| `prisma.transaction.groupBy({ by: ['categoryId'], where: {...}, _sum: { amount } })` en `getBudgets` | `transactionRepo.groupByCategory({ userId, type: 'expense', date: {...}, categoryId: { in: [...] } })` — nota: este groupBy usa `by: ['categoryId']` solamente, distinto al definido en el repo (`by: ['categoryId', 'type']`). **Ver gap abajo.** |
| `prisma.budget.findFirst({ where: { id, userId }, include: { category } })` en `getBudgetById` | `budgetRepo.findByIdAndUser(id, userId, { category: categorySelect })` |
| `prisma.budget.findFirst({ where: { userId, categoryId, month, year } })` en `createBudget` | `budgetRepo.findFirst({ userId, categoryId, month: data.month, year: data.year })` |
| `prisma.budget.create({ data: { ...data, userId }, include: { category } })` | `budgetRepo.create({ ...data, userId }, { category: categorySelect })` |
| `prisma.budget.update({ where: { id }, data, include: { category } })` | `budgetRepo.update(id, data, { category: categorySelect })` |
| `prisma.budget.delete({ where: { id } })` | `budgetRepo.remove(id)` |
| `prisma.user.findUnique({ where: { id: userId }, select: { notificationPreferences } })` en `checkBudgetAndNotify` | `userRepo.findById(userId, { notificationPreferences: true })` |
| `prisma.budget.findFirst({ where: { userId, categoryId, month, year }, include: { category: { select: { name } } } })` en `checkBudgetAndNotify` | `budgetRepo.findFirst({ userId, categoryId, month, year })` — y luego acceder a `budget.category.name`. **Nota:** `findFirst` del repo no acepta `include` — si se necesita el nombre de la categoría, hacer segundo fetch o usar `findByIdAndUser` con include. Alternativa: pasar `include` como segundo arg si se ajusta la firma. **Usar `budgetRepo.findFirst` y hacer fetch separado de categoría si es necesario, o usar `findAllByUserAndPeriod` con el filtro.** |
| `prisma.transaction.aggregate({ where: {...}, _sum: { amount } })` en `checkBudgetAndNotify` | `transactionRepo.aggregate({ userId, categoryId, type: 'expense', date: { gte, lte } })` |
| `prisma.notification.findFirst({ where: { userId, type, metadata: {...}, createdAt: { gte } } })` en `checkBudgetAndNotify` | `notificationRepo.findFirst({ userId, type: 'category_limit', metadata: { path: ['categoryId'], equals: categoryId }, createdAt: { gte: startOfMonth } })` |

**Gap en `getBudgets`:** `prisma.transaction.groupBy` usa `by: ['categoryId']` (sin `type`). El método `transactionRepo.groupByCategory` agrupa `by: ['categoryId', 'type']` — retorna registros adicionales. El service actual sí itera por `type` en el resultado (`row.type === 'expense'`). Son compatibles — usar `transactionRepo.groupByCategory(where)` sin cambios en la lógica de iteración.

**Gap en `checkBudgetAndNotify` — `budget.category.name`:** `budgetRepo.findFirst` no tiene parámetro `include`. Para obtener el nombre de la categoría, cambiar a `budgetRepo.findByIdAndUser` NO aplica (no se tiene `id`). Solución: tras obtener el budget con `findFirst`, hacer `categoryRepo.findByIdAndUser(budget.categoryId, userId)` para obtener el nombre. Agregar `import * as categoryRepo from '../repositories/category.repository.js'`.

---

### `src/services/notifications.service.ts`

**Import eliminar:** `import { prisma } from '../lib/prisma.js'`

**Imports nuevos:**
```
import * as notificationRepo from '../repositories/notification.repository.js'
import * as userRepo from '../repositories/user.repository.js'
```

| Línea actual | Reemplazar por |
|---|---|
| `prisma.notification.findMany({ where: { userId }, orderBy: { createdAt: 'desc' }, take: 50 })` | `notificationRepo.findAllByUser(userId)` |
| `prisma.notification.count({ where: { userId, read: false } })` | `notificationRepo.countUnread(userId)` |
| `prisma.notification.findFirst({ where: { id, userId } })` en `markAsRead` | `notificationRepo.findByIdAndUser(id, userId)` |
| `prisma.notification.update({ where: { id }, data: { read: true } })` | `notificationRepo.update(id, { read: true })` |
| `prisma.notification.updateMany({ where: { userId, read: false }, data: { read: true } })` | `notificationRepo.updateMany({ userId, read: false }, { read: true })` |
| `prisma.notification.findFirst({ where: { id, userId } })` en `deleteNotification` | `notificationRepo.findByIdAndUser(id, userId)` |
| `prisma.notification.delete({ where: { id } })` | `notificationRepo.remove(id)` |
| `prisma.notification.create({ data: { userId, type, title, message, metadata } })` | `notificationRepo.create({ userId, type, title, message, ...(metadata !== undefined ? { metadata: metadata as ... } : {}) })` |
| `prisma.user.findUnique({ where: { id: userId }, select: { notificationPreferences } })` en `getPreferences` | `userRepo.findById(userId, { notificationPreferences: true })` |
| `prisma.user.update({ where: { id: userId }, data: { notificationPreferences: updated } })` en `updatePreferences` | `userRepo.update(userId, { notificationPreferences: updated })` |

---

### `src/services/fixed-expenses.service.ts`

**Import eliminar:** `import { prisma } from '../lib/prisma.js'` — **EXCEPTO** para `autoGenerateFixedExpenseTransactions` (ver gap). El import de prisma se mantiene solo para esa función.

**Imports nuevos:**
```
import * as fixedExpenseRepo from '../repositories/fixed-expense.repository.js'
import * as transactionRepo from '../repositories/transaction.repository.js'
import * as recurringRepo from '../repositories/recurring-debt-payment.repository.js'
import * as accountRepo from '../repositories/account.repository.js'
import * as categoryRepo from '../repositories/category.repository.js'
```

| Línea actual | Reemplazar por |
|---|---|
| `prisma.fixedExpense.findMany({ where: { userId, ...(activeOnly && { isActive: true }) }, include, orderBy })` en `getFixedExpenses` | `fixedExpenseRepo.findAllByUser(userId, activeOnly ? { isActive: true } : undefined, include, [{ dueDay: 'asc' }])` |
| `prisma.fixedExpense.findFirst({ where: { id, userId }, include: {...} })` en `getFixedExpenseById` | `fixedExpenseRepo.findByIdAndUser(id, userId, include)` |
| `prisma.fixedExpense.create({ data: { ...data, userId }, include })` en `createFixedExpense` | `fixedExpenseRepo.create({ ...data, userId }, include)` |
| `prisma.transaction.updateMany({ where: { fixedExpenseId: id, userId }, data: transactionUpdates })` en `updateFixedExpense` | `transactionRepo.updateMany({ fixedExpenseId: id, userId }, transactionUpdates)` |
| `prisma.recurringDebtPayment.findUnique({ where: { id: existingExpense.recurringDebtPaymentId } })` en `updateFixedExpense` | `recurringRepo.findUnique(existingExpense.recurringDebtPaymentId)` |
| `prisma.recurringDebtPayment.update({ where: { id }, data: recurringPaymentUpdates })` en `updateFixedExpense` | `recurringRepo.update(existingExpense.recurringDebtPaymentId, recurringPaymentUpdates)` |
| `prisma.fixedExpense.update({ where: { id }, data, include })` en `updateFixedExpense` | `fixedExpenseRepo.update(id, data, include)` |
| `prisma.fixedExpense.delete({ where: { id } })` en `deleteFixedExpense` | `fixedExpenseRepo.remove(id)` |
| `prisma.recurringDebtPayment.findUnique({ where: { id: fixedExpense.recurringDebtPaymentId } })` en `payFixedExpense` | `recurringRepo.findUnique(fixedExpense.recurringDebtPaymentId)` |
| `prisma.fixedExpense.findMany({ where: { isActive: true, autoGenerate: true, dueDay: todayDay }, include: { user } })` en `autoGenerateFixedExpenseTransactions` | **PERMANECE con `prisma` directo** (query multi-user sin userId) |
| `prisma.transaction.findFirst({ where: { fixedExpenseId, userId, date: { gte, lte } } })` en `autoGenerateFixedExpenseTransactions` | **PERMANECE con `prisma` directo** (dentro del mismo loop multi-user) |
| `prisma.fixedExpense.findMany({ where: { userId }, include: { account, category, transactions } orderBy })` en `getFixedExpensesSummary` | `fixedExpenseRepo.findAllByUser(userId, undefined, include, [{ sortOrder: 'asc' }, { dueDay: 'asc' }])` |
| `prisma.account.findMany({ where: { userId, type: 'credit_card', paymentAccountId: { not: null }, cutoffDay: { not: null }, paymentDueDay: { not: null } } })` en `syncCreditCardFixedExpenses` | `accountRepo.findCreditCardsByUser(userId, { paymentAccountId: { not: null }, cutoffDay: { not: null }, paymentDueDay: { not: null } })` |
| `prisma.category.findFirst({ where: { userId, name: 'Pago de Tarjeta', type: 'expense' } })` en `syncCreditCardFixedExpenses` | `categoryRepo.findFirst({ userId, name: 'Pago de Tarjeta', type: 'expense' })` |
| `prisma.category.create({ data: { name: 'Pago de Tarjeta', ... } })` | `categoryRepo.create({ name: 'Pago de Tarjeta', type: 'expense', icon: '💳', color: '#8B5CF6', userId })` |
| `prisma.fixedExpense.findFirst({ where: { userId, creditCardAccountId: card.id } })` | `fixedExpenseRepo.findFirst({ userId, creditCardAccountId: card.id })` |
| `prisma.fixedExpense.update({ where: { id: existingFixedExpense.id }, data: {...} })` (en sync CC, rama shouldShow + rama deactivate) | `fixedExpenseRepo.update(existingFixedExpense.id, data)` |
| `prisma.fixedExpense.create({ data: { name: 'Pago Tarjeta ...', ... } })` | `fixedExpenseRepo.create(data)` |
| `prisma.recurringDebtPayment.findMany({ where: { userId, isActive: true, frequency: 'monthly' }, include: { debt } })` en `syncRecurringDebtPaymentFixedExpenses` | `recurringRepo.findAllByUser(userId, undefined, { debt: { select: { id, creditor, description, status } } })` |
| `prisma.category.findFirst({ where: { userId, name: 'Pago de Deuda', type: 'expense' } })` | `categoryRepo.findFirst({ userId, name: 'Pago de Deuda', type: 'expense' })` |
| `prisma.category.create({ data: { name: 'Pago de Deuda', ... } })` | `categoryRepo.create({ name: 'Pago de Deuda', type: 'expense', icon: '💰', color: '#F59E0B', userId })` |
| `prisma.fixedExpense.findFirst({ where: { userId, recurringDebtPaymentId: payment.id } })` (x2 en sync recurring) | `fixedExpenseRepo.findFirst({ userId, recurringDebtPaymentId: payment.id })` |
| `prisma.fixedExpense.update(...)` (rama deactivate en sync recurring) | `fixedExpenseRepo.update(existingFixedExpense.id, { isActive: false })` |
| `prisma.fixedExpense.update(...)` (rama update en sync recurring) | `fixedExpenseRepo.update(existingFixedExpense.id, fixedExpenseData)` |
| `prisma.fixedExpense.create(...)` (rama create en sync recurring) | `fixedExpenseRepo.create({ ...fixedExpenseData, recurringDebtPaymentId: payment.id, userId })` |
| `prisma.fixedExpense.findMany({ where: { id: { in: itemIds }, userId }, select: { id } })` en `reorderFixedExpenses` | `fixedExpenseRepo.findAllByUser(userId, { id: { in: itemIds } }, { id: true } as unknown as Prisma.FixedExpenseInclude)` — **GAP**: `findAllByUser` acepta `select` via `include`? No — `include` y `select` son distintos en Prisma. Esta query usa `select: { id: true }`. **Usar `transactionRepo.findMany` no aplica. Opción: llamar `fixedExpenseRepo.findAllByUser(userId, { id: { in: itemIds } })` sin select y filtrar ids en memoria.** El resultado es equivalente para la validación de ownership. |
| `prisma.$transaction(itemOrders.map(...))` en `reorderFixedExpenses` | **PERMANECE con `prisma` directo** (batch de updates en una sola transacción) |

**Conclusión para `fixed-expenses.service.ts`:** El service mantiene `import { prisma }` para dos casos: `autoGenerateFixedExpenseTransactions` (query multi-user) y `reorderFixedExpenses` `$transaction` batch. El resto migra a repositories.

---

### `src/services/tags.service.ts`

**Import eliminar:** `import { prisma } from '../lib/prisma.js'`

**Imports nuevos:**
```
import * as tagRepo from '../repositories/tag.repository.js'
```

| Línea actual | Reemplazar por |
|---|---|
| `prisma.tag.findMany({ where: { userId, ...(nameFilter ? {...} : {}) }, orderBy, include: { _count } })` en `getTags` | `tagRepo.findAllByUser(userId, nameFilter, { _count: { select: { transactions: true } } })` |
| `prisma.tag.findMany({ where: { userId }, include: { transactions: { include: { transaction } } }, orderBy })` en `getTagsSummary` | `tagRepo.findAllByUser(userId, undefined, { transactions: { include: { transaction: { select: { amount: true, type: true } } } } })` |
| `prisma.tag.findFirst({ where: { id, userId } })` en `deleteTag` | `tagRepo.findByIdAndUser(id, userId)` |
| `prisma.tag.delete({ where: { id } })` | `tagRepo.remove(id)` |
| `prisma.tag.upsert({ where: { userId_name: { userId, name } }, update: {}, create: {...} })` en `upsertTags` | `tagRepo.upsert(userId, name.trim().toLowerCase())` — el loop existente ya itera sobre `names`, reemplazar el body del for con esta llamada |

---

### `src/services/recurring-debt-payments.service.ts`

**Import eliminar:** `import { prisma } from '../lib/prisma.js'`

**Imports nuevos:**
```
import * as recurringRepo from '../repositories/recurring-debt-payment.repository.js'
import * as debtRepo from '../repositories/debt.repository.js'
import * as accountRepo from '../repositories/account.repository.js'
```

| Línea actual | Reemplazar por |
|---|---|
| `prisma.debt.findFirst({ where: { id: data.debtId, userId } })` en `createRecurringDebtPayment` | `debtRepo.findByIdAndUser(data.debtId, userId)` |
| `prisma.account.findFirst({ where: { id: data.accountId, userId } })` | `accountRepo.findByIdAndUser(data.accountId, userId)` |
| `prisma.recurringDebtPayment.create({ data: {...}, include: { account, debt } })` | `recurringRepo.create(data, { account: { select: {...} }, debt: { select: {...} } })` |
| `prisma.recurringDebtPayment.findMany({ where, include: { account, debt }, orderBy })` en `getRecurringDebtPayments` | `recurringRepo.findAllByUser(userId, debtId, { account: { select: {...} }, debt: { select: {...} } })` |
| `prisma.recurringDebtPayment.findFirst({ where: { id, userId }, include: { account, debt } })` en `getRecurringDebtPaymentById` | `recurringRepo.findByIdAndUser(id, userId, { account: { select: {...} }, debt: { select: {...} } })` |
| `prisma.recurringDebtPayment.findFirst({ where: { id, userId } })` en `updateRecurringDebtPayment` | `recurringRepo.findByIdAndUser(id, userId)` |
| `prisma.recurringDebtPayment.update({ where: { id }, data: {...}, include })` | `recurringRepo.update(id, data, include)` |
| `prisma.recurringDebtPayment.findFirst({ where: { id, userId } })` en `deleteRecurringDebtPayment` | `recurringRepo.findByIdAndUser(id, userId)` |
| `prisma.recurringDebtPayment.delete({ where: { id } })` | `recurringRepo.remove(id)` |
| `prisma.recurringDebtPayment.findMany({ where: { isActive, nextDueDate: { lte }, debt: { status: { not: 'paid' } } }, include: { debt, account } })` en `processPendingRecurringPayments` | `recurringRepo.findDuePayments(today, { debt: true, account: true })` |
| `prisma.recurringDebtPayment.update({ where: { id }, data: { isActive: false } })` en `processPendingRecurringPayments` (rama deactivate) | `recurringRepo.update(recurringPayment.id, { isActive: false })` |
| `prisma.recurringDebtPayment.update({ where: { id }, data: { lastProcessed, nextDueDate } })` en `processPendingRecurringPayments` (rama post-process) | `recurringRepo.update(recurringPayment.id, { lastProcessed: today, nextDueDate })` |

---

### `src/services/auth.service.ts`

**Import eliminar:** `import { prisma } from '../lib/prisma.js'`

**Imports nuevos:**
```
import * as userRepo from '../repositories/user.repository.js'
```

| Línea actual | Reemplazar por |
|---|---|
| `prisma.user.findUnique({ where: { email: data.email } })` en `register` | `userRepo.findByEmail(data.email)` |
| `prisma.user.create({ data: { email, password, name } })` | `userRepo.create({ email: data.email, password: hashedPassword, name: data.name })` |
| `prisma.user.findUnique({ where: { email: data.email } })` en `login` | `userRepo.findByEmail(data.email)` |
| `prisma.user.findUnique({ where: { id: userId }, select: { id, email, name, createdAt } })` en `getMe` | `userRepo.findById(userId, { id: true, email: true, name: true, createdAt: true })` |

---

### `src/services/settings.service.ts`

**Import eliminar:** `import { prisma } from '../lib/prisma.js'`

**Imports nuevos:**
```
import * as userRepo from '../repositories/user.repository.js'
import * as accountRepo from '../repositories/account.repository.js'
import * as transactionRepo from '../repositories/transaction.repository.js'
import * as categoryRepo from '../repositories/category.repository.js'
import * as fixedExpenseRepo from '../repositories/fixed-expense.repository.js'
import * as debtRepo from '../repositories/debt.repository.js'
```

| Línea actual | Reemplazar por |
|---|---|
| `prisma.user.findUnique({ where: { id: userId }, select: {...} })` en `getUserProfile` | `userRepo.findById(userId, { id: true, email: true, name: true, createdAt: true })` |
| `prisma.user.findFirst({ where: { email: data.email, NOT: { id: userId } } })` en `updateUserProfile` | `userRepo.findFirst({ email: data.email, NOT: { id: userId } })` |
| `prisma.user.update({ where: { id: userId }, data: {...}, select: {...} })` en `updateUserProfile` | `userRepo.update(userId, { ...(data.name && { name: data.name }), ...(data.email && { email: data.email }) }, { id: true, email: true, name: true, createdAt: true })` |
| `prisma.user.findUnique({ where: { id: userId } })` en `changePassword` | `userRepo.findById(userId)` |
| `prisma.user.update({ where: { id: userId }, data: { password: hashedPassword } })` en `changePassword` | `userRepo.update(userId, { password: hashedPassword })` |
| `prisma.user.findUnique({ where: { id: userId } })` en `deleteUserAccount` | `userRepo.findById(userId)` |
| `prisma.user.delete({ where: { id: userId } })` | `userRepo.remove(userId)` |
| `prisma.account.count({ where: { userId } })` | `accountRepo.countByUser(userId)` |
| `prisma.transaction.count({ where: { userId } })` | `transactionRepo.countByUser(userId)` |
| `prisma.category.count({ where: { userId } })` | `categoryRepo.countByUser(userId)` |
| `prisma.fixedExpense.count({ where: { userId } })` | `fixedExpenseRepo.countByUser(userId)` |
| `prisma.debt.count({ where: { userId } })` | `debtRepo.countByUser(userId)` |
| `prisma.transaction.findFirst({ where: { userId }, orderBy: { date: 'asc' }, select: { date: true } })` | `transactionRepo.findFirstByUser(userId, { date: 'asc' })` |

---

### `src/services/dashboard.service.ts`

**Import eliminar:** `import { prisma } from '../lib/prisma.js'`

**Imports nuevos:**
```
import * as accountRepo from '../repositories/account.repository.js'
import * as transactionRepo from '../repositories/transaction.repository.js'
import * as fixedExpenseRepo from '../repositories/fixed-expense.repository.js'
```

| Línea actual | Reemplazar por |
|---|---|
| `prisma.account.findMany({ where: { userId }, select: { balance, type, creditLimit } })` en `getSummary` | `accountRepo.findAllByUser(userId)` — el repo retorna `Account[]` completo; el service ya solo accede a `balance`, `type`, `creditLimit` — compatible sin cambio en lógica |
| `prisma.transaction.findMany({ where: { userId, date: { gte, lte } }, select: { amount, type } })` en `getSummary` | `transactionRepo.findMany({ userId, date: { gte: startOfMonth, lte: endOfMonth } })` — el repo retorna `Transaction[]` completo; el service accede solo a `amount` y `type` — compatible |
| `prisma.transaction.findMany({ where: { userId, type, date: {...} }, include: { category } })` en `getByCategory` | `transactionRepo.findMany({ userId, type, date: { gte: startOfMonth, lte: endOfMonth } }, { include: { category: { select: {...} } } })` |
| `prisma.transaction.findMany({ where: { userId, date: { gte: startDate } }, select: { amount, type, date } })` en `getMonthlyTrend` | `transactionRepo.findMany({ userId, date: { gte: startDate } })` |
| `prisma.transaction.findMany({ where: { userId, date: { gte, lte } }, include: { category } })` en `getMonthlySummary` | `transactionRepo.findMany({ userId, date: { gte: startOfMonth, lte: endOfMonth } }, { include: { category: { select: {...} } } })` |
| `prisma.fixedExpense.findMany({ where: { userId, isActive: true, type: 'expense' }, select: { amount } })` en `getFixedVsVariable` | `fixedExpenseRepo.findAllByUser(userId, { isActive: true, type: 'expense' })` |
| `prisma.transaction.findMany({ where: { userId, type: 'expense', fixedExpenseId: null, date: {...} }, select: { amount } })` en `getFixedVsVariable` | `transactionRepo.findMany({ userId, type: 'expense', fixedExpenseId: null, date: { gte: startOfMonth, lte: endOfMonth } })` |

---

### `src/services/credit-cards.service.ts`

**Import eliminar:** `import { prisma } from '../lib/prisma.js'`

**Imports nuevos:**
```
import * as accountRepo from '../repositories/account.repository.js'
import * as transactionRepo from '../repositories/transaction.repository.js'
import * as creditCardPaymentRepo from '../repositories/credit-card-payment.repository.js'
import * as fixedExpenseRepo from '../repositories/fixed-expense.repository.js'
import * as categoryRepo from '../repositories/category.repository.js'
```

| Línea actual | Reemplazar por |
|---|---|
| `prisma.account.findFirst({ where: { id: accountId, userId, type: 'credit_card' } })` en `getCreditCardStatement` | `accountRepo.findByIdAndUser(accountId, userId)` — luego validar `account.type === 'credit_card'` en el service (la validación ya existe) |
| `prisma.transaction.findMany({ where: { accountId, userId, type: 'expense', date: { gte: lastCutoff, lte: today } }, include, orderBy })` (current period) | `transactionRepo.findMany({ accountId, userId, type: 'expense', date: { gte: lastCutoff, lte: today } }, { include, orderBy: { date: 'desc' } })` |
| `prisma.transaction.findMany({ where: { accountId, userId, type: 'expense', date: { gte: previousCutoff, lt: lastCutoff } }, include, orderBy })` (closed period) | `transactionRepo.findMany({ accountId, userId, type: 'expense', date: { gte: previousCutoff, lt: lastCutoff } }, { include, orderBy: { date: 'desc' } })` |
| `prisma.creditCardPayment.findFirst({ where: { accountId, periodStart, periodEnd } })` | `creditCardPaymentRepo.findFirst({ accountId, periodStart: previousCutoffUTC, periodEnd: closedPeriodEndUTC })` |
| `prisma.account.findMany({ where: { userId, type: 'credit_card' } })` en `getCreditCardsSummary` | `accountRepo.findCreditCardsByUser(userId)` |
| `prisma.creditCardPayment.create({ data: { accountId, amount, paymentDate, periodStart, periodEnd, transactionId } })` | `creditCardPaymentRepo.create(data)` |
| `prisma.fixedExpense.findFirst({ where: { userId, creditCardAccountId: accountId, isActive: true } })` | `fixedExpenseRepo.findFirst({ userId, creditCardAccountId: accountId, isActive: true })` |
| `prisma.transaction.findFirst({ where: { fixedExpenseId, date: { gte, lte } } })` | `transactionRepo.findFirst({ fixedExpenseId: fixedExpense.id, date: { gte: startOfMonth, lte: endOfMonth } })` |
| `prisma.category.findFirst({ where: { userId, name: 'Pago de Tarjeta', type: 'expense' } })` en `getOrCreatePaymentCategory` | `categoryRepo.findFirst({ userId, name: 'Pago de Tarjeta', type: 'expense' })` |
| `prisma.category.create({ data: { name: 'Pago de Tarjeta', ... } })` | `categoryRepo.create({ name: 'Pago de Tarjeta', type: 'expense', icon: '💳', color: '#8B5CF6', userId })` |

---

### `src/services/receipts.service.ts`

**Import eliminar:** `import { prisma } from '../lib/prisma.js'`

**Imports nuevos:**
```
import * as transactionRepo from '../repositories/transaction.repository.js'
```

| Línea actual | Reemplazar por |
|---|---|
| `prisma.transaction.findFirst({ where: { userId, imageHash }, include: { account, category } })` en `checkExactDuplicate` | `transactionRepo.findFirst({ userId, imageHash }, { account: { select: { id: true, name: true } }, category: { select: { id: true, name: true } } })` |
| `prisma.transaction.findMany({ where: { userId, amount: { gte, lte }, date: { gte, lte } }, include: { account, category }, orderBy })` en `checkSimilarTransactions` | `transactionRepo.findMany({ userId, amount: { gte: amount - 0.5, lte: amount + 0.5 }, date: { gte: twoDaysBefore, lte: twoDaysAfter } }, { include: { account: { select: {...} }, category: { select: {...} } }, orderBy: { date: 'desc' } })` |

---

### `src/services/projection.service.ts`

**Import eliminar:** `import { prisma } from '../lib/prisma.js'`

**Imports nuevos:**
```
import * as fixedExpenseRepo from '../repositories/fixed-expense.repository.js'
```

| Línea actual | Reemplazar por |
|---|---|
| `prisma.fixedExpense.findMany({ where: { userId, isActive: true }, include: { category }, orderBy })` en `getNextMonthProjection` | `fixedExpenseRepo.findAllByUser(userId, { isActive: true }, { category: { select: { id, name, icon, color } } }, [{ sortOrder: 'asc' }, { dueDay: 'asc' }])` |
| `prisma.fixedExpense.findMany({ where: { userId, isActive: true } })` en `getCurrentMonthSummary` | `fixedExpenseRepo.findAllByUser(userId, { isActive: true })` |

---

## Archivos a tocar

| Archivo | Cambio |
|---------|--------|
| `src/services/accounts.service.ts` | Eliminar import prisma, importar accountRepo, reemplazar 10 llamadas |
| `src/services/transactions.service.ts` | Eliminar import prisma, importar transactionRepo + categoryRepo, reemplazar 9 llamadas, agregar cast de tipo |
| `src/services/categories.service.ts` | Eliminar import prisma, importar categoryRepo + transactionRepo, reemplazar 7 llamadas |
| `src/services/debts.service.ts` | Eliminar import prisma, importar 5 repos, reemplazar 14 llamadas fuera de $transaction |
| `src/services/budgets.service.ts` | Eliminar import prisma, importar 4 repos + categoryRepo, reemplazar 11 llamadas, fetch extra de categoría en checkBudgetAndNotify |
| `src/services/notifications.service.ts` | Eliminar import prisma, importar notificationRepo + userRepo, reemplazar 10 llamadas |
| `src/services/fixed-expenses.service.ts` | Mantener import prisma (solo para 2 funciones), importar 5 repos, reemplazar ~25 llamadas |
| `src/services/tags.service.ts` | Eliminar import prisma, importar tagRepo, reemplazar 5 llamadas |
| `src/services/recurring-debt-payments.service.ts` | Eliminar import prisma, importar 3 repos, reemplazar 11 llamadas |
| `src/services/auth.service.ts` | Eliminar import prisma, importar userRepo, reemplazar 4 llamadas |
| `src/services/settings.service.ts` | Eliminar import prisma, importar 6 repos, reemplazar 13 llamadas |
| `src/services/dashboard.service.ts` | Eliminar import prisma, importar 3 repos, reemplazar 7 llamadas |
| `src/services/credit-cards.service.ts` | Eliminar import prisma, importar 5 repos, reemplazar 10 llamadas |
| `src/services/receipts.service.ts` | Eliminar import prisma, importar transactionRepo, reemplazar 2 llamadas |
| `src/services/projection.service.ts` | Eliminar import prisma, importar fixedExpenseRepo, reemplazar 2 llamadas |

---

## Propuesta

1. Procesar services en orden de menor a mayor número de cambios: `projection` → `receipts` → `auth` → `tags` → `notifications` → `categories` → `accounts` → `dashboard` → `recurring-debt-payments` → `transactions` → `budgets` → `debts` → `settings` → `credit-cards` → `fixed-expenses`.
2. En cada service: eliminar el import `prisma`, agregar los imports de repositories, reemplazar llamadas según el mapeo de este SPEC.
3. `fixed-expenses.service.ts` es el único que retiene `import { prisma }` — únicamente para `autoGenerateFixedExpenseTransactions` y el `$transaction` batch en `reorderFixedExpenses`.
4. Ejecutar `npx tsc --noEmit` al final — 0 errores requerido.

---

## Fuera de scope

- Modificar los repositories creados en BE-006.
- Cambiar las firmas de los services (los callers no cambian).
- Refactorizar lógica de negocio dentro de los services.
- Crear tests.
- Extraer la lógica multi-user de `autoGenerateFixedExpenseTransactions` a un repository — eso sería una nueva tarea.
- Eliminar `console.error` que existen en `fixed-expenses.service.ts` y `credit-cards.service.ts` — fuera de scope.

---

## Preguntas abiertas

Ninguna. El mapeo completo está determinado por el código real y las firmas de BE-006.
