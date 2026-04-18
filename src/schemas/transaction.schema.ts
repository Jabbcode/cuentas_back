import { z } from 'zod';

const receiptItemInputSchema = z.object({
  name: z.string().min(1),
  quantity: z.number().positive(),
  unitPrice: z.number().nonnegative(),
  totalPrice: z.number().nonnegative(),
});

export const createTransactionSchema = z.object({
  amount: z.number().positive('El monto debe ser positivo'),
  type: z.enum(['expense', 'income']),
  description: z.string().optional(),
  date: z.string().datetime().optional(),
  accountId: z.string().uuid('ID de cuenta inválido'),
  categoryId: z.string().uuid('ID de categoría inválido'),
  fixedExpenseId: z.string().uuid().optional(),
  imageHash: z.string().optional(), // For receipt scanning
  receiptItems: z.array(receiptItemInputSchema).optional(), // Receipt items
});

export const updateTransactionSchema = createTransactionSchema.partial();

export const transactionQuerySchema = z.object({
  startDate: z.string().optional(),
  endDate: z.string().optional(),
  accountId: z.string().uuid().optional(),
  categoryId: z.string().uuid().optional(),
  type: z.enum(['expense', 'income']).optional(),
  limit: z.string().transform(Number).optional(),
  offset: z.string().transform(Number).optional(),
});

export type CreateTransactionInput = z.infer<typeof createTransactionSchema>;
export type UpdateTransactionInput = z.infer<typeof updateTransactionSchema>;
export type TransactionQuery = z.infer<typeof transactionQuerySchema>;
