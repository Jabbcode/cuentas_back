import { describe, it, expect } from 'vitest';
import { calculateNextDueDate, getMonthRange } from '../date.utils.js';

describe('getMonthRange', () => {
  it('junio 2026: start 1 jun 00:00, end 1 jul 00:00', () => {
    const { start, end } = getMonthRange(2026, 5);
    expect(start).toEqual(new Date(2026, 5, 1));
    expect(end).toEqual(new Date(2026, 6, 1));
  });

  it('diciembre: end cruza al 1 de enero del año siguiente', () => {
    const { start, end } = getMonthRange(2026, 11);
    expect(start).toEqual(new Date(2026, 11, 1));
    expect(end).toEqual(new Date(2027, 0, 1));
  });

  it('febrero bisiesto (2028): end es 1 de marzo, cubre el 29', () => {
    const { start, end } = getMonthRange(2028, 1);
    expect(start).toEqual(new Date(2028, 1, 1));
    expect(end).toEqual(new Date(2028, 2, 1));
  });
});

describe('calculateNextDueDate', () => {
  describe('monthly', () => {
    it('dayOfMonth en el futuro dentro del mes actual', () => {
      const result = calculateNextDueDate('monthly', 15, null, new Date(2026, 5, 10));
      expect(result).toEqual(new Date(2026, 5, 15));
    });

    it('dayOfMonth igual a hoy salta al mes siguiente', () => {
      const result = calculateNextDueDate('monthly', 15, null, new Date(2026, 5, 15));
      expect(result).toEqual(new Date(2026, 6, 15));
    });

    it('dayOfMonth null usa el día 1 (y si ya pasó este mes, salta al siguiente)', () => {
      // fromDate=10, targetDay=1: el día 1 ya pasó este mes → salta a julio
      const result = calculateNextDueDate('monthly', null, null, new Date(2026, 5, 10));
      expect(result).toEqual(new Date(2026, 6, 1));
    });

    it('caracterización: dayOfMonth=31 desde un mes de 30 días desborda al mes siguiente', () => {
      // JS Date normaliza setDate(31) en junio (30 días) a julio 1; comportamiento actual, no corregido aquí.
      const result = calculateNextDueDate('monthly', 31, null, new Date(2026, 5, 10));
      expect(result).toEqual(new Date(2026, 6, 1));
    });
  });

  describe('weekly', () => {
    it('próximo día de la semana distinto al actual', () => {
      // 2026-06-10 es miércoles (día 3); dayOfWeek=1 (lunes) → próximo lunes 2026-06-15
      const result = calculateNextDueDate('weekly', null, 1, new Date(2026, 5, 10));
      expect(result).toEqual(new Date(2026, 5, 15));
    });

    it('mismo día de la semana que hoy salta +7 días', () => {
      // 2026-06-10 es miércoles (día 3)
      const result = calculateNextDueDate('weekly', null, 3, new Date(2026, 5, 10));
      expect(result).toEqual(new Date(2026, 5, 17));
    });
  });

  describe('biweekly', () => {
    it('siempre suma 14 días desde fromDate', () => {
      const result = calculateNextDueDate('biweekly', null, null, new Date(2026, 5, 10));
      expect(result).toEqual(new Date(2026, 5, 24));
    });
  });
});
