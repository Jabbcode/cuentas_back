import { describe, it, expect } from 'vitest';
import type { User } from '@prisma/client';
import type { UserRepository } from '../../repositories/user.repository.port.js';
import { UsersServiceImpl } from '../users.service.js';

function fakeUser(overrides: Partial<User> = {}): User {
  return {
    id: 'user-1',
    email: 'user@test.com',
    name: 'Usuario Test',
    password: 'hashed-password',
    notificationPreferences: { categoryLimit: true, debtDue: true, monthlyEmail: true },
    createdAt: new Date(),
    ...overrides,
  } as unknown as User;
}

function fakeUserRepo(overrides: Partial<UserRepository> = {}): UserRepository {
  return {
    findByEmail: async () => null,
    findById: async () => fakeUser(),
    findFirst: async () => null,
    findMany: async () => [],
    create: async () => fakeUser(),
    update: async () => fakeUser(),
    remove: async () => fakeUser(),
    ...overrides,
  };
}

describe('UsersServiceImpl', () => {
  describe('findUserById (null-returning)', () => {
    it('devuelve null si el repo no encuentra al usuario', async () => {
      const service = new UsersServiceImpl(fakeUserRepo({ findById: async () => null }));

      await expect(service.findUserById('user-1')).resolves.toBeNull();
    });

    it('devuelve el usuario completo si existe', async () => {
      const user = fakeUser();
      const service = new UsersServiceImpl(fakeUserRepo({ findById: async () => user }));

      await expect(service.findUserById('user-1')).resolves.toEqual(user);
    });
  });

  describe('findDuplicateEmail', () => {
    it('excluye al propio usuario de la búsqueda (NOT id)', async () => {
      const calls: unknown[] = [];
      const service = new UsersServiceImpl(
        fakeUserRepo({
          findFirst: async (where) => {
            calls.push(where);
            return null;
          },
        })
      );

      await service.findDuplicateEmail('tomado@example.com', 'user-1');

      expect(calls).toEqual([{ email: 'tomado@example.com', NOT: { id: 'user-1' } }]);
    });

    it('devuelve el usuario si el email ya está en uso por otro', async () => {
      const other = fakeUser({ id: 'other-user' });
      const service = new UsersServiceImpl(fakeUserRepo({ findFirst: async () => other }));

      await expect(service.findDuplicateEmail('tomado@example.com', 'user-1')).resolves.toEqual(
        other
      );
    });
  });

  describe('getAllUsersForSummaries', () => {
    it('consulta sin filtro de usuario, con select acotado (batch de sistema)', async () => {
      const calls: unknown[] = [];
      const users = [fakeUser(), fakeUser({ id: 'user-2' })];
      const service = new UsersServiceImpl(
        fakeUserRepo({
          findMany: async (where, select) => {
            calls.push({ where, select });
            return users;
          },
        })
      );

      await expect(service.getAllUsersForSummaries()).resolves.toEqual(users);
      expect(calls).toEqual([
        { where: {}, select: { id: true, email: true, name: true, notificationPreferences: true } },
      ]);
    });
  });

  describe('updateNotificationPreferences', () => {
    it('persiste solo el campo notificationPreferences', async () => {
      const calls: unknown[] = [];
      const updated = fakeUser({ notificationPreferences: { monthlyEmail: false } });
      const service = new UsersServiceImpl(
        fakeUserRepo({
          update: async (id, data) => {
            calls.push({ id, data });
            return updated;
          },
        })
      );

      const prefs = { categoryLimit: true, debtDue: true, monthlyEmail: false };
      await expect(service.updateNotificationPreferences('user-1', prefs)).resolves.toEqual(
        updated
      );
      expect(calls).toEqual([{ id: 'user-1', data: { notificationPreferences: prefs } }]);
    });
  });

  describe('updateProfile / updatePassword / deleteUser', () => {
    it('updateProfile persiste name/email tal cual se reciben', async () => {
      const calls: unknown[] = [];
      const updated = fakeUser({ name: 'Nuevo Nombre' });
      const service = new UsersServiceImpl(
        fakeUserRepo({
          update: async (id, data) => {
            calls.push({ id, data });
            return updated;
          },
        })
      );

      await expect(service.updateProfile('user-1', { name: 'Nuevo Nombre' })).resolves.toEqual(
        updated
      );
      expect(calls).toEqual([{ id: 'user-1', data: { name: 'Nuevo Nombre' } }]);
    });

    it('updatePassword persiste el hash recibido en el campo password', async () => {
      const calls: unknown[] = [];
      const service = new UsersServiceImpl(
        fakeUserRepo({
          update: async (id, data) => {
            calls.push({ id, data });
            return fakeUser();
          },
        })
      );

      await service.updatePassword('user-1', 'nuevo-hash');

      expect(calls).toEqual([{ id: 'user-1', data: { password: 'nuevo-hash' } }]);
    });

    it('deleteUser delega en userRepo.remove', async () => {
      const removed = fakeUser();
      const service = new UsersServiceImpl(fakeUserRepo({ remove: async () => removed }));

      await expect(service.deleteUser('user-1')).resolves.toEqual(removed);
    });
  });
});
