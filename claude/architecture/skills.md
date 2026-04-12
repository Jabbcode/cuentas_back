# Skills - Cuentas Backend

Habilidades disponibles para Claude al trabajar en el backend. Cada skill encapsula conocimiento sobre un aspecto específico del API.

## 📚 Catálogo de Skills

---

## 1. DatabaseQuerySkill

**Propósito:** Escribir queries Prisma eficientes y seguras

**Cuándo usar:**
- Obtener datos de la BD
- Crear/actualizar registros
- Relaciones complejas
- Optimización de queries

**Lo que sabes hacer:**
- ✅ Queries Prisma type-safe
- ✅ Relaciones con include/select
- ✅ Where filters con validación
- ✅ Paginación y ordenamiento
- ✅ Índices para performance
- ✅ Transacciones cuando es necesario

**Patrones que usas:**
```typescript
// Obtener con relaciones
const account = await prisma.account.findUnique({
  where: { id },
  include: {
    transactions: true,
    fixedExpenses: true,
  },
});

// Select para performance
const accounts = await prisma.account.findMany({
  where: { userId },
  select: {
    id: true,
    name: true,
    balance: true,
    type: true,
  },
});

// Paginación
const transactions = await prisma.transaction.findMany({
  where: { userId },
  skip: (page - 1) * limit,
  take: limit,
  orderBy: { date: 'desc' },
});

// Filtro por userId (CRÍTICO)
const data = await prisma.account.findMany({
  where: { userId: req.user!.userId },  // SIEMPRE
});
```

**Reglas críticas:**
- ✅ SIEMPRE filtrar por userId
- ✅ Usar select/include apropiadamente
- ✅ Índices en campos consultados
- ✅ Evitar N+1 queries
- ✅ Transacciones para cambios múltiples

---

## 2. ValidationSkill

**Propósito:** Validar datos con Zod de manera correcta

**Cuándo usar:**
- Validar input de usuario
- Validar parámetros de request
- Asegurar data consistency
- Mensajes de error claros

**Lo que sabes hacer:**
- ✅ Schemas Zod completos
- ✅ Validaciones anidadas
- ✅ Refinamientos customizados
- ✅ Mensajes de error en español
- ✅ Tipos TypeScript inferidos
- ✅ Optional vs required

**Patrones que usas:**
```typescript
// Schema básico
const createAccountSchema = z.object({
  name: z.string().min(1, 'Nombre requerido'),
  type: z.enum(['cash', 'bank', 'credit_card']),
  balance: z.number().default(0),
});

// Schema con validación compleja
const debtSchema = z.object({
  creditor: z.string().min(1),
  totalAmount: z.number().positive('Monto debe ser positivo'),
  dueDate: z.date().optional().refine(
    date => !date || date >= new Date(),
    { message: 'Fecha no puede ser en el pasado' }
  ),
});

// En controller
const data = createAccountSchema.parse(req.body);
```

**Reglas:**
- ✅ Schema primero, luego tipos
- ✅ Validaciones en schema
- ✅ Mensajes de error claros
- ✅ Refine() para lógica compleja
- ✅ Nunca confiar en datos del cliente

---

## 3. ErrorHandlingSkill

**Propósito:** Manejar errores de manera consistente

**Cuándo usar:**
- Validación falla
- Recurso no encontrado
- Operación no permitida
- Error de servidor

**Lo que sabes hacer:**
- ✅ HTTP status codes correctos
- ✅ Mensajes de error claros
- ✅ Try/catch apropiado
- ✅ Logging de errores
- ✅ Respuestas consistentes
- ✅ Stack traces en dev

**Patrones que usas:**
```typescript
// En controller
export async function getAccount(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const account = await accountsService.getById(req.params.id, req.user!.userId);
    res.json(account);
  } catch (error) {
    next(error);  // Propagar al error handler
  }
}

// En service
export async function getById(id: string, userId: string) {
  const account = await prisma.account.findFirst({
    where: { id, userId },
  });

  if (!account) {
    throw new Error('Cuenta no encontrada');  // Service lanza
  }

  return account;
}

// Error handler (middleware)
app.use((err, req, res, next) => {
  console.error(err);
  
  if (err.message === 'Cuenta no encontrada') {
    return res.status(404).json({ error: err.message });
  }
  
  res.status(500).json({ error: 'Error interno del servidor' });
});
```

**Status codes:**
- 200 OK - Éxito
- 201 Created - POST exitoso
- 400 Bad Request - Validación falló
- 401 Unauthorized - No autenticado
- 403 Forbidden - No autorizado
- 404 Not Found - Recurso no existe
- 500 Internal Server Error

---

## 4. AuthenticationSkill

**Propósito:** Manejar autenticación y autorización

**Cuándo usar:**
- Login/registro de usuario
- Validar token JWT
- Proteger endpoints
- Renovar tokens

