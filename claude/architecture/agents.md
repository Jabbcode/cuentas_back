# Agents - Cuentas Backend

Agentes especializados que Claude puede usar para tareas complejas en el backend. Cada agente sabe cómo hacer algo específico de manera correcta.

## 🤖 Catálogo de Agents

---

## 1. ControllerGeneratorAgent

**Responsabilidad:** Generar controladores Express completos y seguros

**Cuándo invocarlo:**
```
"Genera un controlador para gestionar cuentas (CRUD)"
"Crea un controlador de autenticación con login/register"
"Necesito un controlador para transacciones"
```

**Lo que hace:**
1. ✅ Crea controlador con patrones correctos
2. ✅ Incluye autenticación y autorización
3. ✅ Validación con Zod
4. ✅ Manejo de errores
5. ✅ Types TypeScript correctos
6. ✅ Llamadas a servicios
7. ✅ Status HTTP apropiados

**Estructura que crea:**
```typescript
// accounts.controller.ts
import { Response, NextFunction } from 'express';
import * as accountsService from '../services/accounts.service.js';
import { createAccountSchema, updateAccountSchema } from '../schemas/account.schema.js';
import { AuthRequest } from '../types/index.js';

// Obtener todas (con filtro de usuario)
export async function getAccounts(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const accounts = await accountsService.getAccounts(req.user!.userId);
    res.json(accounts);
  } catch (error) {
    next(error);
  }
}

// Crear
export async function createAccount(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const data = createAccountSchema.parse(req.body);
    const account = await accountsService.createAccount(data, req.user!.userId);
    res.status(201).json(account);
  } catch (error) {
    next(error);
  }
}

// Actualizar
export async function updateAccount(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const data = updateAccountSchema.parse(req.body);
    const account = await accountsService.updateAccount(
      req.params.id,
      data,
      req.user!.userId
    );
    res.json(account);
  } catch (error) {
    next(error);
  }
}

// Eliminar
export async function deleteAccount(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    await accountsService.deleteAccount(req.params.id, req.user!.userId);
    res.status(204).send();
  } catch (error) {
    next(error);
  }
}
```

**Reglas que sigue:**
- ✅ Validación con `.parse()` primero
- ✅ Try/catch siempre
- ✅ next(error) para propagar
- ✅ Status correcto (201 para POST, 204 para DELETE)
- ✅ req.user!.userId en queries
- ✅ Llamadas a service, no queries directas

---

## 2. ServiceCreatorAgent

**Responsabilidad:** Crear servicios con lógica de negocio

**Cuándo invocarlo:**
```
"Crea un servicio para gestionar cuentas con todas las operaciones"
"Genera un servicio de autenticación"
"Necesito un servicio para transacciones"
```

**Lo que hace:**
1. ✅ Crea servicio con funciones export
2. ✅ Queries Prisma eficientes
3. ✅ Filtrado por userId
4. ✅ Manejo de errores
5. ✅ Lógica de negocio
6. ✅ Reutilización correcta
7. ✅ Types explícitos

**Estructura que crea:**
```typescript
// accounts.service.ts
import { prisma } from '../lib/prisma.js';
import { CreateAccountInput, UpdateAccountInput } from '../schemas/account.schema.js';

// Obtener todas
export async function getAccounts(userId: string) {
  return prisma.account.findMany({
    where: { userId },
    orderBy: { createdAt: 'desc' },
  });
}

// Obtener una
export async function getAccountById(id: string, userId: string) {
  const account = await prisma.account.findFirst({
    where: { id, userId },
  });

  if (!account) {
    throw new Error('Cuenta no encontrada');
  }

  return account;
}

// Crear
export async function createAccount(data: CreateAccountInput, userId: string) {
  return prisma.account.create({
    data: {
      ...data,
      userId,
    },
  });
}

// Actualizar
export async function updateAccount(
  id: string,
  data: UpdateAccountInput,
  userId: string
) {
  // Validar existencia
  await getAccountById(id, userId);

  return prisma.account.update({
    where: { id },
    data,
  });
}

// Eliminar
export async function deleteAccount(id: string, userId: string) {
  // Validar existencia
  await getAccountById(id, userId);

  return prisma.account.delete({
    where: { id },
  });
}
```

