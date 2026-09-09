import { test, expect, type APIRequestContext } from '@playwright/test';

function uniqueEmail(): string {
  return `e2e-${Date.now()}-${Math.random().toString(36).slice(2, 8)}@e2e.local`;
}

async function registerUser(request: APIRequestContext) {
  const email = uniqueEmail();
  const res = await request.post('/api/auth/register', {
    data: { email, password: 'password123', name: 'E2E User' },
  });
  expect(res.status()).toBe(201);
  return email;
}

async function getCategoryId(request: APIRequestContext, name: string): Promise<string> {
  const res = await request.get('/api/categories');
  expect(res.ok()).toBeTruthy();
  const categories = (await res.json()) as { id: string; name: string }[];
  const category = categories.find((c) => c.name === name);
  if (!category) throw new Error(`Categoría "${name}" no encontrada`);
  return category.id;
}

async function createAccount(request: APIRequestContext, balance = 1000): Promise<string> {
  const res = await request.post('/api/accounts', {
    data: { name: 'Cuenta E2E', type: 'bank', balance, currency: 'EUR' },
  });
  expect(res.status()).toBe(201);
  const account = await res.json();
  return account.id as string;
}

test.describe('Dashboard API', () => {
  test('usuario nuevo sin datos: resumen en cero', async ({ request }) => {
    await registerUser(request);

    const res = await request.get('/api/dashboard/summary');

    expect(res.ok()).toBeTruthy();
    const summary = await res.json();
    expect(summary.totalBalance).toBe(0);
    expect(summary.monthlyIncome).toBe(0);
    expect(summary.monthlyExpenses).toBe(0);
  });

  test('con una cuenta y un gasto: el resumen refleja el balance y el gasto mensual', async ({
    request,
  }) => {
    await registerUser(request);
    const accountId = await createAccount(request, 500);
    const categoryId = await getCategoryId(request, 'Alimentación');

    const txRes = await request.post('/api/transactions', {
      data: { amount: 100, type: 'expense', accountId, categoryId, date: new Date().toISOString() },
    });
    expect(txRes.status()).toBe(201);

    const res = await request.get('/api/dashboard/summary');
    const summary = await res.json();

    expect(summary.totalBalance).toBe(400);
    expect(summary.monthlyExpenses).toBe(100);
    expect(summary.monthlyNet).toBe(-100);
  });

  test('getByCategory agrupa el gasto en la categoría correcta', async ({ request }) => {
    await registerUser(request);
    const accountId = await createAccount(request);
    const categoryId = await getCategoryId(request, 'Transporte');

    await request.post('/api/transactions', {
      data: { amount: 50, type: 'expense', accountId, categoryId, date: new Date().toISOString() },
    });

    const res = await request.get('/api/dashboard/by-category?type=expense');
    expect(res.ok()).toBeTruthy();
    const breakdown = await res.json();

    expect(breakdown).toContainEqual(expect.objectContaining({ name: 'Transporte', total: 50 }));
  });

  test('getMonthlyTrend sin datos devuelve 6 meses en cero', async ({ request }) => {
    await registerUser(request);

    const res = await request.get('/api/dashboard/monthly-trend');
    expect(res.ok()).toBeTruthy();
    const trend = await res.json();

    expect(trend).toHaveLength(6);
    expect(
      trend.every((m: { income: number; expenses: number }) => m.income === 0 && m.expenses === 0)
    ).toBe(true);
  });

  test('getMonthlySummary del mes actual refleja el gasto creado', async ({ request }) => {
    await registerUser(request);
    const accountId = await createAccount(request);
    const categoryId = await getCategoryId(request, 'Salud');

    await request.post('/api/transactions', {
      data: { amount: 30, type: 'expense', accountId, categoryId, date: new Date().toISOString() },
    });

    const now = new Date();
    const res = await request.get(
      `/api/dashboard/monthly-summary?month=${now.getMonth() + 1}&year=${now.getFullYear()}`
    );
    expect(res.ok()).toBeTruthy();
    const summary = await res.json();

    expect(summary.totalExpenses).toBe(30);
  });

  test('getFixedVsVariable sin gastos fijos: todo es variable', async ({ request }) => {
    await registerUser(request);
    const accountId = await createAccount(request);
    const categoryId = await getCategoryId(request, 'Ropa');

    await request.post('/api/transactions', {
      data: { amount: 20, type: 'expense', accountId, categoryId, date: new Date().toISOString() },
    });

    const res = await request.get('/api/dashboard/fixed-vs-variable');
    expect(res.ok()).toBeTruthy();
    const data = await res.json();

    expect(data.fixed).toBe(0);
    expect(data.variable).toBe(20);
  });
});
