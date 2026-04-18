/**
 * Claude AI Prompt for Receipt/Invoice Analysis
 *
 * This prompt instructs Claude to extract structured data from OCR text
 * of receipts and invoices, including:
 * - Amount (total)
 * - Description (establishment name)
 * - Date
 * - Suggested category
 * - Confidence level
 * - Individual items (products/services)
 *
 * @param ocrText - Raw text extracted from image via OCR
 * @returns Formatted prompt string ready for Claude API
 */
export function buildReceiptAnalysisPrompt(ocrText: string): string {
  return `Eres un experto en análisis de facturas y recibos. Tu tarea es extraer información estructurada de forma precisa.

IMPORTANTE: Analiza cuidadosamente el texto completo antes de responder.

TEXTO DE LA FACTURA:
${ocrText}

Extrae la siguiente información:

1. **amount** (TOTAL de la factura):
   - Busca palabras clave: "TOTAL", "Total", "TOTAL A PAGAR", "Importe Total"
   - Es el monto final que se pagó
   - Solo el número, sin símbolos de moneda

2. **description**:
   - Nombre del establecimiento/comercio (si aparece al inicio)
   - O tipo de compra general (ej: "Compra en Supermercado", "Gasolinera Shell")
   - Máximo 100 caracteres

3. **date**:
   - Busca: "Fecha:", "Date:", números con formato DD/MM/YYYY o DD-MM-YYYY
   - Convierte a formato ISO: YYYY-MM-DD
   - Si no encuentras fecha, usa la fecha actual

4. **suggestedCategory** (solo UNA de estas opciones):
   - Alimentación (supermercados, restaurantes, comida)
   - Transporte (gasolina, taxis, transporte público)
   - Vivienda (alquiler, servicios del hogar)
   - Servicios (telecomunicaciones, suscripciones)
   - Entretenimiento (cine, streaming, ocio)
   - Ropa (tiendas de ropa, calzado)
   - Salud (farmacias, médicos)
   - Educación (libros, cursos)
   - Compras (tiendas generales, online)
   - Tecnología (electrónica, gadgets)

5. **confidence**:
   - "high": Texto muy claro, todos los campos identificados
   - "medium": Algunos campos poco claros
   - "low": Texto difícil de leer, varios campos inciertos

6. **items** (productos individuales):
   - Busca líneas con: CANTIDAD + NOMBRE_PRODUCTO + PRECIO
   - Cada item debe tener:
     * **name**: Nombre del producto/servicio
     * **quantity**: Cantidad (número, default 1 si no está claro)
     * **unitPrice**: Precio por unidad
     * **totalPrice**: Precio total de ese item (quantity × unitPrice)
   - Si no puedes identificar items claramente, deja el array vacío []

REGLAS IMPORTANTES:
- Lee TODO el texto antes de extraer información
- TRADUCELO al español para tener los items en español
- El TOTAL siempre es la cantidad más grande o la que dice "TOTAL"
- Si hay subtotales, impuestos, etc., asegúrate de tomar el TOTAL FINAL
- Para items: solo incluye productos claramente identificables
- Si un item no tiene cantidad explícita, usa 1
- Suma de items NO necesariamente = total (puede haber impuestos, descuentos)

Responde ÚNICAMENTE con un objeto JSON válido (sin markdown, sin explicaciones):
{
  "amount": 0,
  "description": "",
  "date": "YYYY-MM-DD",
  "suggestedCategory": "",
  "confidence": "medium",
  "items": []
}

EJEMPLOS:

Ejemplo 1 - Supermercado:
{
  "amount": 25.50,
  "description": "Supermercado Día",
  "date": "2024-03-15",
  "suggestedCategory": "Alimentación",
  "confidence": "high",
  "items": [
    {"name": "Pan integral", "quantity": 2, "unitPrice": 1.50, "totalPrice": 3.00},
    {"name": "Leche entera 1L", "quantity": 3, "unitPrice": 1.20, "totalPrice": 3.60},
    {"name": "Manzanas kg", "quantity": 1.5, "unitPrice": 2.50, "totalPrice": 3.75}
  ]
}

Ejemplo 2 - Gasolinera (sin items claros):
{
  "amount": 45.00,
  "description": "Gasolinera Shell",
  "date": "2024-03-16",
  "suggestedCategory": "Transporte",
  "confidence": "medium",
  "items": []
}`;
}

/**
 * Available categories for receipt classification
 */
export const RECEIPT_CATEGORIES = [
  'Alimentación',
  'Transporte',
  'Vivienda',
  'Servicios',
  'Entretenimiento',
  'Ropa',
  'Salud',
  'Educación',
  'Compras',
  'Tecnología',
] as const;

export type ReceiptCategory = typeof RECEIPT_CATEGORIES[number];

/**
 * Confidence levels for receipt analysis
 */
export const CONFIDENCE_LEVELS = ['high', 'medium', 'low'] as const;

export type ConfidenceLevel = typeof CONFIDENCE_LEVELS[number];
