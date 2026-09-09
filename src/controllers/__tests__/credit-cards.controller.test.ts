import { describe, it, expect, vi, beforeEach } from 'vitest';
import { fakeReq, fakeRes, fakeNext } from './http-fakes.js';

const mocked = vi.hoisted(() => ({
  getCreditCardStatement: vi.fn(),
  getCreditCardsSummary: vi.fn(),
  payCreditCardStatement: vi.fn(),
}));

vi.mock('../../bootstrap.js', () => ({ creditCardsService: mocked }));

import * as controller from '../credit-cards.controller.js';

describe('credit-cards.controller', () => {
  beforeEach(() => vi.clearAllMocks());

  describe('getStatement', () => {
    it('responde 200 con el statement', async () => {
      mocked.getCreditCardStatement.mockResolvedValue({ creditLimit: 1000 });
      const req = fakeReq({ params: { accountId: 'card-1' } });
      const res = fakeRes();

      await controller.getStatement(req, res, fakeNext());

      expect(mocked.getCreditCardStatement).toHaveBeenCalledWith('card-1', 'user-1');
      expect(res.json).toHaveBeenCalledWith({ creditLimit: 1000 });
    });

    it('error cae en next', async () => {
      const error = new Error('Cuenta no encontrada');
      mocked.getCreditCardStatement.mockRejectedValue(error);
      const next = fakeNext();

      await controller.getStatement(fakeReq({ params: { accountId: 'card-1' } }), fakeRes(), next);

      expect(next).toHaveBeenCalledWith(error);
    });
  });

  describe('getSummary', () => {
    it('responde 200 con el resumen', async () => {
      mocked.getCreditCardsSummary.mockResolvedValue({ totalToPay: 0 });
      const res = fakeRes();

      await controller.getSummary(fakeReq(), res, fakeNext());

      expect(mocked.getCreditCardsSummary).toHaveBeenCalledWith('user-1');
      expect(res.json).toHaveBeenCalledWith({ totalToPay: 0 });
    });
  });

  describe('payStatement', () => {
    it('parsea amount a número y responde con el pago', async () => {
      mocked.payCreditCardStatement.mockResolvedValue({ id: 'payment-1' });
      const req = fakeReq({
        params: { accountId: 'card-1' },
        body: { amount: '50.5', paymentAccountId: 'account-1', paymentDate: '2026-01-01' },
      });
      const res = fakeRes();

      await controller.payStatement(req, res, fakeNext());

      expect(mocked.payCreditCardStatement).toHaveBeenCalledWith('card-1', 'user-1', {
        amount: 50.5,
        paymentAccountId: 'account-1',
        paymentDate: '2026-01-01',
      });
      expect(res.json).toHaveBeenCalledWith({ id: 'payment-1' });
    });

    it('error cae en next', async () => {
      const error = new Error('El estado de cuenta ya está pagado');
      mocked.payCreditCardStatement.mockRejectedValue(error);
      const next = fakeNext();

      await controller.payStatement(
        fakeReq({ params: { accountId: 'card-1' }, body: { amount: '50', paymentAccountId: 'a' } }),
        fakeRes(),
        next
      );

      expect(next).toHaveBeenCalledWith(error);
    });
  });
});
