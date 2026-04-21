# Estado del Proyecto - Cuentas Backend

Documento vivo del estado actual del backend. Actualizar regularmente.

## 📅 Fecha de Actualización
**Última actualización:** 2026-04-21

## 🚀 Estado General
API REST en desarrollo activo con endpoints core implementados.

## 📋 Endpoints Implementados

### ✅ Autenticación
- [x] POST /auth/login
- [x] POST /auth/register
- [x] POST /auth/logout (si aplica)

### ✅ Cuentas
- [x] GET /accounts
- [x] GET /accounts/:id
- [x] POST /accounts
- [x] PUT /accounts/:id
- [x] DELETE /accounts/:id

### ✅ Transacciones
- [x] GET /transactions
- [x] GET /transactions/:id
- [x] POST /transactions
- [x] PUT /transactions/:id
- [x] DELETE /transactions/:id

### ✅ Categorías
- [x] GET /categories
- [x] POST /categories
- [x] PUT /categories/:id
- [x] DELETE /categories/:id

### ✅ Gastos Fijos
- [x] GET /fixed-expenses
- [x] POST /fixed-expenses
- [x] PUT /fixed-expenses/:id
- [x] DELETE /fixed-expenses/:id
- [x] POST /fixed-expenses/:id/mark-paid

### ✅ Deudas
- [x] GET /debts
- [x] POST /debts
- [x] PUT /debts/:id
- [x] DELETE /debts/:id
- [x] GET /debts/:id/payments

### ✅ Pagos de Deudas
- [x] POST /debt-payments
- [x] GET /debt-payments

### ✅ Pagos Recurrentes
- [x] GET /recurring-debt-payments
- [x] POST /recurring-debt-payments
- [x] PUT /recurring-debt-payments/:id
- [x] DELETE /recurring-debt-payments/:id

### ✅ Dashboard
- [x] GET /dashboard/summary

### ✅ Presupuestos (FEAT-011 — 2026-04-21)
- [x] GET /budgets?month=&year= (con spent/remaining/percentage calculado)
- [x] POST /budgets
- [x] PATCH /budgets/:id
- [x] DELETE /budgets/:id

### ✅ Notificaciones y Alertas (FEAT-013 — 2026-04-21)
- [x] GET /notifications (con unreadCount)
- [x] PATCH /notifications/:id/read
- [x] PATCH /notifications/read-all
- [x] DELETE /notifications/:id
- [x] GET /notifications/preferences
- [x] PATCH /notifications/preferences
- [x] POST /notifications/test-email (TEST ONLY)

### 🔄 En Progreso
- [ ] OCR de recibos mejorado
- [ ] Análisis con IA
- [ ] Proyecciones financieras

### 📝 Pendiente
- [ ] Búsqueda avanzada
- [ ] Exportación de datos
- [ ] Webhooks para notificaciones
- [ ] Rate limiting

## 🐛 Bugs Conocidos

### Críticos
- (Ninguno reportado)

### Menores
- Cálculo de interés en deudas: revisar formato de entrada
- Performance: queries N+1 en algunos endpoints

## 🔧 Deuda Técnica

### Testing
- ❌ Sin tests unitarios (0% cobertura)
- ❌ Sin tests de integración
- **Prioridad:** Alta (implementar pronto)

### Performance
- ⚠️ N+1 queries en algunos endpoints
- ⚠️ Sin caching de datos frecuentes
- Solución: Revisar Prisma select/include

### Documentación
- ✅ Convenciones documentadas
- ⚠️ Endpoints no documentados con Swagger/OpenAPI
- **Próximo:** Agregar Swagger

### Code Quality
- ✅ TypeScript strict mode
- ✅ Sin `any` en código
- ⚠️ Algunos servicios podrían dividirse

## 📊 Métricas

### API Response Times
- GET endpoints: ~50-100ms (sin relaciones)
- GET con include: ~150-300ms
- POST/PUT: ~100-200ms
- DELETE: ~50-100ms

**Target:** < 200ms para P95

### Database
- Tabla más grande: Transaction (~100k registros)
- Índices: Implementados para queries críticas
- Migrations: 12 completadas

### Code
- Controladores: 13 archivos
- Servicios: 13 archivos
- Schemas: 13 archivos
- Líneas de código TypeScript: ~3500

## 🔐 Seguridad

