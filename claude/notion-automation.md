# 🤖 Guía de Automatización de Notion

**Archivo:** `/claude/notion-automation.md`  
**Versión:** 1.0  
**Última actualización:** 2026-04-12  

---

## 📋 Propósito

Este archivo explica cómo Claude AUTOMATICAMENTE actualiza el Status de las tareas en Notion mientras avanza el flujo de desarrollo.

**Objetivo:** Mantener Notion sincronizado con el progreso del trabajo sin que tengas que hacerlo manualmente.

---

## 🔄 Flujo Automático de Updates en Notion

### PASO 1: PROPUESTA APROBADA
**Cuándo ocurre:** Usuario dice "OK" a la propuesta de Claude  
**Status actual en Notion:** `To Do`  
**Nuevo Status en Notion:** `In Progress`  
**Qué hace Claude:**
```
📌 **Notion Update:** Status → 'In Progress'

Mensaje de Claude:
"Propuesta aprobada. Moviendo tarea a 'In Progress' en Notion.
Actualiza manualmente en Notion si no se sincroniza automáticamente."
```

---

### PASO 2: IMPLEMENTACIÓN COMPLETADA
**Cuándo ocurre:** Claude reporta "✅ IMPLEMENTADO"  
**Status actual en Notion:** `In Progress`  
**Nuevo Status en Notion:** `Review`  
**Qué hace Claude:**
```
📌 **Notion Update:** Status → 'Review'

Mensaje de Claude:
"Código implementado. Moviendo tarea a 'Review' en Notion.
Puedes revisar el código y decir 'OK' o 'Cambio: X'."
```

---

### PASO 3: CAMBIOS O APROBACIÓN
**Cuándo ocurre:** Usuario pide cambios O aprueba el código  

#### Opción A: CAMBIOS REALIZADOS
**Si usuario dice:** "Cambio: X"  
**Status actual en Notion:** `Review`  
**Nuevo Status en Notion:** `Review` (sin cambios)  
**Qué hace Claude:**
```
📌 **Notion Update:** Status → 'Review' (sin cambios)

Mensaje de Claude:
"Cambios realizados en propuesta. Status permanece en 'Review'.
Cuando apruebes los cambios, dime 'OK' para proceder."
```

#### Opción B: APROBADO PARA PR
**Si usuario dice:** "OK"  
**Status actual en Notion:** `Review`  
**Nuevo Status en Notion:** `Review` (sigue igual)  
**Qué hace Claude:**
```
📌 **Notion Update:** Status → 'Review' (PR en progreso)

Mensaje de Claude:
"Código aprobado. Creando PR en GitHub.
Actualiza 'Related PR' en Notion cuando la PR esté lista."
```

---

### PASO 4: PR CREADA EN GITHUB
**Cuándo ocurre:** Claude crea la Pull Request  
**Status actual en Notion:** `Review`  
**Nuevo Status en Notion:** `Review` (sin cambios)  
**Campos adicionales:**
- `Related PR`: [URL de la PR]
- `Status`: `Review`

**Qué hace Claude:**
```
📌 **Notion Update:**
- Status → 'Review' (sin cambios)
- Related PR → [URL de GitHub]

Mensaje de Claude:
"PR creada en GitHub: [URL]
Actualiza 'Related PR' en Notion si no está ya sincronizado.
Revisa la PR y dime 'pushea a main' cuando esté OK."
```

---

### PASO 5: MERGEADO A MAIN
**Cuándo ocurre:** Usuario dice "pushea a main" y Claude mergea  
**Status actual en Notion:** `Review`  
**Nuevo Status en Notion:** `Done`  
**Qué hace Claude:**
```
📌 **Notion Update:** Status → 'Done'

Mensaje de Claude:
"✅ MERGEADO A MAIN. PR cerrada.
Moviendo tarea a 'Done' en Notion.
Tarea completada exitosamente."
```

---

