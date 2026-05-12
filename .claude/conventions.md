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

### Flujo de ramas

```
feature/<descripcion>  →  PR  →  develop  →  (release)  →  main
```

- `main` — Producción. Solo recibe merges desde `develop` con confirmación explícita del usuario.
- `develop` — Integración. **Todos los PRs apuntan aquí**, nunca a `main` directamente.
- `feature/<descripcion>` — Nueva funcionalidad
- `fix/<descripcion>` — Bug fix
- `refactor/<descripcion>` — Refactor
- `db/<descripcion>` — Migration

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

---

## 🏛️ Clean Architecture — Capas de Abstracción

La arquitectura sigue una dependencia estricta hacia adentro. Las capas externas dependen de las internas, nunca al revés.

```
Routes → Controllers → Services → Repositories → Prisma
                            ↑
                         lib/errors.ts
                         lib/utils/
```

| Capa | Responsabilidad | Puede importar |
|------|----------------|----------------|
| `routes/` | Definir endpoints y middlewares | controllers, middlewares |
| `controllers/` | HTTP in/out, validación Zod, extraer userId | services, schemas, errors |
| `services/` | Lógica de negocio, orquestación | repositories, lib/utils, errors |
| `repositories/` | Queries Prisma puras, acceso a BD | lib/prisma, tipos Prisma |
| `lib/utils/` | Funciones puras reutilizables | nada del proyecto |
| `lib/errors.ts` | Clases de error tipadas | nada del proyecto |

**Regla de oro:** Si un controller toca Prisma directamente → error. Si un repository tiene lógica de negocio → error.

---

## 🧱 SOLID en el Backend

### S — Single Responsibility
Una función de service = una responsabilidad.  
Si `payDebt` crea transacción + actualiza balance + gestiona recurrentes → dividir en funciones privadas o extraer a service auxiliar.

```typescript
// MAL — una función hace todo
export async function payDebt(...) {
  // valida, calcula, crea tx, actualiza balance, gestiona recurrentes...
}

// BIEN — orquesta funciones con responsabilidad única
export async function payDebt(...) {
  const debt = await debtRepository.findByIdAndUser(debtId, userId);
  const interest = calculateInterest(debt); // utils pura
  await debtRepository.applyPayment(debt, principal, interest);
  await accountRepository.decrementBalance(accountId, amount, userId);
}
```

### O — Open/Closed
Extender comportamiento vía parámetros o nuevas funciones, no modificando services existentes.  
Ejemplo: agregar un nuevo tipo de notificación → nueva función en `notifications.service`, no modificar `checkBudgetAndNotify`.

### L — Liskov Substitution
Los repositories con la misma firma son intercambiables por su consumidor.  
Un service que recibe `findByIdAndUser(id, userId)` no debe asumir nada sobre la implementación interna.

### I — Interface Segregation
Parámetros de funciones mínimos y específicos. Nunca pasar un objeto completo si solo se necesita un campo:

```typescript
// MAL
async function applyPayment(debt: Debt, data: PayDebtInput) { ... }

// BIEN
async function applyPayment(debtId: string, principal: number, interest: number) { ... }
```

### D — Dependency Inversion
Los services dependen de funciones de repository (abstracciones), nunca de `prisma` directamente.  
Esto permite testear services sin levantar BD.

```typescript
// MAL — service acopado a Prisma
import { prisma } from '../lib/prisma.js';
export async function getAccounts(userId: string) {
  return prisma.account.findMany({ where: { userId } });
}

// BIEN — service depende del repository
import * as accountRepo from '../repositories/account.repository.js';
export async function getAccounts(userId: string) {
  return accountRepo.findAllByUser(userId);
}
```

---

## 📦 Capa Repository (`src/repositories/`)

Única capa que toca Prisma. Exporta funciones puras de acceso a datos, sin lógica de negocio.

### Naming
- Archivo: `<recurso>.repository.ts`
- Funciones: `find*`, `create*`, `update*`, `delete*`, `count*`, `exists*`

