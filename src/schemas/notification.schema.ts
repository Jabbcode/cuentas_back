import { z } from 'zod';

export const notificationPreferencesSchema = z.object({
  categoryLimit: z.boolean(),
  debtDue: z.boolean(),
  monthlyEmail: z.boolean(),
});

export type NotificationPreferences = z.infer<typeof notificationPreferencesSchema>;
