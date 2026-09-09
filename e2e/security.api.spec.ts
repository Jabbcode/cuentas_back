import { test, expect, request as apiRequest } from '@playwright/test';
import { registerUser } from './api-helpers';

test.describe('Health check', () => {
  test('GET /api/health responde 200 sin autenticación', async ({ request }) => {
    const res = await request.get('/api/health');

    expect(res.status()).toBe(200);
    const body = await res.json();
    expect(body.status).toBe('ok');
  });
});

test.describe('Seguridad — 401 sin JWT en cada dominio protegido', () => {
  const protectedGets = [
    '/api/accounts',
    '/api/transactions',
    '/api/categories',
    '/api/fixed-expenses',
    '/api/credit-cards/summary',
    '/api/debts',
    '/api/recurring-debt-payments',
    '/api/dashboard/summary',
    '/api/settings/profile',
    '/api/notifications',
  ];

  for (const path of protectedGets) {
    test(`GET ${path} sin cookie responde 401`, async ({ request }) => {
      const res = await request.get(path);
      expect(res.status()).toBe(401);
    });
  }
});

test.describe('Seguridad — aislamiento multi-tenant', () => {
  test('el usuario B no puede leer, editar ni borrar recursos del usuario A', async () => {
    const contextA = await apiRequest.newContext({ baseURL: 'http://localhost:3001' });
    const contextB = await apiRequest.newContext({ baseURL: 'http://localhost:3001' });

    try {
      await registerUser(contextA);
      await registerUser(contextB);

      // A crea una cuenta y una transacción
      const accountRes = await contextA.post('/api/accounts', {
        data: { name: 'Cuenta de A', type: 'bank', balance: 1000, currency: 'EUR' },
      });
      expect(accountRes.status()).toBe(201);
      const accountA = await accountRes.json();

      const categoriesRes = await contextA.get('/api/categories');
      const categoriesA = (await categoriesRes.json()) as { id: string; name: string }[];
      const categoryA = categoriesA.find((c) => c.name === 'Alimentación')!;

      const txRes = await contextA.post('/api/transactions', {
        data: {
          amount: 50,
          type: 'expense',
          accountId: accountA.id,
          categoryId: categoryA.id,
          date: new Date().toISOString(),
        },
      });
      expect(txRes.status()).toBe(201);
      const txA = await txRes.json();

      // B intenta leer la cuenta de A por id
      const readAccount = await contextB.get(`/api/accounts/${accountA.id}`);
      expect(readAccount.status()).toBe(404);

      // B intenta editar la cuenta de A
      const editAccount = await contextB.patch(`/api/accounts/${accountA.id}`, {
        data: { name: 'Hackeada' },
      });
      expect(editAccount.status()).toBe(404);

      // B intenta borrar la cuenta de A
      const deleteAccount = await contextB.delete(`/api/accounts/${accountA.id}`);
      expect(deleteAccount.status()).toBe(404);

      // B intenta leer la transacción de A
      const readTx = await contextB.get(`/api/transactions/${txA.id}`);
      expect(readTx.status()).toBe(404);

      // El listado de cuentas/transacciones de B nunca incluye nada de A
      const accountsB = await (await contextB.get('/api/accounts')).json();
      expect(accountsB).toEqual([]);

      const transactionsB = await (await contextB.get('/api/transactions')).json();
      expect(transactionsB.transactions).toEqual([]);

      // El dashboard de B no ve el gasto de A
      const summaryB = await (await contextB.get('/api/dashboard/summary')).json();
      expect(summaryB.totalBalance).toBe(0);
      expect(summaryB.monthlyExpenses).toBe(0);
    } finally {
      await contextA.dispose();
      await contextB.dispose();
    }
  });
});
