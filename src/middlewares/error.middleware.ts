import { Request, Response, NextFunction } from 'express';
import { ZodError } from 'zod';
import { AppError } from '../lib/errors.js';
import { createLogger, isExpectedAppError } from '../lib/logger.js';

const logger = createLogger('HTTP');

export function errorMiddleware(err: Error, req: Request, res: Response, _next: NextFunction) {
  if (err instanceof ZodError) {
    logger.warn('Validación fallida en {} {}', req.method, req.originalUrl);
    res.status(400).json({
      error: 'Datos inválidos',
      details: err.errors.map((e) => ({
        field: e.path.join('.'),
        message: e.message,
      })),
    });
    return;
  }

  if (err instanceof AppError) {
    if (isExpectedAppError(err)) {
      logger.warn('{} {} -> {} ({})', req.method, req.originalUrl, err.statusCode, err.code);
    } else {
      logger.error(err, '{} {} -> {} ({})', req.method, req.originalUrl, err.statusCode, err.code);
    }
    res.status(err.statusCode).json({
      error: err.message,
      code: err.code,
    });
    return;
  }

  logger.error(err, 'Error no controlado en {} {}', req.method, req.originalUrl);

  res.status(500).json({
    error: 'Error interno del servidor',
    message: process.env.NODE_ENV === 'development' ? err.message : undefined,
  });
}
