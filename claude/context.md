# Contexto del Proyecto - Cuentas Backend

## 📋 Descripción General

**Cuentas Backend** es la API REST que potencia la aplicación web de gestión de finanzas personales. Maneja autenticación, persistencia de datos, lógica de negocio y análisis.

### Responsabilidades Principales
- 🔐 Autenticación y autorización (JWT)
- 💾 Persistencia de datos (PostgreSQL + Prisma)
- 📊 Lógica de negocio (cálculos, validaciones)
- 🎯 API REST para el frontend
- 📸 Procesamiento de recibos (OCR con Tesseract)
- 🤖 Análisis con IA (Anthropic SDK)

## 🛠️ Stack Tecnológico

### Runtime & Framework
- **Node.js** - JavaScript runtime
- **Express 4.21** - Web framework
- **TypeScript 5.6** - Lenguaje tipado

### Base de Datos
- **PostgreSQL** - Base de datos relacional
- **Prisma 5.22** - ORM
  - Query builder type-safe
  - Migrations automáticas
  - Studio para inspeccionar datos

### Seguridad
- **jsonwebtoken 9.0.2** - JWT tokens
- **bcrypt 5.1.1** - Password hashing
- **cors 2.8.5** - CORS handling

### Validación
- **zod 3.23.8** - Schema validation
  - Type-safe
  - Runtime validation
  - Mensajes de error claros

### File Handling
- **multer 2.1.1** - File upload middleware
  - Maneja formidatas
  - Memory/disk storage

### Análisis
- **tesseract.js 7** - OCR para recibos
- **@anthropic-ai/sdk 0.82** - IA para análisis

### Desarrollo
- **tsx 4.19.2** - TypeScript runner para scripts
- **prisma CLI** - Migrations y schema management

## 📁 Estructura del Proyecto

```
src/
├── controllers/           # Maneja requests HTTP
│   ├── accounts.controller.ts
│   ├── transactions.controller.ts
│   ├── auth.controller.ts
│   └── ...
├── services/             # Lógica de negocio
│   ├── accounts.service.ts
│   ├── transactions.service.ts
│   ├── auth.service.ts
│   └── ...
├── routes/              # Definición de endpoints
│   ├── accounts.routes.ts
│   ├── transactions.routes.ts
│   ├── auth.routes.ts
│   └── ...
├── schemas/             # Zod schemas para validación
│   ├── account.schema.ts
│   ├── transaction.schema.ts
│   └── ...
├── middlewares/         # Express middlewares
│   ├── auth.middleware.ts
│   ├── errorHandler.ts
│   └── ...
├── lib/                # Utilidades
│   └── prisma.ts       # Cliente Prisma
├── types/              # TypeScript definitions
│   └── index.ts
├── app.ts              # Express app setup
└── index.ts            # Entry point
```

## 🗄️ Base de Datos

### Tablas Principales
- **User** - Usuarios del sistema
- **Account** - Cuentas (cash, bank, credit_card)
- **Transaction** - Movimientos de dinero
- **Category** - Categorías de transacciones
- **FixedExpense** - Gastos/ingresos recurrentes
- **CreditCardPayment** - Pagos de tarjetas
- **Debt** - Deudas
- **DebtPayment** - Pagos de deudas
- **RecurringDebtPayment** - Pagos recurrentes de deudas

### Relaciones Clave
```
User
├─ Accounts (1 a N)
├─ Transactions (1 a N)
├─ Categories (1 a N)
├─ FixedExpenses (1 a N)
├─ Debts (1 a N)
└─ DebtPayments (1 a N)

Account
├─ Transactions (1 a N)
├─ FixedExpenses (1 a N)
└─ CreditCardPayments (1 a N)
```

Ver `architecture/database-schema.md` para detalles completos.

## 🔐 Autenticación

### Flujo
1. Usuario POST `/api/auth/login` con email/password
2. Backend valida credenciales con bcrypt
3. Si válido, genera JWT token
4. Frontend almacena en localStorage
5. Frontend incluye token en header Authorization

### JWT Token
- **Algoritmo:** HS256
- **Payload:** `{ userId, email }`
- **Expires:** 24h (configurable)
- **Secret:** Almacenado en variable de entorno

### Autorización
- Cada endpoint verifica `req.user.userId`
- Se obtiene del token JWT
- Middleware `authMiddleware` valida y extrae

## 📡 Estructura de APIs

### Patrón por Recurso
```
GET    /api/recurso              # Lista todos
GET    /api/recurso/:id          # Obtiene uno
POST   /api/recurso              # Crea
PUT    /api/recurso/:id          # Actualiza
DELETE /api/recurso/:id          # Elimina
```

