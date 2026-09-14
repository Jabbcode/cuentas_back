import type { NextFunction, Request, Response } from 'express';

const DEFAULT_ENVIRONMENT = 'development';
const UNKNOWN_VERSION = 'unknown';

export async function getVersion(_req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const version = process.env.APP_VERSION ?? process.env.npm_package_version ?? UNKNOWN_VERSION;
    const environment = process.env.APP_ENV ?? DEFAULT_ENVIRONMENT;

    res.json({ version, environment });
  } catch (error) {
    next(error);
  }
}
