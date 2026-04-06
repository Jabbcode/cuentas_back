import bcrypt from 'bcrypt';
import { prisma } from '../lib/prisma.js';
import { UpdateProfileInput, ChangePasswordInput } from '../schemas/settings.schema.js';

// Get user profile
export async function getUserProfile(userId: string) {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      id: true,
      email: true,
      name: true,
      createdAt: true,
    },
  });

  if (!user) {
    throw new Error('User not found');
  }

  return user;
}

// Update user profile
export async function updateUserProfile(userId: string, data: UpdateProfileInput) {
  // Check if email is being changed and if it's already taken
  if (data.email) {
    const existingUser = await prisma.user.findFirst({
      where: {
        email: data.email,
        NOT: { id: userId },
      },
    });

    if (existingUser) {
      throw new Error('Email is already in use');
    }
  }

  const updatedUser = await prisma.user.update({
    where: { id: userId },
    data: {
      ...(data.name && { name: data.name }),
      ...(data.email && { email: data.email }),
    },
    select: {
      id: true,
      email: true,
      name: true,
      createdAt: true,
    },
  });

  return updatedUser;
}

// Change password
export async function changePassword(userId: string, data: ChangePasswordInput) {
  const user = await prisma.user.findUnique({
    where: { id: userId },
  });

  if (!user) {
    throw new Error('User not found');
  }

  // Verify current password
  const isValidPassword = await bcrypt.compare(data.currentPassword, user.password);

  if (!isValidPassword) {
    throw new Error('Current password is incorrect');
  }

  // Hash new password
  const hashedPassword = await bcrypt.hash(data.newPassword, 10);

  await prisma.user.update({
    where: { id: userId },
    data: { password: hashedPassword },
  });

  return { message: 'Password changed successfully' };
}

// Delete user account
export async function deleteUserAccount(userId: string, password: string) {
  const user = await prisma.user.findUnique({
    where: { id: userId },
  });

  if (!user) {
    throw new Error('User not found');
  }

  // Verify password before deletion
  const isValidPassword = await bcrypt.compare(password, user.password);

  if (!isValidPassword) {
    throw new Error('Incorrect password');
  }

  // Delete user (cascade will delete all related data)
  await prisma.user.delete({
    where: { id: userId },
  });

  return { message: 'Account deleted successfully' };
}

// Get account statistics
export async function getAccountStatistics(userId: string) {
  const [
    accountsCount,
    transactionsCount,
    categoriesCount,
    fixedExpensesCount,
    debtsCount,
  ] = await Promise.all([
    prisma.account.count({ where: { userId } }),
    prisma.transaction.count({ where: { userId } }),
    prisma.category.count({ where: { userId } }),
    prisma.fixedExpense.count({ where: { userId } }),
    prisma.debt.count({ where: { userId } }),
  ]);

  // Get first transaction date
  const firstTransaction = await prisma.transaction.findFirst({
    where: { userId },
    orderBy: { date: 'asc' },
    select: { date: true },
  });

  return {
    accounts: accountsCount,
    transactions: transactionsCount,
    categories: categoriesCount,
    fixedExpenses: fixedExpensesCount,
    debts: debtsCount,
    memberSince: firstTransaction?.date || new Date(),
  };
}
