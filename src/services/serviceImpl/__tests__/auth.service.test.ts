import { describe, it, expect, vi } from 'vitest';
import bcrypt from 'bcrypt';
import type { User } from '@prisma/client';
import type { UserRepository } from '../../../repositories/interfaces/user.repository.port.js';
import { AuthServiceImpl } from '../auth.service.js';

vi.mock('../../../lib/seed.js', () => ({
  seedCategories: vi.fn(async () => undefined),
}));

function fakeUser(overrides: Partial<User> = {}): User {
  return {
    id: 'user-1',
    email: 'test@test.com',
    password: 'hashed',
    name: 'Test User',
    createdAt: new Date(),
    ...overrides,
  } as unknown as User;
}

function fakeUserRepo(overrides: Partial<UserRepository> = {}): UserRepository {
  return {
    findByEmail: async () => null,
    findById: async () => null,
    findFirst: async () => null,
    findMany: async () => [],
    create: async () => fakeUser(),
    update: async () => fakeUser(),
    remove: async () => fakeUser(),
    ...overrides,
  };
}

describe('AuthServiceImpl', () => {
  describe('register', () => {
    it('lanza si el email ya está registrado', async () => {
      const repo = fakeUserRepo({ findByEmail: async () => fakeUser() });
      const service = new AuthServiceImpl(repo);

      await expect(
        service.register({ email: 'test@test.com', password: '123456', name: 'Test' })
      ).rejects.toThrow('El email ya está registrado');
    });

    it('en éxito devuelve { user, token }', async () => {
      const hashed = await bcrypt.hash('123456', 10);
      const repo = fakeUserRepo({
        findByEmail: async () => null,
        create: async () => fakeUser({ password: hashed }),
      });
      const service = new AuthServiceImpl(repo);

      const result = await service.register({
        email: 'test@test.com',
        password: '123456',
        name: 'Test User',
      });

      expect(result.user).toEqual({ id: 'user-1', email: 'test@test.com', name: 'Test User' });
      expect(typeof result.token).toBe('string');
    });
  });

  describe('login', () => {
    it('lanza si el usuario no existe', async () => {
      const repo = fakeUserRepo({ findByEmail: async () => null });
      const service = new AuthServiceImpl(repo);

      await expect(service.login({ email: 'nope@test.com', password: '123456' })).rejects.toThrow(
        'Credenciales inválidas'
      );
    });

    it('lanza si el password no coincide', async () => {
      const hashed = await bcrypt.hash('correct-password', 10);
      const repo = fakeUserRepo({ findByEmail: async () => fakeUser({ password: hashed }) });
      const service = new AuthServiceImpl(repo);

      await expect(
        service.login({ email: 'test@test.com', password: 'wrong-password' })
      ).rejects.toThrow('Credenciales inválidas');
    });

    it('en éxito devuelve { user, token } sin exponer el hash de password', async () => {
      const hashed = await bcrypt.hash('correct-password', 10);
      const repo = fakeUserRepo({
        findByEmail: async () => fakeUser({ password: hashed }),
      });
      const service = new AuthServiceImpl(repo);

      const result = await service.login({
        email: 'test@test.com',
        password: 'correct-password',
      });

      expect(result.user).toEqual({ id: 'user-1', email: 'test@test.com', name: 'Test User' });
      expect(result.user).not.toHaveProperty('password');
      expect(typeof result.token).toBe('string');
    });
  });

  describe('getMe', () => {
    it('lanza si el usuario no existe', async () => {
      const repo = fakeUserRepo({ findById: async () => null });
      const service = new AuthServiceImpl(repo);

      await expect(service.getMe('user-1')).rejects.toThrow('Usuario no encontrado');
    });

    it('en éxito devuelve el perfil consultando solo los campos seleccionados', async () => {
      const findById = vi.fn().mockResolvedValue({
        id: 'user-1',
        email: 'test@test.com',
        name: 'Test User',
        createdAt: fakeUser().createdAt,
      });
      const repo = fakeUserRepo({ findById });
      const service = new AuthServiceImpl(repo);

      const result = await service.getMe('user-1');

      expect(result).toEqual({
        id: 'user-1',
        email: 'test@test.com',
        name: 'Test User',
        createdAt: expect.any(Date),
      });
      expect(findById).toHaveBeenCalledWith('user-1', {
        id: true,
        email: true,
        name: true,
        createdAt: true,
      });
    });
  });
});
