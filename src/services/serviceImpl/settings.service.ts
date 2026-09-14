import bcrypt from 'bcrypt';
import { UpdateProfileInput, ChangePasswordInput } from '../../schemas/settings.schema.js';
import { NotFoundError, ConflictError, ValidationError } from '../../lib/errors.js';
import { createLogger } from '../../lib/logger.js';
import { AUTH_MESSAGES } from '../../lib/constants/auth.constants.js';
import { SETTINGS_MESSAGES } from '../../lib/constants/settings.constants.js';
import type {
  SettingsService,
  UserProfile,
  AccountStatistics,
} from '../interfaces/settings.service.port.js';
import type { TransactionsService } from '../interfaces/transactions.service.port.js';
import type { UsersService } from '../interfaces/users.service.port.js';
import type { AccountsService } from '../interfaces/accounts.service.port.js';
import type { CategoriesService } from '../interfaces/categories.service.port.js';
import type { FixedExpensesService } from '../interfaces/fixed-expenses.service.port.js';
import type { DebtsService } from '../interfaces/debts.service.port.js';

const logger = createLogger('SETTINGS');

export class SettingsServiceImpl implements SettingsService {
  constructor(
    private usersService: UsersService,
    private accountsService: AccountsService,
    private categoriesService: CategoriesService,
    private fixedExpensesService: FixedExpensesService,
    private debtsService: DebtsService,
    private transactionsService: TransactionsService
  ) {}

  async getUserProfile(userId: string): Promise<UserProfile> {
    try {
      const user = await this.usersService.findUserById(userId);

      if (!user) {
        throw new NotFoundError(AUTH_MESSAGES.USER_NOT_FOUND);
      }

      // findUserById devuelve el User completo (incl. password) — se filtra
      // explícitamente antes de exponerlo, nunca se castea el objeto entero.
      return { id: user.id, email: user.email, name: user.name, createdAt: user.createdAt };
    } catch (error) {
      return logger.fail(error, 'No se pudo obtener el perfil del usuario {}', userId);
    }
  }

  async updateUserProfile(userId: string, data: UpdateProfileInput): Promise<UserProfile> {
    try {
      // Check if email is being changed and if it's already taken
      if (data.email) {
        const existingUser = await this.usersService.findDuplicateEmail(data.email, userId);

        if (existingUser) {
          throw new ConflictError(AUTH_MESSAGES.EMAIL_TAKEN);
        }
      }

      const updatedUser = await this.usersService.updateProfile(userId, {
        ...(data.name && { name: data.name }),
        ...(data.email && { email: data.email }),
      });

      // updateProfile devuelve el User completo (incl. password) — mismo filtro
      // explícito que getUserProfile, nunca se castea el objeto entero.
      return {
        id: updatedUser.id,
        email: updatedUser.email,
        name: updatedUser.name,
        createdAt: updatedUser.createdAt,
      };
    } catch (error) {
      return logger.fail(error, 'No se pudo actualizar el perfil del usuario {}', userId);
    }
  }

  async changePassword(userId: string, data: ChangePasswordInput): Promise<{ message: string }> {
    try {
      const user = await this.usersService.findUserById(userId);

      if (!user) {
        throw new NotFoundError(AUTH_MESSAGES.USER_NOT_FOUND);
      }

      // Verify current password
      const isValidPassword = await bcrypt.compare(data.currentPassword, user.password);

      if (!isValidPassword) {
        throw new ValidationError(SETTINGS_MESSAGES.INVALID_CURRENT_PASSWORD);
      }

      // Hash new password
      const hashedPassword = await bcrypt.hash(data.newPassword, 10);

      await this.usersService.updatePassword(userId, hashedPassword);

      return { message: 'Password changed successfully' };
    } catch (error) {
      return logger.fail(error, 'No se pudo cambiar la contraseña del usuario {}', userId);
    }
  }

  async deleteUserAccount(userId: string, password: string): Promise<{ message: string }> {
    try {
      const user = await this.usersService.findUserById(userId);

      if (!user) {
        throw new NotFoundError(AUTH_MESSAGES.USER_NOT_FOUND);
      }

      // Verify password before deletion
      const isValidPassword = await bcrypt.compare(password, user.password);

      if (!isValidPassword) {
        throw new ValidationError(SETTINGS_MESSAGES.INVALID_PASSWORD);
      }

      // Delete user (cascade will delete all related data)
      await this.usersService.deleteUser(userId);

      return { message: 'Account deleted successfully' };
    } catch (error) {
      return logger.fail(error, 'No se pudo eliminar la cuenta del usuario {}', userId);
    }
  }

  async getAccountStatistics(userId: string): Promise<AccountStatistics> {
    try {
      const [accountsCount, transactionsCount, categoriesCount, fixedExpensesCount, debtsCount] =
        await Promise.all([
          this.accountsService.countByUser(userId),
          this.transactionsService.countByUser(userId),
          this.categoriesService.countByUser(userId),
          this.fixedExpensesService.countByUser(userId),
          this.debtsService.countByUser(userId),
        ]);

      // Get first transaction date
      const firstTransaction = await this.transactionsService.getFirstTransactionDate(userId);

      return {
        accounts: accountsCount,
        transactions: transactionsCount,
        categories: categoriesCount,
        fixedExpenses: fixedExpensesCount,
        debts: debtsCount,
        memberSince: firstTransaction?.date || new Date(),
      };
    } catch (error) {
      return logger.fail(
        error,
        'No se pudieron obtener las estadisticas de cuenta del usuario {}',
        userId
      );
    }
  }
}
