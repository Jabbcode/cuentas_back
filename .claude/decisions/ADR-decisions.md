# Decisions — Cuentas Backend

Registro de decisiones arquitectónicas del proyecto backend.

---

## ADR-001: Express sobre Fastify

**Fecha:** 2024 | **Estado:** Aceptada

**Decisión:** Usar Express 4.21 como framework HTTP.

**Justificación:** Ecosistema más amplio, mayor documentación, familiaridad del equipo. Fastify sería más rápido pero el overhead de Express es aceptable para el volumen actual.

---

## ADR-002: Prisma sobre Raw SQL

**Fecha:** 2024 | **Estado:** Aceptada

**Decisión:** Usar Prisma 5.22 como ORM.

**Justificación:** Type-safety automática en queries, migrations declarativas, esquema como fuente de verdad. El trade-off de performance vs Raw SQL es aceptable. **Nota:** Prisma retorna `Decimal` para campos numéricos monetarios — siempre convertir con `.toNumber()` antes de operar.

---

## ADR-003: Zod para validación de inputs

**Fecha:** 2024 | **Estado:** Aceptada

**Decisión:** Usar Zod 3.23 para validar todos los inputs de API.

**Justificación:** TypeScript-first, infiere tipos automáticamente con `z.infer<>`, mensajes de error claros, composable con `.partial()` para updates.

---

## ADR-004: PostgreSQL como base de datos

**Fecha:** 2024 | **Estado:** Aceptada

**Decisión:** PostgreSQL como única base de datos.

**Justificación:** ACID compliance, soporte nativo de Prisma, tipos robustos, soporte para campos JSON (`notificationPreferences`).

---

## ADR-005: JWT para autenticación

**Fecha:** 2024 | **Estado:** Aceptada

**Decisión:** JWT con HS256, expira en 24h, almacenado en localStorage del frontend.

**Justificación:** Stateless, simple de implementar, suficiente para el volumen actual. **Regla crítica:** userId siempre extraído del token (`req.user!.userId`), nunca de parámetros del cliente.

---

## ADR-006: Resend para email transaccional

**Fecha:** 2026-04-21 | **Estado:** Aceptada

**Decisión:** Usar Resend SDK para envío de emails (resúmenes mensuales, alertas).

**Justificación:** Setup mínimo (solo API key), SDK TypeScript-first, sin configurar SMTP. Free tier suficiente para uso actual. Requiere dominio verificado en producción.

**Consecuencias:** Dependencia de servicio externo. Variables requeridas: `RESEND_API_KEY`, `RESEND_FROM_EMAIL`.

---

## ADR-007: Budget como fuente de verdad para límites de gasto

**Fecha:** 2026-04-21 | **Estado:** Aceptada

**Decisión:** El modelo `Budget` (con `amount`, `month`, `year`, `alertAt`) es la única fuente de verdad para límites por categoría. El campo `Category.monthlyLimit` queda como legado.

**Justificación:** Budget es más expresivo (límite específico por mes/año), tiene `alertAt` para alertas tempranas, y es consistente con cómo los usuarios configuran límites en la UI.

**Consecuencias:** `Category.monthlyLimit` pendiente de eliminar (REFACTOR-001). Si no hay Budget para una categoría, no hay notificación de límite.

---

## Cómo agregar una decisión

```markdown
## ADR-NNN: Título

**Fecha:** AAAA-MM-DD | **Estado:** Propuesta/Aceptada/Deprecada

**Decisión:** [Qué se decidió]

**Justificación:** [Por qué]

**Consecuencias:** [Impacto, trade-offs, pendientes]
```
