import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import {
  getCutoffDates,
  getPaymentDueDate,
  getDaysBetween,
  normalizeToUTC,
  buildClosedPeriodBounds,
  getPeriodBoundsForDate,
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

describe('buildClosedPeriodBounds', () => {
  it('cutoffDay=15, 12 meses: cruza el año sin desbordar y queda ascendente', () => {
    const lastCutoff = new Date(2026, 0, 15); // 15-ene-2026
    const periods = buildClosedPeriodBounds(lastCutoff, 12);

    expect(periods).toHaveLength(12);
    expect(periods[0]!.startDate).toEqual(new Date(2025, 0, 15));
    expect(periods[0]!.endDate).toEqual(new Date(2025, 1, 14));
    // último elemento = período cerrado más reciente, justo antes de lastCutoff
    expect(periods[11]!.startDate).toEqual(new Date(2025, 11, 15));
    expect(periods[11]!.endDate).toEqual(new Date(2026, 0, 14));

    for (let i = 1; i < periods.length; i++) {
      expect(periods[i]!.startDate.getTime()).toBeGreaterThan(periods[i - 1]!.startDate.getTime());
    }
  });

  it('cutoffDay=31: febrero clamea a su último día sin desbordar a marzo', () => {
    const lastCutoff = new Date(2026, 2, 31); // 31-mar-2026
    const periods = buildClosedPeriodBounds(lastCutoff, 1);

    expect(periods).toHaveLength(1);
    expect(periods[0]!.startDate).toEqual(new Date(2026, 1, 28)); // 2026 no es bisiesto
    expect(periods[0]!.endDate).toEqual(new Date(2026, 2, 30));
  });

  it('monthsBack=3 devuelve exactamente 3 elementos', () => {
    const lastCutoff = new Date(2026, 5, 10);
    expect(buildClosedPeriodBounds(lastCutoff, 3)).toHaveLength(3);
  });
});

describe('getPeriodBoundsForDate', () => {
  it('fecha en o después del cutoffDay: período empieza este mes', () => {
    const { startDate, endDate } = getPeriodBoundsForDate(5, new Date(2026, 5, 10));
    expect(startDate).toEqual(new Date(2026, 5, 5));
    expect(endDate).toEqual(new Date(2026, 6, 4));
  });

  it('fecha antes del cutoffDay: período empieza el mes anterior', () => {
    const { startDate, endDate } = getPeriodBoundsForDate(20, new Date(2026, 5, 10));
    expect(startDate).toEqual(new Date(2026, 4, 20));
    expect(endDate).toEqual(new Date(2026, 5, 19));
  });

  it('cutoffDay=31 en febrero clamea sin desbordar a marzo', () => {
    const { startDate, endDate } = getPeriodBoundsForDate(31, new Date(2026, 1, 20));
    expect(startDate).toEqual(new Date(2026, 0, 31));
    expect(endDate).toEqual(new Date(2026, 1, 27)); // 2026 no es bisiesto: clamp a 28 - 1 día
  });

  it('coherente con buildClosedPeriodBounds para la misma fecha de corte (cutoffDay=15)', () => {
    const lastCutoff = new Date(2026, 5, 15);
    const [closed] = buildClosedPeriodBounds(lastCutoff, 1);
    const dentroDelPeriodoCerrado = new Date(2026, 4, 20); // dentro de [15-may, 14-jun]
    const { startDate, endDate } = getPeriodBoundsForDate(15, dentroDelPeriodoCerrado);
    expect(startDate).toEqual(closed!.startDate);
    expect(endDate).toEqual(closed!.endDate);
  });

  it('coherente con buildClosedPeriodBounds para cutoffDay=31 (mismo clamp de febrero)', () => {
    const lastCutoff = new Date(2026, 2, 31); // 31-mar-2026
    const [closed] = buildClosedPeriodBounds(lastCutoff, 1); // [28-feb, 30-mar]
    const dentroDelPeriodoCerrado = new Date(2026, 2, 10);
    const { startDate, endDate } = getPeriodBoundsForDate(31, dentroDelPeriodoCerrado);
    expect(startDate).toEqual(closed!.startDate);
    expect(endDate).toEqual(closed!.endDate);
  });
});
