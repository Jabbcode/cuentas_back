import { z } from 'zod';

export const receiptItemSchema = z.object({
  name: z.string().min(1, 'El nombre es requerido'),
  quantity: z.number().positive('La cantidad debe ser positiva'),
  unitPrice: z.number().nonnegative('El precio unitario debe ser no negativo'),
  totalPrice: z.number().nonnegative('El precio total debe ser no negativo'),
});

export type ReceiptItemInput = z.infer<typeof receiptItemSchema>;
