---
name: data-transformation-skill
description: Transformar datos de BD a formato de API — mapeo de tipos Prisma, Decimal y campos derivados
type: skill
---

## Cuándo Usar

- Al retornar datos que requieren cálculos o campos derivados
- Al manejar tipos `Decimal` de Prisma en respuestas
- Al formatear o filtrar campos antes de enviar al cliente

## Decimal → number

Prisma retorna campos numéricos como `Decimal`, no `number`. Convertir antes de operar o retornar:

```typescript
import { Prisma } from '@prisma/client';

// Convertir para operaciones matemáticas
const balance = account.balance.toNumber();
const available = account.creditLimit!.toNumber() - Math.abs(balance);

// Comparar Decimals
const isZero = account.balance.equals(new Prisma.Decimal(0));
const isPositive = account.balance.toNumber() > 0; // ✅
// const isPositive = account.balance > 0;          // ❌ TS2367
```

## Campos Derivados en Service

```typescript
export async function getAccountSummary(userId: string) {
  const accounts = await prisma.account.findMany({ where: { userId } });

  return accounts.map(account => ({
    ...account,
    balance: account.balance.toNumber(),           // Decimal → number
    available: account.type === 'credit_card'
      ? account.creditLimit!.toNumber() - Math.abs(account.balance.toNumber())
      : null,
  }));
}
```

## Seleccionar Solo Campos Necesarios

```typescript
// Evitar enviar campos sensibles o innecesarios al cliente
const user = await prisma.user.findUnique({
  where: { id },
  select: {
    id: true,
    email: true,
    name: true,
    // password: false  — nunca retornar el hash
  },
});
```

## Agregar Datos de Múltiples Modelos

```typescript
export async function getDashboardSummary(userId: string) {
  const [accounts, pendingDebts] = await Promise.all([
    prisma.account.findMany({ where: { userId }, select: { balance: true, type: true } }),
    prisma.debt.findMany({ where: { userId, isPaid: false }, select: { remainingAmount: true } }),
  ]);

  const totalBalance = accounts.reduce((sum, a) => sum + a.balance.toNumber(), 0);
  const totalDebt = pendingDebts.reduce((sum, d) => sum + d.remainingAmount.toNumber(), 0);

  return { totalBalance, totalDebt };
}
```

## Anti-patterns

- ❌ Retornar objetos Prisma crudos con campos `Decimal` sin convertir
- ❌ Calcular en el controller — lógica de negocio va en el service
- ❌ `JSON.stringify` de Decimal sin convertir — serializa como objeto, no número
- ❌ Retornar campos de password o datos internos al cliente
