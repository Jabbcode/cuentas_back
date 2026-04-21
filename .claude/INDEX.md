# 📑 Índice Completo - Carpeta Claude Backend

Guía rápida de todos los archivos disponibles en `./claude`.

## 📌 Navegación Rápida

### Necesito Entender...

| Necesito | Archivo | Descripción |
|----------|---------|-------------|
| **El proyecto** | `context.md` | Qué es, stack, estado |
| **Cómo escribir código** | `conventions.md` | Nombres, estructura, patrones |
| **Instrucciones para Claude** | `system-prompt.md` | Cómo debería trabajar |
| **Estado actual** | `project-state.md` | Sprints, bugs, próximos pasos |
| **Arquitectura general** | `architecture/overview.md` | Diagramas y flujos |
| **Estructura BD** | `architecture/database-schema.md` | Tablas, relaciones, índices |
| **Los servicios** | `architecture/services.md` | Catálogo de servicios |
| **Los endpoints** | `architecture/api-design.md` | Todos los endpoints |
| **Un ejemplo real** | `examples/services/` | Servicio bien hecho |
| **Decisiones pasadas** | `decisions/ADR-decisions.md` | Por qué usamos X |

## 📂 Estructura de Carpetas

```
claude/
├── README.md
│   └─ Este documento (índice)
│
├── 📋 DOCUMENTACIÓN PRINCIPAL
│   ├── context.md              # Descripción del proyecto
│   ├── conventions.md          # Cómo escribir código
│   ├── system-prompt.md        # Instrucciones para Claude
│   └── project-state.md        # Estado actual
│
├── 🏗️ ARQUITECTURA (architecture/)
│   ├── overview.md             # Diagrama general + flujos
│   ├── database-schema.md      # Schema Prisma completo
│   ├── services.md            # Documentación de servicios
│   ├── api-design.md          # Endpoints REST
│   │
│   └─ Próximos (puede agregar):
│       ├── error-handling.md  # Estrategia de errores
│       └── middleware.md      # Middlewares disponibles
│
├── 💡 EJEMPLOS REALES (examples/)
│   ├── services/
│   │   └─ (futuros ejemplos de servicios)
│   │
│   └── controllers/
│       └─ (futuros ejemplos de controladores)
│
├── 📖 DECISIONES ARQUITECTÓNICAS (decisions/)
│   └── ADR-decisions.md        # Registro de decisiones
│       ├── ADR-001: Express vs Fastify
│       ├── ADR-002: Prisma vs Raw SQL
│       ├── ADR-003: Zod para validación
│       ├── ADR-004: PostgreSQL
│       └── ADR-005: TypeScript Strict
│
└── 📚 GUIDELINES (guidelines/)
    └─ (Próximos archivos):
        ├── code-style.md
        ├── database-operations.md
        ├── error-handling.md
        ├── api-guidelines.md
        └── testing-strategy.md
```

## 🔍 Búsqueda por Tópico

### 🗄️ Base de Datos
- Ver: `architecture/database-schema.md` (completo)
- Ver: `context.md` → sección "Base de Datos"
- Ver: `guidelines/database-operations.md` (cuando exista)

### 📡 Endpoints REST
- Ver: `architecture/api-design.md` (listado completo)
- Ver: `architecture/overview.md` → sección "Flujo de Request"

### ⚙️ Servicios
- Ver: `architecture/services.md` (catálogo completo)
- Ver: `examples/services/` (código real)
- Ver: `conventions.md` → sección "Patrón Service"

### 🎮 Controladores
- Ver: `conventions.md` → sección "Patrón Controller"
- Ver: `examples/controllers/` (código real)

### ✔️ Validación
- Ver: `conventions.md` → sección "Patrón Schema Zod"
- Ver: `architecture/overview.md` → sección "Validación"

### 🔐 Seguridad
- Ver: `system-prompt.md` → sección "Reglas de Seguridad"
- Ver: `conventions.md` → sección "Seguridad"
- Ver: `architecture/database-schema.md` → "Filtrado por Usuario"

### 🐛 Manejo de Errores
- Ver: `context.md` → sección "Manejo de Errores"
- Ver: `guidelines/error-handling.md` (cuando exista)

### 📊 Queries Complejas
- Ver: `architecture/database-schema.md` → sección "Relaciones"
- Ver: `examples/` (cuando exista)

### 🚀 Performance
- Ver: `architecture/database-schema.md` → "Índices para Performance"
- Ver: `project-state.md` → "Métricas"

## 📚 Flujo de Lectura Recomendado

**Para nuevos desarrolladores:**
1. Empezar con `README.md` (este archivo)
2. Leer `context.md` (qué es el proyecto)
3. Leer `conventions.md` (cómo escribir código)
4. Revisar `architecture/overview.md` (cómo funciona)
5. Estudiar `architecture/database-schema.md` (estructura BD)
6. Ver `examples/` (código real)

