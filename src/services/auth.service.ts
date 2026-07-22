import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import { RegisterInput, LoginInput } from '../schemas/auth.schema.js';
import { seedCategories } from '../lib/seed.js';
import type { UserRepository } from '../repositories/user.repository.port.js';
import { JWT_SECRET } from '../lib/env.js';
import type { AuthService, AuthResult, MeResult } from './auth.service.port.js';

const SALT_ROUNDS = 10;

export class AuthServiceImpl implements AuthService {
  constructor(private userRepo: UserRepository) {}

  async register(data: RegisterInput): Promise<AuthResult> {
    const existingUser = await this.userRepo.findByEmail(data.email);

    if (existingUser) {
      throw new Error('El email ya está registrado');
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
      expiresIn: '7d',
    });

    return {
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
      },
      token,
    };
  }

  async login(data: LoginInput): Promise<AuthResult> {
    const user = await this.userRepo.findByEmail(data.email);

    if (!user) {
      throw new Error('Credenciales inválidas');
    }

    const validPassword = await bcrypt.compare(data.password, user.password);

    if (!validPassword) {
      throw new Error('Credenciales inválidas');
    }

    const token = jwt.sign({ userId: user.id, email: user.email }, JWT_SECRET, {
      expiresIn: '7d',
    });

    return {
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
      },
      token,
    };
  }

  async getMe(userId: string): Promise<MeResult> {
    const user = await this.userRepo.findById(userId, {
      id: true,
      email: true,
      name: true,
      createdAt: true,
    });

    if (!user) {
      throw new Error('Usuario no encontrado');
    }

    return user as unknown as MeResult;
  }
}
