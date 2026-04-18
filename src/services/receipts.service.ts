import Anthropic from '@anthropic-ai/sdk';
import Tesseract from 'tesseract.js';
import crypto from 'crypto';
import { prisma } from '../lib/prisma.js';
import type { ScanReceiptResponse, DuplicateCheckResponse } from '../schemas/receipt.schema.js';

// Initialize Claude API client
const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
});

/**
 * Calculate SHA256 hash of image buffer
 */
function calculateImageHash(imageBuffer: Buffer): string {
  return crypto.createHash('sha256').update(imageBuffer).digest('hex');
}

/**
 * Check for exact duplicate by image hash
 */
async function checkExactDuplicate(imageHash: string, userId: string) {
  return await prisma.transaction.findFirst({
    where: {
      userId,
      imageHash,
    },
    include: {
      account: { select: { id: true, name: true } },
      category: { select: { id: true, name: true } },
    },
  });
}

/**
 * Check for similar transactions by amount, date, and description
 */
async function checkSimilarTransactions(
  amount: number,
  date: string,
  description: string,
  userId: string
) {
  const targetDate = new Date(date);
  const twoDaysBefore = new Date(targetDate);
  twoDaysBefore.setDate(twoDaysBefore.getDate() - 2);
  const twoDaysAfter = new Date(targetDate);
  twoDaysAfter.setDate(twoDaysAfter.getDate() + 2);

  // Find transactions with similar amount (±0.50€) and date (±2 days)
  const similarTransactions = await prisma.transaction.findMany({
    where: {
      userId,
      amount: {
        gte: amount - 0.5,
        lte: amount + 0.5,
      },
      date: {
        gte: twoDaysBefore,
        lte: twoDaysAfter,
      },
    },
    include: {
      account: { select: { id: true, name: true } },
      category: { select: { id: true, name: true } },
    },
    orderBy: {
      date: 'desc',
    },
  });

  // Filter by description similarity (if description exists)
  if (description && similarTransactions.length > 0) {
    const descLower = description.toLowerCase();
    const matches = similarTransactions.filter((tx) => {
      if (!tx.description) return false;
      const txDescLower = tx.description.toLowerCase();

      // Simple similarity: check if one contains key words from the other
      const words = descLower.split(/\s+/).filter(w => w.length > 3);
      const matchedWords = words.filter(word => txDescLower.includes(word));

      return matchedWords.length >= Math.min(2, words.length * 0.5);
    });

    return matches[0]; // Return first match
  }

  return similarTransactions[0]; // Return first similar transaction
}

/**
 * Extract text from image using Tesseract OCR
 */
async function extractTextFromImage(imageBuffer: Buffer): Promise<string> {
  try {
    const result = await Tesseract.recognize(imageBuffer, 'spa', {
    // Removed console.log
    });

    return result.data.text;
  } catch (error) {
    // Removed console.error
    throw new Error('Error al extraer texto de la imagen');
  }
}

/**
 * Process extracted text with Claude to structure receipt data
 */
async function processReceiptWithClaude(ocrText: string): Promise<ScanReceiptResponse> {
  const prompt = `Eres un experto en análisis de facturas y recibos. Tu tarea es extraer información estructurada de forma precisa.

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

  try {
    const message = await anthropic.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 1024,
      messages: [
        {
          role: 'user',
          content: prompt,
        },
      ],
    });

    // Extract JSON from Claude's response
    const responseText = message.content[0].type === 'text' ? message.content[0].text : '';

    // Try to parse JSON from the response
    const jsonMatch = responseText.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      throw new Error('No se pudo extraer JSON de la respuesta de Claude');
    }

    const data = JSON.parse(jsonMatch[0]);

    return {
      amount: parseFloat(data.amount) || 0,
      description: data.description || 'Gasto sin descripción',
      date: data.date || new Date().toISOString().split('T')[0],
      suggestedCategory: data.suggestedCategory,
      confidence: data.confidence || 'low',
      rawText: ocrText,
      imageHash: '', // Will be set by caller
      items: Array.isArray(data.items) ? data.items.map((item: any) => ({
        name: item.name || 'Producto sin nombre',
        quantity: parseFloat(item.quantity) || 1,
        unitPrice: parseFloat(item.unitPrice) || 0,
        totalPrice: parseFloat(item.totalPrice) || 0,
      })) : [],
    };
  } catch (error) {
    // Removed console.error
    throw new Error('Error al procesar la factura con IA');
  }
}

/**
 * Main function: Scan receipt and extract structured data with duplicate detection
 */
export async function scanReceipt(
  imageBuffer: Buffer,
  userId: string
): Promise<DuplicateCheckResponse> {
  // Step 1: Calculate image hash
  const imageHash = calculateImageHash(imageBuffer);
    // Removed console.log

  // Step 2: Check for exact duplicate (same image)
    // Removed console.log
  const exactDuplicate = await checkExactDuplicate(imageHash, userId);

  if (exactDuplicate) {
    // Removed console.log
    return {
      duplicate: true,
      matchType: 'exact',
      existingTransaction: {
        id: exactDuplicate.id,
        amount: Number(exactDuplicate.amount),
        description: exactDuplicate.description,
        date: exactDuplicate.date.toISOString(),
        createdAt: exactDuplicate.createdAt.toISOString(),
        account: exactDuplicate.account,
        category: exactDuplicate.category,
      },
    };
  }

  // Step 3: Extract text with OCR
    // Removed console.log
  const ocrText = await extractTextFromImage(imageBuffer);

  if (!ocrText || ocrText.trim().length < 10) {
    throw new Error('No se pudo extraer texto legible de la imagen');
  }

    // Removed console.log

  // Step 4: Process with Claude
    // Removed console.log
  const structuredData = await processReceiptWithClaude(ocrText);
  structuredData.imageHash = imageHash; // Add hash to structured data

    // Removed console.log

  // Step 5: Check for similar transactions
    // Removed console.log
  const similarTransaction = await checkSimilarTransactions(
    structuredData.amount,
    structuredData.date,
    structuredData.description,
    userId
  );

  if (similarTransaction) {
    // Removed console.log
    return {
      duplicate: true,
      matchType: 'similar',
      existingTransaction: {
        id: similarTransaction.id,
        amount: Number(similarTransaction.amount),
        description: similarTransaction.description,
        date: similarTransaction.date.toISOString(),
        createdAt: similarTransaction.createdAt.toISOString(),
        account: similarTransaction.account,
        category: similarTransaction.category,
      },
      scannedData: structuredData,
    };
  }

  // Step 6: No duplicates found
    // Removed console.log
  return {
    duplicate: false,
    matchType: 'none',
    scannedData: structuredData,
  };
}

/**
 * OCR-only function: Extract text without AI processing (FREE)
 */
export async function ocrOnly(imageBuffer: Buffer): Promise<{ rawText: string }> {
    // Removed console.log
  const rawText = await extractTextFromImage(imageBuffer);

  if (!rawText || rawText.trim().length < 10) {
    throw new Error('No se pudo extraer texto legible de la imagen');
  }

    // Removed console.log

  return { rawText };
}
