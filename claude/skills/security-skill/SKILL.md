---
name: security-skill
description: Asegurar que datos no se filteren entre usuarios
type: skill
---

## Propósito

Asegurar que datos no se filteren entre usuarios

## Cuándo Usar Este Skill

- ✅ Cuando necesitas implementar este patrón
- ✅ Para código relacionado con asegurar que datos no se filteren entre usuarios
- ✅ Siguiendo las mejores prácticas del proyecto

## Lo Que Sabe Hacer

- Filtrado por userId
- Validación de propiedad
- CORS
- Input validation


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
