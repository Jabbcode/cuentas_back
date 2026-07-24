import type { Prisma, User } from '@prisma/client';
import type { UserRepository } from '../repositories/user.repository.port.js';
import type { UsersService } from './users.service.port.js';

export class UsersServiceImpl implements UsersService {
  constructor(private userRepo: UserRepository) {}

  async findUserById(userId: string): Promise<User | null> {
    return this.userRepo.findById(userId);
  }

  async findDuplicateEmail(email: string, excludeUserId: string): Promise<User | null> {
    return this.userRepo.findFirst({ email, NOT: { id: excludeUserId } });
  }

  async getAllUsersForSummaries(): Promise<User[]> {
    return this.userRepo.findMany(
      {},
      { id: true, email: true, name: true, notificationPreferences: true }
    );
  }

  async updateNotificationPreferences(
    userId: string,
    preferences: Prisma.InputJsonValue
  ): Promise<User> {
    return this.userRepo.update(userId, { notificationPreferences: preferences });
  }

  async updateProfile(userId: string, data: { name?: string; email?: string }): Promise<User> {
    return this.userRepo.update(userId, data);
  }

  async updatePassword(userId: string, hashedPassword: string): Promise<User> {
    return this.userRepo.update(userId, { password: hashedPassword });
  }

  async deleteUser(userId: string): Promise<User> {
    return this.userRepo.remove(userId);
  }
}
