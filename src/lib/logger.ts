import pino from 'pino';
import { AppError } from './errors.js';

/**
 * Un AppError de 4xx es un fallo de negocio esperado (no encontrado, conflicto,
 * validacion) — se loguea como warn sin stack. Un AppError de 5xx (ej. fallo de
 * un servicio externo) es tan inesperado como un error no tipado.
 */
export function isExpectedAppError(err: unknown): boolean {
  return err instanceof AppError && err.statusCode < 500;
}

/**
 * Allowlist explicito en vez del serializer `err` por defecto de pino, que
 * copia todas las propiedades propias enumerables del error — en errores de
 * Prisma (PrismaClientKnownRequestError.meta, args de la query) eso puede
 * arrastrar datos sensibles (ej. password hash) hasta el log.
 */
function errSerializer(err: unknown): unknown {
  if (!(err instanceof Error)) return err;
  const serialized: Record<string, unknown> = {
    type: err.name,
    message: err.message,
    stack: err.stack,
  };
  if (err instanceof AppError) {
    serialized.code = err.code;
    serialized.statusCode = err.statusCode;
  }
  return serialized;
}

export const logger = pino({
  level: process.env.LOG_LEVEL ?? 'info',
  formatters: {
    level: (label) => ({ level: label }),
  },
  serializers: {
    err: errSerializer,
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
    if (isExpectedAppError(err)) {
      warn(template, ...args);
    } else {
      error(err, template, ...args);
    }
    throw err;
  }

  return { info, warn, error, fail };
}
