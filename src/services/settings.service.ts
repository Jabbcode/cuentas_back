import bcrypt from 'bcrypt';
import { UpdateProfileInput, ChangePasswordInput } from '../schemas/settings.schema.js';
import { NotFoundError, ConflictError, ValidationError } from '../lib/errors.js';
import { AUTH_MESSAGES } from '../lib/constants/auth.constants.js';
import { SETTINGS_MESSAGES } from '../lib/constants/settings.constants.js';
import type { SettingsService, UserProfile, AccountStatistics } from './settings.service.port.js';
import type { TransactionsService } from './transactions.service.port.js';
import type { UsersService } from './users.service.port.js';
import type { AccountsService } from './accounts.service.port.js';
import type { CategoriesService } from './categories.service.port.js';
import type { FixedExpensesService } from './fixed-expenses.service.port.js';
import type { DebtsService } from './debts.service.port.js';

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
    const user = await this.usersService.findUserById(userId);

    if (!user) {
      throw new NotFoundError(AUTH_MESSAGES.USER_NOT_FOUND);
    }

    // findUserById devuelve el User completo (incl. password) — se filtra
    // explícitamente antes de exponerlo, nunca se castea el objeto entero.
    return { id: user.id, email: user.email, name: user.name, createdAt: user.createdAt };
  }

  async updateUserProfile(userId: string, data: UpdateProfileInput): Promise<UserProfile> {
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
  }

  async changePassword(userId: string, data: ChangePasswordInput): Promise<{ message: string }> {
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
  }

  async deleteUserAccount(userId: string, password: string): Promise<{ message: string }> {
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
  }

  async getAccountStatistics(userId: string): Promise<AccountStatistics> {
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
  }
}
