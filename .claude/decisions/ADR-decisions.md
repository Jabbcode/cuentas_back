# Decisions — Cuentas Backend

Registro de decisiones arquitectónicas del proyecto backend.

---

## ADR-001: Express sobre Fastify

**Fecha:** 2024 | **Estado:** Aceptada

**Decisión:** Usar Express 4.21 como framework HTTP.

**Justificación:** Ecosistema más amplio, mayor documentación, familiaridad. El overhead de Express es aceptable para el volumen actual.

---

## ADR-002: Prisma sobre Raw SQL

**Fecha:** 2024 | **Estado:** Aceptada

**Decisión:** Usar Prisma 5.22 como ORM.

**Justificación:** Type-safety automática, migrations declarativas, esquema como fuente de verdad. **Nota:** Prisma retorna `Decimal` para campos monetarios — siempre convertir con `.toNumber()`.

---

## ADR-003: Zod para validación de inputs

**Fecha:** 2024 | **Estado:** Aceptada

**Decisión:** Usar Zod 3.23 para validar todos los inputs de API.

**Justificación:** TypeScript-first, infiere tipos con `z.infer<>`, mensajes de error claros, composable con `.partial()` para updates.

---

## ADR-004: PostgreSQL como base de datos

**Fecha:** 2024 | **Estado:** Aceptada

**Decisión:** PostgreSQL como única base de datos.

**Justificación:** ACID compliance, soporte nativo de Prisma, tipos robustos, soporte para campos JSON (`notificationPreferences`).

---

## ADR-005: JWT en httpOnly cookie

**Fecha:** 2026-06-01 | **Estado:** Aceptada | **Reemplaza:** JWT en localStorage

**Decisión:** El JWT se almacena en una httpOnly cookie seteada por el backend. El frontend usa `withCredentials: true`; nunca lee ni escribe el token directamente.

**Config:** `httpOnly: true`, `secure: true` (prod), `sameSite: 'none'` (cross-origin Vercel→Render), `maxAge: 7d`.

**Justificación:** localStorage es accesible desde JavaScript — cualquier script de terceros (analytics, extensiones) puede leerlo. En una app financiera el impacto de un XSS es crítico. httpOnly elimina ese vector completamente.

**Consecuencias:**
- ✅ Token invisible para JavaScript
- ✅ Protección XSS automática por el browser
- ⚠️ `sameSite: 'none'` requiere `secure: true` — solo funciona en HTTPS
- ⚠️ `sameSite: 'strict'` no funciona cross-origin — usar `none` para Vercel→Render
- **Regla crítica:** `userId` siempre de `req.user!.userId` (extraído del token por el middleware), nunca de body/params/query

---

## ADR-006: Resend para email transaccional

**Fecha:** 2026-04-21 | **Estado:** Aceptada

**Decisión:** Usar Resend SDK para envío de emails (resúmenes mensuales, alertas).

**Justificación:** Setup mínimo (solo API key), SDK TypeScript-first, sin configurar SMTP. Free tier suficiente para uso actual.

**Consecuencias:** Dependencia de servicio externo. Variables: `RESEND_API_KEY`, `RESEND_FROM_EMAIL`. Requiere dominio verificado en prod.

---

## ADR-007: Budget como fuente de verdad para límites de gasto

**Fecha:** 2026-04-21 | **Estado:** Obsoleta (2026-06-02) — el modelo `Budget` y la feature completa se eliminaron del backend (`chore: eliminar features Budgets y Tags`). Se conserva como registro histórico.

**Decisión original:** El modelo `Budget` (`amount`, `month`, `year`, `alertAt`) es la única fuente de verdad para límites por categoría. `Category.monthlyLimit` queda como campo legado.

**Justificación original:** Budget es más expresivo (límite por mes/año), tiene `alertAt` para alertas tempranas, y es consistente con cómo los usuarios configuran límites en la UI.

