import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import { RegisterInput, LoginInput } from '../../schemas/auth.schema.js';
import { seedCategories } from '../../lib/seed.js';
import type { UserRepository } from '../../repositories/interfaces/user.repository.port.js';
import { JWT_SECRET } from '../../lib/env.js';
import { createLogger } from '../../lib/logger.js';
import type { AuthService, AuthResult, MeResult } from '../interfaces/auth.service.port.js';
import { JWT_EXPIRES_IN, AUTH_MESSAGES } from '../../lib/constants/auth.constants.js';

const SALT_ROUNDS = 10;
const logger = createLogger('AUTH');

/** Nunca loguear el email crudo: facilita enumeracion de cuentas desde los logs. */
function maskEmail(email: string): string {
  const [local, domain] = email.split('@');
  if (!domain) return '***';
  return `${local.slice(0, 1)}***@${domain}`;
}

export class AuthServiceImpl implements AuthService {
  constructor(private userRepo: UserRepository) {}

  async register(data: RegisterInput): Promise<AuthResult> {
    try {
      const existingUser = await this.userRepo.findByEmail(data.email);

      if (existingUser) {
        throw new Error(AUTH_MESSAGES.EMAIL_TAKEN);
      }

      const hashedPassword = await bcrypt.hash(data.password, SALT_ROUNDS);

      const user = await this.userRepo.create({
        email: data.email,
        password: hashedPassword,
        name: data.name,
      });

      // Create default categories for new user
      await seedCategories(user.id);

      const token = jwt.sign({ userId: user.id, email: user.email }, JWT_SECRET, {
        expiresIn: JWT_EXPIRES_IN,
      });

      return {
        user: {
          id: user.id,
          email: user.email,
          name: user.name,
        },
        token,
      };
    } catch (error) {
      return logger.fail(
        error,
        'No se pudo registrar el usuario con email {}',
        maskEmail(data.email)
      );
    }
  }

  async login(data: LoginInput): Promise<AuthResult> {
    try {
      const user = await this.userRepo.findByEmail(data.email);

      if (!user) {
        throw new Error(AUTH_MESSAGES.INVALID_CREDENTIALS);
      }

      const validPassword = await bcrypt.compare(data.password, user.password);

      if (!validPassword) {
        throw new Error(AUTH_MESSAGES.INVALID_CREDENTIALS);
      }

      const token = jwt.sign({ userId: user.id, email: user.email }, JWT_SECRET, {
        expiresIn: JWT_EXPIRES_IN,
      });

      return {
        user: {
          id: user.id,
          email: user.email,
          name: user.name,
        },
        token,
      };
    } catch (error) {
      return logger.fail(
        error,
        'No se pudo iniciar sesion para el email {}',
        maskEmail(data.email)
      );
    }
  }

  async getMe(userId: string): Promise<MeResult> {
    try {
      const user = await this.userRepo.findById(userId, {
        id: true,
        email: true,
        name: true,
        createdAt: true,
      });

      if (!user) {
        throw new Error(AUTH_MESSAGES.USER_NOT_FOUND);
      }

      return user as unknown as MeResult;
    } catch (error) {
      return logger.fail(error, 'No se pudo obtener el usuario {}', userId);
    }
  }
}
