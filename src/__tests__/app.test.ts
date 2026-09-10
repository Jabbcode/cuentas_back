import { describe, it, expect } from 'vitest';
import type { Response } from 'express';
import app from '../app.js';

interface RouteLayer {
  route?: { path: string; methods: Record<string, boolean> };
  handle?: (req: unknown, res: unknown, next: unknown) => unknown;
  name: string;
  regexp: RegExp;
}

function getStack(): RouteLayer[] {
  return (app as unknown as { _router: { stack: RouteLayer[] } })._router.stack;
}

function fakeRes(): Response {
  const res: Partial<Response> = {};
  res.json = ((body: unknown) => {
    (res as unknown as { body: unknown }).body = body;
    return res as Response;
  }) as Response['json'];
  return res as Response;
}

describe('app', () => {
  it('registra los middlewares globales antes de las rutas', () => {
    const names = getStack().map((l) => l.name);

    expect(names).toContain('helmetMiddleware');
    expect(names).toContain('corsMiddleware');
    expect(names).toContain('cookieParser');
    expect(names).toContain('jsonParser');
  });

  it('monta cada router de dominio bajo su prefijo /api/*', () => {
    const mounted = getStack()
      .filter((l) => l.name === 'router')
      .map((l) => l.regexp.source);

    for (const prefix of [
      'auth',
      'accounts',
      'categories',
      'transactions',
      'fixed-expenses',
      'dashboard',
      'credit-cards',
      'debts',
      'recurring-debt-payments',
      'receipts',
      'settings',
      'notifications',
      'version',
      'monitoring',
    ]) {
      expect(mounted.some((r) => r.includes(prefix))).toBe(true);
    }
  });

  it('registra el error middleware al final de la pila', () => {
    const stack = getStack();
    const lastNamed = stack.filter((l) => l.name !== 'query' && l.name !== 'expressInit');
    expect(lastNamed[lastNamed.length - 1].handle?.length).toBe(4); // (err, req, res, next)
  });

  it('GET /api/health responde { status: "ok" } con un timestamp ISO', () => {
    const healthLayer = getStack().find(
      (l) => l.route?.path === '/api/health' && l.route.methods.get
    );
    expect(healthLayer).toBeDefined();

    const res = fakeRes();
    const handler = healthLayer!.route!.stack?.[0]?.handle ?? healthLayer!.handle;
    (handler as (req: unknown, res: unknown) => void)({}, res);

    const body = (res as unknown as { body: { status: string; timestamp: string } }).body;
    expect(body.status).toBe('ok');
    expect(() => new Date(body.timestamp).toISOString()).not.toThrow();
  });
});
