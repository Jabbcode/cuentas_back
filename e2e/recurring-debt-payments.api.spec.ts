import { test, expect, APIRequestContext } from '@playwright/test';

function uniqueEmail(): string {
  return `e2e-${Date.now()}-${Math.random().toString(36).slice(2, 8)}@e2e.local`;
}

async function registerWithAccountAndDebt(
  request: APIRequestContext,
  totalAmount = 500
): Promise<{ accountId: string; debtId: string }> {
  const email = uniqueEmail();
  await request.post('/api/auth/register', {
    data: { email, password: 'password123', name: 'E2E User' },
  });

  const account = await (
    await request.post('/api/accounts', {
      data: { name: 'Cuenta E2E', type: 'bank', balance: 2000, currency: 'EUR' },
    })
  ).json();

  const debt = await (
    await request.post('/api/debts', {
      data: { creditor: 'Banco X', description: 'Préstamo E2E', totalAmount },
    })
  ).json();

  return { accountId: account.id, debtId: debt.id };
}

test.describe('Recurring Debt Payments API', () => {
  test('crea un pago recurrente mensual con dayOfMonth', async ({ request }) => {
    const { accountId, debtId } = await registerWithAccountAndDebt(request);

    const res = await request.post('/api/recurring-debt-payments', {
      data: { debtId, amount: 50, accountId, frequency: 'monthly', dayOfMonth: 5 },
    });

    expect(res.status()).toBe(201);
    const created = await res.json();
    expect(created.frequency).toBe('monthly');
  });

  test('mensual sin dayOfMonth responde 400', async ({ request }) => {
    const { accountId, debtId } = await registerWithAccountAndDebt(request);

    const res = await request.post('/api/recurring-debt-payments', {
      data: { debtId, amount: 50, accountId, frequency: 'monthly' },
    });

    expect(res.status()).toBe(400);
  });

  test('rechaza crear un pago recurrente sobre una deuda ya pagada', async ({ request }) => {
    const { accountId, debtId } = await registerWithAccountAndDebt(request, 100);

    await request.post(`/api/debts/${debtId}/pay`, { data: { amount: 100, accountId } });

    const res = await request.post('/api/recurring-debt-payments', {
      data: { debtId, amount: 50, accountId, frequency: 'monthly', dayOfMonth: 5 },
    });

    expect(res.status()).toBe(409);
  });

  test('lista los pagos recurrentes filtrando por debtId', async ({ request }) => {
    const { accountId, debtId } = await registerWithAccountAndDebt(request);
    const created = await (
      await request.post('/api/recurring-debt-payments', {
        data: { debtId, amount: 25, accountId, frequency: 'monthly', dayOfMonth: 10 },
      })
    ).json();

    const listRes = await request.get(`/api/recurring-debt-payments?debtId=${debtId}`);
    const list = await listRes.json();

    expect(list.some((rp: { id: string }) => rp.id === created.id)).toBe(true);
  });

  test('actualiza y luego elimina un pago recurrente', async ({ request }) => {
    const { accountId, debtId } = await registerWithAccountAndDebt(request);
    const created = await (
      await request.post('/api/recurring-debt-payments', {
        data: { debtId, amount: 25, accountId, frequency: 'monthly', dayOfMonth: 10 },
      })
    ).json();

    const updateRes = await request.patch(`/api/recurring-debt-payments/${created.id}`, {
      data: { amount: 30 },
    });
    expect(updateRes.status()).toBe(200);
    expect(Number((await updateRes.json()).amount)).toBe(30);

    const deleteRes = await request.delete(`/api/recurring-debt-payments/${created.id}`);
    expect(deleteRes.status()).toBe(200);

    const getRes = await request.get(`/api/recurring-debt-payments/${created.id}`);
    expect(getRes.status()).toBe(404);
  });
});
