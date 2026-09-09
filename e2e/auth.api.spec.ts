import { test, expect } from '@playwright/test';
import { uniqueEmail } from './api-helpers';

test.describe('Auth API', () => {
  test('registra un usuario nuevo y setea la cookie de sesión', async ({ request }) => {
    const email = uniqueEmail();
    const res = await request.post('/api/auth/register', {
      data: { email, password: 'password123', name: 'E2E User' },
    });

    expect(res.status()).toBe(201);
    const body = await res.json();
    expect(body.user.email).toBe(email);
    expect(res.headers()['set-cookie']).toBeTruthy();
  });

  test('rechaza registro con email duplicado', async ({ request }) => {
    const email = uniqueEmail();
    const data = { email, password: 'password123', name: 'E2E User' };

    await request.post('/api/auth/register', { data });
    const res = await request.post('/api/auth/register', { data });

    expect(res.status()).toBe(400);
  });

  test('login con credenciales correctas responde 200', async ({ request }) => {
    const email = uniqueEmail();
    const password = 'password123';
    await request.post('/api/auth/register', { data: { email, password, name: 'E2E User' } });

    const res = await request.post('/api/auth/login', { data: { email, password } });

    expect(res.ok()).toBeTruthy();
  });

  test('login con credenciales inválidas responde 401', async ({ request }) => {
    const res = await request.post('/api/auth/login', {
      data: { email: uniqueEmail(), password: 'wrongpassword' },
    });

    expect(res.status()).toBe(401);
  });

  test('/me sin cookie responde 401', async ({ request }) => {
    const res = await request.get('/api/auth/me');
    expect(res.status()).toBe(401);
  });

  test('/me con sesión activa devuelve el usuario autenticado', async ({ request }) => {
    const email = uniqueEmail();
    const password = 'password123';
    await request.post('/api/auth/register', { data: { email, password, name: 'E2E User' } });

    const res = await request.get('/api/auth/me');

    expect(res.ok()).toBeTruthy();
    const me = await res.json();
    expect(me.email).toBe(email);
  });
});
