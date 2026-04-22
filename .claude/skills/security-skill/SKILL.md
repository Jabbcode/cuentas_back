---
name: security-skill
description: Asegurar que datos no se filteren entre usuarios — userId filtering en cada query
type: skill
---

## Cuándo Usar

- Al escribir cualquier query Prisma que accede a datos del usuario
- Al extraer userId de la request
- Al verificar propiedad de un recurso antes de mutarlo

## Regla de Oro

**Nunca confiar en parámetros del cliente para userId.** El userId siempre viene del token JWT, extraído por `authMiddleware`.

## Extraer userId en Controller

```typescript
import { AuthRequest } from '../types/index.js';

export async function getAccounts(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const userId = req.user!.userId; // del token JWT — nunca de req.body o req.params
    const accounts = await accountsService.getAccounts(userId);
    res.json(accounts);
  } catch (error) {
    next(error);
  }
}
```

## Filtrar en Todas las Queries

```typescript
// ✅ Correcto — usuario solo ve sus datos
prisma.transaction.findMany({ where: { userId } })

// ✅ Correcto — verifica propiedad en update/delete
const item = await prisma.account.findFirst({ where: { id, userId } });
if (!item) throw new Error('No encontrado');

// ❌ Incorrecto — cualquier usuario podría ver datos de otro
prisma.transaction.findMany({ where: { accountId } }) // sin userId
```

## Verificar Propiedad Antes de Mutar

```typescript
// Siempre verificar que el recurso pertenece al usuario antes de update/delete
export async function deleteAccount(id: string, userId: string) {
  const account = await prisma.account.findFirst({ where: { id, userId } });
  if (!account) throw new Error('Cuenta no encontrada'); // 404, no 403 — no revelar existencia
  return prisma.account.delete({ where: { id } });
}
```

## Anti-patterns

- ❌ `prisma.model.findUnique({ where: { id } })` sin userId — no verifica propiedad
- ❌ `userId` tomado de `req.body.userId` o `req.params.userId` — manipulable
- ❌ Retornar error 403 explícito — revela que el recurso existe; usar 404
- ❌ Queries en includes anidados sin filtrar por userId
