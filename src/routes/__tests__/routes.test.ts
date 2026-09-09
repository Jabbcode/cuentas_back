import { describe, it, expect } from 'vitest';
import type { Router } from 'express';

import accountsRouter from '../accounts.routes.js';
import authRouter from '../auth.routes.js';
import categoriesRouter from '../categories.routes.js';
import creditCardsRouter from '../credit-cards.routes.js';
import dashboardRouter from '../dashboard.routes.js';
import debtsRouter from '../debts.routes.js';
import fixedExpensesRouter from '../fixed-expenses.routes.js';
import monitoringRouter from '../monitoring.routes.js';
import notificationsRouter from '../notifications.routes.js';
import receiptsRouter from '../receipts.routes.js';
import recurringDebtPaymentsRouter from '../recurring-debt-payments.routes.js';
import settingsRouter from '../settings.routes.js';
import transactionsRouter from '../transactions.routes.js';

interface RouteLayer {
  route?: {
    path: string;
    methods: Record<string, boolean>;
    stack: { name: string }[];
  };
  name: string;
}

function getStack(router: Router): RouteLayer[] {
  return (router as unknown as { stack: RouteLayer[] }).stack;
}

function routeLayers(router: Router): RouteLayer[] {
  return getStack(router).filter((l) => l.route);
}

function handlerNames(layer: RouteLayer): string[] {
  return layer.route!.stack.map((s) => s.name);
}

function findRoute(router: Router, method: string, path: string): RouteLayer | undefined {
  return routeLayers(router).find(
    (l) => l.route!.path === path && l.route!.methods[method] === true
  );
}

/**
 * Todos estos routers siguen el mismo patrón: `router.use(authMiddleware)`
 * al inicio, seguido de rutas planas `router.<method>(path, controllerFn)`.
 */
const AUTH_GUARDED_ROUTERS: { name: string; router: Router; routes: [string, string][] }[] = [
  {
    name: 'accounts',
    router: accountsRouter,
    routes: [
      ['get', '/'],
      ['post', '/'],
      ['post', '/transfer'],
      ['get', '/:id'],
      ['get', '/:id/transfers'],
      ['patch', '/:id'],
      ['delete', '/:id'],
    ],
  },
  {
    name: 'categories',
    router: categoriesRouter,
    routes: [
      ['get', '/'],
      ['post', '/'],
      ['get', '/:id/spending'],
      ['get', '/:id'],
      ['patch', '/:id'],
      ['delete', '/:id'],
    ],
  },
  {
    name: 'transactions',
    router: transactionsRouter,
    routes: [
      ['get', '/'],
      ['get', '/summary'],
      ['post', '/'],
      ['get', '/:id'],
      ['get', '/:id/items'],
      ['patch', '/:id'],
      ['delete', '/:id'],
    ],
  },
  {
    name: 'debts',
    router: debtsRouter,
    routes: [
      ['get', '/summary'],
      ['get', '/'],
      ['post', '/'],
      ['get', '/:id'],
      ['patch', '/:id'],
      ['delete', '/:id'],
      ['post', '/:id/pay'],
    ],
  },
  {
    name: 'credit-cards',
    router: creditCardsRouter,
    routes: [
      ['get', '/summary'],
      ['get', '/:accountId/statement'],
      ['post', '/:accountId/pay'],
    ],
  },
  {
    name: 'dashboard',
    router: dashboardRouter,
    routes: [
      ['get', '/summary'],
      ['get', '/by-category'],
      ['get', '/monthly-trend'],
      ['get', '/fixed-vs-variable'],
      ['get', '/monthly-summary'],
      ['get', '/next-month-projection'],
    ],
  },
  {
    name: 'fixed-expenses',
    router: fixedExpensesRouter,
    routes: [
      ['get', '/summary'],
      ['get', '/'],
      ['post', '/'],
      ['post', '/reorder'],
      ['get', '/:id'],
      ['patch', '/:id'],
      ['delete', '/:id'],
      ['post', '/:id/pay'],
    ],
  },
  {
    name: 'notifications',
    router: notificationsRouter,
    routes: [
      ['get', '/'],
      ['patch', '/read-all'],
      ['patch', '/:id/read'],
      ['delete', '/:id'],
      ['get', '/preferences'],
      ['patch', '/preferences'],
      ['post', '/test-email'],
    ],
  },
  {
    name: 'recurring-debt-payments',
    router: recurringDebtPaymentsRouter,
    routes: [
      ['post', '/process'],
      ['get', '/'],
      ['post', '/'],
      ['get', '/:id'],
      ['patch', '/:id'],
      ['delete', '/:id'],
    ],
  },
  {
    name: 'settings',
    router: settingsRouter,
    routes: [
      ['get', '/profile'],
      ['patch', '/profile'],
      ['post', '/change-password'],
      ['get', '/statistics'],
      ['delete', '/account'],
    ],
  },
];

