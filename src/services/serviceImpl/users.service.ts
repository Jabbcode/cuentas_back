import type { Prisma, User } from '@prisma/client';
import type { UserRepository } from '../../repositories/interfaces/user.repository.port.js';
import type { UsersService } from '../interfaces/users.service.port.js';
import { createLogger } from '../../lib/logger.js';

const logger = createLogger('USERS');

export class UsersServiceImpl implements UsersService {
  constructor(private userRepo: UserRepository) {}

  async findUserById(userId: string): Promise<User | null> {
    try {
      return await this.userRepo.findById(userId);
    } catch (error) {
      return logger.fail(error, 'No se pudo obtener el usuario {}', userId);
    }
  }

  async findDuplicateEmail(email: string, excludeUserId: string): Promise<User | null> {
    try {
      return await this.userRepo.findFirst({ email, NOT: { id: excludeUserId } });
    } catch (error) {
      return logger.fail(
        error,
        'No se pudo verificar email duplicado para el usuario {}',
        excludeUserId
      );
    }
  }

  async getAllUsersForSummaries(): Promise<User[]> {
    try {
      return await this.userRepo.findMany(
        {},
        { id: true, email: true, name: true, notificationPreferences: true }
      );
    } catch (error) {
      return logger.fail(error, 'No se pudo obtener el listado de usuarios para resumenes');
    }
  }

  async updateNotificationPreferences(
    userId: string,
    preferences: Prisma.InputJsonValue
  ): Promise<User> {
    try {
      return await this.userRepo.update(userId, { notificationPreferences: preferences });
    } catch (error) {
      return logger.fail(
        error,
        'No se pudieron actualizar las preferencias de notificacion del usuario {}',
        userId
      );
    }
  }

  async updateProfile(userId: string, data: { name?: string; email?: string }): Promise<User> {
    try {
      return await this.userRepo.update(userId, data);
    } catch (error) {
      return logger.fail(error, 'No se pudo actualizar el perfil del usuario {}', userId);
    }
  }

  async updatePassword(userId: string, hashedPassword: string): Promise<User> {
    try {
      return await this.userRepo.update(userId, { password: hashedPassword });
    } catch (error) {
      return logger.fail(error, 'No se pudo actualizar la contrasena del usuario {}', userId);
    }
  }

  async deleteUser(userId: string): Promise<User> {
    try {
      return await this.userRepo.remove(userId);
    } catch (error) {
      return logger.fail(error, 'No se pudo eliminar el usuario {}', userId);
    }
  }
}