### Patrón
```typescript
// src/repositories/account.repository.ts
import { prisma } from '../lib/prisma.js';
import type { Prisma } from '@prisma/client';

export async function findByIdAndUser(id: string, userId: string) {
  return prisma.account.findFirst({ where: { id, userId } });
}

export async function findAllByUser(userId: string) {
  return prisma.account.findMany({ where: { userId }, orderBy: { createdAt: 'desc' } });
}

export async function decrementBalance(id: string, userId: string, amount: number) {
  // Siempre verificar ownership antes de mutar
  const account = await findByIdAndUser(id, userId);
  if (!account) throw new NotFoundError('Cuenta no encontrada');
  return prisma.account.update({ where: { id }, data: { balance: { decrement: amount } } });
}
```

### Reutilización obligatoria
Antes de escribir una query, buscar si ya existe en el repository correspondiente.  
Helpers ya identificados para extraer:

| Helper | Actualmente duplicado en |
|--------|--------------------------|
| `findByIdAndUser` | `accounts`, `debts`, `transactions`, `categories` |
| `findOrCreateCategory` | inline en `debts.service` |
| `buildTransactionWhere` | `getTransactions` + `getTransactionSummary` |
| `decrementBalance` | `accounts.service` + inline en `debts.service` |

---

## 🚨 Errores Tipados (`lib/errors.ts`)

Nunca `throw new Error('mensaje')`. Usar siempre clases tipadas para que el error handler mapee el HTTP status correcto.

```typescript
// src/lib/errors.ts
export class AppError extends Error {
  constructor(public message: string, public statusCode: number, public code: string) {
    super(message);
  }
}
export class NotFoundError extends AppError {
  constructor(message = 'Recurso no encontrado') { super(message, 404, 'NOT_FOUND'); }
}
export class ConflictError extends AppError {
  constructor(message: string) { super(message, 409, 'CONFLICT'); }
}
export class ForbiddenError extends AppError {
  constructor(message = 'No autorizado') { super(message, 403, 'FORBIDDEN'); }
}
export class ValidationError extends AppError {
  constructor(message: string) { super(message, 422, 'VALIDATION_ERROR'); }
}
```

El error handler en `middlewares/errorHandler.ts` detecta `AppError` y responde con el `statusCode` correcto. Cualquier otro error → 500.

---

## ♻️ No Reinventar — Reutilización

Antes de escribir lógica nueva:
1. Buscar en `lib/utils/` si existe una función pura equivalente
2. Buscar en el repository si existe la query
3. Si se repite 2+ veces en distintos services → extraer a `lib/utils/` o al repository

### Funciones puras en `lib/utils/`
Lógica sin side effects ni imports de Prisma/Express:

```typescript
// lib/utils/debt.utils.ts
export function calculateInterest(remaining: number, rate: number, type: string): number { ... }
export function getDebtStatus(remaining: number, dueDate: Date | null): string { ... }

// lib/utils/date.utils.ts
export function startOfMonth(date: Date): Date { ... }
export function endOfMonth(date: Date): Date { ... }
```

### Prohibido: dependencias circulares
Nunca `await import('./otro.service.js')` dentro de un service.  
Si dos services se necesitan mutuamente → extraer la lógica compartida a `lib/utils/` o a un repository.

### `checkBudgetAndNotify` pertenece en `budgets.service`
Lógica de negocio de presupuestos → `budgets.service.ts`.  
`notifications.service.ts` solo crea/lee/elimina notificaciones.

---

## ✅ Checklist para PRs

- [ ] Código sigue convenciones de nombres
- [ ] TypeScript types son explícitos (sin `any`, sin `Record<string, unknown>` como workaround)
- [ ] Validación con Zod en controller, nunca en service ni repository
- [ ] Lógica de negocio en service, no en controller ni repository
- [ ] Queries filtradas por userId — siempre via repository con `findByIdAndUser`
- [ ] Try/catch → next(error) en controllers
- [ ] Sin `throw new Error()` — usar clases de `lib/errors.ts`
- [ ] Sin `await import()` dinámicos entre services (circular deps)
- [ ] Sin acceso directo a Prisma desde controllers o services
- [ ] Lógica reutilizable extraída a `lib/utils/` o repository antes de duplicar
- [ ] Sin console.log en código final
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