**Reglas que sigue:**
- ✅ Funciones export individuales
- ✅ Parámetro userId siempre
- ✅ Reutilizar getById para validar
- ✅ Lanzar errores, no retornar nulos
- ✅ Queries optimizadas
- ✅ Sin lógica de HTTP

---

## 3. DatabaseMigrationAgent

**Responsabilidad:** Crear migraciones Prisma seguras

**Cuándo invocarlo:**
```
"Crea una migración para agregar campo X a la tabla Y"
"Genera migraciones para una nueva tabla de reportes"
"Necesito migración para cambiar tipo de un campo"
```

**Lo que hace:**
1. ✅ Modifica schema.prisma
2. ✅ Genera migration file
3. ✅ Manejo de datos existentes
4. ✅ Rollback-safe
5. ✅ Preserva datos
6. ✅ Índices si es necesario
7. ✅ Tipos Prisma actualizados

**Proceso:**
```
1. Actualiza schema.prisma
2. Ejecuta: npx prisma migrate dev --name descripcion
3. Verifica migration file
4. Ejecuta: npx prisma generate
5. Tipos TypeScript se actualizan
```

**Ejemplo de schema change:**
```prisma
// Antes
model Account {
  id String @id @default(uuid())
  name String
  balance Decimal @default(0)
}

// Después
model Account {
  id String @id @default(uuid())
  name String
  balance Decimal @default(0)
  currency String @default("EUR")  // ← Nuevo
  isActive Boolean @default(true)   // ← Nuevo
  color String?                     // ← Opcional
}
```

---

## 4. APIEndpointAgent

**Responsabilidad:** Crear nuevos endpoints REST completos

**Cuándo invocarlo:**
```
"Crea el endpoint POST /api/transactions para crear transacciones"
"Genera todos los endpoints CRUD para cuentas"
"Necesito endpoint GET /api/dashboard/summary"
```

**Lo que hace:**
1. ✅ Crea schema Zod
2. ✅ Crea service con lógica
3. ✅ Crea controller con validación
4. ✅ Crea routes
5. ✅ Integra en app.ts
6. ✅ Error handling
7. ✅ Documentación básica

**Proceso que sigue:**
```
Input: "Endpoint para crear deuda"
  ↓
Crea schema Zod (crear y actualizar)
  ↓
Crea funciones en service
  ↓
Crea controladores
  ↓
Crea routes
  ↓
Integra en app.ts
  ↓
Output: Endpoint listo y funcional
```

**Estructura completa:**
```typescript
// 1. Schema (schemas/debt.schema.ts)
export const createDebtSchema = z.object({
  creditor: z.string().min(1),
  totalAmount: z.number().positive(),
});

// 2. Service (services/debts.service.ts)
export async function createDebt(data: CreateDebtInput, userId: string) {
  return prisma.debt.create({
    data: { ...data, userId },
  });
}

// 3. Controller (controllers/debts.controller.ts)
export async function createDebt(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const data = createDebtSchema.parse(req.body);
    const debt = await debtsService.createDebt(data, req.user!.userId);
    res.status(201).json(debt);
  } catch (error) {
    next(error);
  }
}

// 4. Routes (routes/debts.routes.ts)
router.post('/', debtsController.createDebt);

// 5. Integración (app.ts)
app.use('/api/debts', debtsRoutes);
```

---

## 5. DataProcessingAgent

**Responsabilidad:** Procesar datos complejos con múltiples relaciones

**Cuándo invocarlo:**
```
"Procesa datos para el dashboard (resumen de cuentas, transacciones, etc)"
"Genera reporte de gastos por categoría"
"Crea proyecciones de deudas"
```

**Lo que hace:**
1. ✅ Queries complejas con relaciones
2. ✅ Procesa múltiples datos
3. ✅ Cálculos y agregaciones
4. ✅ Filtra por userId
5. ✅ Retorna datos transformados
6. ✅ Optimiza queries
7. ✅ Error handling