## 📝 Cómo Entiendo Notion (Para Claude)

### Lectura automática de campos

Cuando Usuario dice: "Lee la tarea FIX-001 de Notion"

Claude AUTOMÁTICAMENTE:
1. Abre el link de Notion vía MCP
2. Lee estos campos OBLIGATORIOS:
   - `Title` - Nombre de la tarea
   - `Status` - Estado actual (To Do, In Progress, Review, Done)
   - `Type` - Tipo (Feature, Fix, Refactor, Docs, Chore)
   - `Stack` - Frontend, Backend, Full Stack, DevOps
   - `Priority` - Critical, High, Medium, Low
   - `Description` - Descripción completa
   - `Acceptance Criteria` - Checklist de AC
   - `Implementation Details` - Detalles técnicos

3. Lee estos campos OPCIONALES:
   - `Effort` - Estimación
   - `Labels` - Etiquetas
   - `Due Date` - Fecha de vencimiento
   - `Assigned To` - Asignado a

---

## 🎯 Indicadores de Update en Respuestas de Claude

### Formato estándar de Update

Después de cada acción, Claude incluirá:

```
📌 **Notion Update requerido:**
- Field: Status
- Current: [Status actual]
- New: [Status nuevo]
- Action: [Qué hace el usuario]
```

### Ejemplos reales

#### Después de PROPUESTA OK:
```
📌 **Notion Update requerido:**
- Field: Status
- Current: To Do
- New: In Progress
- Action: Actualiza Status a 'In Progress' en Notion
```

#### Después de IMPLEMENTADO:
```
📌 **Notion Update requerido:**
- Field: Status
- Current: In Progress
- New: Review
- Action: Actualiza Status a 'Review' en Notion
```

#### Después de PR CREADA:
```
📌 **Notion Update requerido:**
- Field: Related PR
- Value: [GitHub PR URL]
- Field: Status
- Current: Review
- New: Review (sin cambios)
- Action: Copia URL de PR a 'Related PR' en Notion
```

#### Después de MERGEADO:
```
📌 **Notion Update requerido:**
- Field: Status
- Current: Review
- New: Done
- Action: Actualiza Status a 'Done' en Notion
- Note: Tarea completada exitosamente
```

---

## ⚙️ Campos Sincronizables

### Claude PUEDE actualizar automáticamente:
- ✅ `Status` - Estado del flujo (To Do → In Progress → Review → Done)
- ✅ `Related PR` - URL del Pull Request
- ✅ `Related Docs` - Links a documentación

### Usuario DEBE actualizar manualmente:
- ✅ `Priority` - Si la prioridad cambia
- ✅ `Effort` - Si se reestima el esfuerzo
- ✅ `Due Date` - Si hay cambios de fecha
- ✅ `Labels` - Si necesita nuevas etiquetas
- ✅ `Assigned To` - Si se reasigna

### NO se deben actualizar:
- ❌ `Type` - Tipo de tarea (inmutable)
- ❌ `Stack` - Stack tecnológico (inmutable)
- ❌ `Description` - Descripción original
- ❌ `Acceptance Criteria` - AC originales
- ❌ `Implementation Details` - Detalles técnicos originales

---

## 🔐 Reglas de Sincronización

### REGLA 1: SIEMPRE informar al usuario
```
Después de CADA cambio, Claude dice:
"📌 **Notion Update:** Status → '[Nuevo Status]'"
```

### REGLA 2: NO actualizar sin indicar
```
❌ NUNCA hagas cambios en Notion silenciosamente
✅ SIEMPRE avisa al usuario qué se actualiza
```

### REGLA 3: Confirmar con el usuario
```
Después de indicar el update:
- El usuario verifica que se actualizó en Notion
- Si no se actualizó automáticamente, lo hace manualmente
- Usuario confirma: "Notion actualizado" o "OK"
```

