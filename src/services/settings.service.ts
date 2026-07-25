import bcrypt from 'bcrypt';
import { UpdateProfileInput, ChangePasswordInput } from '../schemas/settings.schema.js';
import { NotFoundError, ConflictError, ValidationError } from '../lib/errors.js';
import type { UserRepository } from '../repositories/user.repository.port.js';
import type { AccountRepository } from '../repositories/account.repository.port.js';
import type { CategoryRepository } from '../repositories/category.repository.port.js';
import type { FixedExpenseRepository } from '../repositories/fixed-expense.repository.port.js';
import * as debtRepo from '../repositories/debt.repository.js';
import { AUTH_MESSAGES } from '../lib/constants/auth.constants.js';
import { SETTINGS_MESSAGES } from '../lib/constants/settings.constants.js';
import type { SettingsService, UserProfile, AccountStatistics } from './settings.service.port.js';
import type { TransactionsService } from './transactions.service.port.js';

export class SettingsServiceImpl implements SettingsService {
  constructor(
    private userRepo: UserRepository,
    private accountRepo: AccountRepository,
    private categoryRepo: CategoryRepository,
    private fixedExpenseRepo: FixedExpenseRepository,
    private transactionsService: TransactionsService
  ) {}

  async getUserProfile(userId: string): Promise<UserProfile> {
    const user = await this.userRepo.findById(userId, {
      id: true,
      email: true,
      name: true,
      createdAt: true,
    });

    if (!user) {
      throw new NotFoundError(AUTH_MESSAGES.USER_NOT_FOUND);
    }

    return user as unknown as UserProfile;
  }

  async updateUserProfile(userId: string, data: UpdateProfileInput): Promise<UserProfile> {
    // Check if email is being changed and if it's already taken
    if (data.email) {
      const existingUser = await this.userRepo.findFirst({
        email: data.email,
        NOT: { id: userId },
      });

      if (existingUser) {
        throw new ConflictError(AUTH_MESSAGES.EMAIL_TAKEN);
      }
    }

    const updatedUser = await this.userRepo.update(
      userId,
      { ...(data.name && { name: data.name }), ...(data.email && { email: data.email }) },
      { id: true, email: true, name: true, createdAt: true }
    );

    return updatedUser as unknown as UserProfile;
  }

  async changePassword(userId: string, data: ChangePasswordInput): Promise<{ message: string }> {
    const user = await this.userRepo.findById(userId);

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

    await this.userRepo.update(userId, { password: hashedPassword });

    return { message: 'Password changed successfully' };
  }

  async deleteUserAccount(userId: string, password: string): Promise<{ message: string }> {
    const user = await this.userRepo.findById(userId);

    if (!user) {
      throw new NotFoundError(AUTH_MESSAGES.USER_NOT_FOUND);
    }

    // Verify password before deletion
    const isValidPassword = await bcrypt.compare(password, user.password);

    if (!isValidPassword) {
      throw new ValidationError(SETTINGS_MESSAGES.INVALID_PASSWORD);
    }

    // Delete user (cascade will delete all related data)
    await this.userRepo.remove(userId);

    return { message: 'Account deleted successfully' };
  }

  async getAccountStatistics(userId: string): Promise<AccountStatistics> {
    const [accountsCount, transactionsCount, categoriesCount, fixedExpensesCount, debtsCount] =
      await Promise.all([
        this.accountRepo.countByUser(userId),
        this.transactionsService.countByUser(userId),
        this.categoryRepo.countByUser(userId),
        this.fixedExpenseRepo.countByUser(userId),
        debtRepo.countByUser(userId),
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
