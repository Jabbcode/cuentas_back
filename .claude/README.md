# Claude Context Guide - Cuentas Backend

Esta carpeta contiene documentación y contexto completo del proyecto backend para que Claude (o cualquier desarrollador) pueda entender la arquitectura, convenciones y estado del proyecto.

## 📂 Estructura de esta carpeta

### Documentación Principal
- **context.md** - Descripción general del proyecto, stack tecnológico y estado actual
- **conventions.md** - Convenciones de código, estructura, patrones
- **system-prompt.md** - Instrucciones de rol y comportamiento esperado de Claude

### Arquitectura
- **architecture/overview.md** - Diagrama conceptual y flujos de datos
- **architecture/database-schema.md** - Estructura de tablas y relaciones
- **architecture/services.md** - Capa de servicios y lógica
- **architecture/api-design.md** - Design de endpoints REST

### Patrones y Ejemplos
- **architecture/patterns/services.md** - Documentación de patrones de servicios
- **examples/services/** - Ejemplos reales de servicios
- **examples/controllers/** - Ejemplos reales de controladores

### Decisiones y Guías
- **decisions/** - Registro de decisiones arquitectónicas
- **guidelines/code-style.md** - Estilo de código
- **guidelines/error-handling.md** - Manejo de errores
- **guidelines/database-operations.md** - Operaciones DB con Prisma
- **guidelines/api-guidelines.md** - Best practices para APIs

### Estado del Proyecto
- **project-state.md** - Estado actual, sprints, deuda técnica

## 🚀 Cómo usar esta carpeta

### Si necesitas entender...
| Necesito | Consulto |
|----------|----------|
| El proyecto en general | **context.md** |
| Estructura de BD | **architecture/database-schema.md** |
| Cómo funcionan los servicios | **architecture/services.md** |
| Endpoints disponibles | **architecture/api-design.md** |
| Convenciones de nombres | **conventions.md** |
| Patrones de error handling | **guidelines/error-handling.md** |
| Decisiones pasadas | **decisions/** |
| El estado actual | **project-state.md** |

### Pasando contexto a Claude
Puedes pasar los URLs o contenido de los archivos relevantes a Claude para que tenga el contexto necesario.

**Ejemplo:**
```
"Revisa este archivo de convenciones y ayúdame a crear un nuevo servicio:
<pegar contenido de conventions.md>"
```

## 📝 Mantenimiento

Esta carpeta debe mantenerse actualizada:
- Revísala al menos una vez por sprint
- Actualiza **project-state.md** regularmente
- Documenta nuevas decisiones en **decisions/**
- Añade ejemplos cuando discovers nuevos patrones

## 📚 Referencias rápidas

- **Stack:** Node.js, Express, TypeScript, PostgreSQL, Prisma
- **Base de Datos:** PostgreSQL con Prisma ORM
- **Autenticación:** JWT + bcrypt
- **Validación:** Zod schemas
- **Puerto de desarrollo:** 3001
- **API Base:** /api/v1/

## 🔄 Flujo de Desarrollo

1. Crear rama con patrón `feature/descripcion` o `fix/descripcion`
2. Implementar siguiendo convenciones
3. Crear PR con descripción clara
4. Esperar review y feedback
5. Mergear a main tras aprobación
6. Actualizar `project-state.md`

## 🔗 Integración con Frontend

Este backend está diseñado para trabajar con el frontend en:
https://github.com/Jabbcode/cuentas_front

**Importante:** Mantener sincronizados:
- Tipos de datos
- Versionado de API
- Cambios en autenticación
