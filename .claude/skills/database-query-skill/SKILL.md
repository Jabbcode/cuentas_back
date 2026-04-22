---
name: database-query-skill
description: Escribir queries Prisma eficientes y seguras con userId filtering obligatorio
type: skill
---

## Cuándo Usar

- Queries `findMany`, `findUnique`, `findFirst` con filtros
- Relaciones con `include` / `select`
- Operaciones atómicas con `$transaction`
- Paginación y ordenamiento

## Patrón Base — SIEMPRE con userId

```typescript
import { prisma } from '../lib/prisma.js';

// Lista — siempre where: { userId }
export async function getItems(userId: string) {
  return prisma.account.findMany({
    where: { userId },
    orderBy: { createdAt: 'desc' },
  });
}

// Por ID — findFirst con { id, userId } para verificar propiedad
export async function getItemById(id: string, userId: string) {
  const item = await prisma.account.findFirst({
    where: { id, userId },
  });
  if (!item) throw new Error('Recurso no encontrado');
  return item;
}

// Crear — incluir userId en data
export async function createItem(data: CreateInput, userId: string) {
  return prisma.account.create({
    data: { ...data, userId },
  });
}

// Actualizar — verificar propiedad antes con getItemById
export async function updateItem(id: string, data: UpdateInput, userId: string) {
  await getItemById(id, userId); // lanza 404 si no es del usuario
  return prisma.account.update({
    where: { id },
    data,
  });
}
```

## Select vs Include

```typescript
// Select (mejor performance — solo campos necesarios)
const accounts = await prisma.account.findMany({
  where: { userId },
  select: { id: true, name: true, balance: true, type: true },
});

// Include (cuando necesitas relaciones completas)
const user = await prisma.user.findUnique({
  where: { id },
  include: { accounts: true, transactions: true },
});
```

## Transacciones atómicas

```typescript
// Múltiples writes que deben ser todos-o-nada
const [updated, created] = await prisma.$transaction([
  prisma.account.update({ where: { id }, data: { balance: newBalance } }),
  prisma.transaction.create({ data: { ...txData, userId } }),
]);
```

## Decimal de Prisma

```typescript
// Prisma retorna Decimal, no number — convertir antes de operar
const balance = account.balance.toNumber();
const isPositive = account.balance.toNumber() > 0; // ❌ no: account.balance > 0
```

## Anti-patterns

- ❌ `findUnique` para verificar propiedad (no incluye userId en where)
- ❌ Queries sin `where: { userId }` — fuga de datos entre usuarios
- ❌ Comparar `Decimal` con `number` directamente (TS2367)
- ❌ `include` todo cuando solo necesitas campos específicos
