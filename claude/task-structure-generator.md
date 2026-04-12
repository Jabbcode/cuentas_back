# 📋 Generación Automática de Estructura de Tareas

**Archivo:** `/claude/task-structure-generator.md`  
**Versión:** 1.0  
**Última actualización:** 2026-04-12  

---

## 🎯 Propósito

Este documento explica cómo Claude **automáticamente genera la estructura completa** de una tarea basándose solo en un **Título** y **Descripción** en Notion.

**Objetivo:** Ahorrar tiempo rellenando campos repetitivos y mantener consistencia en la estructura de tareas.

---

## 🚀 Flujo de Generación Automática

### PASO 1: Usuario crea tarea con MÍNIMA información

En Notion, usuario crea una tarea con:

```
📌 TÍTULO: "FIX-XXX: [Descripción breve]"
📝 DESCRIPTION: "[Contexto completo del problema]"

❌ SIN rellenar:
- Type
- Stack  
- Priority
- Effort
- Acceptance Criteria
- Implementation Details
- Labels
- Design/Mockup
```

**Ejemplo:**
```
Title: "FIX-002: Botones no responden en mobile"
Description: "Los botones 'Nueva Transacción' y 'Escanear Factura' 
no se apilan en columna en mobile, causando overflow..."
```

---

### PASO 2: Usuario dice a Claude: "Lee la tarea FIX-002 de Notion"

Claude:
1. Lee Notion vía MCP
2. Extrae Título + Description
3. ANALIZA el contexto
4. **GENERA automáticamente propuesta de estructura**

---

### PASO 3: Claude propone ESTRUCTURA (no implementación)

Claude devuelve:

```
## 📊 ESTRUCTURA PROPUESTA PARA: FIX-002

**Análisis del contexto:**
Problema de responsive design en botones de actions. 
El componente no ajusta layout para viewports pequeños.
Solución: Flexbox responsive con breakpoints Tailwind.

**Type recomendado:** Fix
**Stack recomendado:** Frontend
**Priority recomendado:** Medium
**Effort estimado:** S (2 horas)

**Acceptance Criteria propuestos:**
- ✅ En mobile (<480px): Botones apilan en columna
- ✅ En desktop (>768px): Botones en fila horizontal
- ✅ Ancho se adapta al contenedor
- ✅ Texto completamente visible sin truncar
- ✅ Espaciado consistente en todas resoluciones

**Implementation Details propuestos:**
- Skills requeridos: Styling Skill, Component Composition Skill
- Archivos a modificar: src/components/pages/TransactionsPage.tsx
- Constraints: 
  - No usar inline styles
  - Mantener consistencia con diseño actual
  - Asegurar accesibilidad
- Dependencias: TailwindCSS (ya disponible)

¿Está bien? ¿Cambios en la estructura propuesta?
```

---

## 💬 Opciones de Respuesta del Usuario

### OPCIÓN 1: "OK"

```
Usuario: "OK"

Claude:
1. Actualiza Notion con TODOS los campos generados
2. Reporta: "📌 **Notion Update:** Estructura actualizada en Notion"
3. Espera a que usuario confirme actualización en Notion
4. Luego continúa: "¿Procedemos con la implementación?"
```

### OPCIÓN 2: "Cambio: [X]"

```
Usuario: "Cambio: Priority debe ser High, no Medium"

Claude:
1. ACTUALIZA la propuesta (cambia Priority a High)
2. Reporta: "**CAMBIOS REALIZADOS EN ESTRUCTURA:**"
3. Lista qué cambió: "- Priority: Medium → High"
4. Re-propone: "¿OK?"
```

### OPCIÓN 3: "OK, implementa"

```
Usuario: "OK, implementa"

Claude:
1. Actualiza Notion con estructura
2. NO espera confirmación adicional
3. Continúa INMEDIATAMENTE a FASE 1: PROPUESTA
4. (Saltea el paso extra, ahorra tiempo)
```

### OPCIÓN 4: "Cambios: [X], [Y], [Z]"

```
Usuario: "Cambios: Stack debe ser Full Stack, Effort es M, 
agregar criterio de testing"

Claude:
1. Actualiza ESTRUCTURA PROPUESTA con todos los cambios
2. Reporta: "**CAMBIOS REALIZADOS EN ESTRUCTURA:**"
3. Lista cada cambio
4. Pide confirmación: "¿OK ahora?"
```

---

## 🔄 Flujo Completo Ejemplo

