import { describe, it, expect, vi } from 'vitest';
import type { Response } from 'express';
import { errorMiddleware } from '../error.middleware.js';
import { ConflictError, ValidationError } from '../../lib/errors.js';

function fakeResponse(): Response {
  const res: Partial<Response> = {};
  res.status = vi.fn().mockReturnValue(res);
  res.json = vi.fn().mockReturnValue(res);
  return res as Response;
}

describe('errorMiddleware — contrato de error consumible por el frontend (BE-T4)', () => {
  it('ConflictError (límite superado) responde 409 con { error, code }', () => {
    const res = fakeResponse();
    const err = new ConflictError('Se superó el límite disponible de la tarjeta');

    errorMiddleware(err, {} as never, res, vi.fn());

    expect(res.status).toHaveBeenCalledWith(409);
    expect(res.json).toHaveBeenCalledWith({
      error: 'Se superó el límite disponible de la tarjeta',
      code: 'CONFLICT',
    });
  });

  it('ValidationError (falta límite) responde 422 con { error, code }', () => {
    const res = fakeResponse();
    const err = new ValidationError('La tarjeta no tiene configurado un límite de crédito');

    errorMiddleware(err, {} as never, res, vi.fn());

    expect(res.status).toHaveBeenCalledWith(422);
    expect(res.json).toHaveBeenCalledWith({
      error: 'La tarjeta no tiene configurado un límite de crédito',
      code: 'VALIDATION_ERROR',
    });
  });
});
