# Convenciones del Proyecto - Cuentas Backend

## 📝 Convenciones de Nombres

### Controladores
- **Formato:** `<recurso>.controller.ts`
- **Ubicación:** `src/controllers/`
- **Funciones:** camelCase, verbos claros
- **Ejemplos:** 
  - `getAccounts`, `getAccountById`, `createAccount`, `updateAccount`
  - Archivo: `accounts.controller.ts`

### Servicios
- **Formato:** `<recurso>.service.ts`
- **Ubicación:** `src/services/`
- **Funciones:** camelCase, verbos de acción
- **Exportación:** Named exports individuales o namespace
- **Ejemplos:**
  - `export async function getAccounts(userId)`
  - `export async function createAccount(data, userId)`

### Routes
- **Formato:** `<recurso>.routes.ts`
- **Ubicación:** `src/routes/`
- **Export:** Router con endpoints definidos
- **Naming:** Rutas siguen REST conventions
  - `GET /accounts` - lista
  - `POST /accounts` - crea
  - `GET /accounts/:id` - obtiene
  - `PUT /accounts/:id` - actualiza
  - `DELETE /accounts/:id` - elimina

### Schemas de Validación
- **Formato:** `<recurso>.schema.ts`
- **Ubicación:** `src/schemas/`
- **Naming:** `create<Recurso>Schema`, `update<Recurso>Schema`
- **Export:** Zod schemas + tipos inferidos

### Tipos TypeScript
- **Formato:** PascalCase
- **Ubicación:** `src/types/index.ts` o junto al schema
- **Generar:** Con `type VariableName = z.infer<typeof schema>`
- **Ejemplos:** `Account`, `Transaction`, `CreateAccountInput`

### Variables
- **Formato:** camelCase
- **Constantes:** UPPER_SNAKE_CASE
- **Booleanos:** Prefijo is, has, can, should
- **Ejemplos:** `isActive`, `hasError`, `canDelete`, `shouldValidate`

### Métodos de BD (Prisma)
```typescript
// Convención: <verb><Model><Optional suffix>
prisma.account.findMany()        // obtener múltiples
prisma.account.findUnique()      // obtener uno único
prisma.account.findFirst()       // obtener primero (con where)
prisma.account.create()          // crear
prisma.account.update()          // actualizar
prisma.account.delete()          // eliminar
```

## 📂 Estructura de Carpetas

```
src/
├── controllers/              # HTTP request handlers
│   ├── accounts.controller.ts
│   ├── transactions.controller.ts
│   ├── auth.controller.ts
│   └── ...
├── services/                # Business logic
│   ├── accounts.service.ts
│   ├── transactions.service.ts
│   ├── auth.service.ts
│   └── ...
├── routes/                  # Route definitions
│   ├── accounts.routes.ts
│   ├── transactions.routes.ts
│   ├── auth.routes.ts
│   ├── index.ts            # Agrupa todas las rutas
│   └── ...
├── schemas/                # Zod validation schemas
│   ├── account.schema.ts
│   ├── transaction.schema.ts
│   └── ...
├── middlewares/            # Express middlewares
│   ├── auth.middleware.ts
│   ├── errorHandler.ts
│   └── validate.middleware.ts
├── lib/                    # Utilities
│   ├── prisma.ts          # Prisma client instance
│   └── errors.ts          # Custom error classes
├── types/                 # Type definitions
│   └── index.ts
├── app.ts                 # Express app configuration
└── index.ts               # Entry point

prisma/
├── schema.prisma          # Database schema
├── migrations/            # Migration files
└── seed.ts               # Seed script
```

## 🎯 Patrones de Código

### Patrón Controller
```typescript
import { Response, NextFunction } from 'express';
import * as accountsService from '../services/accounts.service.js';
import { createAccountSchema } from '../schemas/account.schema.js';
import { AuthRequest } from '../types/index.js';

export async function getAccounts(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const accounts = await accountsService.getAccounts(req.user!.userId);
    res.json(accounts);
  } catch (error) {
    next(error);  // Propagar a error handler
  }
}

export async function createAccount(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const data = createAccountSchema.parse(req.body);
    const account = await accountsService.createAccount(data, req.user!.userId);
    res.status(201).json(account);
  } catch (error) {
    next(error);
  }
}
```

**Detalles del patrón:**
1. Importar tipos y servicios
2. Función `async` que recibe `(req, res, next)`
3. Envolver en try/catch
4. Validar input si aplica
5. Llamar service
6. Retornar respuesta HTTP apropiada
7. Errores → `next(error)` (al error handler)

### Patrón Service
```typescript
import { prisma } from '../lib/prisma.js';
import { CreateAccountInput, UpdateAccountInput } from '../schemas/account.schema.js';

export async function getAccounts(userId: string) {
  return prisma.account.findMany({
    where: { userId },
    orderBy: { createdAt: 'desc' },
  });
}

export async function getAccountById(id: string, userId: string) {
  const account = await prisma.account.findFirst({
    where: { id, userId },
  });

  if (!account) {
    throw new Error('Cuenta no encontrada');
  }

  return account;
}

export async function createAccount(data: CreateAccountInput, userId: string) {
  return prisma.account.create({
    data: {
      ...data,
      userId,
    },
  });
}

export async function updateAccount(id: string, data: UpdateAccountInput, userId: string) {
  // Verificar que existe
  await getAccountById(id, userId);

  return prisma.account.update({
    where: { id },
    data,
  });
}
```

**Detalles del patrón:**
1. Exportar funciones individuales
2. Parámetros tipados
3. Lógica de negocio clara
4. Errores → throw Error()
5. Reutilizar funciones (ej: getAccountById en update)