```
1. USUARIO CREA EN NOTION:
   Title: "FEAT-102: Panel de resumen de deudas"
   Description: "Mostrar resumen con deuda total y breakdown..."
   [Otros campos vacíos]

2. USUARIO A CLAUDE:
   "Lee la tarea FEAT-102 de Notion"

3. CLAUDE GENERA PROPUESTA:
   "## 📊 ESTRUCTURA PROPUESTA PARA: FEAT-102
   Análisis: Panel de dashboard con datos...
   Type: Feature
   Stack: Frontend
   Priority: High
   Effort: M
   
   Acceptance Criteria:
   - Muestra deuda total
   - Breakdown por categoría
   - [...]
   
   ¿OK?"

4. USUARIO:
   "OK"

5. CLAUDE:
   "📌 Notion Update: Estructura actualizada
   (User confirma actualización en Notion)"

6. CLAUDE CONTINÚA:
   "## 📋 PROPUESTA: Panel de deudas
   Skills: ComponentGeneratorAgent...
   Archivos: DebtSummaryPanel.tsx, useDebtSummary.ts
   ¿OK?"

7. USUARIO:
   "OK"

8. CLAUDE IMPLEMENTA, CREA PR, MERGEA
```

---

## 🧠 Cómo Claude Genera la Estructura

### Análisis del Título

Claude extrae:
- **Tipo de cambio:** FIX → Type: Fix
- **Contexto:** Keywords en descripción
- **Complejidad:** Estimación de esfuerzo

### Análisis de la Descripción

Claude identifica:
- **Problema/Feature:** ¿Qué hay que hacer?
- **Contexto técnico:** ¿Qué parte del código?
- **Aceptance criteria:** ¿Cómo sé que está listo?
- **Stack:** ¿Frontend, Backend, o ambos?
- **Prioridad:** ¿Qué tan urgente?

### Generación de Campos

**Type (automático):**
- "arreglar", "corregir", "error" → Fix
- "nueva funcionalidad", "agregar" → Feature
- "refactorizar", "mejorar código" → Refactor
- "documentación" → Docs
- "limpieza", "actualizar" → Chore

**Stack (automático):**
- Keywords: "botón", "componente", "UI", "CSS" → Frontend
- Keywords: "endpoint", "database", "query", "service" → Backend
- Keywords: "ambos", "integración", "API" → Full Stack
- Keywords: "deploy", "infra", "CI/CD" → DevOps

**Priority (automático):**
- Critical: "bloquea", "no funciona", "urgente"
- High: "importante", "próxima semana"
- Medium: "normal", "cuando puedas"
- Low: "sería bueno", "futuro"

**Effort (automático):**
- XS (30 min): Cambios triviales
- S (2h): Cambios simples, un archivo
- M (4h): Feature pequeño, múltiples archivos
- L (8h): Feature mediano, complejidad
- XL (16h+): Feature grande, muy complejo

---

## ⚙️ Campos Generados Automáticamente

Claude GENERA:
- ✅ Type
- ✅ Stack
- ✅ Priority
- ✅ Effort
- ✅ Acceptance Criteria
- ✅ Implementation Details
- ✅ Labels (relacionados)

Claude NO genera (usuario provee):
- ❌ Design/Mockup (si existe)
- ❌ Due Date
- ❌ Assigned To
- ❌ Custom campos específicos del proyecto

---

## 🎯 Cuándo Usar Esta Funcionalidad

### ✅ USA ESTO CUANDO:
- Usuario crea tarea en Notion rápidamente
- Solo proporciona Título + Description
- Quiere que Claude rellene el resto
- Necesita estructura consistente
- Quiere ahorrar tiempo rellenando campos

### ❌ NO USES ESTO CUANDO:
- Tarea ya tiene todos los campos rellenados
- Usuario proporciona estructura específica
- Campos personalizados requeridos
- Design/Mockup ya existe

---

## 🔐 Reglas de Generación

### REGLA 1: SIEMPRE preguntar antes de actualizar
```
Claude:
- PROPONE estructura
- ESPERA confirmación del usuario
- SOLO ENTONCES actualiza Notion
```

### REGLA 2: Ser conservador en estimaciones
```
Si hay duda en esfuerzo:
- Mejor sobrestimar que subestimar
- Mejor High que Medium si hay incertidumbre
```

### REGLA 3: Basarse en descripción del usuario
```
Si descripción dice "urgente" pero parece trivial:
- RESPETA lo que dice el usuario
- Propone pero marca como ajustable
```

### REGLA 4: Buscar contexto en proyecto
```
Si hay archivos relacionados mencionados:
- Identificar archivos exactos
- Proponer modificaciones
- Incluir en Implementation Details
```

