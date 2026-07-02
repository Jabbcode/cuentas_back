# Plan 007: Resolver vulnerabilidades de npm audit (path-to-regexp, tar, qs, uuid, brace-expansion, @anthropic-ai/sdk)

> **Executor instructions**: Sigue este plan paso a paso. Ejecuta cada comando de
> verificación y confirma el resultado esperado antes de avanzar. Si ocurre algo
> de la sección "STOP conditions", detente y reporta — no improvises. Al terminar,
> actualiza tu fila de estado en `plans/README.md`.
>
> **Drift check (ejecutar primero)**: `git diff --stat 73b4102..HEAD -- package.json package-lock.json`
> Además, re-ejecuta `npm audit --omit=dev` — si la lista de vulnerabilidades difiere
> de la de "Current state", adapta los pasos a la lista real y anótalo.

## Status

- **Priority**: P2
- **Effort**: S
- **Risk**: MED
- **Depends on**: none (recomendado: después de 002 para tener `npm test` como verificación)
- **Category**: security
- **Planned at**: commit `73b4102`, 2026-06-11

## Why this matters

`npm audit --omit=dev` reporta 2 HIGH y 4 MODERATE en dependencias de producción.
La más relevante para una API pública: `path-to-regexp` <0.1.13 (ReDoS vía parámetros
de ruta — transitiva de Express) y `qs` (DoS en parsing de query). `tar` (HIGH) es
transitiva de bcrypt y solo se ejecuta en install, riesgo real bajo. El SDK de
Anthropic 0.82 tiene un advisory moderado resuelto en ≥0.104.1.

## Current state

Salida de `npm audit --omit=dev` (2026-06-11):

| Paquete | Severidad | Vía | Fix |
|---------|-----------|-----|-----|
| `path-to-regexp` <0.1.13 | HIGH | express | `npm audit fix` |
| `tar` <=7.5.10 | HIGH | bcrypt → @mapbox/node-pre-gyp | requiere bcrypt@6 (breaking) |
| `qs` 6.11.1–6.15.1 | MODERATE | express / body-parser | `npm audit fix` |
| `brace-expansion` <1.1.13 | MODERATE | transitiva | `npm audit fix` |
| `uuid` <11.1.1 | MODERATE | resend → svix | `npm audit fix` |
| `@anthropic-ai/sdk` 0.79–0.91 | MODERATE | directa (^0.82.0) | bump a ≥0.104.1 (breaking según semver 0.x) |

Uso del SDK de Anthropic (único punto): `src/services/receipts.service.ts` —
`import Anthropic from '@anthropic-ai/sdk'` (línea 1), `new Anthropic({...})` (línea 11),
`anthropic.messages.create({ model: 'claude-haiku-4-5-20251001', ... })` (líneas 119–120).
Uso simple de `messages.create` — la superficie de esa API es estable entre 0.82 y 0.104.

Uso de bcrypt (único punto): `src/services/auth.service.ts` — `bcrypt.hash(password, 10)`
y `bcrypt.compare(...)`. La API pública de bcrypt 6 es idéntica para hash/compare;
el breaking change de v6 es de toolchain (Node ≥18, prebuilds), no de API.

## Commands you will need

| Purpose   | Command                  | Expected on success |
|-----------|--------------------------|---------------------|
| Audit     | `npm audit --omit=dev`   | (tras el plan) 0 high |
| Typecheck | `npx tsc --noEmit`       | exit 0              |
| Tests     | `npm test` (si existe)   | todos pasan         |
| Build     | `npm run build`          | exit 0              |

## Scope

**In scope**: `package.json`, `package-lock.json`.
**Out of scope** (NO tocar): cualquier archivo de `src/` — si un bump exige cambiar
código fuente más allá de receipts.service.ts/auth.service.ts (y solo si el typecheck
lo obliga), es señal de STOP. No usar `npm audit fix --force` global (puede bumpear
Express u otros sin control).

## Git workflow

- Branch: `feature/007-npm-audit-fixes` (desde `develop`)
- Commits separados: `chore: npm audit fix (path-to-regexp, qs, uuid, brace-expansion)`,
  `chore: bcrypt 5→6`, `chore: @anthropic-ai/sdk 0.82→0.104`
- NO pushear ni abrir PR salvo que el operador lo indique.

## Steps

### Step 1: Fixes no-breaking

`npm audit fix` (SIN `--force`). Luego `npm audit --omit=dev` — deben desaparecer
path-to-regexp, qs, brace-expansion y uuid.

**Verify**: `npx tsc --noEmit` → exit 0; `npm run build` → exit 0

### Step 2: bcrypt 5 → 6

`npm install bcrypt@^6.0.0 && npm install --save-dev @types/bcrypt@latest`.
Verificar que `auth.service.ts` compila sin cambios (hash/compare no cambian).

**Verify**: `npx tsc --noEmit` → exit 0
**Verify manual**: con `npm run dev`, login con un usuario existente funciona
(bcrypt 6 verifica hashes generados por bcrypt 5 — mismo formato $2b$).

### Step 3: @anthropic-ai/sdk 0.82 → 0.104

`npm install @anthropic-ai/sdk@^0.104.1`. Revisar `src/services/receipts.service.ts`:
el constructor `new Anthropic({...})` y `messages.create` con `model`, `max_tokens`,
`messages` siguen siendo válidos. Si el typecheck señala cambios de tipos (p. ej. en
los content blocks de la respuesta), ajustar SOLO el manejo de respuesta en
receipts.service.ts manteniendo el comportamiento.

**Verify**: `npx tsc --noEmit` → exit 0
**Verify**: `npm audit --omit=dev` → 0 vulnerabilidades high; el advisory del SDK desaparece

### Step 4: Verificación funcional

`npm test` (si el plan 002 aterrizó) y arrancar `npm run dev` + `GET /api/health` → 200.
Si hay forma barata de probar el escaneo de un recibo localmente (endpoint
`/api/receipts` con una imagen de prueba), hacerlo y reportar el resultado; si
requiere API key no disponible, anotarlo como no verificado.

## Test plan

- Sin tests nuevos. Gates: typecheck, build, audit limpio, login manual OK.

## Done criteria

- [ ] `npm audit --omit=dev` → 0 HIGH (idealmente 0 total)
- [ ] `npx tsc --noEmit` → exit 0; `npm run build` → exit 0; `npm test` → exit 0 (si existe)
- [ ] Login manual funciona con usuario pre-existente (verifica compat de hashes bcrypt)
- [ ] Solo `package.json`/`package-lock.json` modificados (salvo ajuste de tipos en receipts.service.ts si fue imprescindible, documentado)
- [ ] Fila actualizada en `plans/README.md`

## STOP conditions

- `npm audit fix` intenta cambiar la major de `express` u otra dependencia directa.
- bcrypt 6 no compila en Windows / el `npm install` falla en node-gyp tras dos intentos.
- El bump del SDK de Anthropic exige reescribir la lógica de receipts (más que ajustes
  de tipos puntuales) → reporta el error de compilación exacto.
- El login manual falla tras el bump de bcrypt (los hashes existentes deben seguir validando).

## Maintenance notes

- `resend` → svix → uuid es transitiva: si `npm audit fix` no la resuelve, puede
  necesitar un bump de `resend`; verificar que `sendMonthlySummaryEmail` sigue tipando.
- Programar `npm audit` recurrente (CI ya existe — un paso `npm audit --omit=dev --audit-level=high` es candidato natural, no incluido aquí para no romper builds por advisories nuevos sin revisión).
- El modelo usado en receipts (`claude-haiku-4-5-20251001`) es válido; no tocarlo en este plan.
