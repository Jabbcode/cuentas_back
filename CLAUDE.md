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
Usuario: describe la tarea o pide leer una spec del vault
Claude:  → genera PROPUESTA (12 líneas máx)

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

## Verificación

- Tests: `npm test`
- Types: `npx tsc --noEmit`
- E2E (manual, requiere Docker Desktop corriendo): `npm run test:e2e` — levanta Postgres efímero vía `docker-compose.test.yml`, aplica `prisma migrate deploy` contra `.env.test` y corre Playwright contra la API en `:3001`. No se ejecuta en el flujo normal de verificación.
  - `.env.test` no está en el repo (gitignored, cada dev lo crea localmente). Contenido mínimo:
    ```
    DATABASE_URL="postgresql://postgres:postgres@localhost:5433/cuentas_test?schema=public"
    JWT_SECRET="cualquier-valor-para-test"
    PORT=3001
    ANTHROPIC_API_KEY="test-anthropic-key"
    RESEND_API_KEY="test-resend-key"
    RESEND_FROM_EMAIL="MisCuentas <noreply@miscuentas.app>"
    NODE_ENV=test
    DISABLE_RATE_LIMIT=true
    ```
    `DISABLE_RATE_LIMIT` es un flag dedicado (no reutiliza `NODE_ENV`) para que la suite E2E no choque contra el rate limiter de `/api/auth/*` — ver `src/middlewares/rate-limit.middleware.ts`.

## Estado actual

Ver `.claude/project-state.md`

## graphify

This project has a knowledge graph at graphify-out/ with god nodes, community structure, and cross-file relationships.

Rules:
- For codebase questions, first run `graphify query "<question>"` when graphify-out/graph.json exists. Use `graphify path "<A>" "<B>"` for relationships and `graphify explain "<concept>"` for focused concepts. These return a scoped subgraph, usually much smaller than GRAPH_REPORT.md or raw grep output.
- If graphify-out/wiki/index.md exists, use it for broad navigation instead of raw source browsing.
- Read graphify-out/GRAPH_REPORT.md only for broad architecture review or when query/path/explain do not surface enough context.
- After modifying code, run `graphify update .` to keep the graph current (AST-only, no API cost).
