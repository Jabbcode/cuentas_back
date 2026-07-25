import { describe, it, expect, vi, beforeEach } from 'vitest';
import bcrypt from 'bcrypt';
import type { User } from '@prisma/client';
import type { UserRepository } from '../../repositories/user.repository.port.js';
import type { AccountRepository } from '../../repositories/account.repository.port.js';
import type { CategoryRepository } from '../../repositories/category.repository.port.js';
import type { FixedExpenseRepository } from '../../repositories/fixed-expense.repository.port.js';
import { ConflictError, ValidationError } from '../../lib/errors.js';

vi.mock('../../repositories/transaction.repository.js', () => ({
  countByUser: vi.fn().mockResolvedValue(0),
  findFirstByUser: vi.fn().mockResolvedValue(null),
}));

vi.mock('../../repositories/debt.repository.js', () => ({
  countByUser: vi.fn(),
}));

import * as debtRepo from '../../repositories/debt.repository.js';
import { SettingsServiceImpl } from '../settings.service.js';

const mockedDebtCountByUser = debtRepo.countByUser as unknown as ReturnType<typeof vi.fn>;

function fakeUser(overrides: Partial<User> = {}): User {
  return {
    id: 'user-1',
    email: 'user@example.com',
    name: 'Usuario Test',
    password: bcrypt.hashSync('correct-password', 10),
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

function fakeAccountRepo(overrides: Partial<AccountRepository> = {}): AccountRepository {
  return {
    findAllByUser: async () => [],
    findByIdAndUser: async () => null,
    findCreditCardsByUser: async () => [],
    countByUser: async () => 0,
    create: async () => {
      throw new Error('not used in these tests');
    },
    update: async () => {
      throw new Error('not used in these tests');
    },
    updateBalance: async () => {
      throw new Error('not used in these tests');
    },
    decrementBalance: async () => {
      throw new Error('not used in these tests');
    },
    remove: async () => {
      throw new Error('not used in these tests');
    },
    createTransfer: async () => {
      throw new Error('not used in these tests');
    },
    findTransfersByAccount: async () => [],
    ...overrides,
  };
}

function fakeCategoryRepo(overrides: Partial<CategoryRepository> = {}): CategoryRepository {
  return {
    findAllByUser: async () => [],
    findByIdAndUser: async () => null,
    findFirst: async () => null,
    findMany: async () => [],
    countByUser: async () => 0,
    create: async () => {
      throw new Error('not used in these tests');
    },
    update: async () => {
      throw new Error('not used in these tests');
    },
    remove: async () => {
      throw new Error('not used in these tests');
    },
    upsertSystemCategory: async () => {
      throw new Error('not used in these tests');
    },
    ...overrides,
  };
}

function fakeFixedExpenseRepo(
  overrides: Partial<FixedExpenseRepository> = {}
): FixedExpenseRepository {
  return {
    findAllByUser: async () => [],
    findByIdAndUser: async () => null,
    findFirst: async () => null,
    findMany: async () => [],
    countByUser: async () => 0,
    create: async () => {
      throw new Error('not used in these tests');
    },
    update: async () => {
      throw new Error('not used in these tests');
    },
    remove: async () => {
      throw new Error('not used in these tests');
    },
    ...overrides,
  };
}

function buildService(
  deps: {
    userRepo?: UserRepository;
    accountRepo?: AccountRepository;
    categoryRepo?: CategoryRepository;
    fixedExpenseRepo?: FixedExpenseRepository;
  } = {}
): SettingsServiceImpl {
  return new SettingsServiceImpl(
    deps.userRepo ?? fakeUserRepo(),
    deps.accountRepo ?? fakeAccountRepo(),
    deps.categoryRepo ?? fakeCategoryRepo(),
    deps.fixedExpenseRepo ?? fakeFixedExpenseRepo()
  );
}

describe('SettingsServiceImpl', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('updateUserProfile', () => {
    it('lanza ConflictError con AUTH_MESSAGES.EMAIL_TAKEN si el email ya existe', async () => {
      const service = buildService({
        userRepo: fakeUserRepo({ findFirst: async () => fakeUser({ id: 'other-user' }) }),
      });

      await expect(
        service.updateUserProfile('user-1', { email: 'tomado@example.com' })
      ).rejects.toThrow('El email ya está registrado');
      await expect(
        service.updateUserProfile('user-1', { email: 'tomado@example.com' })
      ).rejects.toBeInstanceOf(ConflictError);
    });

    it('actualiza el perfil si el email no está en uso', async () => {
      const updated = fakeUser({ name: 'Nuevo Nombre' });
      const service = buildService({
        userRepo: fakeUserRepo({ findFirst: async () => null, update: async () => updated }),
      });

      await expect(service.updateUserProfile('user-1', { name: 'Nuevo Nombre' })).resolves.toEqual(
        expect.objectContaining({ name: 'Nuevo Nombre' })
      );
    });
  });

  describe('changePassword', () => {
    it('lanza ValidationError con el mensaje traducido si la contraseña actual es incorrecta', async () => {
      const service = buildService({
        userRepo: fakeUserRepo({ findById: async () => fakeUser() }),
      });

      await expect(
        service.changePassword('user-1', {
          currentPassword: 'wrong-password',
          newPassword: 'new-password',
        })
      ).rejects.toThrow('La contraseña actual es incorrecta');
      await expect(
        service.changePassword('user-1', {
          currentPassword: 'wrong-password',
          newPassword: 'new-password',
        })
      ).rejects.toBeInstanceOf(ValidationError);
    });

    it('cambia la contraseña si la actual es correcta', async () => {
      const update = vi.fn().mockResolvedValue(fakeUser());
      const service = buildService({
        userRepo: fakeUserRepo({ findById: async () => fakeUser(), update }),
      });

      await expect(
        service.changePassword('user-1', {
          currentPassword: 'correct-password',
          newPassword: 'new-password',
        })
      ).resolves.toEqual({ message: 'Password changed successfully' });
      expect(update).toHaveBeenCalledWith('user-1', { password: expect.any(String) });
    });
  });

  describe('getAccountStatistics', () => {
    it('agrega los conteos de todos los dominios, incluida la deuda (vi.mock de debt.repository.js)', async () => {
      mockedDebtCountByUser.mockResolvedValue(3);
      const service = buildService({
        accountRepo: fakeAccountRepo({ countByUser: async () => 2 }),
        categoryRepo: fakeCategoryRepo({ countByUser: async () => 5 }),
        fixedExpenseRepo: fakeFixedExpenseRepo({ countByUser: async () => 4 }),
      });

      const stats = await service.getAccountStatistics('user-1');

      expect(stats).toEqual(
        expect.objectContaining({
          accounts: 2,
          categories: 5,
          fixedExpenses: 4,
          debts: 3,
        })
      );
      expect(mockedDebtCountByUser).toHaveBeenCalledWith('user-1');
    });
  });
});
