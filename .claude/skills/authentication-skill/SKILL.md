---
name: authentication-skill
description: Manejar autenticación con JWT y bcrypt
type: skill
---

## Propósito

Manejar autenticación con JWT y bcrypt

## Cuándo Usar Este Skill

- ✅ Cuando necesitas implementar este patrón
- ✅ Para código relacionado con manejar autenticación con jwt y bcrypt
- ✅ Siguiendo las mejores prácticas del proyecto

## Lo Que Sabe Hacer

- JWT tokens
- bcrypt hashing
- Middleware auth
- Token refresh


## Patrones Clave

Ver `examples.md` para código real del proyecto.

## Best Practices

1. Sigue los patrones documentados
2. Consulta `conventions.md` para convenciones backend
3. Usa TypeScript types explícitos
4. Valida siempre los datos
5. Filtra siempre por userId (CRÍTICO)
6. Maneja errores apropiadamente

## Anti-Patterns

- No filtrar por userId (⚠️ CRÍTICO)
- Validación manual sin Zod
- Código sin TypeScript types
- Sin manejo de errores
- Queries sin optimizar

## Ejemplos

Ver `examples.md`
