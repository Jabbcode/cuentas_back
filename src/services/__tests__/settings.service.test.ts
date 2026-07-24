import { describe, it, expect, vi, beforeEach } from 'vitest';
import bcrypt from 'bcrypt';
import type { User, Category } from '@prisma/client';
import type { UsersService } from '../users.service.port.js';
import type { AccountsService } from '../accounts.service.port.js';
import type { CategoriesService, CategorySpending } from '../categories.service.port.js';
import type {
  FixedExpensesService,
  FixedExpensesSummary,
  AutoGenerateSummary,
} from '../fixed-expenses.service.port.js';
import type { DebtsService, DebtsSummary } from '../debts.service.port.js';
import type { TransactionsService } from '../transactions.service.port.js';
import { ConflictError, ValidationError } from '../../lib/errors.js';
import { SettingsServiceImpl } from '../settings.service.js';

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

function fakeUsersService(overrides: Partial<UsersService> = {}): UsersService {
  return {
    findUserById: async () => fakeUser(),
    findDuplicateEmail: async () => null,
    getAllUsersForSummaries: async () => [],
    updateNotificationPreferences: async () => fakeUser(),
    updateProfile: async () => fakeUser(),
    updatePassword: async () => fakeUser(),
    deleteUser: async () => fakeUser(),
    ...overrides,
  };
}

function fakeAccountsService(overrides: Partial<AccountsService> = {}): AccountsService {
  return {
    getAccounts: async () => [],
    getAccountById: async () => {
      throw new Error('not used in these tests');
    },
    findAccountById: async () => null,
    getCreditCards: async () => [],
    getConfiguredCreditCards: async () => [],
    countByUser: async () => 0,
    createAccount: async () => {
      throw new Error('not used in these tests');
    },
    updateAccount: async () => {
      throw new Error('not used in these tests');
    },
    deleteAccount: async () => {
      throw new Error('not used in these tests');
    },
    transferFunds: async () => {
      throw new Error('not used in these tests');
    },
    getTransfersByAccount: async () => [],
    updateAccountBalance: async () => undefined,
    ...overrides,
  };
}

function fakeCategoriesService(overrides: Partial<CategoriesService> = {}): CategoriesService {
  return {
    getCategories: async () => [],
    getCategoryById: async () => {
      throw new Error('not used in these tests');
    },
    createCategory: async () => {
      throw new Error('not used in these tests');
    },
    updateCategory: async () => {
      throw new Error('not used in these tests');
    },
    deleteCategory: async () => {
      throw new Error('not used in these tests');
    },
    getCategorySpending: async () => ({}) as CategorySpending,
    hydrateCategoriesByIds: async () => [],
    hydrateUserCategoriesByIds: async () => [],
    getOrCreateSystemCategory: async () => ({}) as Category,
    countByUser: async () => 0,
    ...overrides,
  };
}

function fakeFixedExpensesService(
  overrides: Partial<FixedExpensesService> = {}
): FixedExpensesService {
  return {
    getFixedExpenses: async () => [],
    getFixedExpenseById: async () => {
      throw new Error('not used in these tests');
    },
    createFixedExpense: async () => {
      throw new Error('not used in these tests');
    },
    updateFixedExpense: async () => {
      throw new Error('not used in these tests');
    },
    deleteFixedExpense: async () => {
      throw new Error('not used in these tests');
    },
    payFixedExpense: async () => {
      throw new Error('not used in these tests');
    },
    getFixedExpensesSummary: async () => ({}) as FixedExpensesSummary,
    reorderFixedExpenses: async () => ({ success: true }),
    autoGenerateFixedExpenseTransactions: async () => ({}) as AutoGenerateSummary,
    getActiveFixedExpenses: async () => [],
    getActiveFixedExpensesWithCategory: async () => [],
    getActiveExpenseFixedExpenses: async () => [],
    countByUser: async () => 0,
    ...overrides,
  };
}

function fakeDebtsService(overrides: Partial<DebtsService> = {}): DebtsService {
  return {
    createDebt: async () => {
      throw new Error('not used in these tests');
    },
    getDebts: async () => [],
    getDebtById: async () => {
      throw new Error('not used in these tests');
    },
    updateDebt: async () => {
      throw new Error('not used in these tests');
    },
    deleteDebt: async () => {
      throw new Error('not used in these tests');
    },
    payDebt: async () => {
      throw new Error('not used in these tests');
    },
    getDebtsSummary: async () => ({}) as DebtsSummary,
    countByUser: async () => 0,
    ...overrides,
  };
}

