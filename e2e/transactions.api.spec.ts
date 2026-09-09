import { test, expect } from '@playwright/test';
import { registerUser, createAccount, getCategoryByType } from './api-helpers';

test.describe('Transactions API', () => {
  test.beforeEach(async ({ request }) => {
    await registerUser(request);
  });

  test('crear un gasto decrementa el balance de la cuenta', async ({ request }) => {
    const account = await createAccount(request, { balance: 1000 });
    const category = await getCategoryByType(request, 'expense');

    const res = await request.post('/api/transactions', {
      data: { amount: 150, type: 'expense', accountId: account.id, categoryId: category.id },
    });
    expect(res.status()).toBe(201);

    const accountAfter = await (await request.get(`/api/accounts/${account.id}`)).json();
    expect(Number(accountAfter.balance)).toBe(850);
  });

  test('crear un ingreso incrementa el balance de la cuenta', async ({ request }) => {
    const account = await createAccount(request, { balance: 500 });
    const category = await getCategoryByType(request, 'income');

    const res = await request.post('/api/transactions', {
      data: { amount: 300, type: 'income', accountId: account.id, categoryId: category.id },
    });
    expect(res.status()).toBe(201);

    const accountAfter = await (await request.get(`/api/accounts/${account.id}`)).json();
    expect(Number(accountAfter.balance)).toBe(800);
  });

  test('rechaza monto negativo con 400', async ({ request }) => {
    const account = await createAccount(request);
    const category = await getCategoryByType(request, 'expense');

    const res = await request.post('/api/transactions', {
      data: { amount: -10, type: 'expense', accountId: account.id, categoryId: category.id },
    });

    expect(res.status()).toBe(400);
  });

  test('404 si la cuenta no existe', async ({ request }) => {
    const category = await getCategoryByType(request, 'expense');

    const res = await request.post('/api/transactions', {
      data: {
        amount: 10,
        type: 'expense',
        accountId: '00000000-0000-0000-0000-000000000000',
        categoryId: category.id,
      },
    });

    expect(res.status()).toBe(404);
  });

  test('lista transacciones filtrando por type', async ({ request }) => {
    const account = await createAccount(request, { balance: 1000 });
    const expenseCategory = await getCategoryByType(request, 'expense');
    const incomeCategory = await getCategoryByType(request, 'income');
    await request.post('/api/transactions', {
      data: { amount: 50, type: 'expense', accountId: account.id, categoryId: expenseCategory.id },
    });
    await request.post('/api/transactions', {
      data: { amount: 200, type: 'income', accountId: account.id, categoryId: incomeCategory.id },
    });

    const res = await request.get('/api/transactions?type=income');
    const body = await res.json();

    expect(body.transactions).toHaveLength(1);
    expect(body.transactions[0].type).toBe('income');
  });

  test('obtiene una transacción por id', async ({ request }) => {
    const account = await createAccount(request);
    const category = await getCategoryByType(request, 'expense');
    const created = await (
      await request.post('/api/transactions', {
        data: { amount: 30, type: 'expense', accountId: account.id, categoryId: category.id },
      })
    ).json();

    const res = await request.get(`/api/transactions/${created.id}`);
    expect(res.ok()).toBeTruthy();
    expect((await res.json()).id).toBe(created.id);
  });

  test('actualizar el monto de una transacción reajusta el balance de la cuenta', async ({
    request,
  }) => {
    const account = await createAccount(request, { balance: 1000 });
    const category = await getCategoryByType(request, 'expense');
    const created = await (
      await request.post('/api/transactions', {
        data: { amount: 100, type: 'expense', accountId: account.id, categoryId: category.id },
      })
    ).json();

    const res = await request.patch(`/api/transactions/${created.id}`, { data: { amount: 300 } });
    expect(res.ok()).toBeTruthy();

    const accountAfter = await (await request.get(`/api/accounts/${account.id}`)).json();
    expect(Number(accountAfter.balance)).toBe(700); // 1000 - 300
  });

  test('eliminar una transacción revierte el balance de la cuenta', async ({ request }) => {
    const account = await createAccount(request, { balance: 1000 });
    const category = await getCategoryByType(request, 'expense');
    const created = await (
      await request.post('/api/transactions', {
        data: { amount: 100, type: 'expense', accountId: account.id, categoryId: category.id },
      })
    ).json();

    const del = await request.delete(`/api/transactions/${created.id}`);
    expect(del.status()).toBe(204);

    const accountAfter = await (await request.get(`/api/accounts/${account.id}`)).json();
    expect(Number(accountAfter.balance)).toBe(1000);
  });

  test('resumen por categoría agrupa correctamente expenseTotal', async ({ request }) => {
    const account = await createAccount(request, { balance: 1000 });
    const category = await getCategoryByType(request, 'expense');
    await request.post('/api/transactions', {
      data: { amount: 40, type: 'expense', accountId: account.id, categoryId: category.id },
    });
    await request.post('/api/transactions', {
      data: { amount: 60, type: 'expense', accountId: account.id, categoryId: category.id },
    });

    const res = await request.get('/api/transactions/summary');
    const summary = await res.json();
    const entry = summary.find((s: { category: { id: string } }) => s.category.id === category.id);

    expect(entry.expenseTotal).toBe(100);
  });

  test('aislamiento multi-tenant: no puede leer la transacción de otro usuario (404)', async ({
    request,
  }) => {
    const account = await createAccount(request);
    const category = await getCategoryByType(request, 'expense');
    const created = await (
      await request.post('/api/transactions', {
        data: { amount: 10, type: 'expense', accountId: account.id, categoryId: category.id },
      })
    ).json();

    await registerUser(request);

    const res = await request.get(`/api/transactions/${created.id}`);
    expect(res.status()).toBe(404);
  });
});
