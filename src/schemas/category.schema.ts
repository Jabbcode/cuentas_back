import { z } from 'zod';
import { TRANSACTION_TYPE_VALUES } from '../lib/constants/shared.constants.js';

export const createCategorySchema = z.object({
  name: z.string().min(1, 'El nombre es requerido'),
  type: z.enum(TRANSACTION_TYPE_VALUES),
  icon: z.string().optional(),
  color: z.string().optional(),
  monthlyLimit: z.number().positive().nullable().optional(),
});

export const updateCategorySchema = createCategorySchema.partial();

export type CreateCategoryInput = z.infer<typeof createCategorySchema>;
export type UpdateCategoryInput = z.infer<typeof updateCategorySchema>;
