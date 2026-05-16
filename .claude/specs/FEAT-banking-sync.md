# SPEC: FEAT-banking-sync — Integración bancaria con TrueLayer (Open Banking PSD2)

## Qué se pide

Integrar TrueLayer (Open Banking PSD2) para sincronizar transacciones bancarias reales. El flujo cubre: OAuth2 por banco (una sola autenticación por institución), pantalla de mapeo donde el usuario asigna cada sub-cuenta bancaria (cuenta corriente, ahorro, tarjetas) a una cuenta existente en la app, polling cada 10 minutos vía cron job, deduplicación, y endpoint de estado con `lastSyncedAt` para el frontend. Las transacciones manuales existentes no se ven afectadas.

---

## Decisiones confirmadas

| Decisión | Resolución |
|----------|------------|
| Proveedor | TrueLayer (España/Europa, PSD2) |
| Tipo de sync | Polling periódico cada 10 minutos (node-cron) |
| Convivencia manual/banco | Misma tabla `Transaction`, campo `source` distingue el origen |
| Vinculación de cuenta | El usuario vincula a cuentas **existentes** en la app — botón "Vincular banco" en la tarjeta de cuenta |
| Sub-cuentas | Un OAuth por banco devuelve todas las sub-cuentas (corriente, ahorro, tarjetas); el usuario mapea cada una individualmente a una cuenta de la app |
| OAuth state | Tabla `OAuthState` con UUID opaco — userId nunca en URL |
| Tokens temporales | Tabla `PendingBankAuth` — almacena tokens y cuentas TrueLayer hasta que el usuario confirma los mapeos |
| Tokens en producción | Guardados en texto plano por ahora — documentado como deuda técnica (cifrado AES-256 antes de prod) |
| Sync hacia atrás | No — solo desde `lastSyncedAt` o últimos 30 días en primera sync |
| Categoría por defecto | Crear/reusar categoría "Bancario" del usuario para transacciones importadas |
| Intervalo polling | 10 minutos (`*/10 * * * *`) — ajustable por env |

---

## Contexto de código

- `src/lib/cron.ts` — `startCronJobs()` registra todos los jobs. El `SyncJob` se agrega aquí.
- `src/lib/errors.ts` — usar siempre clases tipadas (`NotFoundError`, `ConflictError`, etc.).
- `prisma/schema.prisma` — `Transaction.categoryId` es NOT NULL sin default — el sync debe resolver categoría antes de insertar.
- `src/app.ts` — registro manual de rutas. Agregar `bankingRoutes` aquí.
- Patrón cron existente: errores silenciados con `catch {}` comentado para no crashear el servidor.

---

## Schema Prisma — Cambios requeridos

### 1. OAuthState (nuevo)

```prisma
model OAuthState {
  id        String   @id @default(uuid())  // el state token que va en la URL OAuth
  userId    String
  expiresAt DateTime                       // now + 10 minutos
  createdAt DateTime @default(now())

  @@index([userId])
}
```

### 2. PendingBankAuth (nuevo)

Almacena los tokens obtenidos del callback y las cuentas disponibles de TrueLayer hasta que el usuario confirma los mapeos.

```prisma
model PendingBankAuth {
  id                 String   @id @default(uuid())  // pendingAuthId que va al frontend
  userId             String
  accessToken        String
  refreshToken       String
  tokenExpiresAt     DateTime
  truelayerAccounts  Json     // array de cuentas TrueLayer disponibles
  expiresAt          DateTime // now + 15 minutos
  createdAt          DateTime @default(now())

  @@index([userId])
}
```

### 3. BankConnection (nuevo)

Un registro por cada mapeo confirmado (sub-cuenta bancaria ↔ cuenta de la app).

```prisma
model BankConnection {
  id                 String   @id @default(uuid())
  userId             String
  user               User     @relation(fields: [userId], references: [id], onDelete: Cascade)
  provider           String   @default("truelayer")
  truelayerAccountId String   // ID de la sub-cuenta en TrueLayer
  accountName        String   // nombre de la sub-cuenta (ej: "Cuenta Corriente Imagin")
  bankName           String   // nombre del banco (ej: "CaixaBank")
  currency           String   @default("EUR")
  accessToken        String
  refreshToken       String
  tokenExpiresAt     DateTime
  lastSyncedAt       DateTime?
  isActive           Boolean  @default(true)

  // Cuenta interna de la app a la que está vinculada
  accountId          String
  account            Account  @relation(fields: [accountId], references: [id], onDelete: Cascade)

  createdAt          DateTime @default(now())
  updatedAt          DateTime @updatedAt

  @@unique([userId, truelayerAccountId])
  @@index([userId])
  @@index([userId, isActive])
  @@index([accountId])
}
```

