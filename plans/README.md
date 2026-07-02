# Implementation Plans

Generados por el skill improve el 2026-06-11, sobre el commit `73b4102` (branch `main`).
Ejecutar en el orden de abajo salvo que las dependencias indiquen otra cosa. Cada
executor: lee el plan completo antes de empezar, respeta sus STOP conditions y
actualiza tu fila al terminar.

Contexto del repo: API de finanzas personales (Express + Prisma + PostgreSQL, TS strict,
ESM con extensiones `.js`). Verificación: `npx tsc --noEmit` + `npm run build`
(+ `npm test` tras el plan 002). Branches: `feature/NNN-slug` desde `develop`,
conventional commits, NUNCA push a main sin PR y confirmación del usuario.

## Execution order & status

| Plan | Title | Priority | Effort | Depends on | Status |
|------|-------|----------|--------|------------|--------|
| 001 | JWT_SECRET sin fallback — fail-fast al arrancar | P1 | S | — | TODO |
| 002 | Baseline Vitest + tests de utils puras | P1 | M | — | TODO |
| 003 | Atomicidad de saldos ($transaction + increment) | P1 | M | 002 | TODO |
| 004 | Ownership en repos + validación de FKs ajenas | P1 | M | 003 | TODO |
| 005 | Robustecer crons (try/catch, dueDay, batch) | P2 | M | 002 | TODO |
| 006 | Rate limiting en auth + Helmet | P2 | S | — | TODO |
| 007 | npm audit fixes (path-to-regexp, bcrypt 6, SDK Anthropic) | P2 | S | — | TODO |
| 008 | N+1 en credit cards summary y sync recurrentes | P2 | M | 002, 005 | TODO |
| 009 | Límites de mes unificados (getMonthRange) | P3 | S | 002, 005, 008 | TODO |
| 010 | Limpieza docs/ADR post-Budgets/Tags | P3 | S | — | TODO |

Status values: TODO | IN PROGRESS | DONE | BLOCKED (con motivo en una línea) | REJECTED (con justificación).

## Dependency notes

- **002 antes de 003/005/008/009**: son refactors de lógica de dinero; el baseline de
  tests es la red. 003 y 005 además incluyen tests nuevos que asumen Vitest instalado.
- **003 antes de 004**: ambos reescriben `transactions.service.ts`; 004 asume la
  estructura con `$transaction` que deja 003.
- **005 antes de 008, y ambos antes de 009**: los tres tocan
  `fixed-expenses.service.ts` (funciones distintas, pero ejecutarlos en serie evita
  conflictos); 009 además sustituye el patrón de fechas que 005/008 conservan.
- **001, 006, 007, 010 son independientes** y pueden ejecutarse en cualquier momento.

## Hallazgos de dirección (no planificados — opciones para el dueño)

- **Sistema de data-fixes versionado**: los 14 scripts one-off locales en `src/scripts/`
  (gitignorados) muestran que corregir datos de producción es recurrente; un mini-sistema
  tipo migración (tabla de log + CLI `npm run migrate:data`) lo formalizaría. Esfuerzo M.
- **Migración Prisma 5 → 6**: planificar después de tener tests de integración. Esfuerzo L.

## Findings considered and rejected

(Registrados para que no se re-auditen.)

- **`return` faltante tras 401 en auth.middleware.ts** — falso positivo: el `catch`
  (líneas 19-21) no llama a `next()`; la ejecución termina ahí.
- **Crash por `debt.dueDate!` en cron.ts:46** — el filtro Prisma `dueDate: { gte/lte }`
  excluye nulls; el `!` es seguro en la práctica.
- **CSRF en rutas con cookies sameSite:none** — no explotable hoy: `express.json()`
  solo parsea `application/json` (los form-posts cross-site simples producen body
  vacío → Zod rechaza) y los métodos/content-types no-simples requieren preflight CORS.
  Re-evaluar si algún día se acepta `urlencoded` o se relaja CORS.
- **node-cron / resend como dependencias sin uso** — falso: ambas en uso (cron.ts, lib/email).
- **"TypeScript 6" desactualizado** — versión inexistente reportada por un subagente; descartado.
- **Validación de content-type en el Sentry tunnel** — el controller valida el DSN/host
  antes de reenviar y el límite de 5 MB acota el DoS; endurecerlo es opcional y de bajo
  valor frente al resto. No planificado.
- **Eliminar `Category.monthlyLimit`** — rechazado: tras borrar Budgets es el ÚNICO
  mecanismo de límites y el dashboard lo usa; el plan 010 actualiza el ADR en su lugar.
- **`getDaysBetween` con `Math.ceil` (alertas 1 día antes)** — comportamiento discutible
  pero deliberadamente excluido del plan 009: cambiarlo altera la UX de alertas; decisión
  de producto. Caracterizado en tests del plan 002.

## Qué NO se auditó

- El frontend (`cuentas-frontend/`) — la invocación fue "sobre el backend".
- Los scripts locales gitignorados (`src/scripts/`, `docs/`) más allá de su existencia.
- La configuración de Render/Vercel (infra), y el contenido real de `.env`.
