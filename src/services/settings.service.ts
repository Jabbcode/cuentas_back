import bcrypt from 'bcrypt';
import { UpdateProfileInput, ChangePasswordInput } from '../schemas/settings.schema.js';
import { NotFoundError, ConflictError, ValidationError } from '../lib/errors.js';
import * as userRepo from '../repositories/user.repository.js';
import * as accountRepo from '../repositories/account.repository.js';
import * as transactionRepo from '../repositories/transaction.repository.js';
import * as categoryRepo from '../repositories/category.repository.js';
import * as fixedExpenseRepo from '../repositories/fixed-expense.repository.js';
import * as debtRepo from '../repositories/debt.repository.js';

// Get user profile
export async function getUserProfile(userId: string) {
  const user = await userRepo.findById(userId, {
    id: true,
    email: true,
    name: true,
    createdAt: true,
  });

  if (!user) {
    throw new NotFoundError('User not found');
  }

  return user;
}

// Update user profile
export async function updateUserProfile(userId: string, data: UpdateProfileInput) {
  // Check if email is being changed and if it's already taken
  if (data.email) {
    const existingUser = await userRepo.findFirst({ email: data.email, NOT: { id: userId } });

    if (existingUser) {
      throw new ConflictError('Email is already in use');
    }
  }

  const updatedUser = await userRepo.update(
    userId,
    { ...(data.name && { name: data.name }), ...(data.email && { email: data.email }) },
    { id: true, email: true, name: true, createdAt: true }
  );

  return updatedUser;
}

// Change password
export async function changePassword(userId: string, data: ChangePasswordInput) {
  const user = await userRepo.findById(userId);

  if (!user) {
    throw new NotFoundError('User not found');
  }

  // Verify current password
  const isValidPassword = await bcrypt.compare(data.currentPassword, user.password);

  if (!isValidPassword) {
    throw new ValidationError('Current password is incorrect');
  }

  // Hash new password
  const hashedPassword = await bcrypt.hash(data.newPassword, 10);

  await userRepo.update(userId, { password: hashedPassword });

  return { message: 'Password changed successfully' };
}

// Delete user account
export async function deleteUserAccount(userId: string, password: string) {
  const user = await userRepo.findById(userId);

  if (!user) {
    throw new NotFoundError('User not found');
  }

  // Verify password before deletion
  const isValidPassword = await bcrypt.compare(password, user.password);

  if (!isValidPassword) {
    throw new ValidationError('Incorrect password');
  }

  // Delete user (cascade will delete all related data)
  await userRepo.remove(userId);

  return { message: 'Account deleted successfully' };
}

// Get account statistics
export async function getAccountStatistics(userId: string) {
  const [accountsCount, transactionsCount, categoriesCount, fixedExpensesCount, debtsCount] =
    await Promise.all([
      accountRepo.countByUser(userId),
      transactionRepo.countByUser(userId),
      categoryRepo.countByUser(userId),
      fixedExpenseRepo.countByUser(userId),
      debtRepo.countByUser(userId),
    ]);

  // Get first transaction date
  const firstTransaction = await transactionRepo.findFirstByUser(userId, { date: 'asc' });

  return {
    accounts: accountsCount,
    transactions: transactionsCount,
    categories: categoriesCount,
    fixedExpenses: fixedExpensesCount,
    debts: debtsCount,
    memberSince: firstTransaction?.date || new Date(),
  };
}
