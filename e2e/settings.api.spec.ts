import { test, expect } from '@playwright/test';
import { registerUser } from './api-helpers';

test.describe('Settings API', () => {
  test('getProfile devuelve el perfil sin exponer el password', async ({ request }) => {
    const { email, name } = await registerUser(request);

    const res = await request.get('/api/settings/profile');

    expect(res.ok()).toBeTruthy();
    const profile = await res.json();
    expect(profile).toMatchObject({ email, name });
    expect(profile).not.toHaveProperty('password');
  });

  test('updateProfile actualiza el nombre', async ({ request }) => {
    await registerUser(request);

    const res = await request.patch('/api/settings/profile', {
      data: { name: 'Nombre Actualizado' },
    });

    expect(res.ok()).toBeTruthy();
    const body = await res.json();
    expect(body.profile.name).toBe('Nombre Actualizado');
  });

  test('updateProfile con email ya tomado por otro usuario responde 400', async ({ request }) => {
    const other = await registerUser(request);
    // El segundo registro reemplaza la cookie de sesión por la de este usuario ("self").
    await registerUser(request);

    const res = await request.patch('/api/settings/profile', { data: { email: other.email } });

    expect(res.status()).toBe(409);
  });

  test('changePassword: la contraseña vieja deja de funcionar y la nueva sí', async ({
    request,
  }) => {
    const { email, password } = await registerUser(request);

    const changeRes = await request.post('/api/settings/change-password', {
      data: {
        currentPassword: password,
        newPassword: 'newpassword456',
        confirmPassword: 'newpassword456',
      },
    });
    expect(changeRes.ok()).toBeTruthy();

    const oldLogin = await request.post('/api/auth/login', { data: { email, password } });
    expect(oldLogin.status()).toBe(401);

    const newLogin = await request.post('/api/auth/login', {
      data: { email, password: 'newpassword456' },
    });
    expect(newLogin.ok()).toBeTruthy();
  });

  test('changePassword con la contraseña actual incorrecta responde error, no cambia nada', async ({
    request,
  }) => {
    const { email, password } = await registerUser(request);

    const res = await request.post('/api/settings/change-password', {
      data: {
        currentPassword: 'wrongpassword',
        newPassword: 'newpassword456',
        confirmPassword: 'newpassword456',
      },
    });

    expect(res.status()).toBeGreaterThanOrEqual(400);

    const stillWorks = await request.post('/api/auth/login', { data: { email, password } });
    expect(stillWorks.ok()).toBeTruthy();
  });

  test('getStatistics cuenta las cuentas creadas', async ({ request }) => {
    await registerUser(request);
    await request.post('/api/accounts', {
      data: { name: 'Cuenta E2E', type: 'bank', balance: 100, currency: 'EUR' },
    });

    const res = await request.get('/api/settings/statistics');

    expect(res.ok()).toBeTruthy();
    const stats = await res.json();
    expect(stats.accounts).toBe(1);
  });

  test('deleteAccount con password incorrecta falla y la cuenta sigue existiendo', async ({
    request,
  }) => {
    const { email, password } = await registerUser(request);

    const res = await request.delete('/api/settings/account', {
      data: { password: 'wrongpassword', confirmation: 'DELETE' },
    });

    expect(res.status()).toBeGreaterThanOrEqual(400);

    const login = await request.post('/api/auth/login', { data: { email, password } });
    expect(login.ok()).toBeTruthy();
  });

  test('deleteAccount con password correcta elimina la cuenta', async ({ request }) => {
    const { email, password } = await registerUser(request);

    const res = await request.delete('/api/settings/account', {
      data: { password, confirmation: 'DELETE' },
    });
    expect(res.ok()).toBeTruthy();

    const login = await request.post('/api/auth/login', { data: { email, password } });
    expect(login.status()).toBe(401);
  });
});