### 4. Transaction (extensión)

Tres campos opcionales con defaults — no rompen registros existentes.

```prisma
source      String  @default("manual")  // "manual" | "bank_sync"
externalId  String? @unique             // TrueLayer transaction_id — deduplicación a nivel BD
bankMetadata Json?                      // datos raw del banco (merchant, category TrueLayer, etc.)
```

Agregar índice: `@@index([source])`, `@@index([externalId])`.

### 5. Account (extensión)

Agregar relación inversa:

```prisma
bankConnections BankConnection[]
```

---

## Archivos a crear / modificar

| Archivo | Acción | Descripción |
|---------|--------|-------------|
| `prisma/schema.prisma` | Modificar | Agregar 3 modelos nuevos + extensiones a Transaction y Account |
| `prisma/migrations/` | Crear | `prisma migrate dev --name feat-banking-sync` |
| `src/banking/ports/IBankingProvider.ts` | Crear | Interface: `getAuthUrl()`, `exchangeCode()`, `refreshToken()`, `getAccounts()`, `getTransactions()` |
| `src/banking/providers/truelayer/TrueLayerClient.ts` | Crear | Llamadas HTTP a `auth.truelayer.com` y `api.truelayer.com` (o sandbox) |
| `src/banking/providers/truelayer/TrueLayerAdapter.ts` | Crear | Implementa `IBankingProvider`, mapea respuestas TrueLayer a tipos internos |
| `src/banking/sync/SyncOrchestrator.ts` | Crear | Lógica core: fetch → dedup → resolve category → save. Agnóstico al trigger. |
| `src/banking/sync/SyncJob.ts` | Crear | Entry point del cron: itera todas las `BankConnection` activas → llama `SyncOrchestrator` |
| `src/repositories/bankConnection.repository.ts` | Crear | Queries Prisma para `BankConnection`, siempre con `userId` filter |
| `src/repositories/oauthState.repository.ts` | Crear | Crear, consumir y limpiar registros `OAuthState` |
| `src/repositories/pendingBankAuth.repository.ts` | Crear | Crear, leer y eliminar `PendingBankAuth` |
| `src/services/banking.service.ts` | Crear | Orquestación: initConnect, handleCallback, getAccounts, confirmMappings, disconnect, triggerSync, getStatus |
| `src/controllers/banking.controller.ts` | Crear | Handlers HTTP — extraen `userId`, llaman service |
| `src/schemas/banking.schema.ts` | Crear | Zod schemas para los endpoints (especialmente `confirmMappings`) |
| `src/routes/banking.routes.ts` | Crear | Router Express con todos los endpoints |
| `src/app.ts` | Modificar | `app.use('/api/banking', bankingRoutes)` |
| `src/lib/cron.ts` | Modificar | Registrar `*/10 * * * *` que llama `SyncJob.run()` |
| `src/types/index.ts` | Modificar | Agregar `TrueLayerAccount`, `SyncResult`, `BankConnectionStatus` |

---

## Endpoints

| Método | Ruta | Auth | Descripción |
|--------|------|------|-------------|
| `GET` | `/api/banking/connect` | JWT | Crea `OAuthState`, retorna `{ authUrl }` con URL de TrueLayer |
| `GET` | `/api/banking/callback` | Ninguna | Valida state, intercambia code por tokens, crea `PendingBankAuth`, redirige al frontend con `?pending=<id>` |
| `GET` | `/api/banking/pending/:id` | JWT | Retorna cuentas TrueLayer disponibles para mapear |
| `POST` | `/api/banking/connections/map` | JWT | Recibe mappings, crea `BankConnection` por cada uno, elimina `PendingBankAuth` |
| `GET` | `/api/banking/connections` | JWT | Lista conexiones activas del usuario con `lastSyncedAt` |
| `DELETE` | `/api/banking/connections/:id` | JWT | Soft delete: `isActive = false` |
| `POST` | `/api/banking/connections/:id/sync` | JWT | Fuerza sync inmediato de una conexión específica |
| `GET` | `/api/banking/status` | JWT | `{ isConnected, connections: [{ bankName, accountName, lastSyncedAt }] }` |

---

## Flujo completo

### Paso 1 — Iniciar conexión

```
Usuario: tarjeta de cuenta → "Vincular banco"
Frontend: GET /api/banking/connect  (con JWT)
Backend:  crea OAuthState { id: uuid, userId, expiresAt: now+10min }
          retorna { authUrl: "https://auth.truelayer.com/...&state=<uuid>" }
Frontend: redirige al usuario a authUrl
```

