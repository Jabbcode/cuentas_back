import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { Response } from 'express';
import { z } from 'zod';
import { AppError, ConflictError, ValidationError } from '../../lib/errors.js';

const { mockLogger } = vi.hoisted(() => ({
  mockLogger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));

vi.mock('../../lib/logger.js', async () => {
  const actual = await import('../../lib/errors.js');
  return {
    createLogger: () => mockLogger,
    isExpectedAppError: (err: unknown) => err instanceof actual.AppError && err.statusCode < 500,
  };
});

const { errorMiddleware } = await import('../error.middleware.js');

function fakeResponse(): Response {
  const res: Partial<Response> = {};
  res.status = vi.fn().mockReturnValue(res);
  res.json = vi.fn().mockReturnValue(res);
  return res as Response;
}

describe('errorMiddleware — contrato de error consumible por el frontend (BE-T4)', () => {
  it('ConflictError (límite de período superado) responde 409 con { error, code }', () => {
    const res = fakeResponse();
    const err = new ConflictError(
      'Se superó el límite del período 2026-06-05 al 2026-07-04 (límite: 100)'
    );

    errorMiddleware(err, {} as never, res, vi.fn());

    expect(res.status).toHaveBeenCalledWith(409);
    expect(res.json).toHaveBeenCalledWith({
      error: 'Se superó el límite del período 2026-06-05 al 2026-07-04 (límite: 100)',
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

  it('ZodError responde 400 con { error: "Datos inválidos", details: [...] }', () => {
    const res = fakeResponse();
    const result = z.object({ name: z.string() }).safeParse({});
    const zodError = result.error!;

    errorMiddleware(zodError, {} as never, res, vi.fn());

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({
      error: 'Datos inválidos',
      details: [{ field: 'name', message: expect.any(String) }],
    });
  });

  it('error genérico responde 500 sin exponer el mensaje fuera de development', () => {
    const originalEnv = process.env.NODE_ENV;
    process.env.NODE_ENV = 'production';
    try {
      const res = fakeResponse();

      errorMiddleware(new Error('detalle interno sensible'), {} as never, res, vi.fn());

      expect(res.status).toHaveBeenCalledWith(500);
      expect(res.json).toHaveBeenCalledWith({
        error: 'Error interno del servidor',
        message: undefined,
      });
    } finally {
      process.env.NODE_ENV = originalEnv;
    }
  });

  it('error genérico en development expone el mensaje original', () => {
    const originalEnv = process.env.NODE_ENV;
    process.env.NODE_ENV = 'development';
    try {
      const res = fakeResponse();

      errorMiddleware(new Error('detalle interno'), {} as never, res, vi.fn());

      expect(res.json).toHaveBeenCalledWith({
        error: 'Error interno del servidor',
        message: 'detalle interno',
      });
    } finally {
      process.env.NODE_ENV = originalEnv;
    }
  });

  describe('logging estructurado — siempre se loguea, sin importar NODE_ENV', () => {
    beforeEach(() => {
      mockLogger.info.mockClear();
      mockLogger.warn.mockClear();
      mockLogger.error.mockClear();
    });

    it('loguea con nivel error un error no controlado, incluso en production', () => {
      const originalEnv = process.env.NODE_ENV;
      process.env.NODE_ENV = 'production';
      try {
        const err = new Error('boom');
        const req = { method: 'GET', originalUrl: '/api/accounts' };

        errorMiddleware(err, req as never, fakeResponse(), vi.fn());

        expect(mockLogger.error).toHaveBeenCalledWith(
          err,
          'Error no controlado en {} {}',
          'GET',
          '/api/accounts'
        );
      } finally {
        process.env.NODE_ENV = originalEnv;
      }
    });

    it('loguea con nivel warn (no error) un AppError esperado', () => {
      const req = { method: 'POST', originalUrl: '/api/debts' };

      errorMiddleware(new ConflictError('conflicto'), req as never, fakeResponse(), vi.fn());

      expect(mockLogger.warn).toHaveBeenCalledWith(
        '{} {} -> {} ({}): {}',
        'POST',
        '/api/debts',
        409,
        'CONFLICT',
        'conflicto'
      );
      expect(mockLogger.error).not.toHaveBeenCalled();
    });

    it('loguea con nivel warn (no error) un ZodError', () => {
      const req = { method: 'POST', originalUrl: '/api/accounts' };
      const result = z.object({ name: z.string() }).safeParse({});

      errorMiddleware(result.error!, req as never, fakeResponse(), vi.fn());

      expect(mockLogger.warn).toHaveBeenCalledWith(
        'Validación fallida en {} {}',
        'POST',
        '/api/accounts'
      );
      expect(mockLogger.error).not.toHaveBeenCalled();
    });

    it('loguea con nivel error (con stack) un AppError de 5xx, no warn', () => {
      const req = { method: 'POST', originalUrl: '/api/receipts' };
      const err = new AppError('Fallo de integracion OCR', 500, 'INTEGRATION_ERROR');

      errorMiddleware(err, req as never, fakeResponse(), vi.fn());

      expect(mockLogger.error).toHaveBeenCalledWith(
        err,
        '{} {} -> {} ({}): {}',
        'POST',
        '/api/receipts',
        500,
        'INTEGRATION_ERROR',
        'Fallo de integracion OCR'
      );
      expect(mockLogger.warn).not.toHaveBeenCalled();
    });
  });
});