**Reemplazo (2026-06-02, tras eliminar Budgets/Tags):** `Category.monthlyLimit` vuelve a ser el único mecanismo de límites por categoría y está en uso activo (dashboard `getByCategory`). REFACTOR-001 (eliminar `monthlyLimit`) queda cancelado — no debe volver a proponerse sin una decisión de producto explícita. La notificación de límite (`checkBudgetAndNotify`) no sobrevivió a la eliminación de Budgets; el tipo `category_limit` existe en el schema pero ningún código lo genera hoy.

---

## ADR-008: Clean Architecture — capa repositories

**Fecha:** 2026-05-12 | **Estado:** Aceptada

**Decisión:** Tres capas estrictas: `controllers` → `services` → `repositories`. Solo `repositories/` importa `prisma`. Services no acceden a Prisma directamente.

**Justificación:** PRs BE-001→BE-009 completaron la refactorización. La separación permite testear services sin base de datos real (mock del repo), evita circular imports, y concentra el acceso a datos en un solo lugar.

**Consecuencias:**
- ✅ 14 repositorios creados, un repositorio por modelo
- ✅ Services completamente desacoplados de Prisma
- ✅ Funciones puras en `lib/utils/` (credit-card, date, debt, projection, transaction)
- ✅ Errores tipados en `lib/errors.ts` (AppError, NotFoundError, ConflictError, ForbiddenError, ValidationError)
- ⚠️ Más archivos por feature — trade-off aceptado a cambio de testabilidad

---

## ADR-009: Ports & Adapters para repositories y services

**Fecha:** 2026-07-22 | **Estado:** Aceptada | **Reemplaza parcialmente:** convención de REFACTOR-BE-002 citada en ADR-008

**Decisión:** `repositories/` y `services/` se definen como `interface` (el *port*) + `class XImpl implements Interface` (el *adapter*), con inyección de dependencias por constructor. Un service que necesita datos o lógica de otro dominio inyecta la **interfaz** del service dueño — nunca su repositorio ni su clase concreta. El wiring vive en un único archivo `src/bootstrap.ts` (composition root): instancia todo con `new`, en orden de dependencia, sin librería de DI. Los controllers importan las instancias ya armadas desde `bootstrap.ts`, no desde el archivo de service.

**Justificación:** Nombre arquitectónico: **Ports & Adapters / Arquitectura Hexagonal** (Cockburn), consistente con Clean Architecture y el principio de inversión de dependencias (la "D" de SOLID). Resuelve un hallazgo real: 13 de 15 services importaban repositorios de otros dominios directamente, bypaseando la lógica de negocio del dueño (ej. `debts.service` escribía en `recurring-debt-payment.repository` sin pasar por `recurring-debt-payments.service`). Se adopta esta forma concreta (clases + `implements`, no factory functions) para que el mismo patrón, con la misma nomenclatura, se reutilice en proyectos futuros del usuario.

**Consecuencias:**
- ⚠️ Reemplaza ADR-008 solo en **cómo se estructuran** `repositories/` y `services/`. El resto de ADR-008 sigue vigente: 3 capas estrictas, solo la capa repository (ahora sus clases `Impl`) toca Prisma.
- ⚠️ Esta decisión **no aplica** a `lib/utils/` — sigue siendo funciones puras exportadas individualmente, sin clases, sin cambio (la parte de REFACTOR-BE-002 sobre utils permanece vigente).
- Rollout gradual por fases documentado en spec (`~/vault/workspaces/cuentas-app/specs/`) — mientras dura la migración, conviven el estilo funcional (features no migradas) y el estilo interfaz+clase (features migradas). Excepción puntual y documentada a la regla general de "sin shims", justificada por el volumen (~41 archivos).
- Nomenclatura: `<Entity>Repository` (interfaz) / `<Entity>RepositoryImpl` (clase); `<Feature>Service` (interfaz) / `<Feature>ServiceImpl` (clase).
- Nuevo archivo `src/bootstrap.ts` — único lugar donde se instancian repositories/services con `new`.
- **Actualización 2026-07-23 (Fase 2):** el port (interfaz) vive en su propio fichero `<nombre>.port.ts`, separado del adapter (`class ...Impl`, en `<nombre>.ts`), que importa el tipo desde su `.port.ts`. Rige para las Fases 3-5. Las Fases 1 y 2 ya siguen esta convención (Fase 1 recibió un retrofit en el mismo ciclo de implementación de la Fase 2, sin cambio de comportamiento).

