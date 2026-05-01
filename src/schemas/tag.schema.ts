import { z } from 'zod';

export const tagQuerySchema = z.object({
  name: z.string().optional(),
});

export type TagQuery = z.infer<typeof tagQuerySchema>;
