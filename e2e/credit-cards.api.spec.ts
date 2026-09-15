import { test, expect } from '@playwright/test';
import type { APIRequestContext } from '@playwright/test';
import { registerWithBankAndCard } from './api-helpers';

interface OverduePeriod {
  startDate: string;
  endDate: string;
  periodKey: string;
  balance: number;
  transactionCount: number;
}

async function createOverdueExpense(
  request: APIRequestContext,
  cardId: string,
  monthsAgo: number,
  amount: number
): Promise<void> {
  const categoriesRes = await request.get('/api/categories?type=expense');
  const categories = (await categoriesRes.json()) as { id: string }[];
  const categoryId = categories[0]!.id;

  const date = new Date();
  date.setMonth(date.getMonth() - monthsAgo);

  const res = await request.post('/api/transactions', {
    data: {
      amount,
      type: 'expense',
      accountId: cardId,
      categoryId,
      date: date.toISOString(),
    },
  });
  expect(res.status()).toBe(201);
}

test.describe('Credit Cards API', () => {
  test('crea una tarjeta configurada y obtiene su statement', async ({ request }) => {
    const { cardId } = await registerWithBankAndCard(request);

    const res = await request.get(`/api/credit-cards/${cardId}/statement`);

    expect(res.status()).toBe(200);
    const statement = await res.json();
    expect(statement.creditLimit).toBe(1000);
    expect(statement).toHaveProperty('closedPeriod');
    expect(statement).toHaveProperty('currentPeriod');
    expect(statement.closedPeriod.isPaid).toBe(false);
  });

  test('paga el estado de cuenta y un segundo pago del mismo período responde 409', async ({
    request,
  }) => {
    const { bankId, cardId } = await registerWithBankAndCard(request);

    const payRes = await request.post(`/api/credit-cards/${cardId}/pay`, {
      data: { amount: 50, paymentAccountId: bankId },
    });

    expect(payRes.status()).toBe(200);
    const payment = await payRes.json();
    expect(payment.accountId).toBe(cardId);

    const secondPayRes = await request.post(`/api/credit-cards/${cardId}/pay`, {
      data: { amount: 50, paymentAccountId: bankId },
    });

    expect(secondPayRes.status()).toBe(409);
  });

  test('el resumen de tarjetas incluye la tarjeta creada', async ({ request }) => {
    const { cardId } = await registerWithBankAndCard(request);

    const res = await request.get('/api/credit-cards/summary');

    expect(res.status()).toBe(200);
    const summary = await res.json();
    expect(summary.cards.some((c: { account: { id: string } }) => c.account.id === cardId)).toBe(
      true
    );
  });

  test('un usuario no puede ver el statement de la tarjeta de otro usuario', async ({
    request,
  }) => {
    const userA = await registerWithBankAndCard(request);

    await registerWithBankAndCard(request); // usuario B, pisa la cookie de sesión

    const res = await request.get(`/api/credit-cards/${userA.cardId}/statement`);

    expect(res.status()).toBe(404);
  });

  test.describe('Períodos atrasados', () => {
    test('lista un período atrasado, lo paga y desaparece de la lista', async ({ request }) => {
      const { bankId, cardId } = await registerWithBankAndCard(request);
      await createOverdueExpense(request, cardId, 4, 75);

      const statementRes = await request.get(`/api/credit-cards/${cardId}/statement`);
      expect(statementRes.status()).toBe(200);
      const statement = await statementRes.json();
      expect(statement.overduePeriods).toHaveLength(1);

      const overdue: OverduePeriod = statement.overduePeriods[0];
      expect(overdue.balance).toBe(75);
      expect(overdue.transactionCount).toBe(1);
      const periodStart = overdue.periodKey;

      const payRes = await request.post(`/api/credit-cards/${cardId}/pay`, {
        data: { amount: 75, paymentAccountId: bankId, periodStart },
      });
      expect(payRes.status()).toBe(200);

      const statementAfterRes = await request.get(`/api/credit-cards/${cardId}/statement`);
      const statementAfter = await statementAfterRes.json();
      expect(statementAfter.overduePeriods).toHaveLength(0);
    });

    test('pagar dos veces el mismo período atrasado responde 409 en el segundo intento', async ({
      request,
    }) => {
      const { bankId, cardId } = await registerWithBankAndCard(request);
      await createOverdueExpense(request, cardId, 4, 60);

      const statement = await (await request.get(`/api/credit-cards/${cardId}/statement`)).json();
      const periodStart: string = statement.overduePeriods[0].periodKey;

      const firstPay = await request.post(`/api/credit-cards/${cardId}/pay`, {
        data: { amount: 60, paymentAccountId: bankId, periodStart },
      });
      expect(firstPay.status()).toBe(200);

      const secondPay = await request.post(`/api/credit-cards/${cardId}/pay`, {
        data: { amount: 60, paymentAccountId: bankId, periodStart },
      });
      expect(secondPay.status()).toBe(409);
    });

    test('periodStart inventado responde 404', async ({ request }) => {
      const { bankId, cardId } = await registerWithBankAndCard(request);

      const res = await request.post(`/api/credit-cards/${cardId}/pay`, {
        data: { amount: 10, paymentAccountId: bankId, periodStart: '1999-01-05' },
      });

      expect(res.status()).toBe(404);
    });

    test('?months= fuera de la whitelist responde 400', async ({ request }) => {
      const { cardId } = await registerWithBankAndCard(request);

      const res = await request.get(`/api/credit-cards/${cardId}/statement?months=9999`);

      expect(res.status()).toBe(400);
    });

    test('un usuario no puede ver ni pagar los períodos atrasados de otro usuario', async ({
      request,
    }) => {
      const userA = await registerWithBankAndCard(request);
      await createOverdueExpense(request, userA.cardId, 4, 90);
      const statementA = await (
        await request.get(`/api/credit-cards/${userA.cardId}/statement`)
      ).json();
      const periodStart: string = statementA.overduePeriods[0].periodKey;

      const userB = await registerWithBankAndCard(request); // pisa la cookie de sesión

      const readRes = await request.get(`/api/credit-cards/${userA.cardId}/statement`);
      expect(readRes.status()).toBe(404);

      const payRes = await request.post(`/api/credit-cards/${userA.cardId}/pay`, {
        data: { amount: 90, paymentAccountId: userB.bankId, periodStart },
      });
      expect(payRes.status()).toBe(404);
    });
  });
});