**Lo que sabes hacer:**
- ✅ JWT tokens con payload
- ✅ bcrypt para passwords
- ✅ Middleware de auth
- ✅ Token refresh
- ✅ Validación de permisos
- ✅ Seguridad básica

**Patrones que usas:**
```typescript
// Auth middleware
export function authMiddleware(req: AuthRequest, res: Response, next: NextFunction) {
  const token = req.headers.authorization?.replace('Bearer ', '');
  
  if (!token) {
    return res.status(401).json({ error: 'Token requerido' });
  }
  
  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET!);
    req.user = decoded as JwtPayload;
    next();
  } catch (error) {
    res.status(401).json({ error: 'Token inválido' });
  }
}

// Login
async function login(email: string, password: string) {
  const user = await prisma.user.findUnique({ where: { email } });
  
  if (!user || !await bcrypt.compare(password, user.password)) {
    throw new Error('Credenciales inválidas');
  }
  
  const token = jwt.sign(
    { userId: user.id, email: user.email },
    process.env.JWT_SECRET!,
    { expiresIn: '24h' }
  );
  
  return { token, user };
}

// Password
async function hashPassword(password: string) {
  return bcrypt.hash(password, 10);
}
```

---

## 5. SecuritySkill

**Propósito:** Asegurar que datos no se filteren entre usuarios

**Cuándo usar:**
- Validar que usuario puede acceder al recurso
- Filtrar resultados por userId
- Verificar permisos
- Prevenir data leaks

**Lo que sabes hacer:**
- ✅ Filtrado por userId
- ✅ Validación de propiedad
- ✅ Principio de menor privilegio
- ✅ Prevención de injection
- ✅ Rate limiting (si implementado)
- ✅ CORS configurado

**Patrones que usas:**
```typescript
// SIEMPRE filtrar por userId
export async function getAccounts(userId: string) {
  return prisma.account.findMany({
    where: { userId },  // ← CRÍTICO
  });
}

// Validar propiedad antes de modificar
export async function deleteAccount(id: string, userId: string) {
  const account = await prisma.account.findFirst({
    where: { id, userId },  // ← Validar ownership
  });
  
  if (!account) {
    throw new Error('Cuenta no encontrada');  // No diferenciamos
  }
  
  return prisma.account.delete({ where: { id } });
}

// Usar req.user!.userId siempre
export async function getMyTransactions(req: AuthRequest) {
  return prisma.transaction.findMany({
    where: { userId: req.user!.userId },  // ← Del token
  });
}
```

**Reglas:**
- ✅ NUNCA retornar datos de otros usuarios
- ✅ SIEMPRE validar userId
- ✅ NUNCA confiar en parámetros de usuario para userId
- ✅ SIEMPRE del token JWT
- ✅ No diferenciar entre "no existe" y "no acceso"

---

## 6. DataTransformationSkill

**Propósito:** Transformar datos de BD a formato de API

**Cuándo usar:**
- Formatear respuestas
- Mapear tipos
- Filtrar campos sensibles
- Agregar datos calculados

**Lo que sabes hacer:**
- ✅ Mapeo de tipos
- ✅ Serialización de datos
- ✅ Campos derivados
- ✅ Filtrado de datos
- ✅ Enriquecimiento de datos
- ✅ Conversión de tipos

**Patrones que usas:**
```typescript
// Transformar antes de retornar
function transformAccount(account: Account): AccountResponse {
  return {
    ...account,
    balance: Number(account.balance),  // Decimal → number
    availableCredit: account.creditLimit 
      ? account.creditLimit - Math.abs(Number(account.balance))
      : null,
  };
}

// En controller
const account = await accountsService.getById(id, userId);
res.json(transformAccount(account));

// O con include para relaciones
const transaction = await prisma.transaction.findUnique({
  where: { id },
  include: {
    account: { select: { name: true, color: true } },
    category: { select: { name: true, icon: true } },
  },
});
```

---

## 🎯 Cómo Usar los Skills

### Cuando escribes un servicio:
```
Necesito usar:
1. DatabaseQuerySkill (queries Prisma)
2. SecuritySkill (filtrar por userId)
3. DataTransformationSkill (si es necesario)
4. ErrorHandlingSkill (try/catch)
5. ValidationSkill (validar datos)
```

### Cuando creas un endpoint:
```
Necesito usar:
1. AuthenticationSkill (proteger ruta)
2. ValidationSkill (validar input)
3. DatabaseQuerySkill (obtener datos)
4. SecuritySkill (validar acceso)
5. ErrorHandlingSkill (manejar errores)
6. DataTransformationSkill (formatear respuesta)
```

---

## ✨ Remember

- SIEMPRE filtrar por userId
- SIEMPRE validar con Zod
- SIEMPRE try/catch
- SIEMPRE status HTTP correcto
- SIEMPRE tipos TypeScript
- NUNCA confiar en el cliente

