# Database Schema - Cuentas Backend

## 📊 Diagrama de Entidades

```
┌─────────┐
│  User   │  (usuario del sistema)
└────┬────┘
     │
     ├─ 1:N ────► Account        (cuentas del usuario)
     ├─ 1:N ────► Category       (categorías de transacciones)
     ├─ 1:N ────► Transaction    (movimientos de dinero)
     ├─ 1:N ────► FixedExpense   (gastos/ingresos recurrentes)
     ├─ 1:N ────► Debt           (deudas del usuario)
     ├─ 1:N ────► DebtPayment    (pagos de deudas)
     └─ 1:N ────► RecurringDebtPayment (pagos recurrentes)

┌─────────┐
│ Account │  (cuenta bancaria, tarjeta, efectivo)
└────┬────┘
     │
     ├─ 1:N ────► Transaction    (movimientos en la cuenta)
     ├─ 1:N ────► FixedExpense   (gastos fijos vinculados)
     ├─ 1:N ────► CreditCardPayment (pagos de tarjeta)
     ├─ 1:N ────► DebtPayment    (pagos desde esta cuenta)
     └─ Self ───► Account        (relación para tarjeta de crédito)

┌───────────────┐
│  Transaction  │  (movimiento de dinero)
└───────┬───────┘
        │
        ├─ N:1 ────► Account
        ├─ N:1 ────► Category
        ├─ N:1 ────► User
        ├─ N:1 ────► FixedExpense (si es recurrente)
        ├─ 1:1 ────► CreditCardPayment
        └─ 1:1 ────► DebtPayment
```

## 🗂️ Tablas Detalladas

### User
```
id          UUID (Primary Key)
email       String (Unique)
password    String (hashed with bcrypt)
name        String
createdAt   DateTime (default: now)
```

**Índices:**
- email (unique)

**Relaciones:**
- 1:N con Account, Category, Transaction, etc.

---

### Account
```
id              UUID (Primary Key)
name            String
type            String  // "cash", "bank", "credit_card"
balance         Decimal (default: 0)
initialBalance  Decimal (default: 0)  // starting balance when created
currency        String  (default: "EUR")
color           String? (optional)
userId          UUID (Foreign Key → User)
createdAt       DateTime (default: now)

// Credit card specific fields (null if not credit_card type)
creditLimit     Decimal?
cutoffDay       Int?    // 1-31 (statement closing day)
paymentDueDay   Int?    // 1-31 (payment due day)
paymentAccountId String? (Foreign Key → Account)
```

**Índices:**
- userId
- userId + type (para filtrar por tipo)

**Relaciones:**
- N:1 con User
- N:1 con Account (payment account para tarjetas)
- 1:N con Transaction
- 1:N con FixedExpense
- 1:N con CreditCardPayment
- 1:N con DebtPayment
- 1:N con RecurringDebtPayment

**Lógica especial:**
- Si type = "credit_card", entonces creditLimit, cutoffDay, paymentDueDay aplican
- Balance para credit_card es negativo (lo que se debe)
- Disponible = creditLimit - abs(balance)

---

### Category
```
id      UUID (Primary Key)
name    String
type    String  // "expense" | "income"
icon    String? (optional, emoji o nombre de icon)
color   String? (optional, hex code)
userId  UUID (Foreign Key → User)
```

**Índices:**
- userId

**Relaciones:**
- N:1 con User
- 1:N con Transaction
- 1:N con FixedExpense

---

### Transaction
```
id              UUID (Primary Key)
amount          Decimal
type            String  // "expense" | "income"
description     String? (optional)
date            DateTime (default: now) - importante para reportes
imageHash       String? (SHA256 hash para detectar duplicados de recibos)
accountId       UUID (Foreign Key → Account)
categoryId      UUID (Foreign Key → Category)
userId          UUID (Foreign Key → User)
fixedExpenseId  UUID? (Foreign Key → FixedExpense, if recurring)
createdAt       DateTime (default: now)
updatedAt       DateTime (updated on each change)
```

**Índices:**
- userId (filtrar transacciones por usuario)
- accountId (obtener transacciones de una cuenta)
- categoryId (obtener transacciones de una categoría)
- date (para reportes por rango de fechas)
- imageHash (detectar duplicados de recibos)

