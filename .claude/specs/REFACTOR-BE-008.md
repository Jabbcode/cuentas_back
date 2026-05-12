# SPEC: REFACTOR-BE-008 — Extraer funciones puras a lib/utils/

## Qué se pide

Identificar y extraer funciones puras (sin Prisma, sin imports de otros services, sin side effects) que viven actualmente dentro de services, hacia archivos en `src/lib/utils/`. El precedente establecido en REFACTOR-BE-002 es `src/lib/utils/debt.utils.ts`. Se excluye `buildTransactionWhereInput` (cubierta por REFACTOR-BE-005).

---

## Contexto de Notion (tareas Done relacionadas)

- [REFACTOR-BE-002] — Creó `src/lib/utils/debt.utils.ts` y estableció el patrón: una función pura = sin Prisma, sin imports de otros services, solo transformaciones de datos o cálculos. Extrajo `calculateInterest`, `getDebtStatus`, `calculateDebtPaymentBreakdown`. Ese archivo ya está completo y no se toca en esta tarea.
- [REFACTOR-BE-003] — Movió `checkBudgetAndNotify` de `transactions.service.ts` a `budgets.service.ts`. Confirmó que el criterio de "pura" requiere ausencia total de Prisma y de side effects, no solo de un import específico.

---

## Análisis de candidatas en cada service

### `src/services/recurring-debt-payments.service.ts`
- `calculateNextDueDate(frequency, dayOfMonth, dayOfWeek, fromDate)` — **CANDIDATA**. Exportada, sin Prisma, sin imports de otros services. Solo aritmética de fechas. Ya la usan: `recurring-debt-payments.service.ts` (3 call sites internos), `debts.service.ts` (1 call site), `fixed-expenses.service.ts` (1 call site).

### `src/services/credit-cards.service.ts`
Contiene cuatro funciones privadas (no exportadas):
- `getCutoffDates(cutoffDay)` — **CANDIDATA**. Sin Prisma, sin imports externos. Calcula `lastCutoff` y `nextCutoff` a partir de un número de día.
- `getPaymentDueDate(cutoffDate, paymentDueDay)` — **CANDIDATA**. Sin Prisma, sin imports externos. Calcula la fecha de vencimiento de pago a partir de la fecha de corte.
- `getDaysBetween(from, to)` — **CANDIDATA**. Sin Prisma, sin imports externos. Calcula diferencia en días entre dos fechas.
- `normalizeToUTC(date)` — **CANDIDATA**. Sin Prisma, sin imports externos. Normaliza un `Date` a medianoche UTC.
- `getOrCreatePaymentCategory(userId)` — **DESCARTADA**. Usa Prisma (`findFirst` + `create`). No es pura.

### `src/services/projection.service.ts`
- `groupByCategory(items)` — **DESCARTADA PARCIALMENTE**. Sin Prisma ni imports externos, pero recibe `any[]` y opera sobre objetos con forma implícita de `FixedExpense & { category }`. Para extraerla sin `any` habría que definir un tipo de entrada explícito en utils. El cuerpo es puro, pero la firma actual usa `any`. Se incluye como candidata con la condición de que se tipifique correctamente al moverla (ver sección Decisión requerida).
- `getCurrentMonthSummary(userId, currentMonth)` — **DESCARTADA**. Usa Prisma. No es pura.

### `src/services/dashboard.service.ts`
Todas las funciones exportadas usan Prisma directamente. No hay funciones auxiliares privadas puras extraíbles.

### `src/services/budgets.service.ts`, `accounts.service.ts`, `transactions.service.ts`, `notifications.service.ts`, `auth.service.ts`, `categories.service.ts`, `tags.service.ts`, `receipts.service.ts`, `settings.service.ts`
Revisados. Ninguno contiene funciones privadas puras candidatas: todas las funciones auxiliares hacen queries Prisma, llaman a otros services, o tienen side effects.

---

## Resumen de funciones a extraer

| Función | Archivo actual | Archivo destino | Callers que actualizan import |
|---------|---------------|-----------------|-------------------------------|
| `calculateNextDueDate` | `src/services/recurring-debt-payments.service.ts` | `src/lib/utils/date.utils.ts` | `recurring-debt-payments.service.ts`, `debts.service.ts`, `fixed-expenses.service.ts` |
| `getCutoffDates` | `src/services/credit-cards.service.ts` | `src/lib/utils/credit-card.utils.ts` | `credit-cards.service.ts` (internal — se convierte en import local) |
| `getPaymentDueDate` | `src/services/credit-cards.service.ts` | `src/lib/utils/credit-card.utils.ts` | `credit-cards.service.ts` |
| `getDaysBetween` | `src/services/credit-cards.service.ts` | `src/lib/utils/credit-card.utils.ts` | `credit-cards.service.ts` |
| `normalizeToUTC` | `src/services/credit-cards.service.ts` | `src/lib/utils/credit-card.utils.ts` | `credit-cards.service.ts` |
| `groupByCategory` | `src/services/projection.service.ts` | `src/lib/utils/projection.utils.ts` | `projection.service.ts` |

---

## Archivos a tocar

