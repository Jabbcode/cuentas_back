export const RECEIPT_MESSAGES = {
  UNREADABLE_TEXT: 'No se pudo extraer texto legible de la imagen',
  OCR_ERROR: 'Error al extraer texto de la imagen',
  AI_PROCESSING_ERROR: 'Error al procesar la factura con IA',
  AI_NO_JSON: 'No se pudo extraer JSON de la respuesta de Claude',
  AI_MALFORMED_JSON: 'La respuesta de IA contiene JSON malformado',
} as const;