### Paso 2 — Callback de TrueLayer

```
TrueLayer: redirige a GET /api/banking/callback?code=X&state=<uuid>
Backend:
  1. Busca OAuthState por id=state → si no existe o expiró → error 400
  2. Elimina el OAuthState (token de un solo uso)
  3. Intercambia code por tokens (accessToken, refreshToken, tokenExpiresAt)
  4. Llama TrueLayer GET /data/v1/accounts → lista de sub-cuentas disponibles
  5. Crea PendingBankAuth { id: uuid, userId, tokens, truelayerAccounts, expiresAt: now+15min }
  6. Redirige al frontend: /banking/map?pending=<pendingAuthId>
```

### Paso 3 — Mapeo de sub-cuentas

```
Frontend: GET /api/banking/pending/:id  (con JWT)
Backend:  retorna { accounts: [{ truelayerAccountId, name, type, currency, balance }] }
Frontend: muestra lista de sub-cuentas de TrueLayer
          para cada una, dropdown con las cuentas existentes de la app
          usuario asigna (o ignora) cada sub-cuenta

Frontend: POST /api/banking/connections/map
  {
    pendingAuthId: "uuid",
    mappings: [
      { truelayerAccountId: "abc", appAccountId: "uuid-cuenta-app" },
      { truelayerAccountId: "def", appAccountId: "uuid-visa-app" }
    ]
  }
Backend:
  1. Valida PendingBankAuth (existe, no expiró, userId coincide)
  2. Para cada mapping: crea BankConnection con los tokens y los IDs
  3. Elimina PendingBankAuth
  4. Dispara sync inicial en background para cada conexión nueva
  5. Retorna { connections: [...] }
```

### Paso 4 — Polling periódico (SyncOrchestrator)

```
SyncJob (cada 10 min):
  1. Obtener todas las BankConnection activas (sin filtro de userId — opera global)
  2. Para cada conexión → SyncOrchestrator.sync(connection)

SyncOrchestrator.sync(connection):
  1. Si tokenExpiresAt < now + 5min → refreshToken() → actualizar tokens en BD
  2. from = connection.lastSyncedAt ?? now - 30 días
  3. Llamar TrueLayer GET /data/v1/accounts/:truelayerAccountId/transactions?from=...
  4. Por cada transacción:
     a. Buscar Transaction con externalId = truelayer_tx.transaction_id → skip si existe
     b. Resolver categoría "Bancario" del usuario (findOrCreate)
     c. Mapear y crear Transaction:
        amount = abs(truelayer_tx.amount)
        type = truelayer_tx.amount < 0 ? "expense" : "income"
        description = truelayer_tx.description
        date = truelayer_tx.timestamp
        source = "bank_sync"
        externalId = truelayer_tx.transaction_id
        bankMetadata = { merchant_name, transaction_category, ... }
        accountId = connection.accountId
        categoryId = categoría "Bancario" resuelta
        userId = connection.userId
  5. Actualizar connection.lastSyncedAt = now()
  6. Retornar { synced: N }
```

---

## Flujo de sync (SyncOrchestrator)

`SyncOrchestrator` no sabe si lo llamó el cron o el endpoint de sync manual — solo recibe un `BankConnection` y ejecuta el ciclo completo. Esto permite que ambos triggers usen exactamente la misma lógica.

---

## Variables de entorno a agregar

```
TRUELAYER_CLIENT_ID=
TRUELAYER_CLIENT_SECRET=
TRUELAYER_REDIRECT_URI=http://localhost:3001/api/banking/callback
TRUELAYER_SANDBOX=true
TRUELAYER_AUTH_URL=https://auth.truelayer-sandbox.com
TRUELAYER_API_URL=https://api.truelayer-sandbox.com
```

En producción: cambiar `_sandbox` por las URLs de producción y `TRUELAYER_SANDBOX=false`.

---

## Orden de implementación

1. **Migration** — agregar los 3 modelos nuevos + extender Transaction y Account
2. **IBankingProvider + TrueLayerClient + TrueLayerAdapter** — proveedor aislado y verificable
3. **Repositories** — `bankConnection`, `oauthState`, `pendingBankAuth`
4. **SyncOrchestrator** — lógica central, incluye `findOrCreateBankingCategory`
5. **SyncJob** — registrar en `cron.ts`
6. **banking.service + controller + routes** — CRUD de conexiones y flujo OAuth
7. **app.ts** — registrar rutas

---

## Deuda técnica documentada

