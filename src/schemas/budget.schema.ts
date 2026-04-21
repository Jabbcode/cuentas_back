import { z } from 'zod';

export const createBudgetSchema = z.object({
  categoryId: z.string().uuid('ID de categoría inválido'),
  amount: z.number().positive('El monto debe ser positivo'),
  month: z.number().int().min(1).max(12),
  year: z.number().int().min(2020).max(2100),
  alertAt: z.number().min(0).max(100).optional(),
});

export const updateBudgetSchema = createBudgetSchema.partial();

export type CreateBudgetInput = z.infer<typeof createBudgetSchema>;
export type UpdateBudgetInput = z.infer<typeof updateBudgetSchema>;
