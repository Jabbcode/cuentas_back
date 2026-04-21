# 🔍 TypeScript Verification Guide

**Archivo:** `/claude/typescript-verification.md`  
**Versión:** 1.0  
**Última actualización:** 2026-04-12  

---

## 🎯 Propósito

Este documento explica cómo Claude **SIEMPRE verifica que no hay errores de TypeScript** antes de reportar implementación lista y especialmente antes de crear cualquier PR.

**Objetivo:** Prevenir que código con errores de tipo llegue a producción durante deploy.

---

## ⚠️ El Problema Original

El backend fallaba en deploy con:

```
error TS2367: This comparison appears to be unintentional because 
the types 'number' and 'Decimal' have no overlap.

src/services/fixed-expenses.service.ts(92,40)
```

**Causa:** Claude implementaba código sin verificar que compilara correctamente.

**Solución:** Verificación obligatoria ANTES de reportar implementación como lista.

---

## 🔄 Flujo Correcto

### ANTES (❌ Incorrecto)
```
Claude implementa → Reporta "✅ IMPLEMENTADO" → Usuario approva → 
Create PR → Deploy → ❌ BUILD FAILED: TS errors
```

### DESPUÉS (✅ Correcto)
```
Claude implementa → 
VERIFICA: npm run build → 
VERIFICA: npx tsc --noEmit → 
0 errors? → Reporta "✅ IMPLEMENTADO" → 
VERIFICA NUEVAMENTE ANTES PR →
Reporta "✅ BUILD SUCCESSFUL" → 
Create PR → Deploy → ✅ SUCCESS
```

---

## 🛠️ Verificación Paso a Paso

### PASO 1: Ejecutar TypeScript Checker

```bash
npx tsc --noEmit
```

**Qué hace:**
- Compila todo el código TypeScript
- NO genera archivos (.js)
- Solo muestra errores de tipo
- Retorna código 0 si OK, error code si hay problemas

**Posibles outputs:**

**OK:**
```
[Sin output = Compiló bien]
```

**ERROR:**
```
src/services/fixed-expenses.service.ts(92,40): error TS2367: 
This comparison appears to be unintentional because the types 
'number' and 'Decimal' have no overlap.

src/hooks/useDebtPanel.ts(15,20): error TS2322: 
Type 'string' is not assignable to type 'number'.
```

---

### PASO 2: Ejecutar Build

```bash
npm run build
```

**Qué hace:**
- Ejecuta `tsc` (TypeScript compiler)
- Genera archivos JavaScript en `dist/` o similar
- Ejecuta minificación/bundling
- Retorna 0 si OK

**Posibles outputs:**

**OK:**
```
> tsc
[Sin errores = Done]
```

**ERROR:**
```
> tsc
src/services/fixed-expenses.service.ts(92,40): error TS2367: ...
npm error! code ELIFECYCLE
```

---

### PASO 3: Identificar el Error

**Tipos comunes de errores:**

#### 1. Type Mismatch (TS2367, TS2322)
```
error TS2367: This comparison appears to be unintentional because 
the types 'number' and 'Decimal' have no overlap.
```

**Causa:** Comparando tipos incompatibles
- `number` vs `Decimal` (Prisma)
- `string` vs `number`
- `null` vs `string`

**Fix:**
```typescript
// ❌ INCORRECTO
if (amount > 100) { }  // Decimal > number

// ✅ CORRECTO
if (amount.toNumber() > 100) { }
if (new Decimal(amount).greaterThan(100)) { }
```

#### 2. Missing Property (TS2339)
```
error TS2339: Property 'name' does not exist on type 'User'.
```

**Causa:** Accediendo a propiedad que no existe
- Typo en nombre de propiedad
- Tipo incompleto

**Fix:**
```typescript
// ❌ INCORRECTO
const name = user.fullName;  // TS Error

// ✅ CORRECTO
const name = user.name;  // Property exists
```

#### 3. Wrong Function Signature (TS2345)
```
error TS2345: Argument of type 'string' is not assignable 
to parameter of type 'number'.
```

**Causa:** Pasando tipo incorrecto a función
- Función espera `number`, pasamos `string`
- Array espera `string`, pasamos `number`

**Fix:**
```typescript
// ❌ INCORRECTO
calculateTotal("100");  // Function expects number

// ✅ CORRECTO
calculateTotal(100);
calculateTotal(parseInt("100"));
```

#### 4. Null/Undefined Issues (TS2322, TS2531)
```
error TS2531: Object is possibly 'null' or 'undefined'.
```

