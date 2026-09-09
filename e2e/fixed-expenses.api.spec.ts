import { test, expect, APIRequestContext } from '@playwright/test';

function uniqueEmail(): string {
  return `e2e-${Date.now()}-${Math.random().toString(36).slice(2, 8)}@e2e.local`;
}

async function registerWithAccount(
  request: APIRequestContext
): Promise<{ accountId: string; categoryId: string }> {
  const email = uniqueEmail();
  await request.post('/api/auth/register', {
    data: { email, password: 'password123', name: 'E2E User' },
  });

  const accountRes = await request.post('/api/accounts', {
    data: { name: 'Cuenta E2E', type: 'bank', balance: 1000, currency: 'EUR' },
  });
  const account = await accountRes.json();

  const categoriesRes = await request.get('/api/categories?type=expense');
  const categories = await categoriesRes.json();

  return { accountId: account.id, categoryId: categories[0].id };
}

test.describe('Fixed Expenses API', () => {
  test('crea un gasto fijo (autoGenerate por defecto en false) y lo lista', async ({ request }) => {
    const { accountId, categoryId } = await registerWithAccount(request);

    const createRes = await request.post('/api/fixed-expenses', {
      data: { name: 'Alquiler', amount: 500, type: 'expense', dueDay: 5, accountId, categoryId },
    });

    expect(createRes.status()).toBe(201);
    const created = await createRes.json();
    expect(created.autoGenerate).toBe(false);

    const listRes = await request.get('/api/fixed-expenses');
    const list = await listRes.json();
    expect(list.some((fe: { id: string }) => fe.id === created.id)).toBe(true);
  });

  test('crea con autoGenerate:true', async ({ request }) => {
    const { accountId, categoryId } = await registerWithAccount(request);

    const res = await request.post('/api/fixed-expenses', {
      data: {
        name: 'Netflix',
        amount: 15,
        type: 'expense',
        dueDay: 10,
        accountId,
        categoryId,
        autoGenerate: true,
      },
    });

    expect(res.status()).toBe(201);
    expect((await res.json()).autoGenerate).toBe(true);
  });

  test('actualiza un gasto fijo existente', async ({ request }) => {
    const { accountId, categoryId } = await registerWithAccount(request);
    const created = await (
      await request.post('/api/fixed-expenses', {
        data: { name: 'Gimnasio', amount: 30, type: 'expense', dueDay: 1, accountId, categoryId },
      })
    ).json();

    const updateRes = await request.patch(`/api/fixed-expenses/${created.id}`, {
      data: { amount: 40 },
    });

    expect(updateRes.status()).toBe(200);
    expect(Number((await updateRes.json()).amount)).toBe(40);
  });

  test('elimina un gasto fijo y luego devuelve 404 al buscarlo', async ({ request }) => {
    const { accountId, categoryId } = await registerWithAccount(request);
    const created = await (
      await request.post('/api/fixed-expenses', {
        data: { name: 'Seguro', amount: 60, type: 'expense', dueDay: 15, accountId, categoryId },
      })
    ).json();

    const deleteRes = await request.delete(`/api/fixed-expenses/${created.id}`);
    expect(deleteRes.status()).toBe(204);

    const getRes = await request.get(`/api/fixed-expenses/${created.id}`);
    expect(getRes.status()).toBe(404);
  });

  test('paga un gasto fijo y genera la transacción asociada', async ({ request }) => {
    const { accountId, categoryId } = await registerWithAccount(request);
    const created = await (
      await request.post('/api/fixed-expenses', {
        data: { name: 'Internet', amount: 25, type: 'expense', dueDay: 20, accountId, categoryId },
      })
    ).json();

    const payRes = await request.post(`/api/fixed-expenses/${created.id}/pay`, { data: {} });

    expect(payRes.status()).toBe(201);
    const transaction = await payRes.json();
    expect(transaction.fixedExpenseId).toBe(created.id);
    expect(Number(transaction.amount)).toBe(25);
  });

  test('el resumen refleja el total mensual de gastos activos', async ({ request }) => {
    const { accountId, categoryId } = await registerWithAccount(request);
    await request.post('/api/fixed-expenses', {
      data: { name: 'Renta', amount: 300, type: 'expense', dueDay: 1, accountId, categoryId },
    });

    const summaryRes = await request.get('/api/fixed-expenses/summary');

    expect(summaryRes.status()).toBe(200);
    const summary = await summaryRes.json();
    expect(summary.totalMonthlyExpenses).toBeGreaterThanOrEqual(300);
    expect(summary.totalCount).toBeGreaterThanOrEqual(1);
  });

  test('un usuario no puede ver ni modificar el gasto fijo de otro usuario', async ({
    request,
  }) => {
    const userA = await registerWithAccount(request);
    const created = await (
      await request.post('/api/fixed-expenses', {
        data: {
          name: 'Privado',
          amount: 10,
          type: 'expense',
          dueDay: 1,
          accountId: userA.accountId,
          categoryId: userA.categoryId,
        },
      })
    ).json();

    await registerWithAccount(request); // se loguea como usuario B (cookie se sobreescribe)

    const getRes = await request.get(`/api/fixed-expenses/${created.id}`);
    expect(getRes.status()).toBe(404);

    const deleteRes = await request.delete(`/api/fixed-expenses/${created.id}`);
    expect(deleteRes.status()).toBe(404);
  });
});
