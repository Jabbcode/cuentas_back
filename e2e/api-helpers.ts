import type { APIRequestContext } from '@playwright/test';

export function uniqueEmail(): string {
  return `e2e-${Date.now()}-${Math.random().toString(36).slice(2, 8)}@e2e.local`;
}

export async function registerUser(
  request: APIRequestContext,
  overrides: { email?: string; password?: string; name?: string } = {}
): Promise<{ id: string; email: string; password: string; name: string }> {
  const email = overrides.email ?? uniqueEmail();
  const password = overrides.password ?? 'password123';
  const name = overrides.name ?? 'E2E User';
  const res = await request.post('/api/auth/register', { data: { email, password, name } });
  if (!res.ok()) {
    throw new Error(`registro falló: ${res.status()} ${await res.text()}`);
  }
  const body = await res.json();
  return { id: body.user.id, email, password, name };
}

export async function createAccount(
  request: APIRequestContext,
  overrides: Record<string, unknown> = {}
): Promise<{ id: string } & Record<string, unknown>> {
  const res = await request.post('/api/accounts', {
    data: { name: 'Cuenta E2E', type: 'bank', balance: 1000, currency: 'EUR', ...overrides },
  });
  if (res.status() !== 201) {
    throw new Error(`crear cuenta falló: ${res.status()} ${await res.text()}`);
  }
  return res.json();
}

export async function getCategoryByType(
  request: APIRequestContext,
  type: 'expense' | 'income'
): Promise<{ id: string } & Record<string, unknown>> {
  const res = await request.get(`/api/categories?type=${type}`);
  const categories = (await res.json()) as ({ id: string } & Record<string, unknown>)[];
  const category = categories[0];
  if (!category) {
    throw new Error(`no hay categorías seed de tipo ${type}`);
  }
  return category;
}

/**
 * Registra un usuario nuevo y le crea una cuenta bancaria — el setup mínimo que
 * necesitan la mayoría de los dominios (transactions, debts, fixed-expenses, etc.).
 */
export async function registerWithAccount(
  request: APIRequestContext,
  accountOverrides: Record<string, unknown> = {}
): Promise<{ userId: string; accountId: string; email: string; password: string }> {
  const user = await registerUser(request);
  const account = await createAccount(request, accountOverrides);
  return { userId: user.id, accountId: account.id, email: user.email, password: user.password };
}

/**
 * Registra un usuario, le crea una cuenta bancaria de débito y una tarjeta de
 * crédito configurada (cutoffDay/paymentDueDay/creditLimit) — setup para el
 * dominio de Credit Cards.
 */
export async function registerWithBankAndCard(
  request: APIRequestContext
): Promise<{ bankId: string; cardId: string }> {
  await registerUser(request);
  const bank = await createAccount(request, { name: 'Cuenta Débito' });
  const card = await createAccount(request, {
    name: 'Tarjeta E2E',
    type: 'credit_card',
    balance: 0,
    creditLimit: 1000,
    cutoffDay: 5,
    paymentDueDay: 20,
  });
  return { bankId: bank.id, cardId: card.id };
}
