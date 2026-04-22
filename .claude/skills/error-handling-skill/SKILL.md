---
name: error-handling-skill
description: Manejar errores consistentemente con try/catch → next(error) y status HTTP correctos
type: skill
---

## Cuándo Usar

- Al escribir controllers (try/catch obligatorio)
- Al definir HTTP status codes de respuesta
- Al lanzar errores desde services

## Patrón Controller — try/catch → next(error)

```typescript
export async function createAccount(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const data = createAccountSchema.parse(req.body); // ZodError → 400
    const account = await accountsService.createAccount(data, req.user!.userId);
    res.status(201).json(account);
  } catch (error) {
    next(error); // propaga al errorHandler global en app.ts
  }
}
```

## HTTP Status Codes del Proyecto

| Operación | Status |
|-----------|--------|
| GET exitoso | 200 |
| POST exitoso (creación) | 201 |
| DELETE exitoso | 204 (sin body) |
| Error validación Zod | 400 |
| No autenticado | 401 |
| No encontrado / sin permiso | 404 |
| Conflicto (duplicado) | 409 |
| Error servidor | 500 |

## Lanzar Errores desde Services

```typescript
// Service lanza Error con mensaje — errorHandler detecta el tipo
export async function getAccountById(id: string, userId: string) {
  const account = await prisma.account.findFirst({ where: { id, userId } });
  if (!account) throw new Error('Cuenta no encontrada'); // → 404
  return account;
}
```

## Formato de Respuesta de Error

```json
{
  "error": "Descripción del error",
  "code": "ERROR_CODE",
  "details": {}
}
```

## Anti-patterns

- ❌ `try/catch` que swallows el error sin `next(error)`
- ❌ `res.status(500).json({ error: e.message })` directamente en controller
- ❌ `console.error` sin propagar el error
- ❌ Exponer stack traces o mensajes internos al cliente
- ❌ Status 200 para errores ("ok: false" en body)
