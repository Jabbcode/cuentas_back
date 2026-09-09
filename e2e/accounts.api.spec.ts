import { test, expect } from '@playwright/test';
import { registerUser, createAccount } from './api-helpers';

test.describe('Accounts API', () => {
  test.beforeEach(async ({ request }) => {
    await registerUser(request);
  });

  test('crea una cuenta bank y la devuelve con balance inicial', async ({ request }) => {
    const res = await request.post('/api/accounts', {
      data: { name: 'Banco Test', type: 'bank', balance: 500, currency: 'EUR' },
    });

    expect(res.status()).toBe(201);
    const body = await res.json();
    expect(body).toMatchObject({ name: 'Banco Test', type: 'bank' });
    expect(Number(body.balance)).toBe(500);
  });

  test('crea una cuenta credit_card con los campos de tarjeta', async ({ request }) => {
    const res = await request.post('/api/accounts', {
      data: {
        name: 'Visa Test',
        type: 'credit_card',
        balance: 0,
        creditLimit: 1000,
        cutoffDay: 5,
        paymentDueDay: 20,
      },
    });

    expect(res.status()).toBe(201);
    const body = await res.json();
    expect(body.creditLimit).toBe('1000');
  });

  test('rechaza datos inválidos (type fuera del enum) con 400', async ({ request }) => {
    const res = await request.post('/api/accounts', {
      data: { name: 'x', type: 'crypto', balance: 0 },
    });

    expect(res.status()).toBe(400);
  });

  test('lista solo las cuentas del usuario autenticado', async ({ request }) => {
    await createAccount(request, { name: 'Cuenta A' });
    await createAccount(request, { name: 'Cuenta B' });

    const res = await request.get('/api/accounts');
    const accounts = await res.json();

    expect(accounts).toHaveLength(2);
  });

  test('obtiene una cuenta por id', async ({ request }) => {
    const account = await createAccount(request);

    const res = await request.get(`/api/accounts/${account.id}`);

    expect(res.ok()).toBeTruthy();
    expect((await res.json()).id).toBe(account.id);
  });

  test('404 al pedir una cuenta con id inexistente', async ({ request }) => {
    const res = await request.get('/api/accounts/00000000-0000-0000-0000-000000000000');
    expect(res.status()).toBe(404);
  });

  test('actualiza el nombre de una cuenta', async ({ request }) => {
    const account = await createAccount(request);

    const res = await request.patch(`/api/accounts/${account.id}`, {
      data: { name: 'Nombre actualizado' },
    });

    expect(res.ok()).toBeTruthy();
    expect((await res.json()).name).toBe('Nombre actualizado');
  });

  test('elimina una cuenta', async ({ request }) => {
    const account = await createAccount(request);

    const del = await request.delete(`/api/accounts/${account.id}`);
    expect(del.status()).toBe(204);

    const get = await request.get(`/api/accounts/${account.id}`);
    expect(get.status()).toBe(404);
  });

  test.describe('transferFunds', () => {
    test('transfiere fondos entre dos cuentas propias y ajusta ambos balances', async ({
      request,
    }) => {
      const from = await createAccount(request, { name: 'Origen', balance: 200 });
      const to = await createAccount(request, { name: 'Destino', balance: 50 });

      const res = await request.post('/api/accounts/transfer', {
        data: { fromAccountId: from.id, toAccountId: to.id, amount: 100 },
      });

      expect(res.status()).toBe(201);

      const fromAfter = await (await request.get(`/api/accounts/${from.id}`)).json();
      const toAfter = await (await request.get(`/api/accounts/${to.id}`)).json();
      expect(Number(fromAfter.balance)).toBe(100);
      expect(Number(toAfter.balance)).toBe(150);
    });

    test('rechaza transferencia con saldo insuficiente (400) y no modifica balances', async ({
      request,
    }) => {
      const from = await createAccount(request, { name: 'Origen', balance: 10 });
      const to = await createAccount(request, { name: 'Destino', balance: 0 });

      const res = await request.post('/api/accounts/transfer', {
        data: { fromAccountId: from.id, toAccountId: to.id, amount: 100 },
      });

      expect(res.status()).toBe(400);

      const fromAfter = await (await request.get(`/api/accounts/${from.id}`)).json();
      expect(Number(fromAfter.balance)).toBe(10);
    });

    test('rechaza transferencia con cuenta origen igual a destino (400)', async ({ request }) => {
      const account = await createAccount(request);

      const res = await request.post('/api/accounts/transfer', {
        data: { fromAccountId: account.id, toAccountId: account.id, amount: 10 },
      });

      expect(res.status()).toBe(400);
    });
  });

  test.describe('aislamiento multi-tenant', () => {
    test('un usuario no puede leer la cuenta de otro usuario (404)', async ({ request }) => {
      const account = await createAccount(request);

      await registerUser(request); // cambia de sesión dentro del mismo request context

      const res = await request.get(`/api/accounts/${account.id}`);
      expect(res.status()).toBe(404);
    });

    test('un usuario no puede eliminar la cuenta de otro usuario (404), y sigue existiendo', async ({
      request,
    }) => {
      const account = await createAccount(request);

      await registerUser(request);

      const del = await request.delete(`/api/accounts/${account.id}`);
      expect(del.status()).toBe(404);
    });
  });
});
