---
name: Deploy a producción
about: Despliega un tag vX.Y.Z al servicio de producción de Render (comando /deploy)
title: "Deploy vX.Y.Z a producción"
labels: deploy
---

<!--
Cambia X.Y.Z por la versión (tag vX.Y.Z ya publicado) que quieres desplegar.
Al abrir el issue, el workflow deploy-version.yml valida el tag, escribe
APP_VERSION en Render y dispara el deploy del commit de ese tag.
Solo funciona si lo abre el dueño del repo.
-->

/deploy vX.Y.Z