---

## ADR-010: Normalización de magic numbers/strings a constantes/enums

**Fecha:** 2026-07-23 | **Estado:** Aceptada

**Decisión:** Ningún literal de dominio (status, tipos, frecuencias, mensajes de error) vive suelto en el código — se extrae a `src/lib/constants/<archivo>.constants.ts`, con el patrón `export const X = { ... } as const` (+ tipo derivado `(typeof X)[keyof typeof X]`, + tupla `X_VALUES` cuando alimenta un `z.enum()`). Regla de ubicación: si el literal es propio de un solo dominio (ej. `DEBT_STATUS`), vive en `<dominio>.constants.ts`; si se usa en 3+ dominios distintos (ej. `'expense'/'income'`, `'Cuenta no encontrada'`), vive en `shared.constants.ts`. Un dominio puede reutilizar la constante de otro dominio dueño (ej. `recurring-debt-payments.service.ts` reusa `DEBT_MESSAGES.NOT_FOUND` de `debt.constants.ts`) — eso no lo convierte en global, sigue siendo del dominio dueño.

**Justificación:** El código tenía literales repetidos sin nombre en varios archivos (ej. `'active'/'paid'/'overdue'` duplicado entre `debt.schema.ts`, `debt.utils.ts` y `debts.service.ts`; `expiresIn: '7d'` repetido sin constante) — dificulta saber a simple vista qué representa un valor y su alcance de reutilización real. Se integra dentro de cada fase del rollout Ports & Adapters (ADR-009) en vez de abrir un frente aparte: cada fase, al convertir sus repos/services, también normaliza los literales de los archivos que ya está tocando.

**Consecuencias:**
- ✅ `src/lib/constants/` (ya existía con `category-system-keys.ts`) pasa a ser la carpeta única para constantes de dominio y globales — un archivo por dominio, más `shared.constants.ts` para lo cross-domain.
- ✅ Retrofit aplicado en el mismo ciclo a Fases 1 (`account`, `auth`) y 2 (`debt`, `recurring-debt-payment`): `ACCOUNT_TYPES`, `ACCOUNT_MESSAGES`, `AUTH_MESSAGES`, `JWT_EXPIRES_IN`, `DEBT_STATUS`, `INTEREST_TYPE`, `DEBT_MESSAGES`, `RECURRING_FREQUENCY`, `RECURRING_DEBT_PAYMENT_MESSAGES`, `PROCESS_PENDING_STATUS`/`PROCESS_PENDING_REASONS`, y los globales `TRANSACTION_TYPE`/`SHARED_MESSAGES`.
- ⚠️ No se retrofittean los ~20 archivos fuera del rollout (ej. `transactions.service.ts`, `categories.service.ts`) que también usan `'expense'/'income'` — se normalizan cuando su propio dominio entre en una fase, igual que el resto de la convivencia gradual de ADR-009.
- Rige para Fases 3-5: cada fase normaliza los literales de los archivos que convierte, sin excepción.

---

## Cómo agregar una decisión

```markdown
## ADR-NNN: Título

**Fecha:** AAAA-MM-DD | **Estado:** Propuesta/Aceptada/Deprecada

**Decisión:** [Qué se decidió]

**Justificación:** [Por qué]

**Consecuencias:** [Impacto, trade-offs, pendientes]
```
