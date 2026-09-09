import { test, expect } from '@playwright/test';
import { registerUser } from './api-helpers';

test.describe('Categories API', () => {
  test.beforeEach(async ({ request }) => {
    await registerUser(request);
  });

  test('el registro siembra categorías default de expense e income', async ({ request }) => {
    const res = await request.get('/api/categories');
    const categories = await res.json();

    expect(categories.length).toBeGreaterThan(0);
    expect(categories.some((c: { type: string }) => c.type === 'expense')).toBe(true);
    expect(categories.some((c: { type: string }) => c.type === 'income')).toBe(true);
  });

  test('filtra categorías por type', async ({ request }) => {
    const res = await request.get('/api/categories?type=income');
    const categories = await res.json();

    expect(categories.length).toBeGreaterThan(0);
    expect(categories.every((c: { type: string }) => c.type === 'income')).toBe(true);
  });

  test('crea una categoría nueva', async ({ request }) => {
    const res = await request.post('/api/categories', {
      data: { name: 'Mascotas', type: 'expense', icon: 'Dog', color: '#ffaa00' },
    });

    expect(res.status()).toBe(201);
    const body = await res.json();
    expect(body).toMatchObject({ name: 'Mascotas', type: 'expense' });
  });

  test('rechaza type fuera del enum con 400', async ({ request }) => {
    const res = await request.post('/api/categories', {
      data: { name: 'x', type: 'ahorro' },
    });

    expect(res.status()).toBe(400);
  });

  test('actualiza una categoría', async ({ request }) => {
    const created = await (
      await request.post('/api/categories', { data: { name: 'Original', type: 'expense' } })
    ).json();

    const res = await request.patch(`/api/categories/${created.id}`, {
      data: { name: 'Renombrada' },
    });

    expect(res.ok()).toBeTruthy();
    expect((await res.json()).name).toBe('Renombrada');
  });

  test('elimina una categoría sin transacciones asociadas', async ({ request }) => {
    const created = await (
      await request.post('/api/categories', { data: { name: 'Borrable', type: 'expense' } })
    ).json();

    const res = await request.delete(`/api/categories/${created.id}`);
    expect(res.status()).toBe(204);
  });

  test('no permite eliminar una categoría con transacciones asociadas (400)', async ({
    request,
  }) => {
    const category = await (
      await request.post('/api/categories', {
        data: { name: 'Con transacciones', type: 'expense' },
      })
    ).json();
    const account = await (
      await request.post('/api/accounts', { data: { name: 'Cuenta', type: 'bank', balance: 100 } })
    ).json();
    await request.post('/api/transactions', {
      data: {
        amount: 20,
        type: 'expense',
        accountId: account.id,
        categoryId: category.id,
      },
    });

    const res = await request.delete(`/api/categories/${category.id}`);

    expect(res.status()).toBe(400);
  });

  test('404 al pedir una categoría inexistente', async ({ request }) => {
    const res = await request.get('/api/categories/00000000-0000-0000-0000-000000000000');
    expect(res.status()).toBe(404);
  });

  test('aislamiento multi-tenant: no puede editar la categoría de otro usuario (404)', async ({
    request,
  }) => {
    const category = await (
      await request.post('/api/categories', { data: { name: 'Ajena', type: 'expense' } })
    ).json();

    await registerUser(request);

    const res = await request.patch(`/api/categories/${category.id}`, {
      data: { name: 'Hackeada' },
    });
    expect(res.status()).toBe(404);
  });
});
