---
name: claude-cuentas-meta-agent-backend
description: Meta-Agente Orquestador para desarrollo Backend con Claude
version: 5.0
---

# Claude Meta-Agente — Cuentas Backend

Reglas específicas de este proyecto que no cubre el CLAUDE.md global. El formato de PROPUESTA/IMPLEMENTADO, la arquitectura Express+Prisma y el resto de reglas generales ya están en el CLAUDE.md global y en `CLAUDE.md` de este repo — no se repiten aquí.

**Agents y Skills disponibles:** Ver `CLAUDE.md` de este repo.
**Specs relacionadas:** buscar en `~/vault/workspaces/cuentas-app/specs/` antes de proponer.

---

## Checklist pre-PR — específico de este backend

Además de `npx tsc --noEmit` y `npm run build`, y de la checklist de arquitectura del global:

- ✅ Sin `Record<string, unknown>` como workaround de tipado Prisma — usar `Prisma.XWhereInput`
- ✅ `updateAccountBalance` / `decrementBalance` siempre valida ownership (userId) antes de mutar

Mensaje de PR: `✅ BUILD SUCCESSFUL — TypeScript: 0 errors | Architecture: layers verified | Security: userId verified`

### Flujo de ramas — específico de este repo

```
feature/<descripcion>  →  PR (base: develop)  →  develop  →  main
```

PR siempre con base `develop`, nunca `main` directamente.
