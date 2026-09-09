import { describe, it, expect, vi, beforeEach } from 'vitest';
import { fakeReq, fakeRes, fakeNext } from './http-fakes.js';

const mocked = vi.hoisted(() => ({
  getTransactions: vi.fn(),
  getTransactionById: vi.fn(),
  createTransaction: vi.fn(),
  updateTransaction: vi.fn(),
  deleteTransaction: vi.fn(),
  getTransactionSummary: vi.fn(),
  getReceiptItems: vi.fn(),
}));

vi.mock('../../bootstrap.js', () => ({ transactionsService: mocked }));

import * as controller from '../transactions.controller.js';

const VALID_TX = {
  amount: 50,
  type: 'expense',
  accountId: '11111111-1111-1111-1111-111111111111',
  categoryId: '22222222-2222-2222-2222-222222222222',
};

describe('transactions.controller', () => {
  beforeEach(() => vi.clearAllMocks());

  describe('getTransactions', () => {
    it('parsea la query y responde con el resultado', async () => {
      mocked.getTransactions.mockResolvedValue({ transactions: [], total: 0 });
      const res = fakeRes();

      await controller.getTransactions(fakeReq({ query: { type: 'expense' } }), res, fakeNext());

      expect(mocked.getTransactions).toHaveBeenCalledWith(
        'user-1',
        expect.objectContaining({ type: 'expense' })
      );
      expect(res.json).toHaveBeenCalledWith({ transactions: [], total: 0 });
    });

    it('query inválida cae en next', async () => {
      const next = fakeNext();

      await controller.getTransactions(
        fakeReq({ query: { accountId: 'no-es-uuid' } }),
        fakeRes(),
        next
      );

      expect(mocked.getTransactions).not.toHaveBeenCalled();
      expect(next).toHaveBeenCalled();
    });
  });

  describe('getTransactionById', () => {
    it('responde 200', async () => {
      mocked.getTransactionById.mockResolvedValue({ id: 'tx-1' });
      const res = fakeRes();

      await controller.getTransactionById(fakeReq({ params: { id: 'tx-1' } }), res, fakeNext());

      expect(res.json).toHaveBeenCalledWith({ id: 'tx-1' });
    });

    it('Transacción no encontrada -> 404', async () => {
      mocked.getTransactionById.mockRejectedValue(new Error('Transacción no encontrada'));
      const res = fakeRes();

      await controller.getTransactionById(fakeReq({ params: { id: 'tx-1' } }), res, fakeNext());

      expect(res.status).toHaveBeenCalledWith(404);
    });
  });

  describe('createTransaction', () => {
    it('responde 201', async () => {
      mocked.createTransaction.mockResolvedValue({ id: 'tx-1' });
      const req = fakeReq({ body: VALID_TX });
      const res = fakeRes();

      await controller.createTransaction(req, res, fakeNext());

      expect(mocked.createTransaction).toHaveBeenCalledWith(
        expect.objectContaining({ amount: 50, type: 'expense' }),
        'user-1'
      );
      expect(res.status).toHaveBeenCalledWith(201);
    });

    it('body inválido cae en next', async () => {
      const next = fakeNext();

      await controller.createTransaction(fakeReq({ body: { amount: -5 } }), fakeRes(), next);

      expect(mocked.createTransaction).not.toHaveBeenCalled();
      expect(next).toHaveBeenCalled();
    });
  });

  describe('updateTransaction', () => {
    it('responde 200', async () => {
      mocked.updateTransaction.mockResolvedValue({ id: 'tx-1', amount: 80 });
      const req = fakeReq({ params: { id: 'tx-1' }, body: { amount: 80 } });
      const res = fakeRes();

      await controller.updateTransaction(req, res, fakeNext());

      expect(res.json).toHaveBeenCalledWith({ id: 'tx-1', amount: 80 });
    });

    it('Transacción no encontrada -> 404', async () => {
      mocked.updateTransaction.mockRejectedValue(new Error('Transacción no encontrada'));
      const req = fakeReq({ params: { id: 'tx-1' }, body: {} });
      const res = fakeRes();

      await controller.updateTransaction(req, res, fakeNext());

      expect(res.status).toHaveBeenCalledWith(404);
    });
  });

  describe('deleteTransaction', () => {
    it('responde 204', async () => {
      mocked.deleteTransaction.mockResolvedValue(undefined);
      const res = fakeRes();

      await controller.deleteTransaction(fakeReq({ params: { id: 'tx-1' } }), res, fakeNext());

      expect(res.status).toHaveBeenCalledWith(204);
    });

    it('Transacción no encontrada -> 404', async () => {
      mocked.deleteTransaction.mockRejectedValue(new Error('Transacción no encontrada'));
      const res = fakeRes();

      await controller.deleteTransaction(fakeReq({ params: { id: 'tx-1' } }), res, fakeNext());

      expect(res.status).toHaveBeenCalledWith(404);
    });
  });

  describe('getTransactionSummary', () => {
    it('responde 200', async () => {
      mocked.getTransactionSummary.mockResolvedValue([]);
      const res = fakeRes();

      await controller.getTransactionSummary(fakeReq(), res, fakeNext());

      expect(res.json).toHaveBeenCalledWith([]);
    });
  });

  describe('getReceiptItems', () => {
    it('responde 200 con los items', async () => {
      mocked.getReceiptItems.mockResolvedValue([{ id: 'item-1' }]);
      const res = fakeRes();

      await controller.getReceiptItems(fakeReq({ params: { id: 'tx-1' } }), res, fakeNext());

      expect(mocked.getReceiptItems).toHaveBeenCalledWith('tx-1', 'user-1');
      expect(res.json).toHaveBeenCalledWith([{ id: 'item-1' }]);
    });

    it('Transacción no encontrada -> 404', async () => {
      mocked.getReceiptItems.mockRejectedValue(new Error('Transacción no encontrada'));
      const res = fakeRes();

      await controller.getReceiptItems(fakeReq({ params: { id: 'tx-1' } }), res, fakeNext());

      expect(res.status).toHaveBeenCalledWith(404);
    });
  });
});