**Ejemplo:**
```typescript
// Servicio de dashboard
export async function getDashboardSummary(userId: string) {
  // 1. Cuentas
  const accounts = await prisma.account.findMany({
    where: { userId },
  });

  // 2. Transacciones del mes
  const startOfMonth = new Date();
  startOfMonth.setDate(1);
  
  const transactions = await prisma.transaction.findMany({
    where: {
      userId,
      date: { gte: startOfMonth },
    },
    include: {
      category: true,
      account: { select: { name: true, color: true } },
    },
  });

  // 3. Gastos fijos
  const fixedExpenses = await prisma.fixedExpense.findMany({
    where: { userId, isActive: true },
  });

  // 4. Procesar datos
  const totalBalance = accounts.reduce((sum, acc) => 
    sum + Number(acc.balance), 0
  );

  const monthlyExpenses = transactions
    .filter(t => t.type === 'expense')
    .reduce((sum, t) => sum + Number(t.amount), 0);

  const monthlyIncome = transactions
    .filter(t => t.type === 'income')
    .reduce((sum, t) => sum + Number(t.amount), 0);

  // 5. Retornar transformado
  return {
    totalBalance,
    monthlyExpenses,
    monthlyIncome,
    monthlyNet: monthlyIncome - monthlyExpenses,
    accounts: accounts.map(transformAccount),
    transactions: transactions.map(transformTransaction),
    fixedExpenses: fixedExpenses.map(transformFixedExpense),
  };
}
```

---

## 🔄 Flujo de Trabajo con Agents

### Para crear un nuevo recurso (Ej: Reportes):

```
1. DatabaseMigrationAgent
   ├─ Si necesitas nueva tabla
   └─ Crea migraciones Prisma

2. ServiceCreatorAgent
   ├─ Crea lógica de negocio
   └─ Funciones de lectura/escritura

3. ControllerGeneratorAgent
   ├─ Crea controladores
   └─ Validación y respuestas HTTP

4. APIEndpointAgent
   ├─ Crea routes
   └─ Integra todo en app.ts

5. DataProcessingAgent (si necesario)
   ├─ Para datos complejos
   └─ Agregaciones y transformaciones
```

---

## 📋 Ejemplo Completo: Crear Gestión de Pagos Recurrentes

### Paso 1: Migración
```
DatabaseMigrationAgent: "Crea tabla RecurringPayment con campos..."
```

### Paso 2: Servicio
```
ServiceCreatorAgent: "Crea servicio para recurring payments"
```

### Paso 3: Controlador
```
ControllerGeneratorAgent: "Genera CRUD controller"
```

### Paso 4: Endpoints
```
APIEndpointAgent: "Crea todos los endpoints REST"
```

### Paso 5: Lógica Compleja
```
DataProcessingAgent: "Si necesito procesar próximos pagos"
```

---

## ✨ Invocando Agents

### Invocación simple:
```
"ServiceCreatorAgent: Crea un servicio para X"
```

### Invocación con contexto:
```
"Necesito crear gestión de reportes.
 Requiere:
 - Nueva tabla en BD
 - Funciones de lectura/agregación
 - Endpoints REST
 - Transformación de datos
 
 Usa DatabaseMigrationAgent, ServiceCreatorAgent, APIEndpointAgent, DataProcessingAgent"
```

### Invocación incremental:
```
"1. DatabaseMigrationAgent: Crea tabla Report
 2. ServiceCreatorAgent: Función para leer reportes
 3. ControllerGeneratorAgent: Controller GET /reports
 4. APIEndpointAgent: Integra en app.ts"
```

---

## 🎯 Cuándo Usar Cada Agent

| Necesidad | Agent |
|-----------|-------|
| Nueva tabla | DatabaseMigrationAgent |
| Lógica de negocio | ServiceCreatorAgent |
| Validación + respuesta | ControllerGeneratorAgent |
| Rutas y configuración | APIEndpointAgent |
| Datos complejos | DataProcessingAgent |
| Todo junto | Todos en secuencia |

---

## 💡 Tips

- Sigue el orden: DB → Service → Controller → Routes
- Siempre filtra por userId
- Siempre valida con Zod
- Siempre maneja errores
- Agents trabajan mejor en secuencia
- Proporciona contexto claro

