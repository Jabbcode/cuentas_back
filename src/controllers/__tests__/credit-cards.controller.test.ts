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

  const PAYMENT_ACCOUNT_ID = 'a1b2c3d4-e5f6-4789-a012-3456789abcde';

  describe('getStatement', () => {
    it('responde 200 con el statement, months por defecto en 6', async () => {
      mocked.getCreditCardStatement.mockResolvedValue({ creditLimit: 1000 });
      const req = fakeReq({ params: { accountId: 'card-1' } });
      const res = fakeRes();

      await controller.getStatement(req, res, fakeNext());

      expect(mocked.getCreditCardStatement).toHaveBeenCalledWith('card-1', 'user-1', 6);
      expect(res.json).toHaveBeenCalledWith({ creditLimit: 1000 });
    });

    it('propaga ?months= al service', async () => {
      mocked.getCreditCardStatement.mockResolvedValue({ creditLimit: 1000 });
      const req = fakeReq({ params: { accountId: 'card-1' }, query: { months: '12' } });

      await controller.getStatement(req, fakeRes(), fakeNext());

      expect(mocked.getCreditCardStatement).toHaveBeenCalledWith('card-1', 'user-1', 12);
    });

    it('months fuera de la whitelist ⇒ error de validación cae en next, sin llamar al service', async () => {
      const next = fakeNext();
      const req = fakeReq({ params: { accountId: 'card-1' }, query: { months: '9999' } });

      await controller.getStatement(req, fakeRes(), next);

      expect(mocked.getCreditCardStatement).not.toHaveBeenCalled();
      expect(next).toHaveBeenCalledWith(expect.any(Error));
    });

    it('months no numérico ⇒ error de validación cae en next', async () => {
      const next = fakeNext();
      const req = fakeReq({ params: { accountId: 'card-1' }, query: { months: 'abc' } });

      await controller.getStatement(req, fakeRes(), next);

      expect(mocked.getCreditCardStatement).not.toHaveBeenCalled();
      expect(next).toHaveBeenCalledWith(expect.any(Error));
    });

    it('error del service cae en next', async () => {
      const error = new Error('Cuenta no encontrada');
      mocked.getCreditCardStatement.mockRejectedValue(error);
      const next = fakeNext();

      await controller.getStatement(fakeReq({ params: { accountId: 'card-1' } }), fakeRes(), next);

      expect(next).toHaveBeenCalledWith(error);
    });
  });

  describe('getSummary', () => {
    it('responde 200 con el resumen, months por defecto en 6', async () => {
      mocked.getCreditCardsSummary.mockResolvedValue({ totalToPay: 0 });
      const res = fakeRes();

      await controller.getSummary(fakeReq(), res, fakeNext());

      expect(mocked.getCreditCardsSummary).toHaveBeenCalledWith('user-1', 6);
      expect(res.json).toHaveBeenCalledWith({ totalToPay: 0 });
    });

    it('propaga ?months= al service', async () => {
      mocked.getCreditCardsSummary.mockResolvedValue({ totalToPay: 0 });
      const req = fakeReq({ query: { months: '3' } });

      await controller.getSummary(req, fakeRes(), fakeNext());

      expect(mocked.getCreditCardsSummary).toHaveBeenCalledWith('user-1', 3);
    });
  });

  describe('payStatement', () => {
    it('parsea amount a número y responde con el pago', async () => {
      mocked.payCreditCardStatement.mockResolvedValue({ id: 'payment-1' });
      const req = fakeReq({
        params: { accountId: 'card-1' },
        body: { amount: '50.5', paymentAccountId: PAYMENT_ACCOUNT_ID, paymentDate: '2026-01-01' },
      });
      const res = fakeRes();

      await controller.payStatement(req, res, fakeNext());

      expect(mocked.payCreditCardStatement).toHaveBeenCalledWith('card-1', 'user-1', {
        amount: 50.5,
        paymentAccountId: PAYMENT_ACCOUNT_ID,
        paymentDate: '2026-01-01',
      });
      expect(res.json).toHaveBeenCalledWith({ id: 'payment-1' });
    });

    it('sin paymentAccountId ⇒ error de validación cae en next, sin llamar al service', async () => {
      const next = fakeNext();
      const req = fakeReq({ params: { accountId: 'card-1' }, body: { amount: '50' } });

      await controller.payStatement(req, fakeRes(), next);

      expect(mocked.payCreditCardStatement).not.toHaveBeenCalled();
      expect(next).toHaveBeenCalledWith(expect.any(Error));
    });

    it('error del service cae en next', async () => {
      const error = new Error('El estado de cuenta ya está pagado');
      mocked.payCreditCardStatement.mockRejectedValue(error);
      const next = fakeNext();

      await controller.payStatement(
        fakeReq({
          params: { accountId: 'card-1' },
          body: { amount: '50', paymentAccountId: PAYMENT_ACCOUNT_ID },
        }),
        fakeRes(),
        next
      );

      expect(next).toHaveBeenCalledWith(error);
    });
  });
});
