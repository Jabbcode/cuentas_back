import { z } from 'zod';

export const createAccountSchema = z.object({
  name: z.string().min(1, 'El nombre es requerido'),
  type: z.enum(['cash', 'bank', 'credit_card']),
  balance: z.number().default(0),
  currency: z.string().default('EUR'),
  color: z.string().optional(),
  // Credit card specific fields
  creditLimit: z.number().positive().optional(),
  cutoffDay: z.number().int().min(1).max(31).optional(),
  paymentDueDay: z.number().int().min(1).max(31).optional(),
  paymentAccountId: z.string().uuid().optional().nullable(),
});

export const updateAccountSchema = createAccountSchema.partial();

export const transferSchema = z.object({
  fromAccountId: z.string().uuid('ID de cuenta origen inválido'),
  toAccountId: z.string().uuid('ID de cuenta destino inválido'),
  amount: z.number().positive('El monto debe ser mayor a 0'),
  note: z.string().optional(),
});

export type CreateAccountInput = z.infer<typeof createAccountSchema>;
export type UpdateAccountInput = z.infer<typeof updateAccountSchema>;
export type TransferInput = z.infer<typeof transferSchema>;
