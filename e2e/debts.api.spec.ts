import { test, expect } from '@playwright/test';
import { registerWithAccount } from './api-helpers';

async function createDebt(request: APIRequestContext, totalAmount = 500) {
  const res = await request.post('/api/debts', {
    data: { creditor: 'Banco X', description: 'Préstamo E2E', totalAmount },
  });
  return res.json();
}

test.describe('Debts API', () => {
  test('crea una deuda y la lista entre las activas', async ({ request }) => {
    await registerWithAccount(request);
    const debt = await createDebt(request);

    expect(debt.status).toBe('active');
    expect(Number(debt.remainingAmount)).toBe(500);

    const listRes = await request.get('/api/debts?status=active');
    const list = await listRes.json();
    expect(list.some((d: { id: string }) => d.id === debt.id)).toBe(true);
  });

  test('obtiene y actualiza una deuda existente', async ({ request }) => {
    await registerWithAccount(request);
    const debt = await createDebt(request);

    const getRes = await request.get(`/api/debts/${debt.id}`);
    expect(getRes.status()).toBe(200);

    const updateRes = await request.patch(`/api/debts/${debt.id}`, {
      data: { creditor: 'Banco Y' },
    });
    expect(updateRes.status()).toBe(200);
    expect((await updateRes.json()).creditor).toBe('Banco Y');
  });

  test('un pago parcial reduce remainingAmount y descuenta el balance de la cuenta', async ({
    request,
  }) => {
    const { accountId } = await registerWithAccount(request);
    const debt = await createDebt(request, 500);

    const payRes = await request.post(`/api/debts/${debt.id}/pay`, {
      data: { amount: 200, accountId },
    });

    expect(payRes.status()).toBe(200);
    const result = await payRes.json();
    expect(Number(result.debt.remainingAmount)).toBe(300);
    expect(result.debt.status).toBe('active');

    const accountRes = await request.get(`/api/accounts/${accountId}`);
    expect(Number((await accountRes.json()).balance)).toBe(800);
  });

  test('pagar el total restante marca la deuda como pagada', async ({ request }) => {
    const { accountId } = await registerWithAccount(request);
    const debt = await createDebt(request, 200);

    const payRes = await request.post(`/api/debts/${debt.id}/pay`, {
      data: { amount: 200, accountId },
    });

    expect((await payRes.json()).debt.status).toBe('paid');
  });

  test('elimina una deuda y luego devuelve 404', async ({ request }) => {
    await registerWithAccount(request);
    const debt = await createDebt(request);

    const deleteRes = await request.delete(`/api/debts/${debt.id}`);
    expect(deleteRes.status()).toBe(200);

    const getRes = await request.get(`/api/debts/${debt.id}`);
    expect(getRes.status()).toBe(404);
  });

  test('el resumen cuenta las deudas activas y su monto total', async ({ request }) => {
    await registerWithAccount(request);
    await createDebt(request, 300);

    const summaryRes = await request.get('/api/debts/summary');
    const summary = await summaryRes.json();

    expect(summary.totalActiveDebts).toBeGreaterThanOrEqual(1);
    expect(summary.totalDebtAmount).toBeGreaterThanOrEqual(300);
  });

  test('un usuario no puede ver ni pagar la deuda de otro usuario', async ({ request }) => {
    await registerWithAccount(request);
    const debt = await createDebt(request);

    const userB = await registerWithAccount(request);

    const getRes = await request.get(`/api/debts/${debt.id}`);
    expect(getRes.status()).toBe(404);

    const payRes = await request.post(`/api/debts/${debt.id}/pay`, {
      data: { amount: 10, accountId: userB.accountId },
    });
    expect(payRes.status()).toBe(404);
  });
});
