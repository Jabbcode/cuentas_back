import { describe, it, expect, vi, beforeEach } from 'vitest';
import { fakeReq, fakeRes, fakeNext } from './http-fakes.js';

const mocked = vi.hoisted(() => ({
  createDebt: vi.fn(),
  getDebts: vi.fn(),
  getDebtById: vi.fn(),
  updateDebt: vi.fn(),
  deleteDebt: vi.fn(),
  payDebt: vi.fn(),
  getDebtsSummary: vi.fn(),
}));

vi.mock('../../bootstrap.js', () => ({ debtsService: mocked }));

import * as controller from '../debts.controller.js';

const VALID_DEBT = { creditor: 'Banco', description: 'Préstamo', totalAmount: 1000 };
const VALID_PAYMENT = { amount: 50, accountId: '11111111-1111-1111-1111-111111111111' };

describe('debts.controller', () => {
  beforeEach(() => vi.clearAllMocks());

  describe('createDebt', () => {
    it('responde 201 con la deuda creada', async () => {
      mocked.createDebt.mockResolvedValue({ id: 'debt-1' });
      const req = fakeReq({ body: VALID_DEBT });
      const res = fakeRes();

      await controller.createDebt(req, res, fakeNext());

      expect(mocked.createDebt).toHaveBeenCalledWith('user-1', expect.objectContaining(VALID_DEBT));
      expect(res.status).toHaveBeenCalledWith(201);
    });

    it('body inválido cae en next', async () => {
      const next = fakeNext();

      await controller.createDebt(fakeReq({ body: {} }), fakeRes(), next);

      expect(mocked.createDebt).not.toHaveBeenCalled();
      expect(next).toHaveBeenCalled();
    });
  });

  describe('getDebts', () => {
    it('pasa el status de query si es string', async () => {
      mocked.getDebts.mockResolvedValue([]);

      await controller.getDebts(fakeReq({ query: { status: 'active' } }), fakeRes(), fakeNext());

      expect(mocked.getDebts).toHaveBeenCalledWith('user-1', 'active');
    });

    it('sin status: pasa undefined', async () => {
      mocked.getDebts.mockResolvedValue([]);

      await controller.getDebts(fakeReq(), fakeRes(), fakeNext());

      expect(mocked.getDebts).toHaveBeenCalledWith('user-1', undefined);
    });
  });

  describe('getDebtById', () => {
    it('responde 200 con la deuda', async () => {
      mocked.getDebtById.mockResolvedValue({ id: 'debt-1' });
      const res = fakeRes();

      await controller.getDebtById(fakeReq({ params: { id: 'debt-1' } }), res, fakeNext());

      expect(mocked.getDebtById).toHaveBeenCalledWith('debt-1', 'user-1');
      expect(res.json).toHaveBeenCalledWith({ id: 'debt-1' });
    });

    it('error cae en next (el controller no mapea status codes)', async () => {
      const error = new Error('Deuda no encontrada');
      mocked.getDebtById.mockRejectedValue(error);
      const next = fakeNext();

      await controller.getDebtById(fakeReq({ params: { id: 'debt-1' } }), fakeRes(), next);

      expect(next).toHaveBeenCalledWith(error);
    });
  });

  describe('updateDebt', () => {
    it('responde 200 con la deuda actualizada', async () => {
      mocked.updateDebt.mockResolvedValue({ id: 'debt-1', creditor: 'Nuevo' });
      const req = fakeReq({ params: { id: 'debt-1' }, body: { creditor: 'Nuevo' } });
      const res = fakeRes();

      await controller.updateDebt(req, res, fakeNext());

      expect(mocked.updateDebt).toHaveBeenCalledWith(
        'debt-1',
        'user-1',
        expect.objectContaining({ creditor: 'Nuevo' })
      );
      expect(res.json).toHaveBeenCalledWith({ id: 'debt-1', creditor: 'Nuevo' });
    });
  });

  describe('deleteDebt', () => {
    it('responde 200 con el mensaje de confirmación', async () => {
      mocked.deleteDebt.mockResolvedValue({ message: 'Deuda eliminada correctamente' });
      const res = fakeRes();

      await controller.deleteDebt(fakeReq({ params: { id: 'debt-1' } }), res, fakeNext());

      expect(mocked.deleteDebt).toHaveBeenCalledWith('debt-1', 'user-1');
      expect(res.json).toHaveBeenCalledWith({ message: 'Deuda eliminada correctamente' });
    });
  });

  describe('payDebt', () => {
    it('responde 200 con el resultado del pago', async () => {
      mocked.payDebt.mockResolvedValue({ debt: {}, payment: {}, transaction: {} });
      const req = fakeReq({ params: { id: 'debt-1' }, body: VALID_PAYMENT });
      const res = fakeRes();

      await controller.payDebt(req, res, fakeNext());

      expect(mocked.payDebt).toHaveBeenCalledWith(
        'debt-1',
        'user-1',
        expect.objectContaining(VALID_PAYMENT)
      );
      expect(res.json).toHaveBeenCalled();
    });

    it('body inválido cae en next', async () => {
      const next = fakeNext();

      await controller.payDebt(
        fakeReq({ params: { id: 'debt-1' }, body: { amount: -5 } }),
        fakeRes(),
        next
      );

      expect(mocked.payDebt).not.toHaveBeenCalled();
      expect(next).toHaveBeenCalled();
    });
  });

  describe('getDebtsSummary', () => {
    it('responde 200 con el resumen', async () => {
      mocked.getDebtsSummary.mockResolvedValue({ totalActiveDebts: 2 });
      const res = fakeRes();

      await controller.getDebtsSummary(fakeReq(), res, fakeNext());

      expect(mocked.getDebtsSummary).toHaveBeenCalledWith('user-1');
      expect(res.json).toHaveBeenCalledWith({ totalActiveDebts: 2 });
    });
  });
});