| Archivo | Cambio |
|---------|--------|
| `src/lib/utils/date.utils.ts` | Crear — mover `calculateNextDueDate` desde `recurring-debt-payments.service.ts` |
| `src/lib/utils/credit-card.utils.ts` | Crear — mover las 4 funciones privadas desde `credit-cards.service.ts` |
| `src/lib/utils/projection.utils.ts` | Crear — mover `groupByCategory` desde `projection.service.ts`, tipificando correctamente el parámetro `items` |
| `src/services/recurring-debt-payments.service.ts` | Eliminar definición de `calculateNextDueDate`; agregar import desde `../lib/utils/date.utils.js`; mantener re-export solo si hay callers externos que la consumen directamente (ver Decisión requerida) |
| `src/services/debts.service.ts` | Actualizar import de `calculateNextDueDate`: de `./recurring-debt-payments.service.js` a `../lib/utils/date.utils.js` |
| `src/services/fixed-expenses.service.ts` | Actualizar import de `calculateNextDueDate`: de `./recurring-debt-payments.service.js` a `../lib/utils/date.utils.js` |
| `src/services/credit-cards.service.ts` | Eliminar las 4 funciones privadas; agregar import desde `../lib/utils/credit-card.utils.js` |
| `src/services/projection.service.ts` | Eliminar `groupByCategory`; agregar import desde `../lib/utils/projection.utils.js` |

---

## Decisión requerida

**`calculateNextDueDate` en `recurring-debt-payments.service.ts` — ¿re-exportar o romper import público?**

`calculateNextDueDate` actualmente es `export function` en `recurring-debt-payments.service.ts`. Hay callers externos (`debts.service.ts`, `fixed-expenses.service.ts`) que la importan desde ese path. Hay dos opciones:

**Opción A — Mover y actualizar todos los callers:**
Eliminar la función del service, moverla a `date.utils.ts`, y actualizar los 3 archivos que la importan (el propio service + 2 callers externos) para que apunten a `../lib/utils/date.utils.js`.

**Opción B — Mover y re-exportar desde el service:**
Mover la función a `date.utils.ts` y añadir `export { calculateNextDueDate } from '../lib/utils/date.utils.js'` en `recurring-debt-payments.service.ts` para no romper callers externos.

Recomiendo Opción A porque:
- Re-exportar desde un service mezcla responsabilidades: un service no debe ser fachada de utils.
- El CLAUDE.md prohíbe shims y re-exports de conveniencia al mover código entre capas.
- Los callers son solo 2 archivos adicionales — el costo de actualizar es bajo y el resultado es limpio.

**`groupByCategory` en `projection.service.ts` — tipificación del parámetro**

La firma actual es `function groupByCategory(items: any[])`. Al mover a `projection.utils.ts` se debe eliminar el `any`. El objeto que recibe es un `FixedExpense` de Prisma con `category` incluido. Dado que los tipos Prisma no exportan directamente el tipo de resultado de `findMany` con `include`, la opción es definir una interface local en `projection.utils.ts` que describa solo los campos que la función realmente usa: `amount`, `id`, `name`, `dueDay`, `category.id`, `category.name`, `category.icon`, `category.color`. No se necesita importar tipos de Prisma para esto.

---

## Propuesta

1. Crear `src/lib/utils/date.utils.ts` con `calculateNextDueDate` (cuerpo idéntico al actual, firma sin cambios). Exportarla.
2. Crear `src/lib/utils/credit-card.utils.ts` con las 4 funciones privadas de `credit-cards.service.ts` (cuerpos y firmas idénticos). Exportarlas.
3. Crear `src/lib/utils/projection.utils.ts` con `groupByCategory`, reemplazando `any[]` por una interface tipificada local `FixedExpenseWithCategory`. Exportarla.
4. Actualizar `recurring-debt-payments.service.ts`: eliminar definición, agregar import desde `date.utils.js`. Usar internamente.
5. Actualizar `debts.service.ts` y `fixed-expenses.service.ts`: cambiar el import de `calculateNextDueDate` al nuevo path `../lib/utils/date.utils.js`.
6. Actualizar `credit-cards.service.ts`: eliminar las 4 funciones privadas, agregar import desde `credit-card.utils.js`.
7. Actualizar `projection.service.ts`: eliminar `groupByCategory`, agregar import desde `projection.utils.js`.
8. Verificar `npx tsc --noEmit` — 0 errores.

Cada paso 1-3 es independiente y no rompe el build. Los pasos 4-7 son actualizaciones atómicas por archivo. El paso 8 valida el conjunto.

---

## Fuera de scope

- `buildTransactionWhereInput` en `transactions.service.ts` — cubierta por REFACTOR-BE-005, no se toca aquí.
- `getCurrentMonthSummary` en `projection.service.ts` — usa Prisma, no es pura.
- `getOrCreatePaymentCategory` en `credit-cards.service.ts` — usa Prisma, no es pura.
- Funciones auxiliares de `dashboard.service.ts` — todas usan Prisma directamente, ninguna es candidata.
- Mejorar la lógica interna de ninguna función durante el movimiento — cuerpos se copian idénticos.
- Cambiar firmas externas de ningún service (los callers existentes no deben modificar su código salvo el path del import).
- Extraer lógicas de reducción inline que están embebidas dentro de funciones async (e.g., los `.reduce` en `dashboard.service.ts`) — extraer esas requeriría crear wrappers sin valor real y no está pedido.

---

## Preguntas abiertas

Ninguna. Scope completamente definido por el código existente.
