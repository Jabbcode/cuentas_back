# SPEC: REFACTOR-BE-003 — Mover checkBudgetAndNotify a budgets.service

## Qué se pide

Mover la función `checkBudgetAndNotify` de `notifications.service.ts` a `budgets.service.ts`. `notifications.service` debe quedar como capa pura de CRUD de notificaciones, sin lógica de presupuestos. El único consumidor (`transactions.service.ts`) debe actualizar su import para apuntar al nuevo origen.

---

## Contexto de Notion (tareas Done relacionadas)

- [REFACTOR-BE-001] — Implementó custom error classes (`AppError`, `NotFoundError`, `ConflictError`, `ValidationError`, `ForbiddenError`) en `src/lib/errors.ts`. Ya completado. `notifications.service.ts` y `budgets.service.ts` ya los usan.
- [REFACTOR-BE-002] — Descompuso `payDebt`, eliminó dynamic import, extrajo utils puras a `src/lib/utils/debt.utils.ts`. Establece el patrón de mover lógica de negocio fuera de services que no son su dueño.

---

## Contexto de código

- `src/services/notifications.service.ts` — Contiene `checkBudgetAndNotify` en líneas 81–147. La función: consulta preferencias del usuario (líneas 82–87), calcula spending del mes (líneas 89–110), decide si hay alerta (líneas 112–115), verifica duplicados (líneas 118–126), llama a `createNotification` (líneas 130–146). Viola SRP: mezcla lógica de negocio de presupuestos con la capa de notificaciones.
- `src/services/budgets.service.ts` — Actualmente solo CRUD de presupuestos. Importa `prisma`, `CreateBudgetInput`, `UpdateBudgetInput`, `NotFoundError`, `ConflictError`. Ya tiene patrón de queries sobre `prisma.budget` y `prisma.transaction` — `checkBudgetAndNotify` encaja naturalmente aquí.
- `src/services/transactions.service.ts` — Único consumidor. Línea 9: `import { checkBudgetAndNotify } from './notifications.service.js'`. Línea 129: `checkBudgetAndNotify(userId, data.categoryId).catch(() => {})` dentro de `createTransaction`, condicionado a `data.type === 'expense'`.

### Verificación de consumidores únicos

Grep sobre `src/` confirma que `checkBudgetAndNotify` aparece en exactamente 3 líneas:
- `notifications.service.ts:81` — definición (origen)
- `transactions.service.ts:9` — import
- `transactions.service.ts:129` — llamada

No hay otros consumidores en el codebase.

---

## Archivos a tocar

| Archivo | Cambio |
|---------|--------|
| `src/services/budgets.service.ts` | Añadir import de `NotificationPreferences` desde `../schemas/notification.schema.js`; añadir import de `createNotification` desde `./notifications.service.js`; pegar la función `checkBudgetAndNotify` al final del archivo |
| `src/services/notifications.service.ts` | Eliminar la función `checkBudgetAndNotify` (líneas 81–147); eliminar el import de `NotificationPreferences` si queda sin uso (línea 2 — verificar) |
| `src/services/transactions.service.ts` | Cambiar línea 9: reemplazar `'./notifications.service.js'` por `'./budgets.service.js'` en el import de `checkBudgetAndNotify` |

### Detalle sobre el import de `NotificationPreferences` en `notifications.service.ts`

La línea 2 importa `NotificationPreferences` desde `../schemas/notification.schema.js`. Después de eliminar `checkBudgetAndNotify`, ese tipo deja de usarse en `notifications.service.ts` (el resto del archivo no lo referencia). Debe eliminarse el import también para mantener el archivo limpio y pasar `tsc --noEmit` sin warnings de import no usado (dependiendo de la config de TS).

### Nuevo import necesario en `budgets.service.ts`

`checkBudgetAndNotify` necesita:
- `NotificationPreferences` — desde `../schemas/notification.schema.js`
- `createNotification` — desde `./notifications.service.js`

`prisma` ya está importado en `budgets.service.ts` (línea 1). No se necesitan más dependencias nuevas.

---

## Decisión requerida

No aplica. El camino es único y obvio: la función se mueve íntegra sin modificaciones de lógica, solo cambia el archivo que la contiene y el import en el consumidor.

---

## Propuesta

1. En `budgets.service.ts`: añadir los dos imports nuevos (`NotificationPreferences`, `createNotification`) y copiar la función `checkBudgetAndNotify` líneas 81–147 de `notifications.service.ts` al final del archivo, sin modificar su lógica.
2. En `notifications.service.ts`: eliminar `checkBudgetAndNotify` (líneas 81–147) y eliminar el import de `NotificationPreferences` (línea 2, que queda huérfano).
3. En `transactions.service.ts`: cambiar únicamente el string del import en línea 9 de `'./notifications.service.js'` a `'./budgets.service.js'`.
4. Verificar `npx tsc --noEmit` — 0 errores.

El orden es seguro: el paso 1 introduce la nueva definición sin romper nada. Los pasos 2 y 3 pueden hacerse en cualquier orden — mientras no se elimine la definición original antes de que el consumidor apunte a la nueva, el build nunca queda roto.

---

## Fuera de scope

- No modificar la lógica interna de `checkBudgetAndNotify` — se mueve tal cual, sin refactors adicionales
- No extraer la lógica de cálculo de `checkBudgetAndNotify` a `lib/utils/` (podría considerarse en un REFACTOR-BE posterior, no en esta tarea)
- No modificar el patrón `.catch(() => {})` de la llamada en `transactions.service.ts` — ese silenciamiento de errores es intencional y está fuera de scope
- No tocar `notifications.controller.ts`, `budgets.controller.ts` ni ningún archivo de rutas — el cambio es puramente entre services
- No refactorizar otras funciones de `notifications.service.ts` aunque tengan posibles mejoras

---

## Preguntas abiertas

Ninguna. Scope completamente definido por la tarea y el código existente.
