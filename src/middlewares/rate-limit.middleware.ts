import rateLimit from 'express-rate-limit';

export const authRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutos
  limit: 10, // 10 intentos por IP por ventana
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  message: { error: 'Demasiados intentos. Inténtalo de nuevo en unos minutos.' },
  // La suite E2E (Playwright) corre decenas de register/login por IP en una sola
  // ventana de 15min contra el mismo server. Usa un flag dedicado (DISABLE_RATE_LIMIT,
  // seteado solo en .env.test) en vez de NODE_ENV — NODE_ENV ya es una bandera de
  // confianza multiuso en este repo (CORS, stack traces, cookie secure), y si
  // NODE_ENV=test llegara a filtrarse a un entorno real, no queremos que también
  // desactive silenciosamente la protección contra brute-force.
  skip: () => process.env.DISABLE_RATE_LIMIT === 'true',
});
