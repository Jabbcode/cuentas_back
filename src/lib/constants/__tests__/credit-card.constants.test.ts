import { describe, it, expect } from 'vitest';
import { CREDIT_CARD_MESSAGES } from '../credit-card.constants.js';

describe('CREDIT_CARD_MESSAGES.PAID_PERIOD_LOCKED', () => {
  it('el mensaje contiene el rango del período y la fecha de pago en YYYY-MM-DD', () => {
    const periodStart = new Date(2026, 4, 15);
    const periodEnd = new Date(2026, 5, 14);
    const paymentDate = new Date(2026, 5, 18);

    const message = CREDIT_CARD_MESSAGES.PAID_PERIOD_LOCKED(periodStart, periodEnd, paymentDate);

    expect(message).toContain('2026-05-15');
    expect(message).toContain('2026-06-14');
    expect(message).toContain('2026-06-18');
  });
});
