import { describe, it, expect, vi, beforeEach } from 'vitest';
import { fakeReq, fakeRes, fakeNext } from './http-fakes.js';

const mocked = vi.hoisted(() => ({
  createRecurringDebtPayment: vi.fn(),
  getRecurringDebtPayments: vi.fn(),
  getRecurringDebtPaymentById: vi.fn(),
  updateRecurringDebtPayment: vi.fn(),
  deleteRecurringDebtPayment: vi.fn(),
  processPendingRecurringPayments: vi.fn(),
}));

vi.mock('../../bootstrap.js', () => ({ recurringDebtPaymentsService: mocked }));

import * as controller from '../recurring-debt-payments.controller.js';

const VALID_BODY = {
  debtId: '11111111-1111-1111-1111-111111111111',
  amount: 50,
  accountId: '22222222-2222-2222-2222-222222222222',
  frequency: 'monthly',
  dayOfMonth: 5,
};

describe('recurring-debt-payments.controller', () => {
  beforeEach(() => vi.clearAllMocks());

  describe('createRecurringDebtPayment', () => {
    it('responde 201', async () => {
      mocked.createRecurringDebtPayment.mockResolvedValue({ id: 'rdp-1' });
      const req = fakeReq({ body: VALID_BODY });
      const res = fakeRes();

      await controller.createRecurringDebtPayment(req, res, fakeNext());

      expect(mocked.createRecurringDebtPayment).toHaveBeenCalledWith(
        'user-1',
        expect.objectContaining({ debtId: VALID_BODY.debtId })
      );
      expect(res.status).toHaveBeenCalledWith(201);
    });

    it('body inválido (mensual sin dayOfMonth) cae en next', async () => {
      const next = fakeNext();
      const invalid = { ...VALID_BODY, dayOfMonth: undefined };

      await controller.createRecurringDebtPayment(fakeReq({ body: invalid }), fakeRes(), next);

      expect(mocked.createRecurringDebtPayment).not.toHaveBeenCalled();
      expect(next).toHaveBeenCalled();
    });
  });

  describe('getRecurringDebtPayments', () => {
    it('pasa el debtId de query si es string', async () => {
      mocked.getRecurringDebtPayments.mockResolvedValue([]);

      await controller.getRecurringDebtPayments(
        fakeReq({ query: { debtId: 'debt-1' } }),
        fakeRes(),
        fakeNext()
      );

      expect(mocked.getRecurringDebtPayments).toHaveBeenCalledWith('user-1', 'debt-1');
    });

    it('sin debtId: pasa undefined', async () => {
      mocked.getRecurringDebtPayments.mockResolvedValue([]);

      await controller.getRecurringDebtPayments(fakeReq(), fakeRes(), fakeNext());

      expect(mocked.getRecurringDebtPayments).toHaveBeenCalledWith('user-1', undefined);
    });
  });

  describe('getRecurringDebtPaymentById', () => {
    it('responde 200', async () => {
      mocked.getRecurringDebtPaymentById.mockResolvedValue({ id: 'rdp-1' });
      const res = fakeRes();

      await controller.getRecurringDebtPaymentById(
        fakeReq({ params: { id: 'rdp-1' } }),
        res,
        fakeNext()
      );

      expect(mocked.getRecurringDebtPaymentById).toHaveBeenCalledWith('rdp-1', 'user-1');
      expect(res.json).toHaveBeenCalledWith({ id: 'rdp-1' });
    });

    it('error cae en next', async () => {
      const error = new Error('Pago recurrente no encontrado');
      mocked.getRecurringDebtPaymentById.mockRejectedValue(error);
      const next = fakeNext();

      await controller.getRecurringDebtPaymentById(
        fakeReq({ params: { id: 'rdp-1' } }),
        fakeRes(),
        next
      );

      expect(next).toHaveBeenCalledWith(error);
    });
  });

  describe('updateRecurringDebtPayment', () => {
    it('responde 200', async () => {
      mocked.updateRecurringDebtPayment.mockResolvedValue({ id: 'rdp-1', amount: 100 });
      const req = fakeReq({ params: { id: 'rdp-1' }, body: { amount: 100 } });
      const res = fakeRes();

      await controller.updateRecurringDebtPayment(req, res, fakeNext());

      expect(mocked.updateRecurringDebtPayment).toHaveBeenCalledWith(
        'rdp-1',
        'user-1',
        expect.objectContaining({ amount: 100 })
      );
      expect(res.json).toHaveBeenCalledWith({ id: 'rdp-1', amount: 100 });
    });
  });

  describe('deleteRecurringDebtPayment', () => {
    it('responde 200 con el resultado', async () => {
      mocked.deleteRecurringDebtPayment.mockResolvedValue({ message: 'ok' });
      const res = fakeRes();

      await controller.deleteRecurringDebtPayment(
        fakeReq({ params: { id: 'rdp-1' } }),
        res,
        fakeNext()
      );

      expect(mocked.deleteRecurringDebtPayment).toHaveBeenCalledWith('rdp-1', 'user-1');
      expect(res.json).toHaveBeenCalledWith({ message: 'ok' });
    });
  });

  describe('processPendingPayments', () => {
    it('responde 200 con el resultado del batch, sin requerir userId', async () => {
      mocked.processPendingRecurringPayments.mockResolvedValue({ processed: 2 });
      const res = fakeRes();

      await controller.processPendingPayments(fakeReq(), res, fakeNext());

      expect(mocked.processPendingRecurringPayments).toHaveBeenCalledWith();
      expect(res.json).toHaveBeenCalledWith({ processed: 2 });
    });
  });
});
