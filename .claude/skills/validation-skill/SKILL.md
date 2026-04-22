---
name: validation-skill
description: Validar datos con Zod — schemas, tipos inferidos y validación en controllers
type: skill
---

## Cuándo Usar

- Al crear schemas para body de requests
- Al inferir tipos TypeScript desde schemas
- Al validar input en controllers antes de llamar al service

## Patrón Schema Zod

```typescript
import { z } from 'zod';

export const createAccountSchema = z.object({
  name: z.string().min(1, 'Nombre requerido'),
  type: z.enum(['cash', 'bank', 'credit_card']),
  balance: z.number().default(0),
  currency: z.string().default('USD'),
  color: z.string().optional(),
  creditLimit: z.number().optional(),
  paymentAccountId: z.string().uuid().optional(),
});

// Update: todos los campos opcionales
export const updateAccountSchema = createAccountSchema.partial();

// Tipos inferidos — siempre exportar junto al schema
export type CreateAccountInput = z.infer<typeof createAccountSchema>;
export type UpdateAccountInput = z.infer<typeof updateAccountSchema>;
```

## Validar en Controller

```typescript
export async function createAccount(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    // .parse() lanza ZodError si falla — el errorHandler lo convierte a 400
    const data = createAccountSchema.parse(req.body);
    const account = await accountsService.createAccount(data, req.user!.userId);
    res.status(201).json(account);
  } catch (error) {
    next(error);
  }
}
```

## Validaciones Comunes

```typescript
z.string().min(1, 'Campo requerido')
z.string().email('Email inválido')
z.string().uuid('ID inválido')
z.number().positive('Debe ser positivo')
z.number().int('Debe ser entero')
z.enum(['a', 'b', 'c'])
z.boolean()
z.coerce.number()          // convierte string → number (útil para query params)
z.coerce.date()            // convierte string → Date
z.string().optional()      // campo opcional
z.string().nullable()      // puede ser null
z.array(z.string()).min(1) // array no vacío
```

## Anti-patterns

- ❌ Validación manual con `if (!req.body.name)` — usar Zod
- ❌ Crear tipos manualmente — inferir con `z.infer<>`
- ❌ `.safeParse()` sin manejar el error — o usar `.parse()` y dejar que next(error) lo maneje
- ❌ `any` en parámetros de service — usar el tipo inferido del schema
