# Backend Agents

Agentes especializados para trabajar en el backend de Cuentas.

## 🤖 Agents Documentados

### 1. Controller Generator Agent
- **Descripción:** Generar controladores Express completos y seguros
- **Cuándo invocar:** Para crear nuevos controladores
- **Documentación:** [`controller-generator-agent/AGENT.md`](./controller-generator-agent/AGENT.md)
- **Ejemplos:** [`controller-generator-agent/examples.md`](./controller-generator-agent/examples.md)
- **Workflow:** [`controller-generator-agent/workflow.md`](./controller-generator-agent/workflow.md)

### 2. Service Creator Agent
- **Descripción:** Crear servicios con lógica de negocio
- **Cuándo invocar:** Para crear servicios
- **Documentación:** [`service-creator-agent/AGENT.md`](./service-creator-agent/AGENT.md)
- **Ejemplos:** [`service-creator-agent/examples.md`](./service-creator-agent/examples.md)
- **Workflow:** [`service-creator-agent/workflow.md`](./service-creator-agent/workflow.md)

### 3. Database Migration Agent
- **Descripción:** Crear migraciones Prisma seguras
- **Cuándo invocar:** Para cambios en el schema
- **Documentación:** [`database-migration-agent/AGENT.md`](./database-migration-agent/AGENT.md)
- **Ejemplos:** [`database-migration-agent/examples.md`](./database-migration-agent/examples.md)
- **Workflow:** [`database-migration-agent/workflow.md`](./database-migration-agent/workflow.md)

### 4. API Endpoint Agent
- **Descripción:** Crear nuevos endpoints REST completos
- **Cuándo invocar:** Para implementar nuevas funcionalidades
- **Documentación:** [`api-endpoint-agent/AGENT.md`](./api-endpoint-agent/AGENT.md)
- **Ejemplos:** [`api-endpoint-agent/examples.md`](./api-endpoint-agent/examples.md)
- **Workflow:** [`api-endpoint-agent/workflow.md`](./api-endpoint-agent/workflow.md)

### 5. Data Processing Agent
- **Descripción:** Procesar datos complejos con múltiples relaciones
- **Cuándo invocar:** Para lógica de datos complicada
- **Documentación:** [`data-processing-agent/AGENT.md`](./data-processing-agent/AGENT.md)
- **Ejemplos:** [`data-processing-agent/examples.md`](./data-processing-agent/examples.md)
- **Workflow:** [`data-processing-agent/workflow.md`](./data-processing-agent/workflow.md)

---

## 🎯 Cómo Usar

1. Encuentra el agent que necesitas
2. Lee el `AGENT.md` principal
3. Consulta `examples.md` para ver cómo invocarlo
4. Consulta `workflow.md` para entender los pasos

## ⚠️ CRÍTICO

**SIEMPRE validar userId filtering** - Todos los agents verifican esto.
