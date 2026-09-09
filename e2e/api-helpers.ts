import type { APIRequestContext } from '@playwright/test';

export function uniqueEmail(): string {
  return `e2e-${Date.now()}-${Math.random().toString(36).slice(2, 8)}@e2e.local`;
}

export async function registerUser(
  request: APIRequestContext,
  overrides: { email?: string; password?: string; name?: string } = {}
): Promise<{ email: string; password: string }> {
  const email = overrides.email ?? uniqueEmail();
  const password = overrides.password ?? 'password123';
  const res = await request.post('/api/auth/register', {
    data: { email, password, name: overrides.name ?? 'E2E User' },
  });
  if (!res.ok()) {
    throw new Error(`registro falló: ${res.status()} ${await res.text()}`);
  }
  return { email, password };
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