### Patrón Schema Zod
```typescript
import { z } from 'zod';

export const createAccountSchema = z.object({
  name: z.string().min(1, 'Nombre requerido'),
  type: z.enum(['cash', 'bank', 'credit_card']),
  balance: z.number().default(0),
  currency: z.string().default('EUR'),
  color: z.string().optional(),
  creditLimit: z.number().optional(),
  cutoffDay: z.number().optional(),
  paymentDueDay: z.number().optional(),
  paymentAccountId: z.string().uuid().optional(),
});

export const updateAccountSchema = createAccountSchema.partial();

export type CreateAccountInput = z.infer<typeof createAccountSchema>;
export type UpdateAccountInput = z.infer<typeof updateAccountSchema>;
```

**Detalles:**
1. Definir schema con validaciones
2. Exportar schema y tipos inferidos
3. Usar `.partial()` para updates (campos opcionales)
4. Mensajes de error claros

### Patrón Routes
```typescript
import { Router } from 'express';
import * as accountsController from '../controllers/accounts.controller.js';
import { authMiddleware } from '../middlewares/auth.middleware.js';

const router = Router();

// Proteger todas las rutas con auth
router.use(authMiddleware);

// CRUD operations
router.get('/', accountsController.getAccounts);
router.get('/:id', accountsController.getAccountById);
router.post('/', accountsController.createAccount);
router.put('/:id', accountsController.updateAccount);
router.delete('/:id', accountsController.deleteAccount);

// Operaciones específicas
router.post('/:id/transactions', accountsController.getTransactions);

export default router;
```

## 🔐 Autenticación en Controladores

```typescript
export async function getAccounts(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    // req.user viene del authMiddleware y contiene userId
    const userId = req.user!.userId;
    
    // Siempre pasar userId al service para filtrar por usuario
    const accounts = await accountsService.getAccounts(userId);
    res.json(accounts);
  } catch (error) {
    next(error);
  }
}
```

**Regla de oro:** Siempre filtrar por `userId` en queries para asegurar que usuario solo ve sus datos.

## 📊 Consultas a BD (Prisma)

### Convención de Select
```typescript
// Obtener todo
const account = await prisma.account.findUnique({
  where: { id },
});

// Obtener con relaciones
const user = await prisma.user.findUnique({
  where: { id },
  include: {
    accounts: true,
    transactions: true,
  },
});

// Obtener campos específicos (mejor performance)
const accounts = await prisma.account.findMany({
  where: { userId },
  select: {
    id: true,
    name: true,
    balance: true,
    type: true,
  },
});
```

## 🔄 Git Workflow

### Convención de Commits
- **Formato:** `[TIPO]: Descripción breve`
- **Tipos:**
  - `feat:` Nueva funcionalidad
  - `fix:` Corrección de bug
  - `refactor:` Cambios sin impacto
  - `docs:` Documentación
  - `test:` Tests
  - `chore:` Build, deps, etc.
  - `db:` Migration o cambio de schema

### Ejemplos
- `feat: add recurring debt payment support`
- `fix: correct credit card balance calculation`
- `db: add index on transactions.userId`
- `refactor: extract account validation to helper`

### Ramas
- `main` - Producción
- `feature/<descripcion>` - Nueva funcionalidad
- `fix/<descripcion>` - Bug fix
- `db/<descripcion>` - Migration

## 💅 Estilo de Código

### TypeScript
- **Tipos explícitos** en parámetros y retornos
- **Sin `any`** - Usar `unknown` si es necesario
- **Union types** para valores específicos
- **Null safety** - Ser explícito con `?` y `??`

### Express
- **Middleware al inicio** de la cadena
- **Error handling** siempre con try/catch → next(error)
- **HTTP status codes** apropiados
- **Validación antes** de procesar

### Prisma
- **Relaciones explícitas** con include/select
- **Where filters** por userId para seguridad
- **Transacciones** para operaciones complejas
- **Performance** - pensar en indices

### Ejemplo Completo
```typescript
// account.schema.ts
export const createAccountSchema = z.object({
  name: z.string().min(1),
  type: z.enum(['cash', 'bank', 'credit_card']),
});

export type CreateAccountInput = z.infer<typeof createAccountSchema>;

// account.service.ts
export async function createAccount(
  data: CreateAccountInput,
  userId: string
): Promise<Account> {
  return prisma.account.create({
    data: {
      ...data,
      userId,
    },
  });
}

// account.controller.ts
export async function createAccount(
  req: AuthRequest,
  res: Response,
  next: NextFunction
) {
  try {
    const data = createAccountSchema.parse(req.body);
    const account = await accountsService.createAccount(data, req.user!.userId);
    res.status(201).json(account);
  } catch (error) {
    next(error);
  }
}

// account.routes.ts
router.post('/', accountsController.createAccount);
```

## ✅ Checklist para PRs

- [ ] Código sigue convenciones de nombres
- [ ] TypeScript types son explícitos (sin `any`)
- [ ] Validación con Zod en controller
- [ ] Lógica en service, no en controller
- [ ] Queries filtradas por userId (seguridad)
- [ ] Try/catch → next(error)
- [ ] No hay console.log en código final
- [ ] Migrations creadas si hay cambios BD
- [ ] Commit message sigue formato
- [ ] Actualizar `claude/project-state.md`

## 🔒 Seguridad

### Reglas Críticas
- ✅ Siempre filtrar por `userId` en queries
- ✅ Validar input con Zod
- ✅ Hash passwords con bcrypt
- ✅ Errores genéricos (no exponer detalles)
- ❌ NUNCA loguear passwords o tokens
- ❌ NUNCA retornar datos de otros usuarios
