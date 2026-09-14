import pino from 'pino';

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

  return {
    info: (template: string, ...args: unknown[]): void => {
      child.info(interpolate(template, args));
    },
    warn: (template: string, ...args: unknown[]): void => {
      child.warn(interpolate(template, args));
    },
    error: (err: unknown, template: string, ...args: unknown[]): void => {
      child.error({ err }, interpolate(template, args));
    },
  };
}
