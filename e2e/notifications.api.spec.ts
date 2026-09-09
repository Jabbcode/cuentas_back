import { test, expect, request as apiRequest } from '@playwright/test';
import { PrismaClient } from '@prisma/client';
import { registerUser } from './api-helpers';

// Misma DB efímera que docker-compose.test.yml/.env.test — el proceso de Playwright
// no carga .env.test (solo el webServer del backend lo hace), así que se apunta
// directo a la URL conocida del contenedor de test.
const TEST_DATABASE_URL =
  'postgresql://postgres:postgres@localhost:5433/cuentas_test?schema=public';

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

  test('aislamiento multi-tenant: el usuario B no puede leer, marcar ni borrar una notificación real de A', async () => {
    const contextA = await apiRequest.newContext({ baseURL: 'http://localhost:3001' });
    const contextB = await apiRequest.newContext({ baseURL: 'http://localhost:3001' });
    const prisma = new PrismaClient({ datasources: { db: { url: TEST_DATABASE_URL } } });

    try {
      const userA = await registerUser(contextA);
      await registerUser(contextB);

      // No hay endpoint público para crear una notificación (las genera el cron) —
      // se siembra directo en la DB de test para probar el filtro de ownership real.
      const notification = await prisma.notification.create({
        data: {
          userId: userA.id,
          type: 'debt_due',
          title: 'Pago próximo a vencer',
          message: 'Deuda E2E vence en 3 días',
        },
      });

      const readRes = await contextB.patch(`/api/notifications/${notification.id}/read`);
      expect(readRes.status()).toBe(404);

      const deleteRes = await contextB.delete(`/api/notifications/${notification.id}`);
      expect(deleteRes.status()).toBe(404);

      // La notificación de A sigue intacta y sin leer
      const listA = await (await contextA.get('/api/notifications')).json();
      const stillThere = listA.notifications.find((n: { id: string }) => n.id === notification.id);
      expect(stillThere).toBeDefined();
      expect(stillThere.read).toBe(false);
    } finally {
      await prisma.$disconnect();
      await contextA.dispose();
      await contextB.dispose();
    }
  });
});
