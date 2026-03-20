import { z } from 'zod';

export const createAccountSchema = z.object({
  name: z.string().min(1, 'El nombre es requerido'),
  type: z.enum(['cash', 'bank', 'credit_card']),
  balance: z.number().default(0),
  currency: z.string().default('EUR'),
  color: z.string().optional(),
});

export const updateAccountSchema = createAccountSchema.partial();

export type CreateAccountInput = z.infer<typeof createAccountSchema>;
export type UpdateAccountInput = z.infer<typeof updateAccountSchema>;