**Causa:** No checking si valor es null/undefined

**Fix:**
```typescript
// ❌ INCORRECTO
const length = data.items.length;

// ✅ CORRECTO
const length = data?.items?.length ?? 0;
if (data && data.items) {
  const length = data.items.length;
}
```

#### 5. Import/Export Errors (TS2307)
```
error TS2307: Cannot find module './types'.
```

**Causa:** Import incorrecto o archivo no existe

**Fix:**
```typescript
// ✅ Verificar que archivo existe
// ✅ Verificar que export existe en archivo
// ✅ Verificar path es correcto
import { User } from './types/user.ts';
```

---

## 🔐 Reglas de Verificación

### REGLA 1: Verificar SIEMPRE ANTES de reportar

```
Después de implementar:
1. Ejecuta: npx tsc --noEmit
2. Ejecuta: npm run build
3. ¿0 errors? → Reporta "✅ IMPLEMENTADO"
4. ❌ errors? → FIXEA y repite paso 1
```

### REGLA 2: Ser específico en errores

```
❌ "Hay error de tipo"
✅ "TS2367: 'number' y 'Decimal' incompatibles. 
   Línea 92. Solución: usar .toNumber()"
```

### REGLA 3: Proponer siempre el fix

```
Cuando encuentres error:
1. Identifica el tipo de error (TS2367, TS2322, etc)
2. Identifica la causa específica
3. Propone solución exacta
4. Aplica el fix
5. Repite verificación
```

### REGLA 4: NO avanzar sin compilar

```
❌ NO crear PR si tsc tiene errores
❌ NO mergear si build falla
✅ SOLO si npm run build SUCCESS
```

---

## 📝 Casos Específicos del Proyecto

### Cuentas - Decimal vs Number

**Problema común:**
```typescript
// Prisma devuelve Decimal para números monetarios
const expense = await prisma.expense.findUnique({
  where: { id }
});

// ❌ ERROR: Comparing Decimal with number
if (expense.amount > 100) { }
```

**Solución:**
```typescript
// ✅ Convertir a number
if (expense.amount.toNumber() > 100) { }

// ✅ O usar Decimal methods
if (new Decimal(expense.amount).greaterThan(100)) { }

// ✅ O en tipo
type Expense = {
  amount: Decimal;
  // ...
};
```

### userId Filtering (Backend)

**Problema común:**
```typescript
// ❌ ERROR: userId no asegurado
const expenses = await prisma.expense.findMany({
  where: {
    // userId debe venir de token, no del cliente
  }
});
```

**Solución:**
```typescript
// ✅ CORRECTO
const userId = req.user!.userId;  // From JWT
const expenses = await prisma.expense.findMany({
  where: {
    userId: userId  // Filtrado obligatorio
  }
});
```

---

## 🚀 Pre-PR Checklist Completo

### Frontend Checklist
```
☐ npx tsc --noEmit → 0 errors
☐ npm run build → SUCCESS
☐ No @ts-ignore en código
☐ No any types
☐ Props interfaces completas
☐ Manejo de errores presente
☐ Acceptance criteria cubiertos
☐ Mensaje: "✅ BUILD SUCCESSFUL"
```

### Backend Checklist
```
☐ npx tsc --noEmit → 0 errors
☐ npm run build → SUCCESS
☐ No @ts-ignore en código
☐ No any types
☐ userId filtering en ALL queries
☐ Validación con Zod presente
☐ Manejo de errores presente
☐ Acceptance criteria cubiertos
☐ Mensaje: "✅ BUILD SUCCESSFUL"
```

---

## ⚡ Resumen Rápido

| Acción | Comando | Esperado |
|--------|---------|----------|
| Verificar tipos | `npx tsc --noEmit` | 0 errors |
| Build completo | `npm run build` | SUCCESS |
| Pre PR | Verificar ambos ↑ | Ambos OK |
| Crear PR | Solo si los dos OK | Siempre |
| Mergear | Solo si pre-PR OK | Siempre |

---

## 🎯 Impacto

**Antes de esta guía:**
- ❌ Deploy failures por TS errors
- ❌ Build time wasted en fixes
- ❌ Código incompleto en main

**Después de esta guía:**
- ✅ Cero TS errors en deploy
- ✅ Build siempre successful
- ✅ Código listo para producción

---

**Versión:** 1.0  
**Última actualización:** 2026-04-12  
**Estado:** Crítico para estabilidad de producción  

¡Verificación de TypeScript implementada! 🚀