describe.each(AUTH_GUARDED_ROUTERS)('$name.routes', ({ router, routes }) => {
  it('protege todas sus rutas con router.use(authMiddleware) antes de declarar ninguna ruta', () => {
    const stack = getStack(router);
    const authUseIndex = stack.findIndex((l) => !l.route && l.name === 'authMiddleware');
    const firstRouteIndex = stack.findIndex((l) => l.route);

    expect(authUseIndex).toBeGreaterThanOrEqual(0);
    expect(authUseIndex).toBeLessThan(firstRouteIndex);
  });

  it.each(routes)('registra %s %s', (method, path) => {
    expect(findRoute(router, method, path)).toBeDefined();
  });

  it('no registra rutas además de las esperadas', () => {
    const actual = routeLayers(router).map(
      (l) => `${Object.keys(l.route!.methods)[0]} ${l.route!.path}`
    );
    const expected = routes.map(([m, p]) => `${m} ${p}`);
    expect(actual.sort()).toEqual(expected.sort());
  });
});

describe('auth.routes', () => {
  it('register y login pasan por authRateLimiter antes del controller', () => {
    const register = findRoute(authRouter, 'post', '/register')!;
    const login = findRoute(authRouter, 'post', '/login')!;

    expect(handlerNames(register)).toEqual(['<anonymous>', 'register']);
    expect(handlerNames(login)).toEqual(['<anonymous>', 'login']);
  });

  it('logout no requiere autenticación ni rate limiting', () => {
    const logout = findRoute(authRouter, 'post', '/logout')!;

    expect(handlerNames(logout)).toEqual(['logout']);
  });

  it('/me exige authMiddleware', () => {
    const me = findRoute(authRouter, 'get', '/me')!;

    expect(handlerNames(me)).toEqual(['authMiddleware', 'getMe']);
  });
});

describe('receipts.routes', () => {
  it('protege ambas rutas con authMiddleware', () => {
    const stack = getStack(receiptsRouter);
    const authUseIndex = stack.findIndex((l) => !l.route && l.name === 'authMiddleware');

    expect(authUseIndex).toBeGreaterThanOrEqual(0);
  });

  it('/scan y /ocr reciben el archivo vía multer antes del controller', () => {
    const scan = findRoute(receiptsRouter, 'post', '/scan')!;
    const ocr = findRoute(receiptsRouter, 'post', '/ocr')!;

    expect(handlerNames(scan)).toEqual(['multerMiddleware', 'scanReceipt']);
    expect(handlerNames(ocr)).toEqual(['multerMiddleware', 'ocrOnly']);
  });
});

describe('monitoring.routes', () => {
  it('/tunnel es público (sin authMiddleware) y parsea el body como texto plano', () => {
    const stack = getStack(monitoringRouter);
    expect(stack.some((l) => !l.route && l.name === 'authMiddleware')).toBe(false);

    const tunnel = findRoute(monitoringRouter, 'post', '/tunnel')!;
    expect(handlerNames(tunnel)).toEqual(['textParser', 'sentryTunnel']);
  });
});
