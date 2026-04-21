---
name: data-transformation-skill
description: Transformar datos de BD a formato de API
type: skill
---

## Propósito

Transformar datos de BD a formato de API

## Cuándo Usar Este Skill

- ✅ Cuando necesitas implementar este patrón
- ✅ Para código relacionado con transformar datos de bd a formato de api
- ✅ Siguiendo las mejores prácticas del proyecto

## Lo Que Sabe Hacer

- Mapeo de tipos
- Serialización
- Campos derivados
- Filtrado de datos


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
