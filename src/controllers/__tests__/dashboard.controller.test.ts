import { describe, it, expect, vi, beforeEach } from 'vitest';
import { fakeReq, fakeRes, fakeNext } from './http-fakes.js';

const mocked = vi.hoisted(() => ({
  getSummary: vi.fn(),
  getByCategory: vi.fn(),
  getMonthlyTrend: vi.fn(),
  getFixedVsVariable: vi.fn(),
  getMonthlySummary: vi.fn(),
  getNextMonthProjection: vi.fn(),
}));

vi.mock('../../bootstrap.js', () => ({
  dashboardService: {
    getSummary: mocked.getSummary,
    getByCategory: mocked.getByCategory,
    getMonthlyTrend: mocked.getMonthlyTrend,
    getFixedVsVariable: mocked.getFixedVsVariable,
    getMonthlySummary: mocked.getMonthlySummary,
  },
  projectionService: { getNextMonthProjection: mocked.getNextMonthProjection },
}));

import * as controller from '../dashboard.controller.js';

describe('dashboard.controller', () => {
  beforeEach(() => vi.clearAllMocks());

  describe('getSummary', () => {
    it('responde 200 con el resumen', async () => {
      mocked.getSummary.mockResolvedValue({ totalBalance: 100 });
      const res = fakeRes();

      await controller.getSummary(fakeReq(), res, fakeNext());

      expect(mocked.getSummary).toHaveBeenCalledWith('user-1');
      expect(res.json).toHaveBeenCalledWith({ totalBalance: 100 });
    });

    it('error cae en next', async () => {
      const error = new Error('boom');
      mocked.getSummary.mockRejectedValue(error);
      const next = fakeNext();

      await controller.getSummary(fakeReq(), fakeRes(), next);

      expect(next).toHaveBeenCalledWith(error);
    });
  });

  describe('getByCategory', () => {
    it('usa el type de query si viene', async () => {
      mocked.getByCategory.mockResolvedValue([]);

      await controller.getByCategory(fakeReq({ query: { type: 'income' } }), fakeRes(), fakeNext());

      expect(mocked.getByCategory).toHaveBeenCalledWith('user-1', 'income');
    });

    it('sin type: usa expense por defecto', async () => {
      mocked.getByCategory.mockResolvedValue([]);

      await controller.getByCategory(fakeReq(), fakeRes(), fakeNext());

      expect(mocked.getByCategory).toHaveBeenCalledWith('user-1', 'expense');
    });
  });

  describe('getMonthlyTrend', () => {
    it('parsea months de query', async () => {
      mocked.getMonthlyTrend.mockResolvedValue([]);

      await controller.getMonthlyTrend(fakeReq({ query: { months: '3' } }), fakeRes(), fakeNext());

      expect(mocked.getMonthlyTrend).toHaveBeenCalledWith('user-1', 3);
    });

    it('sin months: usa 6 por defecto', async () => {
      mocked.getMonthlyTrend.mockResolvedValue([]);

      await controller.getMonthlyTrend(fakeReq(), fakeRes(), fakeNext());

      expect(mocked.getMonthlyTrend).toHaveBeenCalledWith('user-1', 6);
    });
  });

  describe('getFixedVsVariable', () => {
    it('responde 200', async () => {
      mocked.getFixedVsVariable.mockResolvedValue({ fixed: 100, variable: 50 });
      const res = fakeRes();

      await controller.getFixedVsVariable(fakeReq(), res, fakeNext());

      expect(res.json).toHaveBeenCalledWith({ fixed: 100, variable: 50 });
    });
  });

  describe('getMonthlySummary', () => {
    it('parsea month/year de query', async () => {
      mocked.getMonthlySummary.mockResolvedValue({});

      await controller.getMonthlySummary(
        fakeReq({ query: { month: '3', year: '2026' } }),
        fakeRes(),
        fakeNext()
      );

      expect(mocked.getMonthlySummary).toHaveBeenCalledWith('user-1', 3, 2026);
    });

    it('sin month/year: usa el mes/año actual', async () => {
      mocked.getMonthlySummary.mockResolvedValue({});
      const now = new Date();

      await controller.getMonthlySummary(fakeReq(), fakeRes(), fakeNext());

      expect(mocked.getMonthlySummary).toHaveBeenCalledWith(
        'user-1',
        now.getMonth() + 1,
        now.getFullYear()
      );
    });
  });

  describe('getNextMonthProjection', () => {
    it('responde 200 con la proyección', async () => {
      mocked.getNextMonthProjection.mockResolvedValue({ projected: 500 });
      const res = fakeRes();

      await controller.getNextMonthProjection(fakeReq(), res, fakeNext());

      expect(mocked.getNextMonthProjection).toHaveBeenCalledWith('user-1');
      expect(res.json).toHaveBeenCalledWith({ projected: 500 });
    });

    it('error cae en next', async () => {
      const error = new Error('boom');
      mocked.getNextMonthProjection.mockRejectedValue(error);
      const next = fakeNext();

      await controller.getNextMonthProjection(fakeReq(), fakeRes(), next);

      expect(next).toHaveBeenCalledWith(error);
    });
  });
});
