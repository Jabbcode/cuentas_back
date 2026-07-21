import { describe, it, expect } from 'vitest';
import { calculateNextDueDate } from '../date.utils.js';

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
