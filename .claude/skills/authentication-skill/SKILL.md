---
name: authentication-skill
description: Manejar autenticación con JWT y bcrypt — AuthRequest type, middleware y extracción de userId
type: skill
---

## Cuándo Usar

- Al escribir cualquier controller que requiera usuario autenticado
- Al entender el flujo de autenticación del proyecto
- Al crear rutas protegidas

## Tipo AuthRequest

```typescript
// src/types/index.ts
export interface AuthRequest extends Request {
  user?: {
    userId: string;
    email: string;
  };
}
```

## Uso en Controllers

```typescript
import { AuthRequest } from '../types/index.js';

// userId siempre de req.user!.userId — nunca del body o params
export async function getAccounts(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const accounts = await accountsService.getAccounts(req.user!.userId);
    res.json(accounts);
  } catch (error) {
    next(error);
  }
}
```

## Aplicar authMiddleware en Routes

```typescript
import { Router } from 'express';
import { authMiddleware } from '../middlewares/auth.middleware.js';

const router = Router();
router.use(authMiddleware); // protege todas las rutas del router

router.get('/', accountsController.getAccounts);
router.post('/', accountsController.createAccount);

export default router;
```

## Flujo JWT

1. `POST /api/auth/login` → valida email/password con bcrypt → retorna token JWT
2. Frontend guarda token en `localStorage.token`
3. Cada request incluye `Authorization: Bearer <token>`
4. `authMiddleware` valida token → popula `req.user` con `{ userId, email }`
5. Controller extrae `req.user!.userId` → pasa al service

## Anti-patterns

- ❌ `req.body.userId` como fuente del userId — manipulable por el cliente
- ❌ Rutas sin `authMiddleware` que accedan a datos de usuario
- ❌ `req.user?.userId ?? ''` — si user es undefined, el middleware falló; lanzar error
- ❌ Loguear tokens JWT en console.log
