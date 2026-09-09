import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { Response } from 'express';

const { mockedVerify } = vi.hoisted(() => ({
  mockedVerify: vi.fn(),
}));

vi.mock('jsonwebtoken', () => ({
  default: { verify: mockedVerify },
}));

import { authMiddleware } from '../auth.middleware.js';
import type { AuthRequest } from '../../types/index.js';

function fakeRequest(cookies: Record<string, string> = {}): AuthRequest {
  return { cookies } as unknown as AuthRequest;
}

function fakeResponse(): Response {
  const res: Partial<Response> = {};
  res.status = vi.fn().mockReturnValue(res);
  res.json = vi.fn().mockReturnValue(res);
  return res as Response;
}

describe('authMiddleware', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('sin cookie token: responde 401 "Token no proporcionado" y no llama a next', () => {
    const req = fakeRequest();
    const res = fakeResponse();
    const next = vi.fn();

    authMiddleware(req, res, next);

    expect(res.status).toHaveBeenCalledWith(401);
    expect(res.json).toHaveBeenCalledWith({ error: 'Token no proporcionado' });
    expect(next).not.toHaveBeenCalled();
    expect(mockedVerify).not.toHaveBeenCalled();
  });

  it('token inválido (jwt.verify lanza): responde 401 "Token inválido" y no llama a next', () => {
    mockedVerify.mockImplementation(() => {
      throw new Error('invalid signature');
    });
    const req = fakeRequest({ token: 'un-token-cualquiera' });
    const res = fakeResponse();
    const next = vi.fn();

    authMiddleware(req, res, next);

    expect(res.status).toHaveBeenCalledWith(401);
    expect(res.json).toHaveBeenCalledWith({ error: 'Token inválido' });
    expect(next).not.toHaveBeenCalled();
  });

  it('token válido: setea req.user con el payload decodificado y llama a next() sin tocar res', () => {
    const payload = { userId: 'user-1', email: 'user@example.com' };
    mockedVerify.mockReturnValue(payload);
    const req = fakeRequest({ token: 'un-token-valido' });
    const res = fakeResponse();
    const next = vi.fn();

    authMiddleware(req, res, next);

    expect(req.user).toEqual(payload);
    expect(next).toHaveBeenCalledTimes(1);
    expect(res.status).not.toHaveBeenCalled();
    expect(res.json).not.toHaveBeenCalled();
  });
});