| Item | Prioridad |
|------|-----------|
| Cifrar `accessToken` y `refreshToken` en BD (AES-256) | Alta antes de prod |
| Limpiar `OAuthState` y `PendingBankAuth` expirados con cron job | Media |
| Retry con backoff exponencial en `TrueLayerClient` (429, 5xx) | Media |
| Bloquear edición/eliminación manual de transacciones con `source = "bank_sync"` | Media |
| Notificación post-sync con N transacciones nuevas | Baja |

---

## Fuera de scope

- Webhooks de TrueLayer (push en lugar de polling)
- Categorización automática con IA
- Múltiples tokens por banco (los tokens se comparten entre todas las sub-cuentas del mismo OAuth — esto es implícito en el diseño)
- Rate limiting en endpoints de banking
- Soporte multi-proveedor (arquitectura preparada con `IBankingProvider`, pero solo TrueLayer implementado)
- Modificar/eliminar transacciones bancarias desde el frontend (restricción a implementar en v2)

---

## Fase 2 — Frontend

Stack: React 19 + TypeScript 5.9 + Vite 8 + TailwindCSS 4 + React Router DOM 7 + Axios

### Archivos a crear / modificar (Frontend)

| Archivo | Acción | Descripción |
|---------|--------|-------------|
| `src/api/banking.api.ts` | Crear | Llamadas Axios a todos los endpoints de banking |
| `src/types/banking.types.ts` | Crear | `TrueLayerAccount`, `BankConnection`, `BankingStatus`, `MappingPayload` |
| `src/hooks/useBanking.ts` | Crear | Estado de conexiones del usuario, status, disconnect, triggerSync |
| `src/hooks/useBankMapping.ts` | Crear | Estado del flujo de mapeo: cuentas TrueLayer disponibles, mapeos del usuario, submit |
| `src/pages/BankingMapPage.tsx` | Crear | Página `/banking/map` — lee `?pending=<id>`, muestra sub-cuentas, permite asignar |
| `src/components/accounts/BankConnectionBadge.tsx` | Crear | Badge en AccountCard: estado vinculado + "sync hace X min" + botón desconectar |
| `src/components/accounts/AccountCard.tsx` | Modificar | Agregar `BankConnectionBadge` y botón "Vincular banco" si no está vinculada |
| `src/App.tsx` (o router) | Modificar | Agregar ruta `/banking/map` protegida con auth |
| `src/types/index.ts` | Modificar | Re-exportar tipos de `banking.types.ts` si aplica al patrón actual |

### Routing

```
/banking/map?pending=<id>   ← nueva ruta protegida (PrivateRoute)
                              TrueLayer redirige aquí después del OAuth
                              Lee pending, muestra mapeo, redirige a /accounts al confirmar
```

### Componentes — detalle

**`BankConnectionBadge`** — recibe `connection: BankConnection | null` y `onDisconnect: () => void`:

```
Si vinculada:
  ✅ [NombreBanco] · sync hace 3 min     [Sincronizar] [Desconectar]

Si no vinculada:
  [+ Vincular banco]  → llama banking.api.initConnect() → redirige a authUrl
```

El "sync hace X min" se calcula en el cliente con `formatDistanceToNow` de `date-fns` aplicado a `lastSyncedAt`.

**`BankingMapPage`** — flujo completo en una sola página:

```
1. Monta → lee ?pending de URL → GET /api/banking/pending/:id
2. Muestra lista de sub-cuentas TrueLayer disponibles
3. Por cada sub-cuenta: dropdown con cuentas existentes de la app (de useAccounts)
4. Usuario asigna (o deja "No vincular")
5. Submit → POST /api/banking/connections/map → toast éxito → navigate('/accounts')
```

### Hooks — detalle

**`useBanking`**:
```typescript
interface UseBankingReturn {
  connections: BankConnection[]
  loading: boolean
  getConnectionForAccount: (accountId: string) => BankConnection | undefined
  disconnect: (connectionId: string) => Promise<void>
  triggerSync: (connectionId: string) => Promise<void>
  reload: () => void
}
```

**`useBankMapping`**:
```typescript
interface UseBankMappingReturn {
  truelayerAccounts: TrueLayerAccount[]
  mappings: Record<string, string>   // truelayerAccountId → appAccountId
  setMapping: (truelayerId: string, appAccountId: string) => void
  submit: () => Promise<void>
  loading: boolean
}
```

### Variables de entorno (Frontend)

No se requieren nuevas variables — el backend maneja todas las credenciales de TrueLayer. El `VITE_API_URL` existente es suficiente.

### Orden de implementación (Frontend)

1. `banking.types.ts` + `banking.api.ts`
2. `useBanking.ts` + `useBankMapping.ts`
3. `BankConnectionBadge` + modificar `AccountCard`
4. `BankingMapPage`
5. Registrar ruta en router