### Flujo de Request
```
Client Request
     │
     ▼
Express Route Handler
     │
     ├─ Auth Middleware (valida token)
     │
     ├─ Input Validation (Zod schema)
     │
     ▼
Controller
     │
     ├─ Extrae datos del request
     │
     ▼
Service
     │
     ├─ Lógica de negocio
     ├─ Queries a BD (Prisma)
     │
     ▼
BD Response
     │
     ▼
Controller
     │
     ├─ Formatea respuesta
     │
     ▼
Response a Client
```

## 📊 Capas de la Aplicación

### 1. Routes (`src/routes/`)
- Definen endpoints y métodos HTTP
- Asocian controllers a rutas
- Aplican middlewares

### 2. Controllers (`src/controllers/`)
- Manejan requests HTTP
- Validan input con schemas Zod
- Llaman services
- Retornan respuestas HTTP

### 3. Services (`src/services/`)
- Lógica de negocio
- Operaciones con BD (Prisma)
- Validaciones complejas
- Cálculos financieros

### 4. Database (Prisma)
- ORM TypeScript-first
- Schema en `prisma/schema.prisma`
- Migrations automáticas
- Type safety en queries

## 🛡️ Manejo de Errores

### Tipos de Errores
- **ValidationError** - Input inválido (Zod)
- **AuthenticationError** - Credenciales inválidas
- **AuthorizationError** - Usuario no autorizado (401)
- **NotFoundError** - Recurso no existe (404)
- **ConflictError** - Datos duplicados (409)
- **ServerError** - Error del servidor (500)

### Respuesta de Error Estándar
```json
{
  "error": "Descripción del error",
  "code": "ERROR_CODE",
  "details": {}  // Información adicional si aplica
}
```

Ver `guidelines/error-handling.md` para detalles.

## 🔄 Flujos de Datos Comunes

### Crear una Transacción
```
POST /api/transactions
{
  amount: 100,
  type: "expense",
  description: "Compra",
  accountId: "uuid",
  categoryId: "uuid",
  date: "2024-01-15"
}
     │
     ▼
transactionsController.create()
     │
     ├─ Valida schema
     │
     ▼
transactionsService.create()
     │
     ├─ Verifica cuenta existe
     ├─ Verifica categoría existe
     ├─ Actualiza balance de cuenta
     ├─ Crea transacción
     │
     ▼
BD: INSERT Transaction, UPDATE Account
     │
     ▼
Retorna Transaction creada
```

## 🧮 Lógica de Negocio Compleja

### Cálculo de Tarjeta de Crédito
- Balance = uso actual (negativo)
- Disponible = límite - uso
- Pago = se aplica a cuenta de pago designada

### Gestión de Deudas
- Pago = principal + interés
- Interés = puede ser fijo o porcentaje
- Recurrentes = se crean automáticamente

### Gastos Fijos
- Se pueden vincular a tarjetas de crédito
- Se pueden vincular a pagos recurrentes de deudas
- Se marcan como "pagados" cuando hay transacción

## 📸 Procesamiento de Recibos

### Flujo
1. Cliente hace POST `/api/receipts/upload` con imagen
2. Backend procesa con Tesseract OCR
3. Extrae texto y cantidad
4. Busca duplicados con hash
5. Retorna datos extraídos (opcional: sugiere transacción)

## 🤖 Integración con IA

### Casos de Uso
- Análisis de transacciones
- Categorización automática
- Predicciones financieras
- Generación de reportes

### Implementación
- Usar SDK de Anthropic
- Pasar contexto de transacciones
- Procesar respuesta y guardar en BD si aplica

## 🔑 Variables de Entorno

```
# Base de Datos
DATABASE_URL=postgresql://user:password@localhost:5432/cuentas

# Autenticación
JWT_SECRET=tu-secreto-muy-seguro-aqui
JWT_EXPIRATION=24h

# Servidor
PORT=3001
NODE_ENV=development

# API Anthropic (para IA)
ANTHROPIC_API_KEY=sk-...

# Uploads
UPLOAD_DIR=./uploads
```

## 🚀 Iniciar en Desarrollo

```bash
# Instalar dependencias
npm install

# Setup base de datos
npx prisma migrate dev

# Ejecutar servidor
npm run dev
```

## 🧪 Testing

- Actualmente: Sin tests automatizados
- Próximo: Agregar Jest + testing library

## 📈 Performance

### Optimizaciones BD
- Índices en campos frecuentemente consultados
- Queries eficientes con Prisma select()
- Paginación en listados largos

### Caching (Futuro)
- Redis para datos frecuentes
- TTL configurable por tipo de dato

## 🔗 Integración con Frontend

- **URL de API:** Se configura en frontend
- **CORS:** Habilitado para origen del frontend
- **Tipos:** TypeScript types compartidas (considerar monorepo)
- **Versionado:** API sin versionado actualmente

## 📚 Documentación Adicional

- `architecture/overview.md` - Diagramas de arquitectura
- `architecture/database-schema.md` - Schema completo
- `architecture/services.md` - Detalles de servicios
- `architecture/api-design.md` - Endpoints documentados
