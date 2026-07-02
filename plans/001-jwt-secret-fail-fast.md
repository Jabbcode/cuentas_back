# Plan 001: Eliminar el fallback inseguro de JWT_SECRET y fallar al arrancar si falta

> **Executor instructions**: Sigue este plan paso a paso. Ejecuta cada comando de
> verificación y confirma el resultado esperado antes de avanzar. Si ocurre algo
> de la sección "STOP conditions", detente y reporta — no improvises. Al terminar,
> actualiza tu fila de estado en `plans/README.md`.
>
> **Drift check (ejecutar primero)**: `git diff --stat 73b4102..HEAD -- src/middlewares/auth.middleware.ts src/services/auth.service.ts src/index.ts .env.example`
> Si algún archivo in-scope cambió desde que se escribió este plan, compara los
> excerpts de "Current state" con el código vivo; si no coinciden, es STOP.

## Status

- **Priority**: P1
- **Effort**: S
- **Risk**: LOW
- **Depends on**: none
- **Category**: security
- **Planned at**: commit `73b4102`, 2026-06-11

## Why this matters

Si la variable de entorno `JWT_SECRET` no está definida (un deploy mal configurado en
Render, un entorno nuevo), el servidor firma y verifica TODOS los tokens con la cadena
literal `'your-secret-key'`. Cualquier atacante que conozca ese valor (es un placeholder
público y común) puede forjar un JWT válido para cualquier `userId` y acceder a los datos
financieros de cualquier usuario. El fix es que el servidor se niegue a arrancar sin secret.

## Current state

- `src/middlewares/auth.middleware.ts` — middleware que verifica el JWT de la cookie:
  ```ts
  // src/middlewares/auth.middleware.ts:5
  const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key';
  ```
- `src/services/auth.service.ts` — login/register que firman el JWT:
  ```ts
  // src/services/auth.service.ts:7
  const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key';
  ```
- `src/index.ts` — entry point (8 líneas): importa `app` y arranca `app.listen(PORT)`.
- Convención del repo: ESM con extensiones `.js` en los imports (`import x from './y.js'`),
  TypeScript strict, módulos en `src/lib/`.

## Commands you will need

| Purpose   | Command            | Expected on success |
|-----------|--------------------|---------------------|
| Typecheck | `npx tsc --noEmit` | exit 0, sin errores |
| Build     | `npm run build`    | exit 0              |

## Scope

**In scope** (los únicos archivos a modificar):
- `src/lib/env.ts` (crear)
- `src/middlewares/auth.middleware.ts`
- `src/services/auth.service.ts`
- `.env.example` (asegurar que documenta `JWT_SECRET`)

**Out of scope** (NO tocar aunque parezca relacionado):
- Cualquier otra variable de entorno con fallback (`PORT`, `CORS_ORIGIN`) — son
  fallbacks razonables de desarrollo, no secretos.
- `src/app.ts`, los controllers de auth, la lógica de cookies.
- El archivo `.env` real — nunca leerlo ni copiarlo a ningún sitio.

## Git workflow

- Branch: `feature/001-jwt-secret-fail-fast` (desde `develop`)
- Commits estilo conventional commits del repo, p. ej. `fix: JWT_SECRET obligatorio — fallar al arrancar si falta`
- NO pushear ni abrir PR salvo que el operador lo indique.

## Steps

### Step 1: Crear `src/lib/env.ts` con validación fail-fast

Crear el archivo con exactamente esta forma (ajusta solo si el typecheck lo exige):

```ts
function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Variable de entorno requerida no definida: ${name}`);
  }
  return value;
}

export const JWT_SECRET = requireEnv('JWT_SECRET');
```

El throw a nivel de módulo hace que el proceso muera al arrancar si falta el secret
(el módulo se importa desde el middleware, que se carga vía `app.ts` → `index.ts`).

**Verify**: `npx tsc --noEmit` → exit 0

### Step 2: Reemplazar el fallback en los dos consumidores

En `src/middlewares/auth.middleware.ts` y `src/services/auth.service.ts`, eliminar la
línea `const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key';` y añadir:

```ts
import { JWT_SECRET } from '../lib/env.js';
```

(nota la extensión `.js` — convención ESM del repo).

**Verify**: `npx tsc --noEmit` → exit 0
**Verify**: `grep -rn "your-secret-key" src/` → sin coincidencias

### Step 3: Documentar en `.env.example`

Abrir `.env.example`; si no contiene `JWT_SECRET`, añadir una línea
`JWT_SECRET=` con un comentario `# obligatorio — generar valor aleatorio largo`.
NUNCA poner un valor real.

**Verify**: `grep -n "JWT_SECRET" .env.example` → 1 coincidencia

## Test plan

- Si el plan 002 (baseline Vitest) ya aterrizó: añadir `src/lib/__tests__/env.test.ts`
  que verifica que `requireEnv` lanza con env var ausente y devuelve el valor si existe
  (usar `vi.stubEnv`). Si el plan 002 no aterrizó aún, omitir tests (no hay runner) y
  anotarlo en el reporte final.
- Verificación manual: `npm run build` y luego, en una shell SIN `JWT_SECRET`
  (PowerShell: `Remove-Item Env:JWT_SECRET -ErrorAction SilentlyContinue; node dist/index.js`)
  → el proceso debe terminar con el error "Variable de entorno requerida no definida: JWT_SECRET".
  No dejar el servidor corriendo.

## Done criteria

Machine-checkable. TODOS deben cumplirse:

- [ ] `npx tsc --noEmit` → exit 0
- [ ] `grep -rn "your-secret-key" src/` → 0 coincidencias
- [ ] `src/lib/env.ts` existe y exporta `JWT_SECRET`
- [ ] Arrancar sin `JWT_SECRET` falla con mensaje claro (verificación manual del Test plan)
- [ ] `git status` no muestra archivos modificados fuera del scope
- [ ] Fila actualizada en `plans/README.md`

## STOP conditions

Detente y reporta si:

- Las líneas 5/7 citadas no contienen el fallback `'your-secret-key'` (drift).
- Aparecen otros usos de `process.env.JWT_SECRET` fuera de los dos archivos citados
  (`grep -rn "JWT_SECRET" src/` debería dar solo esos dos antes del cambio).
- El typecheck falla por algo no relacionado con este cambio.

## Maintenance notes

- IMPORTANTE para el operador: antes de desplegar, confirmar que `JWT_SECRET` está
  definido en Render; tras este cambio un deploy sin la variable NO arrancará (eso es
  lo deseado, pero hay que saberlo).
- Si en el futuro se validan más env vars (ANTHROPIC_API_KEY, RESEND_API_KEY),
  añadirlas a `src/lib/env.ts` — es el único punto de validación.
- El secret actual pudo haber convivido con el fallback en algún entorno; si existe
  cualquier duda de que producción corrió sin `JWT_SECRET`, rotar el secret (invalida
  sesiones activas, los usuarios re-loguean).
