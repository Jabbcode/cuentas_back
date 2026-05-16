import { z } from 'zod';

export const confirmMappingsSchema = z.object({
  pendingAuthId: z.string().uuid(),
  mappings: z
    .array(
      z.object({
        truelayerAccountId: z.string().min(1),
        appAccountId: z.string().uuid(),
      })
    )
    .min(1, 'At least one mapping is required'),
});

export type ConfirmMappingsInput = z.infer<typeof confirmMappingsSchema>;