**Para crear un nuevo endpoint:**
1. Revisar `conventions.md` → patrones
2. Ver endpoint similar en `architecture/api-design.md`
3. Revisar `architecture/database-schema.md` para la tabla
4. Copiar patrón de otro servicio
5. Escribir schema, service, controller, route
6. Crear PR con descripción

**Para trabajar con BD:**
1. Ir a `architecture/database-schema.md`
2. Encontrar tu tabla
3. Ver índices disponibles
4. Ver relaciones
5. Ver ejemplos de queries
6. Usar select/include apropiadamente

**Para entender una decisión:**
1. Ir a `decisions/ADR-decisions.md`
2. Buscar la ADR relevante
3. Leer problema, contexto, decisión

## 🔗 Enlaces de Referencia

- **Stack Overview:** `context.md` → "Stack Tecnológico"
- **Tablas BD:** `architecture/database-schema.md` → "Tablas Detalladas"
- **Endpoints:** `architecture/api-design.md`
- **Patrones:** `conventions.md`
- **Seguridad:** `system-prompt.md` → "Reglas de Seguridad"

## ✅ Checklist: Qué Revisar Antes de un PR Backend

Antes de hacer cualquier cambio, revisa:
- [ ] `conventions.md` → Patrón Controller/Service/Schema
- [ ] `architecture/database-schema.md` → Estructura de la tabla
- [ ] `architecture/api-design.md` → Si el endpoint existe
- [ ] `system-prompt.md` → Reglas de seguridad críticas
- [ ] ¿Filtro por userId en queries? → **CRÍTICO**
- [ ] ¿Validación con Zod schema? → **CRÍTICO**
- [ ] ¿Try/catch → next(error)? → **CRÍTICO**

## 🚀 Cómo Actualizar Esta Carpeta

Cuando agregues o cambies algo:
1. Documenta en el archivo relevante
2. Actualiza `project-state.md` si es significativo
3. Considera si necesitas un ADR en `decisions/`
4. Agrega un ejemplo en `examples/` si es un patrón nuevo

## 📝 Archivos Todavía por Crear

Estos archivos estarían bien tener (crear en PRs futuras):

```
guidelines/
├── code-style.md           # ESLint, formatting, best practices
├── database-operations.md  # Prisma best practices
├── error-handling.md       # Estrategia de errores consistente
├── api-guidelines.md       # Best practices REST
└── testing-strategy.md     # Jest/Vitest setup

architecture/
├── services.md             # Catálogo detallado de servicios
├── api-design.md          # Todos los endpoints documentados
├── error-handling.md      # Estrategia centralizada
├── middleware.md          # Custom middlewares
└── authentication.md      # JWT y autorización

examples/
├── services/
│   ├── accounts.service-example.md
│   ├── transactions.service-example.md
│   └── auth.service-example.md
│
└── controllers/
    ├── accounts.controller-example.md
    └── transactions.controller-example.md
```

## 💡 Pro Tips

1. **Ctrl+F es tu amigo:** Usa search para encontrar rápido
2. **Empieza pequeño:** Lee una sección, no todo de una
3. **Consulta ejemplos:** Siempre busca un servicio/controlador similar
4. **Pregunta a Claude:** Pasa este archivo a Claude para ayuda rápida
5. **Actualiza regularmente:** Mantén sincronizado con cambios

## 🎯 Propósito de Esta Carpeta

Esta carpeta existe para:
- ✅ No repetir explicaciones oralmente
- ✅ Mantener conocimiento centralizado
- ✅ Onboard nuevos desarrolladores rápido
- ✅ Dar contexto a Claude automáticamente
- ✅ Documentar decisiones importantes
- ✅ Mostrar patrones reales del proyecto

## 🔒 Seguridad: Lo Más Importante

**Nunca olvides:**
1. ✅ Filtrar por `userId` en TODAS las queries
2. ✅ Validar input con Zod schema
3. ✅ Try/catch → next(error)
4. ✅ HTTP status codes correctos
5. ❌ No exponer detalles de error
6. ❌ No retornar datos de otros usuarios

Ver: `system-prompt.md` → "Reglas de Seguridad"

## 📞 Necesito Ayuda

Si no encuentras lo que buscas:
1. Busca en este INDEX
2. Revisa `context.md` o `conventions.md`
3. Mira un ejemplo similar en `examples/`
4. Revisa `architecture/` para entender flujos
5. Pregunta a Claude pasándole este archivo

## 🔄 Relación con Frontend

Este backend integra con frontend en: https://github.com/Jabbcode/cuentas_front

**Importante:**
- Mantener tipos sincronizados
- Coordinar cambios de API
- Documentar breaking changes

## 📊 Estado General

- **Endpoints:** 12+ implementados ✅
- **Testing:** Pendiente
- **Documentación:** En progreso ✅
- **Performance:** Buena (ver project-state.md)
- **Seguridad:** Implementada ✅

Para detalles, ver: `project-state.md`

---

**Última actualización:** 2024
**Responsable:** Equipo de desarrollo
**Frecuencia de actualización:** Cada sprint o cuando hay cambios significativos

**Recuerda:** Si no encuentras algo, pregunta a Claude con este archivo como contexto. 🤖
