import { describe, it, expect } from 'vitest';
import { createRecurringDebtPaymentSchema } from '../recurring-debt-payment.schema.js';

const base = {
  debtId: '11111111-1111-1111-1111-111111111111',
  amount: 100,
  accountId: '22222222-2222-2222-2222-222222222222',
};

describe('createRecurringDebtPaymentSchema', () => {
  it('mensual con dayOfMonth: válido', () => {
    expect(
      createRecurringDebtPaymentSchema.safeParse({ ...base, frequency: 'monthly', dayOfMonth: 5 })
        .success
    ).toBe(true);
  });

  it('mensual sin dayOfMonth: el refine lo rechaza', () => {
    const result = createRecurringDebtPaymentSchema.safeParse({ ...base, frequency: 'monthly' });
    expect(result.success).toBe(false);
  });

  it('semanal con dayOfWeek: válido', () => {
    expect(
      createRecurringDebtPaymentSchema.safeParse({ ...base, frequency: 'weekly', dayOfWeek: 0 })
        .success
    ).toBe(true);
  });

  it('semanal sin dayOfWeek: el refine lo rechaza', () => {
    const result = createRecurringDebtPaymentSchema.safeParse({ ...base, frequency: 'weekly' });
    expect(result.success).toBe(false);
  });

  it('frequency fuera del enum: rechazado', () => {
    expect(
      createRecurringDebtPaymentSchema.safeParse({ ...base, frequency: 'diaria', dayOfMonth: 1 })
        .success
    ).toBe(false);
  });
});
