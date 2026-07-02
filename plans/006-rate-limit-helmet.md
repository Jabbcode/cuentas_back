# Plan 006: Añadir rate limiting en auth y headers de seguridad con Helmet

> **Executor instructions**: Sigue este plan paso a paso. Ejecuta cada comando de
> verificación y confirma el resultado esperado antes de avanzar. Si ocurre algo
> de la sección "STOP conditions", detente y reporta — no improvises. Al terminar,
> actualiza tu fila de estado en `plans/README.md`.
>
> **Drift check (ejecutar primero)**: `git diff --stat 73b4102..HEAD -- src/app.ts src/routes/auth.routes.ts package.json`
> Si hay drift, compara los excerpts de "Current state" con el código vivo; en caso
> de mismatch, STOP.

## Status

- **Priority**: P2
- **Effort**: S
- **Risk**: LOW
- **Depends on**: none
- **Category**: security
- **Planned at**: commit `73b4102`, 2026-06-11

## Why this matters

`POST /api/auth/login` y `POST /api/auth/register` no tienen ningún límite de intentos:
un atacante puede probar credenciales sin freno (brute force / credential stuffing)
contra una API pública en Render. Además la app no envía headers de seguridad estándar
(X-Content-Type-Options, etc.). Ambas cosas están ya en el backlog del propio proyecto
(`.claude/project-state.md`, sección Seguridad: "Rate limiting (pendiente)", "Helmet
para headers (pendiente)").

## Current state

- `src/app.ts` — middlewares actuales (líneas 22–28): `cors(...)`, `cookieParser()`,
  `express.json()`. Sin helmet, sin `trust proxy`.
- `src/routes/auth.routes.ts` (completo, 12 líneas):
  ```ts
  router.post('/register', authController.register);
  router.post('/login', authController.login);
  router.post('/logout', authController.logout);
  router.get('/me', authMiddleware, authController.getMe);
  ```
- Deploy: Render (detrás de proxy — las IPs de cliente llegan en `X-Forwarded-For`,
  hace falta `app.set('trust proxy', 1)` para que el rate limit por IP funcione).
- `package.json` — no incluye `helmet` ni `express-rate-limit`. Express es 4.21.
- Regla del repo: avisar antes de añadir dependencias — este plan AUTORIZA exactamente
  dos: `helmet` y `express-rate-limit` (ambas estándar, sin alternativas ya presentes).

## Commands you will need

| Purpose   | Command                                        | Expected on success |
|-----------|------------------------------------------------|---------------------|
| Install   | `npm install helmet express-rate-limit`        | exit 0              |
| Typecheck | `npx tsc --noEmit`                             | exit 0              |
| Tests     | `npm test`                                     | todos pasan         |
| Build     | `npm run build`                                | exit 0              |

## Scope

**In scope**:
- `package.json` / `package-lock.json` (las dos dependencias)
- `src/app.ts`
- `src/middlewares/rate-limit.middleware.ts` (crear)
- `src/routes/auth.routes.ts`

**Out of scope** (NO tocar):
- La configuración CORS existente (línea 23–26 de app.ts) — ya es correcta.
- Rate limiting global de toda la API — solo auth en este plan (ver Maintenance).
- CSP estricta: la API no sirve HTML; usar los defaults de helmet sin configurar CSP a medida.

## Git workflow

- Branch: `feature/006-rate-limit-helmet` (desde `develop`)
- Commit: `feat: rate limiting en auth y headers de seguridad con helmet`
- NO pushear ni abrir PR salvo que el operador lo indique.

## Steps

### Step 1: Instalar dependencias

`npm install helmet express-rate-limit` (ambas traen sus propios types).

**Verify**: `npm ls helmet express-rate-limit` → muestra ambas sin errores

### Step 2: Helmet y trust proxy en app.ts

En `src/app.ts`, tras crear `app`:

```ts
import helmet from 'helmet';
...
app.set('trust proxy', 1); // Render — necesario para IPs reales en rate limit
app.use(helmet());
```

Colocar `helmet()` ANTES de `cors(...)`.

**Verify**: `npx tsc --noEmit` → exit 0

### Step 3: Middleware de rate limit para auth

Crear `src/middlewares/rate-limit.middleware.ts`:

```ts
import rateLimit from 'express-rate-limit';

export const authRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutos
  limit: 10, // 10 intentos por IP por ventana
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  message: { error: 'Demasiados intentos. Inténtalo de nuevo en unos minutos.' },
});
```

En `src/routes/auth.routes.ts`, aplicarlo SOLO a register y login:

```ts
import { authRateLimiter } from '../middlewares/rate-limit.middleware.js';

router.post('/register', authRateLimiter, authController.register);
router.post('/login', authRateLimiter, authController.login);
```

(`/logout` y `/me` no lo necesitan.)

**Verify**: `npx tsc --noEmit` → exit 0
**Verify**: `npm run build` → exit 0

### Step 4: Verificación manual

Con `npm run dev` corriendo:
1. `GET /api/health` → la respuesta incluye headers de helmet
   (`X-Content-Type-Options: nosniff` como mínimo).
2. 11 POST seguidos a `/api/auth/login` con credenciales falsas → los primeros 10
   devuelven 401/400, el 11º devuelve **429** con el mensaje del limiter.
3. El frontend local (localhost:5173) sigue pudiendo hacer login con credenciales
   válidas (CORS + cookies intactos).

## Test plan

- La lógica es de middlewares de terceros — no se exige test unitario propio; la
  verificación manual del Step 4 es el gate. Documentar los 3 resultados.

## Done criteria

- [ ] `npx tsc --noEmit` → exit 0; `npm test` → exit 0; `npm run build` → exit 0
- [ ] `grep -n "helmet()" src/app.ts` → 1 coincidencia antes de `cors`
- [ ] `grep -n "trust proxy" src/app.ts` → 1 coincidencia
- [ ] `grep -c "authRateLimiter" src/routes/auth.routes.ts` → 3 (import + 2 rutas)
- [ ] Verificación manual: 429 al 11º intento y headers de helmet presentes
- [ ] `git status` sin archivos fuera del scope
- [ ] Fila actualizada en `plans/README.md`

## STOP conditions

- `helmet()` con defaults rompe el flujo del frontend local (cookies o CORS) tras
  verificar dos veces → reporta qué header lo causa en vez de desactivar helmet entero.
- `express-rate-limit` exige una versión de Express incompatible con 4.21 → reporta.
- El endpoint `/api/monitoring/sentry-tunnel` deja de funcionar por algún header → ese
  endpoint está fuera de scope, reporta.

## Maintenance notes

- El limiter es en memoria: si el deploy escala a >1 instancia, los límites son por
  instancia (suficiente hoy; con escala usar un store Redis).
- Tras desplegar, vigilar que usuarios legítimos no choquen con el 429 (10/15min es
  conservador para una app personal).
- Follow-up natural: un limiter global laxo (p. ej. 300 req/15min) para toda la API.
- `trust proxy` afecta a `req.ip` globalmente — si se añade logging por IP, ya queda correcto.
