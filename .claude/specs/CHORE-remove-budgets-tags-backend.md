# SPEC: CHORE — Eliminar features Budgets y Tags (Backend)

## Qué se pide

Eliminar completamente las features Budgets y Tags del backend: archivos propios (controllers, routes, schemas, repositories, services) y todas las referencias en archivos compartidos. Eliminar los modelos `Budget`, `Tag`, `TransactionTag` del schema Prisma y crear la migración correspondiente.

---

## Archivos a eliminar completamente

| Archivo |
|---------|
| `src/controllers/budgets.controller.ts` |
| `src/routes/budgets.routes.ts` |
| `src/schemas/budget.schema.ts` |
| `src/repositories/budget.repository.ts` |
| `src/services/budgets.service.ts` |
| `src/controllers/tags.controller.ts` |
| `src/routes/tags.routes.ts` |
| `src/schemas/tag.schema.ts` |
| `src/repositories/tag.repository.ts` |
| `src/services/tags.service.ts` |

---

## Archivos compartidos a editar

| Archivo | Cambio |
|---------|--------|
| `src/app.ts` | Quitar imports y `app.use` de budgets y tags (líneas 17, 19, 44, 46) |
| `src/services/transactions.service.ts` | Quitar imports de `checkBudgetAndNotify` y `upsertTags`; quitar lógica de tags en create/update; quitar campo `tags` en todos los includes; quitar parámetro `tag` en `getTransactions` |
| `src/schemas/transaction.schema.ts` | Quitar campo `tagNames` de `createTransactionSchema`; quitar campo `tag` de `transactionQuerySchema` |
| `src/lib/utils/transaction.utils.ts` | Quitar `tag` del Pick en la firma, de la desestructuración, y el bloque `if (tag) where.tags = ...` |
| `src/lib/cron.ts` | Quitar query `prisma.budget.findMany`, `budgetMap`, y campo `budget` del `breakdown` en el cron mensual |
| `src/controllers/notifications.controller.ts` | En `sendTestEmail`: quitar `prisma.budget.findMany`, `budgetMap`, campo `budget` del `categoryBreakdown` |
| `src/lib/email/templates/monthly-summary.template.ts` | Quitar referencias al campo `budget` en la plantilla |
| `src/lib/email/constants.ts` | Quitar constantes de budgets/tags si existen |

### Archivos confirmados sin cambios

Los siguientes archivos fueron verificados y NO tienen referencias a budgets/tags:
- `src/services/dashboard.service.ts`
- `src/services/projection.service.ts`
- `src/services/credit-cards.service.ts`
- `src/services/categories.service.ts`
- `src/lib/utils/debt.utils.ts`
- `src/schemas/debt.schema.ts`

---

## Prisma Schema

Eliminar:
- Modelo `Budget` (con constraint único `[userId, categoryId, month, year]`)
- Modelo `Tag` (con constraint único `[userId, name]`)
- Modelo `TransactionTag` (join table M:N)
- Relación `budgets: Budget[]` en `User`
- Relación `tags: Tag[]` en `User`
- Relación `budgets: Budget[]` en `Category`
- Campo `tags: TransactionTag[]` en `Transaction`

---

## Plan de implementación (orden seguro)

1. **Schema Prisma** — eliminar los 3 modelos y sus relaciones. Ejecutar `npx prisma migrate dev --name remove-budgets-tags`. Esto regenera el cliente Prisma: sin este paso, los imports de `prisma.budget.*` y `prisma.tag.*` fallan en compilación.
2. **Archivos propios** — eliminar los 10 archivos exclusivos de budgets y tags.
3. **Capa de datos compartida** — editar `transactions.service.ts`, `transaction.schema.ts`, `transaction.utils.ts`. Son la capa más baja; los layers superiores dependen de ellos.
4. **Capa de infraestructura** — editar `cron.ts`, `notifications.controller.ts` y archivos de email. Usan el cliente Prisma directamente (ya limpio tras paso 1).
5. **Punto de entrada** — editar `app.ts`. Hacerlo al final garantiza que los módulos eliminados ya no existen.
6. **Verificación** — `npx tsc --noEmit` debe pasar sin errores.

---

## Criterios de verificación

- `npx tsc --noEmit` sin errores
- `npx prisma migrate dev` aplicada correctamente
- No quedan imports rotos en ningún archivo
- El servidor arranca sin errores tras los cambios

---

## Fuera de scope

- El campo `monthlyLimit` en `Category` se mantiene — es independiente de Budget
- Las notificaciones `category_limit` se mantienen — están ligadas a `monthlyLimit`, no a Budget
- No se refactoriza ningún otro archivo aunque se detecten mejoras

---

## Notas de riesgo

- La migración hace `DROP TABLE` irreversible en BD — confirmar con el usuario antes de ejecutar en producción
- Tags permeaba `transactions.service.ts` con `upsertTags` y `checkBudgetAndNotify` — edición quirúrgica necesaria para no romper el flujo de create/update de transacciones
