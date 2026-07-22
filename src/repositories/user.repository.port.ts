import type { Prisma, User } from '@prisma/client';

export interface UserRepository {
  findByEmail(email: string): Promise<User | null>;
  findById(id: string, select?: Prisma.UserSelect): Promise<User | null>;
  findFirst(where: Prisma.UserWhereInput): Promise<User | null>;
  findMany(where: Prisma.UserWhereInput, select?: Prisma.UserSelect): Promise<User[]>;
  create(data: Prisma.UserCreateInput): Promise<User>;
  update(id: string, data: Prisma.UserUpdateInput, select?: Prisma.UserSelect): Promise<User>;
  remove(id: string): Promise<User>;
}
