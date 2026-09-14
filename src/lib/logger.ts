import pino from 'pino';
import { AppError } from './errors.js';

export const logger = pino({
  level: process.env.LOG_LEVEL ?? 'info',
  formatters: {
    level: (label) => ({ level: label }),
  },
  transport:
    process.env.NODE_ENV === 'production'
      ? undefined
      : { target: 'pino-pretty', options: { colorize: true, translateTime: 'HH:MM:ss.l' } },
});

export function createLogger(moduleName: string) {
  const child = logger.child({ module: moduleName });

  function interpolate(template: string, args: unknown[]): string {
    const values = [...args];
    return `[${moduleName}]: ${template.replace(/\{\}/g, () => String(values.shift() ?? '{}'))}`;
  }

  const info = (template: string, ...args: unknown[]): void => {
    child.info(interpolate(template, args));
  };
  const warn = (template: string, ...args: unknown[]): void => {
    child.warn(interpolate(template, args));
  };
  const error = (err: unknown, template: string, ...args: unknown[]): void => {
    child.error({ err }, interpolate(template, args));
  };

  /**
   * Loguea el fallo de una operacion y relanza el error tal cual llego,
   * sin modificarlo. Nivel warn (sin stack) para AppError esperado por el
   * negocio, error (con stack) para cualquier otro fallo no controlado.
   */
  function fail(err: unknown, template: string, ...args: unknown[]): never {
    if (err instanceof AppError) {
      warn(template, ...args);
    } else {
      error(err, template, ...args);
    }
    throw err;
  }

  return { info, warn, error, fail };
}