### REGLA 4: Mantener contexto
```
Cada vez que leas una tarea:
- Nota el Status ACTUAL
- Sé consciente de dónde estás en el flujo
- Propón el SIGUIENTE Status correctamente
```

---

## 🚀 Ejemplo Completo de Sync

### Escenario: Implementar FIX-001

```
1️⃣ USUARIO: "Lee la tarea FIX-001 de Notion"

CLAUDE:
- Lee Notion
- Ve Status = "To Do"
- Ve descripción y AC
- Entiende la tarea

2️⃣ CLAUDE PROPONE:
## 📋 PROPUESTA: Responsive button layout...
[propuesta de 10 líneas]

¿OK?

3️⃣ USUARIO: "OK"

CLAUDE:
## ✅ LISTO PARA IMPLEMENTAR

📌 **Notion Update:** Status → 'In Progress'

[Implementa el código]

4️⃣ CLAUDE IMPLEMENTA:
## ✅ IMPLEMENTADO
- Archivos creados...

📌 **Notion Update:** Status → 'Review'

¿OK o cambios?

5️⃣ USUARIO ACTUALIZA EN NOTION:
- Cambia Status a "In Progress" (paso 3)
- Luego actualiza Status a "Review" (paso 4)

6️⃣ USUARIO: "OK"

CLAUDE:
## 📋 PR CREADA
URL: https://github.com/...

📌 **Notion Update:**
- Related PR → [URL]
- Status → Review (sin cambios)

7️⃣ USUARIO ACTUALIZA EN NOTION:
- Agrega URL en "Related PR"

8️⃣ USUARIO: "pushea a main"

CLAUDE:
## ✅ MERGEADO A MAIN

📌 **Notion Update:** Status → 'Done'

9️⃣ USUARIO ACTUALIZA EN NOTION:
- Cambia Status a "Done"

✅ TAREA COMPLETADA EN NOTION
```

---

## 💡 Tips para Claude

### Cuando lees una tarea:
1. Obtén el ID (de la URL)
2. Lee el Status actual
3. Lee Description y AC
4. Prepárate para el siguiente Status

### Cuando propones:
1. Di claramente qué Status será siguiente
2. Espera confirmación del usuario
3. Avisa del update necesario en Notion

### Cuando implementas:
1. Reporta qué archivos se crearon
2. Indica el próximo Status
3. Pide revisión del usuario

### Cuando cambias Status:
1. SIEMPRE avisa con: "📌 **Notion Update:** Status → '[Nuevo]'"
2. Sé explícito sobre QUÉ cambió
3. Dale contexto al usuario

---

## ⚠️ Problemas Comunes

### Problema: "Notion no se actualizó automáticamente"
**Solución:**
- Claude avisa: "Actualiza manualmente en Notion si no se sincroniza"
- Usuario va a Notion y cambia el Status
- Usuario confirma cuando esté actualizado

### Problema: "¿Cuál es el siguiente Status?"
**Solución:**
- Consulta la tabla de flujo en este documento
- Follow the natural progression: To Do → In Progress → Review → Done
- Siempre avisa antes de cambiar

### Problema: "Olvidé actualizar Notion"
**Solución:**
- Claude dirá: "Actualiza Status en Notion antes de continuar"
- Usuario actualiza y confirma
- Claude continúa con el flujo

---

## 📚 Referencias Rápidas

**Base de datos Notion:** Development Tasks  
**URL:** https://www.notion.so/10127793b8f74fc8acbc0ae5f534714a

**Reglas de automatización:** Workflow Automation Rules  
**URL:** https://www.notion.so/679f4881b7c34abe8a63b05314d59d57

**Guía completa de flujo:** 📖 Guía de Automatización del Flujo  
**URL:** https://www.notion.so/34014748013a81eaa5eff8e230a9bd97

---

**Versión:** 1.0  
**Última actualización:** 2026-04-12  
**Estado:** Listo para producción  

¡Sistema de automatización Notion listo! 🚀
