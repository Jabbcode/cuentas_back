import { describe, it, expect, vi, afterEach } from 'vitest';
import type { Response } from 'express';
import { z } from 'zod';
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

  describe('log de errores fuera de production', () => {
    afterEach(() => {
      vi.restoreAllMocks();
    });

    it('loguea el error cuando NODE_ENV no es production', () => {
      const originalEnv = process.env.NODE_ENV;
      process.env.NODE_ENV = 'test';
      const spy = vi.spyOn(console, 'error').mockImplementation(() => undefined);
      try {
        errorMiddleware(new Error('boom'), {} as never, fakeResponse(), vi.fn());
        expect(spy).toHaveBeenCalledWith('Error:', expect.any(Error));
      } finally {
        process.env.NODE_ENV = originalEnv;
      }
    });

    it('no loguea el error en production', () => {
      const originalEnv = process.env.NODE_ENV;
      process.env.NODE_ENV = 'production';
      const spy = vi.spyOn(console, 'error').mockImplementation(() => undefined);
      try {
        errorMiddleware(new Error('boom'), {} as never, fakeResponse(), vi.fn());
        expect(spy).not.toHaveBeenCalled();
      } finally {
        process.env.NODE_ENV = originalEnv;
      }
    });
  });
});
