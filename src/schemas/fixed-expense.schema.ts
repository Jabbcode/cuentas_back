import { z } from 'zod';

export const createFixedExpenseSchema = z.object({
  name: z.string().min(1, 'El nombre es requerido'),
  amount: z.number().positive('El monto debe ser positivo'),
  type: z.enum(['expense', 'income']),
  dueDay: z.number().int().min(1).max(31, 'El día debe estar entre 1 y 31'),
  description: z.string().optional(),
  accountId: z.string().uuid('ID de cuenta inválido'),
  categoryId: z.string().uuid('ID de categoría inválido'),
  isActive: z.boolean().default(true),
});

export const updateFixedExpenseSchema = createFixedExpenseSchema.partial();

export const payFixedExpenseSchema = z.object({
  date: z.string().datetime().optional(),
  amount: z.number().positive().optional(), // Allow override for variable bills
});

export type CreateFixedExpenseInput = z.infer<typeof createFixedExpenseSchema>;
export type UpdateFixedExpenseInput = z.infer<typeof updateFixedExpenseSchema>;
export type PayFixedExpenseInput = z.infer<typeof payFixedExpenseSchema>;
