# Changelog de base de datos

Historial de versiones del esquema de BD (`prisma/migrations/`, `prisma/schema.prisma`).
Línea de versión independiente del código: tags `db-vX.Y.Z`, publicados por
`db-release.yml` y aplicados con `/migrate db-vX.Y.Z`. Formato basado en
[Keep a Changelog](https://keepachangelog.com/en/1.0.0/) + [SemVer](https://semver.org/spec/v2.0.0.html).

## [0.1.0] - 2026-09-16

### FEAT
* [#5](https://github.com/Jabbcode/cuentas_back/pull/5) FEAT-007: Límites mensuales por categoría
* [#6](https://github.com/Jabbcode/cuentas_back/pull/6) FEAT-008: Guardar items detallados de facturas
* [#8](https://github.com/Jabbcode/cuentas_back/pull/8) FEAT-009: Transferencias entre cuentas - Backend
* [#9](https://github.com/Jabbcode/cuentas_back/pull/9) FEAT-011 - Presupuestos mensuales por categoría (Backend)
* [#10](https://github.com/Jabbcode/cuentas_back/pull/10) Sistema de notificaciones y alertas (FEAT-013)
* [#12](https://github.com/Jabbcode/cuentas_back/pull/12) Transacciones recurrentes automáticas (FEAT-015)
* [#13](https://github.com/Jabbcode/cuentas_back/pull/13) add tags feature (FEAT-016)
* [#31](https://github.com/Jabbcode/cuentas_back/pull/31) eliminar features Budgets y Tags del backend
* [#50](https://github.com/Jabbcode/cuentas_back/pull/50) systemKey estable para categorías de sistema (fin de duplicados)
* [#68](https://github.com/Jabbcode/cuentas_back/pull/68) unit coverage 97.1% + backend E2E API suite
* [#92](https://github.com/Jabbcode/cuentas_back/pull/92) validar el límite de crédito por período, no por saldo acumulado

### OTROS
* [#51](https://github.com/Jabbcode/cuentas_back/pull/51) Prepare Release
* [#52](https://github.com/Jabbcode/cuentas_back/pull/52) limpiar drift de banking-sync (PR #25, no mergeado) + docs
* [#67](https://github.com/Jabbcode/cuentas_back/pull/67) Prepare Release
* [#94](https://github.com/Jabbcode/cuentas_back/pull/94) Release



## Comparaciones completas
