# SPEC: REFACTOR-BE-009 — Eliminar `any` en debts.service

## Qué se pide

Eliminar el único uso de `any` en `src/services/debts.service.ts`, reemplazándolo por el tipo correcto de Prisma. No se permite `as any`, `@ts-ignore`, ni `Record<string, unknown>` como workaround.

---

## Ubicación exacta del `any`

**Archivo:** `src/services/debts.service.ts`
**Línea:** 34
**Contexto:**

```
const where: any = { userId };

if (status) {
  where.status = status;
}
```

Este `any` está en la función `getDebts(userId: string, status?: string)`. La variable `where` se construye condicionalmente: empieza con `{ userId }` y, si `status` tiene valor, se le agrega `where.status = status`. Luego se pasa directamente al campo `where` de `prisma.debt.findMany()`.

---

## Contexto de Notion (tareas Done relacionadas)

- [REFACTOR-BE-002] — Descompuso `payDebt` y extrajo utils a `src/lib/utils/debt.utils.ts`. Confirmó que `Prisma` se importa via `import type { Prisma } from '@prisma/client'` para tipos del cliente Prisma. Establece el patrón de usar tipos Prisma generados en lugar de tipos manuales.
- [REFACTOR-BE-003] — Movió `checkBudgetAndNotify` a `budgets.service.ts`. Refuerza el patrón de imports explícitos y sin workarounds de tipos.

---

## Contexto de código

- `src/services/debts.service.ts` — Archivo intervenido. El `any` está exclusivamente en línea 34, dentro de `getDebts`. Los imports actuales no incluyen `Prisma` del cliente — debe agregarse.
- `node_modules/.prisma/client/index.d.ts` — Confirma que `DebtWhereInput` existe como tipo generado por Prisma, disponible vía `Prisma.DebtWhereInput`.

---

## Tipo correcto de reemplazo

| Línea | Código actual | Reemplazo |
|-------|--------------|-----------|
| 34 | `const where: any = { userId };` | `const where: Prisma.DebtWhereInput = { userId };` |

`Prisma.DebtWhereInput` es el tipo exacto que `prisma.debt.findMany({ where: ... })` espera. Acepta `userId: string` y `status: string` como campos válidos, por lo que la asignación condicional `where.status = status` en línea 37 es compatible sin cast adicional.

---

## Archivos a tocar

| Archivo | Cambio |
|---------|--------|
| `src/services/debts.service.ts` | Añadir `import type { Prisma } from '@prisma/client';` en los imports; cambiar `const where: any` por `const where: Prisma.DebtWhereInput` en línea 34 |

Solo este archivo. Ningún otro archivo requiere modificación.

---

## Decisión requerida

No aplica. El tipo `Prisma.DebtWhereInput` es el tipo nativo y exacto que Prisma espera en ese campo. No hay alternativas con tradeoffs reales.

---

## Propuesta

1. Añadir `import type { Prisma } from '@prisma/client';` en los imports de `debts.service.ts`, junto a los demás imports existentes.
2. En línea 34, cambiar `const where: any` por `const where: Prisma.DebtWhereInput`.
3. Verificar `npx tsc --noEmit` — 0 errores.

El cambio es de una línea de lógica más una línea de import. No altera comportamiento en runtime. No requiere modificar la firma de `getDebts` ni ningún consumer del service.

---

## Fuera de scope

- No refactorizar la función `getDebts` más allá del cambio de tipo (mejorar el patrón de filtros opcionales, añadir más campos, etc. no están pedidos)
- No revisar ni corregir `any` en otros archivos del proyecto aunque existan
- No modificar el parámetro `status?: string` de `getDebts` para usar un union type más estricto — eso sería una tarea separada de mejora de schema

---

## Preguntas abiertas

Ninguna. Scope completamente definido.
