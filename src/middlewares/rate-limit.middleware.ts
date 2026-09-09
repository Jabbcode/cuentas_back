import rateLimit from 'express-rate-limit';

export const authRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutos
  limit: 10, // 10 intentos por IP por ventana
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  message: { error: 'Demasiados intentos. Inténtalo de nuevo en unos minutos.' },
  // La suite E2E (Playwright) corre decenas de register/login por IP en una sola
  // ventana de 15min contra el mismo server — desactivar el límite solo en NODE_ENV=test.
  skip: () => process.env.NODE_ENV === 'test',
});