**Relaciones:**
- N:1 con Account
- N:1 con Category
- N:1 con User
- N:1 con FixedExpense (si es parte de gasto fijo)
- 1:1 con CreditCardPayment
- 1:1 con DebtPayment

**Lógica:**
- amount siempre positivo
- type determina si suma o resta del balance
- imageHash para OCR (evitar duplicados de recibos)

---

### FixedExpense
```
id                      UUID (Primary Key)
name                    String
amount                  Decimal
type                    String  // "expense" | "income"
dueDay                  Int     // 1-31 (día del mes)
isActive                Boolean (default: true)
sortOrder               Int     (default: 0, para ordenar manualmente)
description             String? (optional)
accountId               UUID (Foreign Key → Account)
categoryId              UUID (Foreign Key → Category)
userId                  UUID (Foreign Key → User)
creditCardAccountId     UUID? (Foreign Key → Account, if linked to credit card)
recurringDebtPaymentId  UUID? (Foreign Key → RecurringDebtPayment)
createdAt               DateTime (default: now)
updatedAt               DateTime (updated on changes)
```

**Índices:**
- userId
- userId + type + sortOrder (para listar ordenados)
- creditCardAccountId

**Relaciones:**
- N:1 con Account (cuenta de la que se debita)
- N:1 con Category
- N:1 con User
- N:1 con Account (relación creditCardAccount)
- N:1 con RecurringDebtPayment
- 1:N con Transaction (transacciones asociadas)

**Lógica especial:**
- Si creditCardAccountId está set, es pago de tarjeta
- Si recurringDebtPaymentId está set, es pago de deuda
- dueDay determina cuándo se "ejecuta"

---

### CreditCardPayment
```
id              UUID (Primary Key)
accountId       UUID (Foreign Key → Account, the credit card)
amount          Decimal (total payment amount)
paymentDate     DateTime (when payment was made)
periodStart     DateTime (start of payment period)
periodEnd       DateTime (end of payment period)
transactionId   UUID? (Foreign Key → Transaction, linking transaction)
createdAt       DateTime (default: now)
```

**Índices:**
- accountId
- paymentDate

**Relaciones:**
- N:1 con Account
- 1:1 con Transaction

**Lógica:**
- Registra pagos de tarjeta de crédito
- periodStart y periodEnd definen qué período se pagó
- Puede haber transacción asociada o no

---

### Debt
```
id              UUID (Primary Key)
userId          UUID (Foreign Key → User)
creditor        String  // "Juan", "Banco BBVA", etc.
description     String  // reason for debt
totalAmount     Decimal // original total
remainingAmount Decimal // current pending
interestRate    Decimal? (optional)
interestType    String?  // "fixed" | "percentage"
startDate       DateTime (default: now)
dueDate         DateTime? (optional, payment deadline)
status          String   (default: "active") // "active" | "paid" | "overdue"
createdAt       DateTime (default: now)
updatedAt       DateTime (updated on changes)
```

**Índices:**
- userId
- userId + status (filter active debts)

**Relaciones:**
- N:1 con User
- 1:N con DebtPayment
- 1:N con RecurringDebtPayment

**Lógica:**
- Sigue el estado del pago
- Interés puede ser fijo o porcentaje
- remainingAmount se actualiza con cada pago

---

### DebtPayment
```
id              UUID (Primary Key)
debtId          UUID (Foreign Key → Debt)
amount          Decimal (total payment: principal + interest)
principal       Decimal (amount to principal)
interest        Decimal (amount to interest)
accountId       UUID (Foreign Key → Account, source of payment)
transactionId   UUID? (Foreign Key → Transaction)
paymentDate     DateTime (default: now)
notes           String? (optional)
userId          UUID (Foreign Key → User)
createdAt       DateTime (default: now)
```

**Índices:**
- debtId
- userId
- paymentDate

**Relaciones:**
- N:1 con Debt
- N:1 con Account
- 1:1 con Transaction
- N:1 con User

**Lógica:**
- Desglosa pago en principal e interés
- Reduce remainingAmount de la deuda
- Puede asociarse con una transacción

---

