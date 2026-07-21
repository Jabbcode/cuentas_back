import { describe, it, expect } from 'vitest';
import { CATEGORY_SYSTEM_KEYS, SYSTEM_CATEGORY_DEFAULTS } from '../category-system-keys.js';

describe('CATEGORY_SYSTEM_KEYS / SYSTEM_CATEGORY_DEFAULTS', () => {
  it('cada clave tiene una entrada de defaults', () => {
    for (const key of Object.values(CATEGORY_SYSTEM_KEYS)) {
      expect(SYSTEM_CATEGORY_DEFAULTS[key]).toBeDefined();
    }
  });

  it('nombres canónicos exactos', () => {
    expect(SYSTEM_CATEGORY_DEFAULTS.DEBT_PAYMENT.name).toBe('Pago de Deuda');
    expect(SYSTEM_CATEGORY_DEFAULTS.CREDIT_CARD_PAYMENT.name).toBe('Pago de Tarjeta');
  });

  it('todas las categorías de sistema son type "expense"', () => {
    for (const defaults of Object.values(SYSTEM_CATEGORY_DEFAULTS)) {
      expect(defaults.type).toBe('expense');
    }
  });
});
