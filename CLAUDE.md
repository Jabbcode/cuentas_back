# Cuentas Backend — Claude Code

## Inicio de sesión

Al comenzar cualquier conversación en este proyecto, carga automáticamente:

1. `.claude/system-prompt.md` — instrucciones del meta-agente
2. `.claude/context.md` — stack, estructura y flujo del proyecto
3. `.claude/conventions.md` — patrones de código y convenciones
4. `.claude/decisions/ADR-decisions.md` — decisiones arquitectónicas
5. `.claude/project-state.md` — estado actual del proyecto

Luego espera instrucciones del usuario.

---

## Flujo de trabajo

```
Usuario: "Lee la tarea BACKEND-XX de Notion"
Claude:  → Lee Notion vía MCP → genera PROPUESTA (12 líneas máx)

Usuario: "OK" / "Cambio: ..."
Claude:  → IMPLEMENTA (schema + service + controller + routes)
         → Verifica userId filtering en todas las queries
         → Verifica TypeScript sin errores antes de reportar

Usuario: "OK"
Claude:  → LISTO — pide revisión, no auto-valida
```

## Reglas críticas

- **userId filtering obligatorio** en todas las queries Prisma (`req.user!.userId`)
- **TypeScript strict** — sin `any`, ejecutar `npx tsc --noEmit` antes de PR
- **Nunca pushear a main** sin PR y confirmación explícita del usuario
- Respuestas máximo 15 líneas — directo al grano

## Stack

Node.js + Express 4.21 + TypeScript 5.6 + Prisma 5.22 + PostgreSQL + Zod + JWT + Resend

## Agents disponibles

| Agent | Cuándo usarlo |
|-------|--------------|
| `api-endpoint-agent` | Endpoint REST completo (schema + service + controller + route) |
| `service-creator-agent` | Solo capa de service/Prisma |
| `controller-generator-agent` | Solo controller Express |
| `data-processing-agent` | Agregaciones, dashboards, cálculos complejos |
| `database-migration-agent` | Cambios en schema Prisma |

## Estado actual

Ver `.claude/project-state.md`
