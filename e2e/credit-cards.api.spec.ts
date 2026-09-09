import { test, expect, APIRequestContext } from '@playwright/test';

function uniqueEmail(): string {
  return `e2e-${Date.now()}-${Math.random().toString(36).slice(2, 8)}@e2e.local`;
}

async function registerWithBankAndCard(
  request: APIRequestContext
): Promise<{ bankId: string; cardId: string }> {
  const email = uniqueEmail();
  await request.post('/api/auth/register', {
    data: { email, password: 'password123', name: 'E2E User' },
  });

  const bank = await (
    await request.post('/api/accounts', {
      data: { name: 'Cuenta Débito', type: 'bank', balance: 1000, currency: 'EUR' },
    })
  ).json();

  const card = await (
    await request.post('/api/accounts', {
      data: {
        name: 'Tarjeta E2E',
        type: 'credit_card',
        balance: 0,
        currency: 'EUR',
        creditLimit: 1000,
        cutoffDay: 5,
        paymentDueDay: 20,
      },
    })
  ).json();

  return { bankId: bank.id, cardId: card.id };
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
});
