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
}

test.describe('Notifications API', () => {
  test('usuario nuevo: lista vacía y contador de no leídas en cero', async ({ request }) => {
    await registerUser(request);

    const res = await request.get('/api/notifications');

    expect(res.ok()).toBeTruthy();
    const body = await res.json();
    expect(body.notifications).toEqual([]);
    expect(body.unreadCount).toBe(0);
  });

  test('markAllAsRead responde éxito incluso sin notificaciones', async ({ request }) => {
    await registerUser(request);

    const res = await request.patch('/api/notifications/read-all');

    expect(res.ok()).toBeTruthy();
  });

  test('getPreferences devuelve las preferencias por defecto', async ({ request }) => {
    await registerUser(request);

    const res = await request.get('/api/notifications/preferences');

    expect(res.ok()).toBeTruthy();
    const prefs = await res.json();
    expect(prefs).toMatchObject({
      categoryLimit: true,
      debtDue: true,
      monthlyEmail: true,
    });
  });

  test('updatePreferences persiste el cambio', async ({ request }) => {
    await registerUser(request);

    const patchRes = await request.patch('/api/notifications/preferences', {
      data: { monthlyEmail: false },
    });
    expect(patchRes.ok()).toBeTruthy();

    const getRes = await request.get('/api/notifications/preferences');
    const prefs = await getRes.json();
    expect(prefs.monthlyEmail).toBe(false);
  });

  test('markAsRead/deleteNotification sobre un id inexistente responde 404', async ({
    request,
  }) => {
    await registerUser(request);

    const readRes = await request.patch('/api/notifications/does-not-exist/read');
    expect(readRes.status()).toBe(404);

    const deleteRes = await request.delete('/api/notifications/does-not-exist');
    expect(deleteRes.status()).toBe(404);
  });
});
