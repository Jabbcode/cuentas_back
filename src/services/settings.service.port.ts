import type { UpdateProfileInput, ChangePasswordInput } from '../schemas/settings.schema.js';

export interface UserProfile {
  id: string;
  email: string;
  name: string;
  createdAt: Date;
}

export interface AccountStatistics {
  accounts: number;
  transactions: number;
  categories: number;
  fixedExpenses: number;
  debts: number;
  memberSince: Date;
}

export interface SettingsService {
  getUserProfile(userId: string): Promise<UserProfile>;
  updateUserProfile(userId: string, data: UpdateProfileInput): Promise<UserProfile>;
  changePassword(userId: string, data: ChangePasswordInput): Promise<{ message: string }>;
  deleteUserAccount(userId: string, password: string): Promise<{ message: string }>;
  getAccountStatistics(userId: string): Promise<AccountStatistics>;
}
