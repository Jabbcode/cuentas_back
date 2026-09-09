import { test, expect, request as apiRequest, APIRequestContext } from '@playwright/test';
import { registerWithAccount } from './api-helpers';

async function registerWithAccountAndDebt(
  request: APIRequestContext,
  totalAmount = 500
): Promise<{ accountId: string; debtId: string }> {
  const { accountId } = await registerWithAccount(request, { balance: 2000 });

  const debt = await (
    await request.post('/api/debts', {
      data: { creditor: 'Banco X', description: 'Préstamo E2E', totalAmount },
    })
  ).json();

  return { accountId, debtId: debt.id };
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

  test('aislamiento multi-tenant: el usuario B no puede leer, editar ni borrar el pago recurrente de A', async () => {
    const contextA = await apiRequest.newContext({ baseURL: 'http://localhost:3001' });
    const contextB = await apiRequest.newContext({ baseURL: 'http://localhost:3001' });

    try {
      const { debtId, accountId } = await registerWithAccountAndDebt(contextA);
      const created = await (
        await contextA.post('/api/recurring-debt-payments', {
          data: { debtId, amount: 25, accountId, frequency: 'monthly', dayOfMonth: 10 },
        })
      ).json();

      await registerWithAccountAndDebt(contextB);

      const readRes = await contextB.get(`/api/recurring-debt-payments/${created.id}`);
      expect(readRes.status()).toBe(404);

      const updateRes = await contextB.patch(`/api/recurring-debt-payments/${created.id}`, {
        data: { amount: 999 },
      });
      expect(updateRes.status()).toBe(404);

      const deleteRes = await contextB.delete(`/api/recurring-debt-payments/${created.id}`);
      expect(deleteRes.status()).toBe(404);

      // El pago recurrente de A sigue intacto
      const stillThere = await contextA.get(`/api/recurring-debt-payments/${created.id}`);
      expect(stillThere.ok()).toBeTruthy();
      expect(Number((await stillThere.json()).amount)).toBe(25);
    } finally {
      await contextA.dispose();
      await contextB.dispose();
    }
  });
});