### Implementado
- ✅ JWT autenticación
- ✅ bcrypt para passwords
- ✅ Filtrado por userId en todas las queries
- ✅ Validación con Zod
- ✅ CORS configurado

### Pendiente
- [ ] Rate limiting
- [ ] Helmet para headers
- [ ] CSRF tokens (si frontend lo requiere)
- [ ] Audit logging

## 🌐 Integración con Frontend

### Tipos Compartidas
- Actualmente: Definidas por separado en cada repo
- **Próximo:** Considerar monorepo o shared types package

### Endpoints
- Frontend consume en `VITE_API_URL`
- Base path: `/api/`
- Versionado: No implementado (considerar v1)

### Cambios Recientes
- **FEAT-011 (2026-04-21):** API de presupuestos `/api/budgets` — modelo Budget en Prisma, CRUD completo, GET enriquece con spending calculado desde transacciones via `groupBy`
- **FEAT-013 (2026-04-21):** Sistema de notificaciones — modelo Notification en Prisma, cron jobs (deudas diario + email mensual), API REST completa, email HTML via Resend, `checkBudgetAndNotify` en transactions service

## 📦 Dependencias

### Versiones Actuales
- Express: 4.21.1
- TypeScript: 5.6.3
- Prisma: 5.22.0
- Node: 18+ (recomendado 20+)

### Vulnerabilidades
- ✅ Sin vulnerabilidades críticas
- Run: `npm audit` regularmente

## 🚢 Despliegue

### Ambiente
- **Local:** npm run dev
- **Producción:** (Especificar plataforma)

### Procesos
1. Migrations: `npx prisma migrate deploy`
2. Build: `npm run build`
3. Start: `node dist/index.js` o package.json start

### Variables Requeridas
```
DATABASE_URL=postgresql://...
JWT_SECRET=tu-secreto
JWT_EXPIRATION=24h
PORT=3001
RESEND_API_KEY=re_...
RESEND_FROM_EMAIL=MisCuentas <noreply@miscuentas.app>
```

## 🎯 Próximas Prioridades

### Sprint Actual
1. [ ] Agregar tests unitarios (controladores críticos)
2. [ ] Optimizar queries N+1
3. [ ] Documentar API con Swagger

### Próximos Sprints
1. [ ] Implementar OCR de recibos
2. [ ] Análisis con IA (Anthropic)
3. [ ] Proyecciones financieras
4. [ ] Rate limiting + caching

## 👥 Equipo

- **Desarrollador Principal:** Tu nombre
- **Frontend:** Tu nombre (repo cuentas_front)

## 🔗 Enlaces

- **Frontend:** https://github.com/Jabbcode/cuentas_front
- **Repo Backend:** https://github.com/Jabbcode/cuentas_back
- **Base de Datos:** PostgreSQL (especificar servidor)

## 📝 Notas de Desarrollo

### Patrones Establecidos
- Controller → Service → Prisma
- Zod schemas para validación
- Error handling con try/catch → next(error)
- Filtrado por userId en todas las queries

### Decisiones Arquitectónicas
- Express sobre Fastify (comunidad, documentación)
- Prisma sobre raw SQL (type safety, migrations)
- Zod sobre Joi (TypeScript-first)

### Problemas a Solucionar
1. N+1 queries: implementar select/include apropiado
2. Performance: medir y optimizar endpoints lentos
3. Caching: considerar Redis para datos frecuentes

## 📚 Roadmap Futuro

### Q1 2024
- [ ] Tests: 70% cobertura
- [ ] API docs: Swagger
- [ ] Optimización: queries rápidas

### Q2 2024
- [ ] OCR: Upload de recibos funcional
- [ ] IA: Análisis básico
- [ ] Caché: Redis si necesario

### Q3 2024
- [ ] Proyecciones financieras
- [ ] Webhooks/notificaciones
- [ ] GraphQL (considerar)

## 🔍 Cómo Contribuir

1. Crear rama `feature/descripcion`
2. Seguir convenciones en `conventions.md`
3. Pasar tests y validaciones
4. Crear PR con descripción clara
5. Esperar aprobación antes de mergear
6. Actualizar este documento

## 📞 Contactos

- **Dudas de desarrollo:** GitHub issues
- **Decisiones:** Ver `decisions/` en carpeta claude
- **Estado:** Este documento

---

**Nota:** Actualizar al finalizar cada sprint o cuando hay cambios significativos.
