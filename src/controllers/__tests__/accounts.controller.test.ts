import { describe, it, expect, vi, beforeEach } from 'vitest';
import { fakeReq, fakeRes, fakeNext } from './http-fakes.js';

const mocked = vi.hoisted(() => ({
  getAccounts: vi.fn(),
  getAccountById: vi.fn(),
  createAccount: vi.fn(),
  updateAccount: vi.fn(),
  deleteAccount: vi.fn(),
  transferFunds: vi.fn(),
  getTransfersByAccount: vi.fn(),
}));

vi.mock('../../bootstrap.js', () => ({ accountsService: mocked }));

import * as controller from '../accounts.controller.js';

describe('accounts.controller', () => {
  beforeEach(() => vi.clearAllMocks());

  describe('getAccounts', () => {
    it('llama al service con el userId y responde con el resultado', async () => {
      mocked.getAccounts.mockResolvedValue([{ id: 'acc-1' }]);
      const req = fakeReq();
      const res = fakeRes();

      await controller.getAccounts(req, res, fakeNext());

      expect(mocked.getAccounts).toHaveBeenCalledWith('user-1');
      expect(res.json).toHaveBeenCalledWith([{ id: 'acc-1' }]);
    });

    it('un error inesperado cae en next', async () => {
      const error = new Error('boom');
      mocked.getAccounts.mockRejectedValue(error);
      const next = fakeNext();

      await controller.getAccounts(fakeReq(), fakeRes(), next);

      expect(next).toHaveBeenCalledWith(error);
    });
  });

  describe('getAccountById', () => {
    it('responde 200 con la cuenta', async () => {
      mocked.getAccountById.mockResolvedValue({ id: 'acc-1' });
      const req = fakeReq({ params: { id: 'acc-1' } });
      const res = fakeRes();

      await controller.getAccountById(req, res, fakeNext());

      expect(mocked.getAccountById).toHaveBeenCalledWith('acc-1', 'user-1');
      expect(res.json).toHaveBeenCalledWith({ id: 'acc-1' });
    });

    it('Cuenta no encontrada -> 404', async () => {
      mocked.getAccountById.mockRejectedValue(new Error('Cuenta no encontrada'));
      const req = fakeReq({ params: { id: 'acc-1' } });
      const res = fakeRes();

      await controller.getAccountById(req, res, fakeNext());

      expect(res.status).toHaveBeenCalledWith(404);
      expect(res.json).toHaveBeenCalledWith({ error: 'Cuenta no encontrada' });
    });

    it('error no mapeado cae en next', async () => {
      const error = new Error('otro error');
      mocked.getAccountById.mockRejectedValue(error);
      const next = fakeNext();

      await controller.getAccountById(fakeReq({ params: { id: 'acc-1' } }), fakeRes(), next);

      expect(next).toHaveBeenCalledWith(error);
    });
  });

  describe('createAccount', () => {
    it('parsea el body y responde 201', async () => {
      mocked.createAccount.mockResolvedValue({ id: 'acc-1' });
      const req = fakeReq({ body: { name: 'Efectivo', type: 'cash' } });
      const res = fakeRes();

      await controller.createAccount(req, res, fakeNext());

      expect(mocked.createAccount).toHaveBeenCalledWith(
        expect.objectContaining({ name: 'Efectivo', type: 'cash' }),
        'user-1'
      );
      expect(res.status).toHaveBeenCalledWith(201);
      expect(res.json).toHaveBeenCalledWith({ id: 'acc-1' });
    });

    it('body inválido: zod lanza y cae en next, sin llamar al service', async () => {
      const next = fakeNext();
      const req = fakeReq({ body: { type: 'cash' } }); // falta name

      await controller.createAccount(req, fakeRes(), next);

      expect(mocked.createAccount).not.toHaveBeenCalled();
      expect(next).toHaveBeenCalled();
    });
  });

  describe('updateAccount', () => {
    it('responde 200 con la cuenta actualizada', async () => {
      mocked.updateAccount.mockResolvedValue({ id: 'acc-1', name: 'Nueva' });
      const req = fakeReq({ params: { id: 'acc-1' }, body: { name: 'Nueva' } });
      const res = fakeRes();

      await controller.updateAccount(req, res, fakeNext());

      expect(mocked.updateAccount).toHaveBeenCalledWith(
        'acc-1',
        expect.objectContaining({ name: 'Nueva' }),
        'user-1'
      );
      expect(res.json).toHaveBeenCalledWith({ id: 'acc-1', name: 'Nueva' });
    });

    it('Cuenta no encontrada -> 404', async () => {
      mocked.updateAccount.mockRejectedValue(new Error('Cuenta no encontrada'));
      const req = fakeReq({ params: { id: 'acc-1' }, body: {} });
      const res = fakeRes();

      await controller.updateAccount(req, res, fakeNext());

      expect(res.status).toHaveBeenCalledWith(404);
    });
  });

  describe('deleteAccount', () => {
    it('responde 204 sin body', async () => {
      mocked.deleteAccount.mockResolvedValue(undefined);
      const req = fakeReq({ params: { id: 'acc-1' } });
      const res = fakeRes();

      await controller.deleteAccount(req, res, fakeNext());

      expect(mocked.deleteAccount).toHaveBeenCalledWith('acc-1', 'user-1');
      expect(res.status).toHaveBeenCalledWith(204);
      expect(res.send).toHaveBeenCalled();
    });

    it('Cuenta no encontrada -> 404', async () => {
      mocked.deleteAccount.mockRejectedValue(new Error('Cuenta no encontrada'));
      const req = fakeReq({ params: { id: 'acc-1' } });
      const res = fakeRes();

      await controller.deleteAccount(req, res, fakeNext());

      expect(res.status).toHaveBeenCalledWith(404);
    });
  });

  describe('transferFunds', () => {
    const validBody = {
      fromAccountId: '11111111-1111-1111-1111-111111111111',
      toAccountId: '22222222-2222-2222-2222-222222222222',
      amount: 10,
    };

    it('responde 201 con la transferencia', async () => {
      mocked.transferFunds.mockResolvedValue({ id: 'transfer-1' });
      const req = fakeReq({ body: validBody });
      const res = fakeRes();

      await controller.transferFunds(req, res, fakeNext());

      expect(mocked.transferFunds).toHaveBeenCalledWith(
        expect.objectContaining(validBody),
        'user-1'
      );
      expect(res.status).toHaveBeenCalledWith(201);
    });

    it.each([
      'Las cuentas de origen y destino deben ser diferentes',
      'Cuenta origen no encontrada',
      'Cuenta destino no encontrada',
      'Saldo insuficiente en la cuenta origen',
    ])('%s -> 400', async (message) => {
      mocked.transferFunds.mockRejectedValue(new Error(message));
      const req = fakeReq({ body: validBody });
      const res = fakeRes();

      await controller.transferFunds(req, res, fakeNext());

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({ error: message });
    });

    it('error no mapeado cae en next', async () => {
      const error = new Error('fallo de base de datos');
      mocked.transferFunds.mockRejectedValue(error);
      const next = fakeNext();

      await controller.transferFunds(fakeReq({ body: validBody }), fakeRes(), next);

      expect(next).toHaveBeenCalledWith(error);
    });
  });

  describe('getTransfersByAccount', () => {
    it('responde 200 con las transferencias', async () => {
      mocked.getTransfersByAccount.mockResolvedValue([{ id: 'transfer-1' }]);
      const req = fakeReq({ params: { id: 'acc-1' } });
      const res = fakeRes();

      await controller.getTransfersByAccount(req, res, fakeNext());

      expect(mocked.getTransfersByAccount).toHaveBeenCalledWith('acc-1', 'user-1');
      expect(res.json).toHaveBeenCalledWith([{ id: 'transfer-1' }]);
    });

    it('Cuenta no encontrada -> 404', async () => {
      mocked.getTransfersByAccount.mockRejectedValue(new Error('Cuenta no encontrada'));
      const req = fakeReq({ params: { id: 'acc-1' } });
      const res = fakeRes();

      await controller.getTransfersByAccount(req, res, fakeNext());

      expect(res.status).toHaveBeenCalledWith(404);
    });
  });
});
