import { prisma } from './lib/prisma.js';
import { AccountRepositoryImpl } from './repositories/account.repository.js';
import { UserRepositoryImpl } from './repositories/user.repository.js';
import { AccountsServiceImpl } from './services/accounts.service.js';
import { AuthServiceImpl } from './services/auth.service.js';

const accountRepository = new AccountRepositoryImpl(prisma);
export const accountsService = new AccountsServiceImpl(accountRepository, prisma);

const userRepository = new UserRepositoryImpl(prisma);
export const authService = new AuthServiceImpl(userRepository);
