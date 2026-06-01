import type { NextFunction, Request, Response } from 'express';

const SENTRY_INGEST_HOSTS = [
  'sentry.io',
  'ingest.sentry.io',
  'ingest.de.sentry.io',
  'ingest.us.sentry.io',
];

export async function sentryTunnel(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const envelope = req.body as string;
    const firstLine = envelope.split('\n')[0];
    const header = JSON.parse(firstLine) as { dsn?: string };

    if (!header.dsn) {
      res.status(400).json({ error: 'Missing DSN in envelope header' });
      return;
    }

    const dsn = new URL(header.dsn);

    // Only allow requests to known Sentry ingest hosts
    const isSentryHost = SENTRY_INGEST_HOSTS.some(
      (host) => dsn.hostname === host || dsn.hostname.endsWith(`.${host}`)
    );
    if (!isSentryHost) {
      res.status(403).json({ error: 'Invalid DSN host' });
      return;
    }

    const projectId = dsn.pathname.replace(/^\//, '');
    const sentryUrl = `https://${dsn.hostname}/api/${projectId}/envelope/`;

    const response = await fetch(sentryUrl, {
      method: 'POST',
      body: envelope,
      headers: { 'Content-Type': 'application/x-sentry-envelope' },
    });

    res.status(response.status).end();
  } catch (error) {
    next(error);
  }
}
