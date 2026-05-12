# SPEC: REFACTOR-BE-005 — Extraer buildTransactionWhereInput como helper

## Qué se pide

Extraer el bloque de construcción del objeto `where` dentro de `getTransactions` en `src/services/transactions.service.ts` a una función pura `buildTransactionWhereInput` en un nuevo archivo `src/lib/utils/transaction.utils.ts`. El caller (`getTransactions`) debe actualizarse para usar la función extraída. Nada más.

---

## Contexto de Notion (tareas Done relacionadas)

- [REFACTOR-BE-002] — Creó `src/lib/utils/debt.utils.ts` y estableció el patrón base: archivo `*.utils.ts` en `src/lib/utils/`, funciones exportadas, sin Prisma, sin side effects. Es el precedente directo para el archivo nuevo.
- [REFACTOR-BE-008] — Mapeó todos los utils candidatos del codebase. Confirma explícitamente que `buildTransactionWhereInput` está fuera de su scope y es responsabilidad exclusiva de esta tarea. Además establece que los cuerpos se copian idénticos y no se altera la lógica durante el movimiento.

---

## Contexto de código

- `src/services/transactions.service.ts` — Contiene `getTransactions` (líneas 12–71). El bloque a extraer son las líneas 27–51: construcción del objeto `where` con filtros opcionales de `TransactionQuery`. El tipo declarado actualmente es `Record<string, unknown>`, lo que permite asignaciones dinámicas. La función no tiene otros callers en el codebase que usen esta lógica de construcción del `where`.
- `src/schemas/transaction.schema.ts` — Define `TransactionQuery` (type inferido de `transactionQuerySchema`). Los campos relevantes para la firma son: `startDate`, `endDate`, `accountId`, `categoryId`, `categoryIds`, `type`, `tag`, `minAmount`, `maxAmount`. Los campos `limit` y `offset` no forman parte del `where` y no se pasan al helper.
- `src/lib/utils/debt.utils.ts` — Referencia de estructura: funciones exportadas nombradas, sin imports de Prisma ni de otros services, solo imports de tipos si aplica.
- `src/lib/utils/` — Directorio ya existe con 4 archivos. `transaction.utils.ts` no existe todavía — hay que crearlo.

---

## Bloque exacto a extraer

Líneas 27–51 de `src/services/transactions.service.ts`:

```
const where: Record<string, unknown> = { userId };

if (startDate || endDate) {
  where.date = {};
  if (startDate) (where.date as Record<string, Date>).gte = new Date(startDate);
  if (endDate) (where.date as Record<string, Date>).lte = new Date(endDate);
}

if (accountId) where.accountId = accountId;

if (categoryIds?.length) {
  where.categoryId = { in: categoryIds };
} else if (categoryId) {
  where.categoryId = categoryId;
}

if (type) where.type = type;
if (tag) where.tags = { some: { tag: { name: tag.toLowerCase(), userId } } };

if (minAmount !== undefined || maxAmount !== undefined) {
  const amountFilter: Record<string, number> = {};
  if (minAmount !== undefined) amountFilter.gte = minAmount;
  if (maxAmount !== undefined) amountFilter.lte = maxAmount;
  where.amount = amountFilter;
}
```

---

## Firma de la función

```ts
export function buildTransactionWhereInput(
  userId: string,
  filters: Pick<TransactionQuery, 'startDate' | 'endDate' | 'accountId' | 'categoryId' | 'categoryIds' | 'type' | 'tag' | 'minAmount' | 'maxAmount'>
): Prisma.TransactionWhereInput
```

Notas sobre la firma:
- `userId` se recibe por separado porque es obligatorio y no es parte de `TransactionQuery`.
- El tipo de retorno cambia de `Record<string, unknown>` a `Prisma.TransactionWhereInput` — esto elimina el casting interno y da tipado correcto al resultado.
- El import de `Prisma` viene de `'@prisma/client'`.
- El import de `TransactionQuery` viene de `'../../schemas/transaction.schema.js'`.

---

## Archivos a tocar

| Archivo | Cambio |
|---------|--------|
| `src/lib/utils/transaction.utils.ts` | Crear — contiene `buildTransactionWhereInput` exportada |
| `src/services/transactions.service.ts` | Eliminar bloque `where` de líneas 27–51; agregar llamada a `buildTransactionWhereInput`; agregar import desde `'../lib/utils/transaction.utils.js'` |

---

## Propuesta

1. Crear `src/lib/utils/transaction.utils.ts` con la función `buildTransactionWhereInput`. La lógica interna es idéntica al bloque extraído, pero el tipo de retorno se cambia a `Prisma.TransactionWhereInput` eliminando los casts `as Record<string, Date>` y `as Record<string, number>` — el tipo Prisma los acepta directamente.
2. En `getTransactions`, reemplazar el bloque de construcción del `where` (líneas 27–51) por `const where = buildTransactionWhereInput(userId, { startDate, endDate, accountId, categoryId, categoryIds, type, tag, minAmount, maxAmount })`.
3. Agregar el import de `buildTransactionWhereInput` en `transactions.service.ts`.
4. Verificar `npx tsc --noEmit` — 0 errores.

El cambio es atómico: un archivo nuevo + un caller actualizado. No hay otros callers. La lógica del `where` en `getTransactionSummary` (líneas 205–214) es un subconjunto diferente de filtros (sin `tag`, `categoryIds`, `minAmount`, `maxAmount`) y no se toca en esta tarea.

---

## Fuera de scope

- El bloque `where` en `getTransactionSummary` (líneas 204–214) — maneja filtros distintos y no está pedido en esta tarea.
- Cambiar la lógica interna del helper — el cuerpo se copia idéntico, solo cambia el tipo de retorno de `Record<string, unknown>` a `Prisma.TransactionWhereInput`.
- Extraer helpers para `updateTransaction`, `createTransaction` u otras funciones del mismo service.
- Modificar el schema `transactionQuerySchema` o el tipo `TransactionQuery`.
- Barrel exports o modificaciones a `src/lib/utils/index.ts` (si existiera).

---

## Preguntas abiertas

Ninguna. Scope completamente definido por el código existente.