### RecurringDebtPayment
```
id              UUID (Primary Key)
debtId          UUID (Foreign Key → Debt)
userId          UUID (Foreign Key → User)
amount          Decimal (payment amount each period)
accountId       UUID (Foreign Key → Account, source)
frequency       String // "monthly" | "biweekly" | "weekly"
dayOfMonth      Int?   // 1-31 for monthly
dayOfWeek       Int?   // 0-6 (0=Sunday) for weekly
isActive        Boolean (default: true)
startDate       DateTime (default: now)
endDate         DateTime? (optional)
lastProcessed   DateTime? (when last payment was created)
nextDueDate     DateTime (next scheduled payment)
notes           String? (optional)
createdAt       DateTime (default: now)
updatedAt       DateTime (updated on changes)
```

**Índices:**
- debtId
- userId
- nextDueDate
- isActive

**Relaciones:**
- N:1 con Debt
- N:1 con User
- N:1 con Account
- 1:1 con FixedExpense

**Lógica:**
- Define pagos automáticos
- nextDueDate se recalcula después de cada pago
- Se puede pausar con isActive = false
- Puede tener endDate para límitar duración

---

## 🔐 Seguridad - Filtrado por Usuario

**Regla de oro:** En todas las queries, filtrar por userId del request

```typescript
// ✅ CORRECTO
const accounts = await prisma.account.findMany({
  where: { userId: req.user!.userId },
});

// ❌ INCORRECTO
const accounts = await prisma.account.findMany();  // Sin filtro!

// ✅ CORRECTO para relaciones
const user = await prisma.user.findUnique({
  where: { id: req.user!.userId },
  include: {
    accounts: {
      where: { userId: req.user!.userId },  // Extra filtro
    },
  },
});
```

## 📈 Índices para Performance

```sql
-- User
CREATE UNIQUE INDEX idx_user_email ON "User"(email);

-- Account
CREATE INDEX idx_account_userId ON "Account"("userId");
CREATE INDEX idx_account_userId_type ON "Account"("userId", "type");

-- Transaction
CREATE INDEX idx_transaction_userId ON "Transaction"("userId");
CREATE INDEX idx_transaction_accountId ON "Transaction"("accountId");
CREATE INDEX idx_transaction_categoryId ON "Transaction"("categoryId");
CREATE INDEX idx_transaction_date ON "Transaction"("date");
CREATE INDEX idx_transaction_imageHash ON "Transaction"("imageHash");

-- FixedExpense
CREATE INDEX idx_fixedExpense_userId ON "FixedExpense"("userId");
CREATE INDEX idx_fixedExpense_order ON "FixedExpense"("userId", "type", "sortOrder");

-- Debt
CREATE INDEX idx_debt_userId ON "Debt"("userId");
CREATE INDEX idx_debt_status ON "Debt"("userId", "status");

-- RecurringDebtPayment
CREATE INDEX idx_recurringDebt_nextDue ON "RecurringDebtPayment"("nextDueDate");
CREATE INDEX idx_recurringDebt_active ON "RecurringDebtPayment"("isActive");
```

## 📝 Migrations

Las migrations están en `prisma/migrations/` y se generan automáticamente:

```bash
# Crear migration después de cambiar schema.prisma
npx prisma migrate dev --name "nombre_descriptivo"

# Aplicar migrations en producción
npx prisma migrate deploy
```

## 🔄 Relaciones Complejas - Ejemplos

### Obtener usuario con todo su contexto
```typescript
const user = await prisma.user.findUnique({
  where: { id: userId },
  include: {
    accounts: {
      select: {
        id: true,
        name: true,
        balance: true,
        type: true,
      },
    },
    categories: true,
    debts: {
      where: { status: 'active' },
    },
  },
});
```

### Obtener transacciones con contexto
```typescript
const transactions = await prisma.transaction.findMany({
  where: { userId },
  include: {
    account: { select: { name: true, color: true } },
    category: { select: { name: true, icon: true, color: true } },
  },
  orderBy: { date: 'desc' },
  take: 50,
});
```

### Obtener dashboard summary
```typescript
const [accounts, transactions, fixedExpenses] = await Promise.all([
  prisma.account.findMany({ where: { userId } }),
  prisma.transaction.findMany({
    where: { 
      userId,
      date: { gte: startOfMonth, lte: endOfMonth },
    },
  }),
  prisma.fixedExpense.findMany({ where: { userId, isActive: true } }),
]);
```
