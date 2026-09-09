import { describe, it, expect, vi, beforeEach } from 'vitest';
import { fakeReq, fakeRes, fakeNext } from './http-fakes.js';

const mocked = vi.hoisted(() => ({
  getNotifications: vi.fn(),
  getUnreadCount: vi.fn(),
  markAsRead: vi.fn(),
  markAllAsRead: vi.fn(),
  deleteNotification: vi.fn(),
  getPreferences: vi.fn(),
  updatePreferences: vi.fn(),
  getUserContactInfo: vi.fn(),
  buildMonthlySummary: vi.fn(),
}));

const mockedSendMonthlySummaryEmail = vi.hoisted(() => vi.fn());

vi.mock('../../bootstrap.js', () => ({ notificationsService: mocked }));
vi.mock('../../lib/email/index.js', () => ({
  sendMonthlySummaryEmail: mockedSendMonthlySummaryEmail,
}));

import * as controller from '../notifications.controller.js';

describe('notifications.controller', () => {
  beforeEach(() => vi.clearAllMocks());

  describe('getNotifications', () => {
    it('combina lista + conteo de no leídas en un solo body', async () => {
      mocked.getNotifications.mockResolvedValue([{ id: 'n-1' }]);
      mocked.getUnreadCount.mockResolvedValue(1);
      const res = fakeRes();

      await controller.getNotifications(fakeReq(), res, fakeNext());

      expect(mocked.getNotifications).toHaveBeenCalledWith('user-1');
      expect(mocked.getUnreadCount).toHaveBeenCalledWith('user-1');
      expect(res.json).toHaveBeenCalledWith({ notifications: [{ id: 'n-1' }], unreadCount: 1 });
    });
  });

  describe('markAsRead', () => {
    it('responde 200 con la notificación', async () => {
      mocked.markAsRead.mockResolvedValue({ id: 'n-1', read: true });
      const res = fakeRes();

      await controller.markAsRead(fakeReq({ params: { id: 'n-1' } }), res, fakeNext());

      expect(mocked.markAsRead).toHaveBeenCalledWith('n-1', 'user-1');
      expect(res.json).toHaveBeenCalledWith({ id: 'n-1', read: true });
    });

    it('Notificación no encontrada -> 404', async () => {
      mocked.markAsRead.mockRejectedValue(new Error('Notificación no encontrada'));
      const res = fakeRes();

      await controller.markAsRead(fakeReq({ params: { id: 'n-1' } }), res, fakeNext());

      expect(res.status).toHaveBeenCalledWith(404);
    });
  });

  describe('markAllAsRead', () => {
    it('responde con el mensaje de confirmación', async () => {
      mocked.markAllAsRead.mockResolvedValue(undefined);
      const res = fakeRes();

      await controller.markAllAsRead(fakeReq(), res, fakeNext());

      expect(mocked.markAllAsRead).toHaveBeenCalledWith('user-1');
      expect(res.json).toHaveBeenCalledWith({
        message: 'Todas las notificaciones marcadas como leídas',
      });
    });
  });

  describe('deleteNotification', () => {
    it('responde 204', async () => {
      mocked.deleteNotification.mockResolvedValue(undefined);
      const res = fakeRes();

      await controller.deleteNotification(fakeReq({ params: { id: 'n-1' } }), res, fakeNext());

      expect(res.status).toHaveBeenCalledWith(204);
    });

    it('Notificación no encontrada -> 404', async () => {
      mocked.deleteNotification.mockRejectedValue(new Error('Notificación no encontrada'));
      const res = fakeRes();

      await controller.deleteNotification(fakeReq({ params: { id: 'n-1' } }), res, fakeNext());

      expect(res.status).toHaveBeenCalledWith(404);
    });
  });

  describe('getPreferences', () => {
    it('responde 200', async () => {
      mocked.getPreferences.mockResolvedValue({ categoryLimit: true });
      const res = fakeRes();

      await controller.getPreferences(fakeReq(), res, fakeNext());

      expect(res.json).toHaveBeenCalledWith({ categoryLimit: true });
    });
  });

  describe('updatePreferences', () => {
    it('parsea el body parcial y responde 200', async () => {
      mocked.updatePreferences.mockResolvedValue({ categoryLimit: false });
      const req = fakeReq({ body: { categoryLimit: false } });
      const res = fakeRes();

      await controller.updatePreferences(req, res, fakeNext());

      expect(mocked.updatePreferences).toHaveBeenCalledWith('user-1', { categoryLimit: false });
      expect(res.json).toHaveBeenCalledWith({ categoryLimit: false });
    });

    it('body con tipo inválido cae en next', async () => {
      const next = fakeNext();

      await controller.updatePreferences(
        fakeReq({ body: { categoryLimit: 'no-es-boolean' } }),
        fakeRes(),
        next
      );

      expect(mocked.updatePreferences).not.toHaveBeenCalled();
      expect(next).toHaveBeenCalled();
    });
  });

  describe('sendTestEmail', () => {
    it('usuario no encontrado -> 404, sin construir el resumen ni enviar email', async () => {
      mocked.getUserContactInfo.mockResolvedValue(null);
      const res = fakeRes();

      await controller.sendTestEmail(fakeReq(), res, fakeNext());

      expect(res.status).toHaveBeenCalledWith(404);
      expect(mocked.buildMonthlySummary).not.toHaveBeenCalled();
      expect(mockedSendMonthlySummaryEmail).not.toHaveBeenCalled();
    });

    it('usuario existente: construye el resumen y envía el email', async () => {
      mocked.getUserContactInfo.mockResolvedValue({ email: 'user@test.com', name: 'Usuario' });
      mocked.buildMonthlySummary.mockResolvedValue({ totalExpenses: 100 });
      mockedSendMonthlySummaryEmail.mockResolvedValue(undefined);
      const res = fakeRes();

      await controller.sendTestEmail(fakeReq(), res, fakeNext());

      expect(mockedSendMonthlySummaryEmail).toHaveBeenCalledWith(
        expect.objectContaining({ to: 'user@test.com', userName: 'Usuario', totalExpenses: 100 })
      );
      expect(res.json).toHaveBeenCalledWith({ message: 'Email enviado a user@test.com' });
    });

    it('error inesperado cae en next', async () => {
      const error = new Error('boom');
      mocked.getUserContactInfo.mockRejectedValue(error);
      const next = fakeNext();

      await controller.sendTestEmail(fakeReq(), fakeRes(), next);

      expect(next).toHaveBeenCalledWith(error);
    });
  });
});
