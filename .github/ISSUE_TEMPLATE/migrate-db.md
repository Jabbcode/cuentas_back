---
name: Migrar la BD de producción
about: Aplica las migraciones de un tag db-vX.Y.Z contra la BD de producción (comando /migrate)
title: "Migrate db-vX.Y.Z en producción"
labels: migrate
---

<!--
Cambia X.Y.Z por la versión de BD (tag db-vX.Y.Z ya publicado) cuyo estado
quieres aplicar. `prisma migrate deploy` aplica TODAS las migraciones pendientes
hasta el commit de ese tag, no solo las "de esa versión". Sin rollback automático.
Solo funciona si lo abre el dueño del repo.
-->

/migrate db-vX.Y.Z
