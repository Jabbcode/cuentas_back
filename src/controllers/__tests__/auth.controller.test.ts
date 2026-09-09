import { describe, it, expect, vi, beforeEach } from 'vitest';
import { fakeReq, fakeRes, fakeNext } from './http-fakes.js';

const mocked = vi.hoisted(() => ({
  register: vi.fn(),
  login: vi.fn(),
  getMe: vi.fn(),
}));

vi.mock('../../bootstrap.js', () => ({ authService: mocked }));

import * as controller from '../auth.controller.js';

describe('auth.controller', () => {
  beforeEach(() => vi.clearAllMocks());

  describe('register', () => {
    const validBody = { email: 'user@test.com', password: 'password123', name: 'Usuario' };

    it('registra y setea la cookie con el token', async () => {
      mocked.register.mockResolvedValue({ user: { id: 'user-1' }, token: 'jwt-token' });
      const req = fakeReq({ body: validBody });
      const res = fakeRes();

      await controller.register(req, res, fakeNext());

      expect(mocked.register).toHaveBeenCalledWith(expect.objectContaining(validBody));
      expect(res.cookie).toHaveBeenCalledWith('token', 'jwt-token', expect.any(Object));
      expect(res.status).toHaveBeenCalledWith(201);
      expect(res.json).toHaveBeenCalledWith({ user: { id: 'user-1' } });
    });

    it('email ya registrado -> 400, sin cookie', async () => {
      mocked.register.mockRejectedValue(new Error('El email ya está registrado'));
      const req = fakeReq({ body: validBody });
      const res = fakeRes();

      await controller.register(req, res, fakeNext());

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.cookie).not.toHaveBeenCalled();
    });

    it('body inválido: cae en next sin llamar al service', async () => {
      const next = fakeNext();
      const req = fakeReq({ body: { email: 'no-es-email' } });

      await controller.register(req, fakeRes(), next);

      expect(mocked.register).not.toHaveBeenCalled();
      expect(next).toHaveBeenCalled();
    });

    it('error no mapeado cae en next', async () => {
      const error = new Error('db down');
      mocked.register.mockRejectedValue(error);
      const next = fakeNext();

      await controller.register(fakeReq({ body: validBody }), fakeRes(), next);

      expect(next).toHaveBeenCalledWith(error);
    });
  });

  describe('login', () => {
    const validBody = { email: 'user@test.com', password: 'password123' };

    it('login exitoso setea la cookie y responde con el usuario', async () => {
      mocked.login.mockResolvedValue({ user: { id: 'user-1' }, token: 'jwt-token' });
      const req = fakeReq({ body: validBody });
      const res = fakeRes();

      await controller.login(req, res, fakeNext());

      expect(res.cookie).toHaveBeenCalledWith('token', 'jwt-token', expect.any(Object));
      expect(res.json).toHaveBeenCalledWith({ user: { id: 'user-1' } });
    });

    it('credenciales inválidas -> 401', async () => {
      mocked.login.mockRejectedValue(new Error('Credenciales inválidas'));
      const req = fakeReq({ body: validBody });
      const res = fakeRes();

      await controller.login(req, res, fakeNext());

      expect(res.status).toHaveBeenCalledWith(401);
      expect(res.cookie).not.toHaveBeenCalled();
    });

    it('error no mapeado cae en next', async () => {
      const error = new Error('boom');
      mocked.login.mockRejectedValue(error);
      const next = fakeNext();

      await controller.login(fakeReq({ body: validBody }), fakeRes(), next);

      expect(next).toHaveBeenCalledWith(error);
    });
  });

  describe('logout', () => {
    it('limpia la cookie y responde con el mensaje de confirmación', async () => {
      const res = fakeRes();

      await controller.logout(fakeReq(), res);

      expect(res.clearCookie).toHaveBeenCalledWith('token', expect.any(Object));
      expect(res.json).toHaveBeenCalledWith({ message: 'Sesión cerrada' });
    });
  });

  describe('getMe', () => {
    it('responde con el usuario autenticado', async () => {
      mocked.getMe.mockResolvedValue({ id: 'user-1', email: 'user@test.com' });
      const res = fakeRes();

      await controller.getMe(fakeReq(), res, fakeNext());

      expect(mocked.getMe).toHaveBeenCalledWith('user-1');
      expect(res.json).toHaveBeenCalledWith({ id: 'user-1', email: 'user@test.com' });
    });

    it('error cae en next', async () => {
      const error = new Error('Usuario no encontrado');
      mocked.getMe.mockRejectedValue(error);
      const next = fakeNext();

      await controller.getMe(fakeReq(), fakeRes(), next);

      expect(next).toHaveBeenCalledWith(error);
    });
  });
});
