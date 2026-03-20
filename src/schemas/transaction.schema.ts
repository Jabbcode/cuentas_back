import { z } from 'zod';

export const createTransactionSchema = z.object({
  amount: z.number().positive('El monto debe ser positivo'),
  type: z.enum(['expense', 'income']),
  description: z.string().optional(),
  date: z.string().datetime().optional(),
  accountId: z.string().uuid('ID de cuenta inválido'),
  categoryId: z.string().uuid('ID de categoría inválido'),
  fixedExpenseId: z.string().uuid().optional(),
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
