import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import type { Request } from 'express';
import { fakeRes, fakeNext } from './http-fakes.js';
import { sentryTunnel } from '../monitoring.controller.js';

function envelope(dsn: string | undefined): string {
  const header = dsn ? { dsn } : {};
  return `${JSON.stringify(header)}\n{"type":"event"}\n{}`;
}

function fakeMonitoringReq(body: string): Request {
  return { body } as unknown as Request;
}

describe('monitoring.controller.sentryTunnel', () => {
  const originalFetch = global.fetch;

  beforeEach(() => {
    vi.clearAllMocks();
    global.fetch = vi.fn().mockResolvedValue({ status: 200 });
  });

  afterEach(() => {
    global.fetch = originalFetch;
  });

  it('sin DSN en el header -> 400, sin llamar a fetch', async () => {
    const res = fakeRes();

    await sentryTunnel(fakeMonitoringReq(envelope(undefined)), res, fakeNext());

    expect(res.status).toHaveBeenCalledWith(400);
    expect(global.fetch).not.toHaveBeenCalled();
  });

  it('host de Sentry válido: reenvía el envelope y responde con el status upstream', async () => {
    const res = fakeRes();
    (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValue({ status: 200 });

    await sentryTunnel(
      fakeMonitoringReq(envelope('https://abc@ingest.sentry.io/12345')),
      res,
      fakeNext()
    );

    expect(global.fetch).toHaveBeenCalledWith(
      'https://ingest.sentry.io/api/12345/envelope/',
      expect.objectContaining({ method: 'POST' })
    );
    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.end).toHaveBeenCalled();
  });

  it('subdominio de un host permitido también es válido', async () => {
    const res = fakeRes();

    await sentryTunnel(
      fakeMonitoringReq(envelope('https://abc@myorg.ingest.us.sentry.io/999')),
      res,
      fakeNext()
    );

    expect(global.fetch).toHaveBeenCalled();
    expect(res.status).not.toHaveBeenCalledWith(403);
  });

  it('host fuera de la allowlist -> 403, sin llamar a fetch', async () => {
    const res = fakeRes();

    await sentryTunnel(
      fakeMonitoringReq(envelope('https://abc@evil.example.com/12345')),
      res,
      fakeNext()
    );

    expect(res.status).toHaveBeenCalledWith(403);
    expect(global.fetch).not.toHaveBeenCalled();
  });

  it('un DSN malformado (URL inválida) cae en next', async () => {
    const next = fakeNext();

    await sentryTunnel(fakeMonitoringReq(envelope('no-es-una-url')), fakeRes(), next);

    expect(next).toHaveBeenCalled();
  });

  it('body no parseable como JSON cae en next', async () => {
    const next = fakeNext();

    await sentryTunnel(fakeMonitoringReq('esto no es json\n{}'), fakeRes(), next);

    expect(next).toHaveBeenCalled();
  });
});
