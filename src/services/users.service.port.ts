import type { Prisma, User } from '@prisma/client';

export interface UsersService {
  findUserById(userId: string): Promise<User | null>;
  findDuplicateEmail(email: string, excludeUserId: string): Promise<User | null>;
  getAllUsersForSummaries(): Promise<User[]>;
  updateNotificationPreferences(userId: string, preferences: Prisma.InputJsonValue): Promise<User>;
  updateProfile(userId: string, data: { name?: string; email?: string }): Promise<User>;
  updatePassword(userId: string, hashedPassword: string): Promise<User>;
  deleteUser(userId: string): Promise<User>;
}
