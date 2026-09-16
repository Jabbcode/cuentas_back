# Changelog

Todos los cambios notables de este proyecto se documentan en este fichero.

El formato sigue [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
y este proyecto sigue [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [1.3.0] - 2026-09-16

### FEAT
* [#92](https://github.com/Jabbcode/cuentas_back/pull/92) validar el límite de crédito por período, no por saldo acumulado
* [#93](https://github.com/Jabbcode/cuentas_back/pull/93) bloquear crear/editar transacciones en período ya pagado

### OTROS
* [#88](https://github.com/Jabbcode/cuentas_back/pull/88) Sync release 1.2.0 to develop
* [#94](https://github.com/Jabbcode/cuentas_back/pull/94) Release



## [1.2.0] - 2026-09-15

### FEAT
* [#86](https://github.com/Jabbcode/cuentas_back/pull/86) pago de periodos atrasados de tarjeta de credito

### OTROS
* [#88](https://github.com/Jabbcode/cuentas_back/pull/88) sync develop con main v1.1.4
* [#90](https://github.com/Jabbcode/cuentas_back/pull/90) Release



## [1.1.4] - 2026-09-15

### FEAT
* [#85](https://github.com/Jabbcode/cuentas_back/pull/85) log de detalle numérico en conflictos de negocio frecuentes

### OTROS
* [#83](https://github.com/Jabbcode/cuentas_back/pull/83) Sync release 1.1.3 to develop
* [#87](https://github.com/Jabbcode/cuentas_back/pull/87) Release v1.1.4



## [1.1.3] - 2026-09-14

### FIXES
* [#81](https://github.com/Jabbcode/cuentas_back/pull/81) agrega err.message al log de HTTP

### OTROS
* [#79](https://github.com/Jabbcode/cuentas_back/pull/79) Sync release 1.1.2 to develop
* [#82](https://github.com/Jabbcode/cuentas_back/pull/82) v1.1.3 - mensaje de error en logs de HTTP



## [1.1.2] - 2026-09-14

### FIXES
* [#77](https://github.com/Jabbcode/cuentas_back/pull/77) recorta el log de request de pino-http a lo esencial

### OTROS
* [#75](https://github.com/Jabbcode/cuentas_back/pull/75) Sync release 1.1.1 to develop
* [#78](https://github.com/Jabbcode/cuentas_back/pull/78) v1.1.2



## [1.1.1] - 2026-09-14

### FEAT
* [#73](https://github.com/Jabbcode/cuentas_back/pull/73) logging estructurado con pino + fix de silencio de errores en prod

### OTROS
* [#72](https://github.com/Jabbcode/cuentas_back/pull/72) Sync release 1.1.0 to develop
* [#74](https://github.com/Jabbcode/cuentas_back/pull/74) Release 1.1.1



## [1.1.0] - 2026-09-14

### FEAT
* [#1](https://github.com/Jabbcode/cuentas_back/pull/1) add claude context structure for backend documentation
* [#2](https://github.com/Jabbcode/cuentas_back/pull/2) add modular skills and agents documentation structure
* [#3](https://github.com/Jabbcode/cuentas_back/pull/3) FIX-002: Sincronización bidireccional de fechas entre Fixed Expenses y Recurring Debt Payments
* [#5](https://github.com/Jabbcode/cuentas_back/pull/5) FEAT-007: Límites mensuales por categoría
* [#6](https://github.com/Jabbcode/cuentas_back/pull/6) FEAT-008: Guardar items detallados de facturas
* [#8](https://github.com/Jabbcode/cuentas_back/pull/8) FEAT-009: Transferencias entre cuentas - Backend
* [#9](https://github.com/Jabbcode/cuentas_back/pull/9) FEAT-011 - Presupuestos mensuales por categoría (Backend)
* [#10](https://github.com/Jabbcode/cuentas_back/pull/10) Sistema de notificaciones y alertas (FEAT-013)
* [#11](https://github.com/Jabbcode/cuentas_back/pull/11) GET /dashboard/monthly-summary endpoint (FEAT-017)
* [#12](https://github.com/Jabbcode/cuentas_back/pull/12) Transacciones recurrentes automáticas (FEAT-015)
* [#13](https://github.com/Jabbcode/cuentas_back/pull/13) add tags feature (FEAT-016)
* [#16](https://github.com/Jabbcode/cuentas_back/pull/16) custom error classes + typed error handler (REFACTOR-BE-001)
* [#29](https://github.com/Jabbcode/cuentas_back/pull/29) FIX-032 — JWT en httpOnly cookies (seguridad XSS)
* [#30](https://github.com/Jabbcode/cuentas_back/pull/30) sameSite condicional en cookies — lax en local, none en producción
* [#31](https://github.com/Jabbcode/cuentas_back/pull/31) eliminar features Budgets y Tags del backend
* [#35](https://github.com/Jabbcode/cuentas_back/pull/35) JWT_SECRET obligatorio — fallar al arrancar si falta
* [#36](https://github.com/Jabbcode/cuentas_back/pull/36) instalar Vitest y baseline de tests para lib/utils
* [#37](https://github.com/Jabbcode/cuentas_back/pull/37) saldo y transacción en un único prisma.$transaction (atomicidad)
* [#38](https://github.com/Jabbcode/cuentas_back/pull/38) userId en WHERE de update/delete y validación de ownership de FKs
* [#39](https://github.com/Jabbcode/cuentas_back/pull/39) crons con try/catch, dueDay clampeado a fin de mes y check en batch
* [#40](https://github.com/Jabbcode/cuentas_back/pull/40) batch de queries en credit cards summary y sync de recurrentes
* [#41](https://github.com/Jabbcode/cuentas_back/pull/41) rate limiting en auth y headers de seguridad con helmet
* [#42](https://github.com/Jabbcode/cuentas_back/pull/42) resolver vulnerabilidades de npm audit
* [#43](https://github.com/Jabbcode/cuentas_back/pull/43) límites de mes con rango exclusivo vía getMonthRange
* [#44](https://github.com/Jabbcode/cuentas_back/pull/44) actualizar project-state y ADR-007 tras eliminación de Budgets/Tags
* [#45](https://github.com/Jabbcode/cuentas_back/pull/45) convertir imports dinámicos a estáticos en services
* [#46](https://github.com/Jabbcode/cuentas_back/pull/46) detectar pago de tarjeta ya existente por tipo en vez de texto
* [#47](https://github.com/Jabbcode/cuentas_back/pull/47) agregar el dashboard en la base de datos en vez de reduce en JS
* [#48](https://github.com/Jabbcode/cuentas_back/pull/48) sacar prisma directo de sendTestEmail y cron mensual a repos/services
* [#49](https://github.com/Jabbcode/cuentas_back/pull/49) batch multi-usuario en el cron mensual para eliminar el N+1
* [#50](https://github.com/Jabbcode/cuentas_back/pull/50) systemKey estable para categorías de sistema (fin de duplicados)
* [#53](https://github.com/Jabbcode/cuentas_back/pull/53) crear transacciones desde Tarjetas de Credito - validacion de limite
* [#54](https://github.com/Jabbcode/cuentas_back/pull/54) Ports & Adapters Fase 1 — account + user/auth (ADR-009)
* [#56](https://github.com/Jabbcode/cuentas_back/pull/56) entorno de pre-producción (rama develop de Neon)
* [#57](https://github.com/Jabbcode/cuentas_back/pull/57) render.yaml Blueprint para staging (cuentas-back-staging)
* [#61](https://github.com/Jabbcode/cuentas_back/pull/61) Ports & Adapters Fase 3 — category + notification + credit-cards (ADR-009)
* [#62](https://github.com/Jabbcode/cuentas_back/pull/62) Ports & Adapters Fase 4 — dashboard + fixed-expenses + settings (ADR-009)
* [#63](https://github.com/Jabbcode/cuentas_back/pull/63) Ports & Adapters Fase 5 — transactions + receipts (ADR-009)
* [#64](https://github.com/Jabbcode/cuentas_back/pull/64) Fase 6 — cierre ADR-009 (services inyectan services, no repos ajenos)
* [#65](https://github.com/Jabbcode/cuentas_back/pull/65) separa interfaces (ports) de implementaciones en services y repositories
* [#66](https://github.com/Jabbcode/cuentas_back/pull/66) Ports & Adapters Fase 2 — debt + recurring-debt-payments (ADR-009)
* [#68](https://github.com/Jabbcode/cuentas_back/pull/68) unit coverage 97.1% + backend E2E API suite
* [#69](https://github.com/Jabbcode/cuentas_back/pull/69) gestión de versión y despliegues controlados por comando

### FIXES
* [#4](https://github.com/Jabbcode/cuentas_back/pull/4) Corrección de comparación TypeScript entre number y Decimal
* [#14](https://github.com/Jabbcode/cuentas_back/pull/14) FIX-012: Porcentaje de uso incorrecto en tarjetas de crédito
* [#26](https://github.com/Jabbcode/cuentas_back/pull/26) security & quality fixes — JSON parse crash, CORS, error handling
* [#27](https://github.com/Jabbcode/cuentas_back/pull/27) Sentry tunnel endpoint para evitar bloqueo por ad blockers
* [#58](https://github.com/Jabbcode/cuentas_back/pull/58) prepare script de husky rompe el build en Render (NODE_ENV=production)
* [#59](https://github.com/Jabbcode/cuentas_back/pull/59) render.yaml — build omite devDependencies con NODE_ENV=production

### REFACTOR
* [#17](https://github.com/Jabbcode/cuentas_back/pull/17) decompose payDebt + remove dynamic import (REFACTOR-BE-002)
* [#18](https://github.com/Jabbcode/cuentas_back/pull/18) mover checkBudgetAndNotify a budgets.service
* [#19](https://github.com/Jabbcode/cuentas_back/pull/19) verificar userId en updateAccountBalance
* [#20](https://github.com/Jabbcode/cuentas_back/pull/20) eliminar any en debts.service
* [#21](https://github.com/Jabbcode/cuentas_back/pull/21) extraer funciones puras a lib/utils/
* [#22](https://github.com/Jabbcode/cuentas_back/pull/22) extraer buildTransactionWhereInput a transaction.utils
* [#23](https://github.com/Jabbcode/cuentas_back/pull/23) crear capa repositories/ como único acceso a Prisma
* [#24](https://github.com/Jabbcode/cuentas_back/pull/24) migrar services para consumir repositories

### OTROS
* [#7](https://github.com/Jabbcode/cuentas_back/pull/7) CHORE-009: Configurar CI/CD y validaciones pre-deploy
* [#28](https://github.com/Jabbcode/cuentas_back/pull/28) Sentry tunnel endpoint
* [#32](https://github.com/Jabbcode/cuentas_back/pull/32) planes de mejora del backend (skill improve)
* [#33](https://github.com/Jabbcode/cuentas_back/pull/33) Prepare Release
* [#34](https://github.com/Jabbcode/cuentas_back/pull/34) limpiar config de Claude Code y migrar specs/plans al vault
* [#51](https://github.com/Jabbcode/cuentas_back/pull/51) Prepare Release
* [#52](https://github.com/Jabbcode/cuentas_back/pull/52) limpiar drift de banking-sync (PR #25, no mergeado) + docs
* [#60](https://github.com/Jabbcode/cuentas_back/pull/60) consolidar entorno de staging en project-state.md
* [#67](https://github.com/Jabbcode/cuentas_back/pull/67) Prepare Release
* [#71](https://github.com/Jabbcode/cuentas_back/pull/71) Release



## Comparaciones completas

- [v1.2.0...v1.3.0](https://github.com/Jabbcode/cuentas_back/compare/v1.2.0...v1.3.0)
- [v1.1.4...v1.2.0](https://github.com/Jabbcode/cuentas_back/compare/v1.1.4...v1.2.0)
- [v1.1.3...v1.1.4](https://github.com/Jabbcode/cuentas_back/compare/v1.1.3...v1.1.4)
- [v1.1.2...v1.1.3](https://github.com/Jabbcode/cuentas_back/compare/v1.1.2...v1.1.3)
- [v1.1.1...v1.1.2](https://github.com/Jabbcode/cuentas_back/compare/v1.1.1...v1.1.2)
- [v1.1.0...v1.1.1](https://github.com/Jabbcode/cuentas_back/compare/v1.1.0...v1.1.1)
- [v1.0.0...v1.1.0](https://github.com/Jabbcode/cuentas_back/compare/v1.0.0...v1.1.0)
