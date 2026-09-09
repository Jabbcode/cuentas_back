import { describe, it, expect } from 'vitest';
import { scanReceiptResponseSchema, duplicateCheckResponseSchema } from '../receipt.schema.js';

const validScan = {
  amount: 25.5,
  description: 'Compra super',
  date: '2026-07-20',
  confidence: 'high' as const,
  imageHash: 'hash-1',
};

describe('scanReceiptResponseSchema', () => {
  it('acepta el mínimo requerido', () => {
    expect(scanReceiptResponseSchema.safeParse(validScan).success).toBe(true);
  });

  it('rechaza amount no positivo', () => {
    expect(scanReceiptResponseSchema.safeParse({ ...validScan, amount: 0 }).success).toBe(false);
  });

  it('rechaza confidence fuera del enum', () => {
    expect(
      scanReceiptResponseSchema.safeParse({ ...validScan, confidence: 'altísima' }).success
    ).toBe(false);
  });

  it('acepta items opcionales bien formados', () => {
    const result = scanReceiptResponseSchema.safeParse({
      ...validScan,
      items: [{ name: 'Leche', quantity: 1, unitPrice: 1, totalPrice: 1 }],
    });
    expect(result.success).toBe(true);
  });
});

describe('duplicateCheckResponseSchema', () => {
  it('acepta duplicate:false sin existingTransaction', () => {
    expect(
      duplicateCheckResponseSchema.safeParse({ duplicate: false, matchType: 'none' }).success
    ).toBe(true);
  });

  it('acepta un duplicado exacto con existingTransaction completo', () => {
    const result = duplicateCheckResponseSchema.safeParse({
      duplicate: true,
      matchType: 'exact',
      existingTransaction: {
        id: 'tx-1',
        amount: 10,
        description: null,
        date: '2026-07-20',
        createdAt: '2026-07-20',
      },
    });
    expect(result.success).toBe(true);
  });

  it('rechaza matchType fuera del enum', () => {
    expect(
      duplicateCheckResponseSchema.safeParse({ duplicate: true, matchType: 'parecido' }).success
    ).toBe(false);
  });
});
