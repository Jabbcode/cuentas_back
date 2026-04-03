import { z } from 'zod';

export const scanReceiptResponseSchema = z.object({
  amount: z.number().positive(),
  description: z.string(),
  date: z.string(),
  suggestedCategory: z.string().optional(),
  confidence: z.enum(['high', 'medium', 'low']),
  rawText: z.string().optional(),
  imageHash: z.string(),
});

export const duplicateCheckResponseSchema = z.object({
  duplicate: z.boolean(),
  matchType: z.enum(['exact', 'similar', 'none']),
  existingTransaction: z.object({
    id: z.string(),
    amount: z.number(),
    description: z.string().nullable(),
    date: z.string(),
    createdAt: z.string(),
    account: z.object({
      id: z.string(),
      name: z.string(),
    }).optional(),
    category: z.object({
      id: z.string(),
      name: z.string(),
    }).optional(),
  }).optional(),
  scannedData: scanReceiptResponseSchema.optional(),
});

export type ScanReceiptResponse = z.infer<typeof scanReceiptResponseSchema>;
export type DuplicateCheckResponse = z.infer<typeof duplicateCheckResponseSchema>;
