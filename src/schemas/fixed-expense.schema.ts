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
  autoGenerate: z.boolean().default(false),
  creditCardAccountId: z.string().uuid('ID de tarjeta de crédito inválido').optional().nullable(),
  recurringDebtPaymentId: z
    .string()
    .uuid('ID de pago recurrente de deuda inválido')
    .optional()
    .nullable(),
});

export const updateFixedExpenseSchema = createFixedExpenseSchema.partial();

export const payFixedExpenseSchema = z.object({
  date: z.string().datetime().optional(),
  amount: z.number().positive().optional(), // Allow override for variable bills
});

export const reorderFixedExpensesSchema = z.object({
  items: z.array(
    z.object({
      id: z.string().uuid('ID inválido'),
      sortOrder: z.number().int().min(0),
    })
  ),
});

export type CreateFixedExpenseInput = z.infer<typeof createFixedExpenseSchema>;
export type UpdateFixedExpenseInput = z.infer<typeof updateFixedExpenseSchema>;
export type PayFixedExpenseInput = z.infer<typeof payFixedExpenseSchema>;
export type ReorderFixedExpensesInput = z.infer<typeof reorderFixedExpensesSchema>;
