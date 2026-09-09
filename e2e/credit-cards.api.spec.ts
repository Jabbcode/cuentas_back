import { test, expect } from '@playwright/test';
import { registerWithBankAndCard } from './api-helpers';

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
});
