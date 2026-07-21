import { describe, it, expect, vi, afterEach } from 'vitest';
import { calculateInterest, getDebtStatus, calculateDebtPaymentBreakdown } from '../debt.utils.js';

describe('calculateInterest', () => {
  it('percentage: aplica el porcentaje sobre el remanente', () => {
    expect(calculateInterest(1000, 5, 'percentage')).toBe(50);
  });

  it('fixed: devuelve la tasa tal cual, sin depender del remanente', () => {
    expect(calculateInterest(1000, 20, 'fixed')).toBe(20);
  });

  it('tipo desconocido devuelve 0', () => {
    expect(calculateInterest(1000, 5, 'other')).toBe(0);
  });
});

describe('getDebtStatus', () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it('remainingAmount <= 0 es "paid" sin importar dueDate', () => {
    expect(getDebtStatus(0, null)).toBe('paid');
    expect(getDebtStatus(-5, new Date(2020, 0, 1))).toBe('paid');
  });

  it('con remanente y dueDate futura es "active"', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(2026, 5, 10));
    expect(getDebtStatus(100, new Date(2026, 5, 20))).toBe('active');
  });

  it('con remanente y dueDate pasada es "overdue"', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(2026, 5, 10));
    expect(getDebtStatus(100, new Date(2026, 5, 1))).toBe('overdue');
  });

  it('con remanente y sin dueDate es "active"', () => {
    expect(getDebtStatus(100, null)).toBe('active');
  });
});

describe('calculateDebtPaymentBreakdown', () => {
  it('sin interés: todo el pago va a principal', () => {
    const result = calculateDebtPaymentBreakdown(1000, 200, null, null);
    expect(result).toEqual({ principal: 200, interest: 0, newRemainingAmount: 800 });
  });

  it('con interés percentage: separa interés y principal', () => {
    const result = calculateDebtPaymentBreakdown(1000, 200, 5, 'percentage');
    // interest = 1000*5/100 = 50; principal = 200-50 = 150
    expect(result).toEqual({ principal: 150, interest: 50, newRemainingAmount: 850 });
  });

  it('pago menor al interés calculado: todo el pago va a interés, principal 0', () => {
    const result = calculateDebtPaymentBreakdown(1000, 10, 5, 'percentage');
    // interest calculado = 50, pero paymentAmount=10 < 50 → interest se limita a 10
    expect(result).toEqual({ principal: 0, interest: 10, newRemainingAmount: 1000 });
  });

  it('principal nunca excede el remanente', () => {
    const result = calculateDebtPaymentBreakdown(100, 500, null, null);
    expect(result).toEqual({ principal: 100, interest: 0, newRemainingAmount: 0 });
  });
});
