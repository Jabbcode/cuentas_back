import { describe, it, expect, vi, beforeEach } from 'vitest';
import { fakeReq, fakeRes, fakeNext } from './http-fakes.js';

const mocked = vi.hoisted(() => ({
  getFixedExpenses: vi.fn(),
  getFixedExpenseById: vi.fn(),
  createFixedExpense: vi.fn(),
  updateFixedExpense: vi.fn(),
  deleteFixedExpense: vi.fn(),
  payFixedExpense: vi.fn(),
  getFixedExpensesSummary: vi.fn(),
  reorderFixedExpenses: vi.fn(),
}));

vi.mock('../../bootstrap.js', () => ({ fixedExpensesService: mocked }));

import * as controller from '../fixed-expenses.controller.js';

const VALID_FE = {
  name: 'Renta',
  amount: 500,
  type: 'expense',
  dueDay: 5,
  accountId: '11111111-1111-1111-1111-111111111111',
  categoryId: '22222222-2222-2222-2222-222222222222',
};

describe('fixed-expenses.controller', () => {
  beforeEach(() => vi.clearAllMocks());

  describe('getFixedExpenses', () => {
    it('active=true en query -> activeOnly true', async () => {
      mocked.getFixedExpenses.mockResolvedValue([]);

      await controller.getFixedExpenses(
        fakeReq({ query: { active: 'true' } }),
        fakeRes(),
        fakeNext()
      );

      expect(mocked.getFixedExpenses).toHaveBeenCalledWith('user-1', true);
    });

    it('sin query: activeOnly false', async () => {
      mocked.getFixedExpenses.mockResolvedValue([]);

      await controller.getFixedExpenses(fakeReq(), fakeRes(), fakeNext());

      expect(mocked.getFixedExpenses).toHaveBeenCalledWith('user-1', false);
    });
  });

  describe('getFixedExpenseById', () => {
    it('responde 200', async () => {
      mocked.getFixedExpenseById.mockResolvedValue({ id: 'fe-1' });
      const res = fakeRes();

      await controller.getFixedExpenseById(fakeReq({ params: { id: 'fe-1' } }), res, fakeNext());

      expect(res.json).toHaveBeenCalledWith({ id: 'fe-1' });
    });

    it('Gasto fijo no encontrado -> 404', async () => {
      mocked.getFixedExpenseById.mockRejectedValue(new Error('Gasto fijo no encontrado'));
      const res = fakeRes();

      await controller.getFixedExpenseById(fakeReq({ params: { id: 'fe-1' } }), res, fakeNext());

      expect(res.status).toHaveBeenCalledWith(404);
    });
  });

  describe('createFixedExpense', () => {
    it('responde 201', async () => {
      mocked.createFixedExpense.mockResolvedValue({ id: 'fe-1' });
      const req = fakeReq({ body: VALID_FE });
      const res = fakeRes();

      await controller.createFixedExpense(req, res, fakeNext());

      expect(mocked.createFixedExpense).toHaveBeenCalledWith(
        expect.objectContaining({ name: 'Renta' }),
        'user-1'
      );
      expect(res.status).toHaveBeenCalledWith(201);
    });

    it('body inválido cae en next', async () => {
      const next = fakeNext();

      await controller.createFixedExpense(fakeReq({ body: {} }), fakeRes(), next);

      expect(mocked.createFixedExpense).not.toHaveBeenCalled();
      expect(next).toHaveBeenCalled();
    });
  });

  describe('updateFixedExpense', () => {
    it('responde 200', async () => {
      mocked.updateFixedExpense.mockResolvedValue({ id: 'fe-1', name: 'Nuevo' });
      const req = fakeReq({ params: { id: 'fe-1' }, body: { name: 'Nuevo' } });
      const res = fakeRes();

      await controller.updateFixedExpense(req, res, fakeNext());

      expect(res.json).toHaveBeenCalledWith({ id: 'fe-1', name: 'Nuevo' });
    });

    it('Gasto fijo no encontrado -> 404', async () => {
      mocked.updateFixedExpense.mockRejectedValue(new Error('Gasto fijo no encontrado'));
      const req = fakeReq({ params: { id: 'fe-1' }, body: {} });
      const res = fakeRes();

      await controller.updateFixedExpense(req, res, fakeNext());

      expect(res.status).toHaveBeenCalledWith(404);
    });
  });

  describe('deleteFixedExpense', () => {
    it('responde 204', async () => {
      mocked.deleteFixedExpense.mockResolvedValue(undefined);
      const res = fakeRes();

      await controller.deleteFixedExpense(fakeReq({ params: { id: 'fe-1' } }), res, fakeNext());

      expect(res.status).toHaveBeenCalledWith(204);
    });

    it('Gasto fijo no encontrado -> 404', async () => {
      mocked.deleteFixedExpense.mockRejectedValue(new Error('Gasto fijo no encontrado'));
      const res = fakeRes();

      await controller.deleteFixedExpense(fakeReq({ params: { id: 'fe-1' } }), res, fakeNext());

      expect(res.status).toHaveBeenCalledWith(404);
    });
  });

  describe('payFixedExpense', () => {
    it('responde 201 con la transacción', async () => {
      mocked.payFixedExpense.mockResolvedValue({ id: 'tx-1' });
      const req = fakeReq({ params: { id: 'fe-1' }, body: {} });
      const res = fakeRes();

      await controller.payFixedExpense(req, res, fakeNext());

      expect(mocked.payFixedExpense).toHaveBeenCalledWith('fe-1', expect.any(Object), 'user-1');
      expect(res.status).toHaveBeenCalledWith(201);
    });

    it('Gasto fijo no encontrado -> 404', async () => {
      mocked.payFixedExpense.mockRejectedValue(new Error('Gasto fijo no encontrado'));
      const req = fakeReq({ params: { id: 'fe-1' }, body: {} });
      const res = fakeRes();

      await controller.payFixedExpense(req, res, fakeNext());

      expect(res.status).toHaveBeenCalledWith(404);
    });
  });

  describe('getFixedExpensesSummary', () => {
    it('responde 200', async () => {
      mocked.getFixedExpensesSummary.mockResolvedValue({ totalCount: 3 });
      const res = fakeRes();

      await controller.getFixedExpensesSummary(fakeReq(), res, fakeNext());

      expect(res.json).toHaveBeenCalledWith({ totalCount: 3 });
    });
  });

  describe('reorderFixedExpenses', () => {
    it('responde 200 con el resultado', async () => {
      mocked.reorderFixedExpenses.mockResolvedValue({ success: true });
      const req = fakeReq({
        body: { items: [{ id: '11111111-1111-1111-1111-111111111111', sortOrder: 0 }] },
      });
      const res = fakeRes();

      await controller.reorderFixedExpenses(req, res, fakeNext());

      expect(mocked.reorderFixedExpenses).toHaveBeenCalledWith(
        'user-1',
        expect.arrayContaining([expect.objectContaining({ sortOrder: 0 })])
      );
      expect(res.json).toHaveBeenCalledWith({ success: true });
    });

    it('Algunos gastos fijos no fueron encontrados -> 404', async () => {
      mocked.reorderFixedExpenses.mockRejectedValue(
        new Error('Algunos gastos fijos no fueron encontrados')
      );
      const req = fakeReq({
        body: { items: [{ id: '11111111-1111-1111-1111-111111111111', sortOrder: 0 }] },
      });
      const res = fakeRes();

      await controller.reorderFixedExpenses(req, res, fakeNext());

      expect(res.status).toHaveBeenCalledWith(404);
    });
  });
});