---

## 📝 Ejemplo Detallado Frontend

### Input:
```
Título: "FEAT-103: Filtrar transacciones por categoría"
Description: "Agregar filtro de categoría en la lista de transacciones. 
El usuario debería poder seleccionar una categoría y ver solo 
transacciones de esa categoría. Considerar multi-select."
```

### Output de Claude:

```
## 📊 ESTRUCTURA PROPUESTA PARA: FEAT-103

**Análisis del contexto:**
Feature de UX que agrega filtrado por categoría en TransactionsPage.
Requiere componente de selector (single o multi-select) y lógica 
de filtrado. Impacto medio-alto en UX, complejidad baja-media.

**Type recomendado:** Feature
**Stack recomendado:** Frontend
**Priority recomendado:** High
**Effort estimado:** M (4 horas)

**Acceptance Criteria propuestos:**
- ✅ Selector de categoría visible en filtros
- ✅ Multi-select de categorías funciona
- ✅ Filtro se aplica al listado en tiempo real
- ✅ Opción "Todas las categorías" por defecto
- ✅ Estado del filtro se mantiene al navegar
- ✅ UI consistente con diseño actual

**Implementation Details propuestos:**
- Skills: ComponentCompositionSkill, HookCreatorAgent, 
  StateManagementSkill
- Archivos a crear: CategoryFilter.tsx, useCategoryFilter.ts
- Archivos a modificar: TransactionsPage.tsx, FilterBar.tsx
- Constraints:
  - Mantener accesibilidad (ARIA labels)
  - Performance: no refetch innecesario
  - Mobile-first approach
- Dependencias: Componentes UI existentes, react-select (ya disponible)

¿Está bien? ¿Cambios en la estructura?
```

---

## 📝 Ejemplo Detallado Backend

### Input:
```
Título: "BACKEND-45: Endpoint para obtener resumen de gastos"
Description: "Crear endpoint que retorne: gasto total del mes, 
breakdown por categoría, comparativa con mes anterior."
```

### Output de Claude:

```
## 📊 ESTRUCTURA PROPUESTA PARA: BACKEND-45

**Análisis del contexto:**
Nuevo endpoint REST que requiere:
- Query agregada en DB (SUM, GROUP BY)
- Comparativa con datos históricos
- Filtrado por userId (crítico para seguridad)
- Validación de rango de fechas

**Type recomendado:** Feature
**Stack recomendado:** Backend
**Priority recomendado:** High
**Effort estimado:** M (4 horas)

**Acceptance Criteria propuestos:**
- ✅ GET /api/expenses/summary retorna estructura correcta
- ✅ Gasto total es correcto (SUM validado)
- ✅ Breakdown por categoría es preciso
- ✅ Comparativa con mes anterior funciona
- ✅ Datos filtrados por userId (CRÍTICO)
- ✅ Status 200 con datos válidos

**Implementation Details propuestos:**
- Skills: DatabaseQuerySkill, APIEndpointAgent, 
  ValidationSkill, SecuritySkill
- Archivos a crear: expense-summary.schema.ts, 
  expense-summary.service.ts, expense-summary.controller.ts
- Archivos a modificar: expenses.routes.ts
- Constraints:
  - SIEMPRE filtrar por userId (no de parámetros)
  - Usar prepared statements (Prisma)
  - Validar rango de fechas
- Seguridad: 
  - userId DEBE venir de JWT token
  - NUNCA confiar en parámetros
- Dependencias: Prisma (ya disponible), Zod para validación

¿Está bien? ¿Cambios en la estructura?
```

---

## 🚀 Ventajas del Sistema

✅ **Ahorra tiempo:** No rellenar manualmente campos repetitivos  
✅ **Consistencia:** Todas las tareas tienen estructura uniforme  
✅ **Calidad:** Claude analiza contexto, no valores random  
✅ **Flexibilidad:** Usuario puede cambiar lo que generó Claude  
✅ **Agil:** De Título → Implementación en 3 pasos  

---

## ⚠️ Notas Importantes

- **No es magia:** Claude se basa en análisis de descripción
- **User siempre controla:** Debe aprobar antes de actualizar Notion
- **Mejora con contexto:** Mejor descripción = mejor estructura
- **Independiente de Notion:** Funciona incluso si Notion está offline

---

**Versión:** 1.0  
**Última actualización:** 2026-04-12  
**Estado:** Listo para producción  

¡Sistema de generación automática de estructura listo! 🚀