function fakeTransactionsService(
  overrides: Partial<TransactionsService> = {}
): TransactionsService {
  return {
    getTransactions: async () => {
      throw new Error('not used in these tests');
    },
    getTransactionById: async () => {
      throw new Error('not used in these tests');
    },
    createTransaction: async () => {
      throw new Error('not used in these tests');
    },
    updateTransaction: async () => {
      throw new Error('not used in these tests');
    },
    deleteTransaction: async () => {
      throw new Error('not used in these tests');
    },
    getTransactionSummary: async () => [],
    getReceiptItems: async () => [],
    countByCategory: async () => 0,
    findMonthlyCategoryExpenses: async () => [],
    findCardStatementTransactions: async () => [],
    findFixedExpensePaymentInMonth: async () => null,
    resyncTransactionsForFixedExpense: async () => ({ count: 0 }),
    getMonthlyTotalByType: async () => ({ _sum: { amount: null } }),
    getVariableExpenseTotal: async () => ({ _sum: { amount: null } }),
    getCategoryBreakdown: async () => [],
    findTransactionsSince: async () => [],
    getTopExpenseCategories: async () => [],
    getUserTotalsByType: async () => [],
    getExpensesByUserAndCategory: async () => [],
    countByUser: async () => 0,
    getFirstTransactionDate: async () => null,
    findByImageHash: async () => null,
    findSimilarByAmountAndDate: async () => [],
    ...overrides,
  };
}

function buildService(
  deps: {
    usersService?: Partial<UsersService>;
    accountsService?: Partial<AccountsService>;
    categoriesService?: Partial<CategoriesService>;
    fixedExpensesService?: Partial<FixedExpensesService>;
    debtsService?: Partial<DebtsService>;
    transactionsService?: Partial<TransactionsService>;
  } = {}
): SettingsServiceImpl {
  return new SettingsServiceImpl(
    fakeUsersService(deps.usersService),
    fakeAccountsService(deps.accountsService),
    fakeCategoriesService(deps.categoriesService),
    fakeFixedExpensesService(deps.fixedExpensesService),
    fakeDebtsService(deps.debtsService),
    fakeTransactionsService(deps.transactionsService)
  );
}

describe('SettingsServiceImpl', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('getUserProfile (usa UsersService.findUserById — nunca expone password)', () => {
    it('lanza NotFoundError si el usuario no existe', async () => {
      const service = buildService({ usersService: { findUserById: async () => null } });

      await expect(service.getUserProfile('user-1')).rejects.toThrow('Usuario no encontrado');
    });

    it('devuelve solo id/email/name/createdAt — nunca el hash de password', async () => {
      const service = buildService({
        usersService: { findUserById: async () => fakeUser({ password: 'hash-secreto' }) },
      });

      const profile = await service.getUserProfile('user-1');

      expect(profile).toEqual({
        id: 'user-1',
        email: 'user@example.com',
        name: 'Usuario Test',
        createdAt: expect.any(Date),
      });
      expect(profile).not.toHaveProperty('password');
    });
  });

  describe('updateUserProfile (usa UsersService.findDuplicateEmail / updateProfile)', () => {
    it('lanza ConflictError con AUTH_MESSAGES.EMAIL_TAKEN si el email ya existe', async () => {
      const service = buildService({
        usersService: { findDuplicateEmail: async () => fakeUser({ id: 'other-user' }) },
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
        usersService: { findDuplicateEmail: async () => null, updateProfile: async () => updated },
      });

      await expect(service.updateUserProfile('user-1', { name: 'Nuevo Nombre' })).resolves.toEqual(
        expect.objectContaining({ name: 'Nuevo Nombre' })
      );
    });

    it('nunca expone el hash de password, aunque updateProfile devuelva el User completo', async () => {
      const service = buildService({
        usersService: {
          findDuplicateEmail: async () => null,
          updateProfile: async () => fakeUser({ password: 'hash-secreto' }),
        },
      });

      const profile = await service.updateUserProfile('user-1', { name: 'Nuevo Nombre' });

      expect(profile).not.toHaveProperty('password');
    });
  });

  describe('changePassword (usa UsersService.findUserById / updatePassword)', () => {
    it('lanza ValidationError con el mensaje traducido si la contraseña actual es incorrecta', async () => {
      const service = buildService({
        usersService: { findUserById: async () => fakeUser() },
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
      const updatePassword = vi.fn().mockResolvedValue(fakeUser());
      const service = buildService({
        usersService: { findUserById: async () => fakeUser(), updatePassword },
      });

      await expect(
        service.changePassword('user-1', {
          currentPassword: 'correct-password',
          newPassword: 'new-password',
        })
      ).resolves.toEqual({ message: 'Password changed successfully' });
      expect(updatePassword).toHaveBeenCalledWith('user-1', expect.any(String));
    });
  });

  describe('getAccountStatistics (usa countByUser de accounts/categories/fixedExpenses/debts/transactions)', () => {
    it('agrega los conteos de todos los dominios', async () => {
      const memberSince = new Date('2025-01-15T00:00:00.000Z');
      const service = buildService({
        accountsService: { countByUser: async () => 2 },
        categoriesService: { countByUser: async () => 5 },
        fixedExpensesService: { countByUser: async () => 4 },
        debtsService: { countByUser: async () => 3 },
        transactionsService: {
          countByUser: async () => 7,
          getFirstTransactionDate: async () => ({ date: memberSince }),
        },
      });

      const stats = await service.getAccountStatistics('user-1');

      expect(stats).toEqual(
        expect.objectContaining({
          accounts: 2,
          categories: 5,
          fixedExpenses: 4,
          debts: 3,
          transactions: 7,
          memberSince,
        })
      );
    });
  });
});
