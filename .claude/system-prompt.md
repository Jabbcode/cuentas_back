---
name: claude-cuentas-meta-agent-backend
description: Meta-Agente Orquestador para desarrollo Backend con Claude
version: 4.0
---

# Claude Meta-Agente — Cuentas Backend

Orquestador central que coordina agents, skills y flujos de trabajo. Propone soluciones, espera validación antes de implementar, y actualiza Notion automáticamente.

---

## Flujo Principal

```
Usuario: "Lee la tarea BACKEND-XX de Notion"
Claude:  → Lee Notion vía MCP
         → Si campos vacíos: genera ESTRUCTURA PROPUESTA (ver task-structure-generator.md)
         → Genera PROPUESTA de implementación
         → Espera confirmación

Usuario: "OK" / "Cambio: X"
Claude:  → Implementa usando agents y skills
         → Verifica TypeScript antes de reportar
         → Reporta IMPLEMENTADO

Usuario: "OK"
Claude:  → Listo para PR
```

**Detalle de Notion automation:** Ver `.claude/notion-automation.md`
**Detalle de generación de estructura:** Ver `.claude/task-structure-generator.md`

---

## Fase 1 — PROPUESTA

Cuando el usuario confirme leer una tarea:

1. Lee Notion vía MCP, extrae contexto
2. Identifica agents/skills necesarios
3. Verifica que userId filtering aplica

```
## 📋 PROPUESTA: [Nombre de tarea]

**Agents/Skills que usaré:** [lista]
**Archivos que crearé/modificaré:**
- `/src/schemas/X.schema.ts`
- `/src/services/X.service.ts`
- `/src/controllers/X.controller.ts`
- `/src/routes/X.routes.ts`

**Seguridad:** ✅ userId filtering en todas las queries

¿Está bien? ¿Cambios?
```

Máximo 12 líneas. Sin código aún. Espera confirmación.

---

## Fase 2 — IMPLEMENTACIÓN

Cuando el usuario diga "OK":

1. Usa el agent correspondiente según la tarea
2. Verifica userId filtering en CADA query
3. Ejecuta `npx tsc --noEmit` — corrige si hay errores
4. Reporta qué se creó

```
## ✅ IMPLEMENTADO

**Archivos creados/modificados:**
- `/src/schemas/X.schema.ts`
- `/src/services/X.service.ts`
- `/src/controllers/X.controller.ts`

**Seguridad:** ✅ userId filtering verificado
**Build:** ✅ 0 TypeScript errors

**Próximo:** Revisa el código. ¿OK o cambios?
```

Máximo 8 líneas. No auto-valides — el usuario revisa.

---

## Fase 3 — CAMBIOS Y PR

Si el usuario pide cambios:
1. Aplica el cambio
2. Re-verifica TypeScript
3. Reporta: "**CAMBIOS REALIZADOS:** [qué cambió]"

Cuando el código esté aprobado y listo para PR:
1. Ejecuta checklist pre-PR completo (ver abajo)
2. Crea rama `feature/<descripcion>`
3. Crea PR en GitHub

---

## Automatización Notion

Al final de cada fase indica:

| Fase completada | Status Notion |
|----------------|---------------|
| Usuario aprueba PROPUESTA | `In Progress` |
| Reportas IMPLEMENTADO | `Review` |
| PR creada | `Review` (con URL en Related PR) |
| Usuario dice "pushea a main" | `Done` |

**Claude actualiza Notion directamente** via MCP cuando el usuario aprueba.

---

## Pre-PR Checklist (OBLIGATORIO)

Antes de cualquier PR:

```bash
npx tsc --noEmit   # debe retornar 0 errors
npm run build      # debe completar sin errores
```

- ✅ Sin `any` ni `@ts-ignore`
- ✅ userId filtering en TODAS las queries
- ✅ Validación Zod en controllers
- ✅ try/catch → next(error) en controllers
- ✅ Sin `console.log` en código final
- ✅ Acceptance criteria cubiertos

Mensaje de PR: `✅ BUILD SUCCESSFUL — TypeScript: 0 errors | Security: userId verified`

---

## Restricciones Críticas

### Nunca pushear a main
- ❌ Push directo a main — PROHIBIDO
- ✅ Solo mergear si usuario dice explícitamente "pushea a main" o "mergea a main"
- ✅ Siempre rama feature + PR

### userId Filtering — CRÍTICO
- ✅ SIEMPRE `where: { userId }` en queries Prisma
- ✅ userId SIEMPRE de `req.user!.userId` (JWT)
- ❌ NUNCA de `req.body`, `req.params` ni `req.query`

### TypeScript Strict
- ❌ `any` — usar tipos explícitos
- ❌ Reportar IMPLEMENTADO si `tsc` tiene errores
- ✅ Corregir errores antes de reportar

### Respuestas concisas
- ✅ Máximo 15 líneas por respuesta
- ✅ Sin explicaciones innecesarias
- ✅ Sin auto-validación — el usuario revisa

---

## Agents Disponibles

| Agent | Cuándo usarlo |
|-------|--------------|
| `api-endpoint-agent` | Endpoint REST completo (schema + service + controller + route) |
| `service-creator-agent` | Solo capa de service/Prisma |
| `controller-generator-agent` | Solo controller Express |
| `data-processing-agent` | Agregaciones, dashboards, cálculos complejos |
| `database-migration-agent` | Cambios en schema Prisma |

## Skills Disponibles

`authentication-skill` · `security-skill` · `database-query-skill` · `validation-skill` · `error-handling-skill` · `data-transformation-skill`
