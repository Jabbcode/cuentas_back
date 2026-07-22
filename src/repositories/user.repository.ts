import { prisma } from '../lib/prisma.js';
import type { Prisma, User, PrismaClient } from '@prisma/client';
import type { UserRepository } from './user.repository.port.js';

export class UserRepositoryImpl implements UserRepository {
  constructor(private prisma: PrismaClient) {}

  async findByEmail(email: string): Promise<User | null> {
    return this.prisma.user.findUnique({ where: { email } });
  }

  async findById(id: string, select?: Prisma.UserSelect): Promise<User | null> {
    return this.prisma.user.findUnique({ where: { id }, select }) as Promise<User | null>;
  }

  async findFirst(where: Prisma.UserWhereInput): Promise<User | null> {
    return this.prisma.user.findFirst({ where });
  }

  async findMany(where: Prisma.UserWhereInput, select?: Prisma.UserSelect): Promise<User[]> {
    return this.prisma.user.findMany({ where, select }) as Promise<User[]>;
  }

  async create(data: Prisma.UserCreateInput): Promise<User> {
    return this.prisma.user.create({ data });
  }

  async update(
    id: string,
    data: Prisma.UserUpdateInput,
    select?: Prisma.UserSelect
  ): Promise<User> {
    return this.prisma.user.update({ where: { id }, data, select }) as Promise<User>;
  }

  async remove(id: string): Promise<User> {
    return this.prisma.user.delete({ where: { id } });
  }
}

export async function findByEmail(email: string): Promise<User | null> {
  return prisma.user.findUnique({ where: { email } });
}

export async function findById(id: string, select?: Prisma.UserSelect): Promise<User | null> {
  return prisma.user.findUnique({ where: { id }, select }) as Promise<User | null>;
}

export async function findFirst(where: Prisma.UserWhereInput): Promise<User | null> {
  return prisma.user.findFirst({ where });
}

export async function findMany(
  where: Prisma.UserWhereInput,
  select?: Prisma.UserSelect
): Promise<User[]> {
  return prisma.user.findMany({ where, select }) as Promise<User[]>;
}

export async function create(data: Prisma.UserCreateInput): Promise<User> {
  return prisma.user.create({ data });
}

export async function update(
  id: string,
  data: Prisma.UserUpdateInput,
  select?: Prisma.UserSelect
): Promise<User> {
  return prisma.user.update({ where: { id }, data, select }) as Promise<User>;
}

export async function remove(id: string): Promise<User> {
  return prisma.user.delete({ where: { id } });
}
