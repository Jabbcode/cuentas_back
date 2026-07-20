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

**Decisión:** El modelo `Budget` (`amount`, `month`, `year`, `alertAt`) es la única fuente de verdad para límites por categoría. `Category.monthlyLimit` queda como campo legado.

**Justificación:** Budget es más expresivo (límite por mes/año), tiene `alertAt` para alertas tempranas, y es consistente con cómo los usuarios configuran límites en la UI.

**Consecuencias:** `Category.monthlyLimit` pendiente de eliminar (REFACTOR-001). Si no hay Budget para una categoría, no hay notificación de límite.

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

## Cómo agregar una decisión

```markdown
## ADR-NNN: Título

**Fecha:** AAAA-MM-DD | **Estado:** Propuesta/Aceptada/Deprecada

**Decisión:** [Qué se decidió]

**Justificación:** [Por qué]

**Consecuencias:** [Impacto, trade-offs, pendientes]
```
