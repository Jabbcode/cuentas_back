import { describe, it, expect, vi, beforeEach } from 'vitest';
import { fakeReq, fakeRes, fakeNext } from './http-fakes.js';

const mocked = vi.hoisted(() => ({
  getUserProfile: vi.fn(),
  updateUserProfile: vi.fn(),
  changePassword: vi.fn(),
  deleteUserAccount: vi.fn(),
  getAccountStatistics: vi.fn(),
}));

vi.mock('../../bootstrap.js', () => ({ settingsService: mocked }));

import * as controller from '../settings.controller.js';

describe('settings.controller', () => {
  beforeEach(() => vi.clearAllMocks());

  describe('getProfile', () => {
    it('responde 200 con el perfil', async () => {
      mocked.getUserProfile.mockResolvedValue({ id: 'user-1', email: 'user@test.com' });
      const res = fakeRes();

      await controller.getProfile(fakeReq(), res, fakeNext());

      expect(mocked.getUserProfile).toHaveBeenCalledWith('user-1');
      expect(res.json).toHaveBeenCalledWith({ id: 'user-1', email: 'user@test.com' });
    });

    it('error cae en next', async () => {
      const error = new Error('Usuario no encontrado');
      mocked.getUserProfile.mockRejectedValue(error);
      const next = fakeNext();

      await controller.getProfile(fakeReq(), fakeRes(), next);

      expect(next).toHaveBeenCalledWith(error);
    });
  });

  describe('updateProfile', () => {
    it('envuelve el perfil actualizado con un mensaje de confirmación', async () => {
      mocked.updateUserProfile.mockResolvedValue({ id: 'user-1', name: 'Nuevo' });
      const req = fakeReq({ body: { name: 'Nuevo' } });
      const res = fakeRes();

      await controller.updateProfile(req, res, fakeNext());

      expect(mocked.updateUserProfile).toHaveBeenCalledWith('user-1', { name: 'Nuevo' });
      expect(res.json).toHaveBeenCalledWith({
        profile: { id: 'user-1', name: 'Nuevo' },
        message: 'Profile updated successfully',
      });
    });

    it('body inválido cae en next', async () => {
      const next = fakeNext();

      await controller.updateProfile(fakeReq({ body: { email: 'no-es-email' } }), fakeRes(), next);

      expect(mocked.updateUserProfile).not.toHaveBeenCalled();
      expect(next).toHaveBeenCalled();
    });
  });

  describe('changePassword', () => {
    it('responde con el resultado del service', async () => {
      mocked.changePassword.mockResolvedValue({ message: 'Password changed successfully' });
      const req = fakeReq({
        body: { currentPassword: 'old123', newPassword: 'new123', confirmPassword: 'new123' },
      });
      const res = fakeRes();

      await controller.changePassword(req, res, fakeNext());

      expect(mocked.changePassword).toHaveBeenCalledWith(
        'user-1',
        expect.objectContaining({ currentPassword: 'old123', newPassword: 'new123' })
      );
      expect(res.json).toHaveBeenCalledWith({ message: 'Password changed successfully' });
    });

    it('newPassword y confirmPassword distintos: cae en next (falla el refine de zod)', async () => {
      const next = fakeNext();
      const req = fakeReq({
        body: { currentPassword: 'old123', newPassword: 'new123', confirmPassword: 'otro456' },
      });

      await controller.changePassword(req, fakeRes(), next);

      expect(mocked.changePassword).not.toHaveBeenCalled();
      expect(next).toHaveBeenCalled();
    });
  });

  describe('deleteAccount', () => {
    it('requiere confirmation:"DELETE" y responde con el resultado', async () => {
      mocked.deleteUserAccount.mockResolvedValue({ message: 'Account deleted successfully' });
      const req = fakeReq({ body: { password: 'password123', confirmation: 'DELETE' } });
      const res = fakeRes();

      await controller.deleteAccount(req, res, fakeNext());

      expect(mocked.deleteUserAccount).toHaveBeenCalledWith('user-1', 'password123');
      expect(res.json).toHaveBeenCalledWith({ message: 'Account deleted successfully' });
    });

    it('confirmation distinto de "DELETE" cae en next sin llamar al service', async () => {
      const next = fakeNext();
      const req = fakeReq({ body: { password: 'password123', confirmation: 'borrar' } });

      await controller.deleteAccount(req, fakeRes(), next);

      expect(mocked.deleteUserAccount).not.toHaveBeenCalled();
      expect(next).toHaveBeenCalled();
    });
  });

  describe('getStatistics', () => {
    it('responde 200 con las estadísticas', async () => {
      mocked.getAccountStatistics.mockResolvedValue({ accounts: 2 });
      const res = fakeRes();

      await controller.getStatistics(fakeReq(), res, fakeNext());

      expect(mocked.getAccountStatistics).toHaveBeenCalledWith('user-1');
      expect(res.json).toHaveBeenCalledWith({ accounts: 2 });
    });
  });
});
