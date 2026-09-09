import { describe, it, expect } from 'vitest';
import { receiptItemSchema } from '../receiptItem.schema.js';

describe('receiptItemSchema', () => {
  it('acepta un item válido', () => {
    expect(
      receiptItemSchema.safeParse({ name: 'Leche', quantity: 2, unitPrice: 1.5, totalPrice: 3 })
        .success
    ).toBe(true);
  });

  it('rechaza name vacío', () => {
    expect(
      receiptItemSchema.safeParse({ name: '', quantity: 1, unitPrice: 1, totalPrice: 1 }).success
    ).toBe(false);
  });

  it('rechaza quantity no positiva', () => {
    expect(
      receiptItemSchema.safeParse({ name: 'x', quantity: 0, unitPrice: 1, totalPrice: 1 }).success
    ).toBe(false);
  });

  it('rechaza unitPrice/totalPrice negativos', () => {
    expect(
      receiptItemSchema.safeParse({ name: 'x', quantity: 1, unitPrice: -1, totalPrice: 1 }).success
    ).toBe(false);
    expect(
      receiptItemSchema.safeParse({ name: 'x', quantity: 1, unitPrice: 1, totalPrice: -1 }).success
    ).toBe(false);
  });
});
