import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import {
  getCutoffDates,
  getPaymentDueDate,
  getDaysBetween,
  normalizeToUTC,
} from '../credit-card.utils.js';

describe('getCutoffDates', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('hoy después del cutoffDay: último corte este mes, próximo el mes siguiente', () => {
    vi.setSystemTime(new Date(2026, 5, 10));
    const { lastCutoff, nextCutoff } = getCutoffDates(5);
    expect(lastCutoff).toEqual(new Date(2026, 5, 5));
    expect(nextCutoff).toEqual(new Date(2026, 6, 5));
  });

  it('hoy antes del cutoffDay: último corte el mes anterior, próximo este mes', () => {
    vi.setSystemTime(new Date(2026, 5, 10));
    const { lastCutoff, nextCutoff } = getCutoffDates(20);
    expect(lastCutoff).toEqual(new Date(2026, 4, 20));
    expect(nextCutoff).toEqual(new Date(2026, 5, 20));
  });
});

describe('getPaymentDueDate', () => {
  it('paymentDueDay después del día de corte: mismo mes del corte', () => {
    const cutoff = new Date(2026, 5, 5);
    const result = getPaymentDueDate(cutoff, 20);
    expect(result).toEqual(new Date(2026, 5, 20));
  });

  it('paymentDueDay antes o igual al día de corte: mes siguiente', () => {
    const cutoff = new Date(2026, 5, 20);
    const result = getPaymentDueDate(cutoff, 5);
    expect(result).toEqual(new Date(2026, 6, 5));
  });
});

describe('getDaysBetween', () => {
  it('mismo instante devuelve 0', () => {
    const d = new Date(2026, 5, 10, 12, 0, 0);
    expect(getDaysBetween(d, d)).toBe(0);
  });

  it('caracterización: Math.ceil redondea hacia arriba (+36h → 2 días)', () => {
    const from = new Date(2026, 5, 10, 0, 0, 0);
    const to = new Date(2026, 5, 11, 12, 0, 0); // +36 horas
    expect(getDaysBetween(from, to)).toBe(2);
  });

  it('to anterior a from da negativo (sin clamp a 0)', () => {
    const from = new Date(2026, 5, 10);
    const to = new Date(2026, 5, 9);
    expect(getDaysBetween(from, to)).toBe(-1);
  });
});

describe('normalizeToUTC', () => {
  it('trunca la hora local y devuelve medianoche UTC del mismo día calendario', () => {
    const local = new Date(2026, 5, 10, 18, 30, 0);
    const result = normalizeToUTC(local);
    expect(result.getUTCFullYear()).toBe(2026);
    expect(result.getUTCMonth()).toBe(5);
    expect(result.getUTCDate()).toBe(10);
    expect(result.getUTCHours()).toBe(0);
    expect(result.getUTCMinutes()).toBe(0);
  });
});
