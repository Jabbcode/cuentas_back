# Backend Skills

Habilidades disponibles para trabajar en el backend de Cuentas.

## 📚 Skills Documentados

### 1. Database Query Skill
- **Descripción:** Escribir queries Prisma eficientes y seguras
- **Cuándo usar:** Para consultas a la BD
- **Documentación:** [`database-query-skill/SKILL.md`](./database-query-skill/SKILL.md)
- **Ejemplos:** [`database-query-skill/examples.md`](./database-query-skill/examples.md)

### 2. Validation Skill
- **Descripción:** Validar datos con Zod
- **Cuándo usar:** Validar inputs de usuario
- **Documentación:** [`validation-skill/SKILL.md`](./validation-skill/SKILL.md)
- **Ejemplos:** [`validation-skill/examples.md`](./validation-skill/examples.md)

### 3. Error Handling Skill
- **Descripción:** Manejar errores consistentemente
- **Cuándo usar:** En todo controlador o servicio
- **Documentación:** [`error-handling-skill/SKILL.md`](./error-handling-skill/SKILL.md)
- **Ejemplos:** [`error-handling-skill/examples.md`](./error-handling-skill/examples.md)

### 4. Authentication Skill
- **Descripción:** Manejar autenticación con JWT y bcrypt
- **Cuándo usar:** Login, registro, protección de rutas
- **Documentación:** [`authentication-skill/SKILL.md`](./authentication-skill/SKILL.md)
- **Ejemplos:** [`authentication-skill/examples.md`](./authentication-skill/examples.md)

### 5. Security Skill
- **Descripción:** Asegurar que datos no se filteren entre usuarios
- **Cuándo usar:** En TODO endpoint (CRÍTICO)
- **Documentación:** [`security-skill/SKILL.md`](./security-skill/SKILL.md)
- **Ejemplos:** [`security-skill/examples.md`](./security-skill/examples.md)

### 6. Data Transformation Skill
- **Descripción:** Transformar datos de BD a formato de API
- **Cuándo usar:** Antes de retornar datos
- **Documentación:** [`data-transformation-skill/SKILL.md`](./data-transformation-skill/SKILL.md)
- **Ejemplos:** [`data-transformation-skill/examples.md`](./data-transformation-skill/examples.md)

---

## 🎯 Cómo Usar

1. Encuentra el skill que necesitas
2. Lee el `SKILL.md` principal
3. Consulta `examples.md` para ver código real
4. Sigue los patrones documentados

## ⚠️ CRÍTICO

**SIEMPRE filtrar por userId en TODOS los queries** - Esto es seguridad fundamental.
